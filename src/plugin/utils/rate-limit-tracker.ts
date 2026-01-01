/**
 * Rate Limit Tracker
 *
 * Tracks rate-limited providers and their retry times.
 */

interface RateLimitInfo {
  provider: string;
  modelId: string;
  retryAfterMs: number | null;
  defaultRetryMs: number;
  timestamp: number;
  cleared: boolean;
}

class RateLimitTracker {
  private limits: Map<string, RateLimitInfo> = new Map();

  recordLimit(
    provider: string,
    modelId: string,
    retryAfterMs: number | null,
    defaultRetryMs: number
  ): void {
    const key = `${provider}:${modelId}`;

    this.limits.set(key, {
      provider,
      modelId,
      retryAfterMs,
      defaultRetryMs,
      timestamp: Date.now(),
      cleared: false,
    });
  }

  isRateLimited(provider: string, modelId: string): boolean {
    const key = `${provider}:${modelId}`;
    const limit = this.limits.get(key);

    if (!limit || limit.cleared) return false;

    const effectiveRetryMs = limit.retryAfterMs ?? limit.defaultRetryMs;
    const elapsed = Date.now() - limit.timestamp;

    return elapsed < effectiveRetryMs;
  }

  getTimeUntilClear(provider: string, modelId: string): number {
    const key = `${provider}:${modelId}`;
    const limit = this.limits.get(key);

    if (!limit) return 0;

    const effectiveRetryMs = limit.retryAfterMs ?? limit.defaultRetryMs;
    const elapsed = Date.now() - limit.timestamp;
    const remaining = effectiveRetryMs - elapsed;

    return Math.max(0, remaining);
  }

  clearLimit(provider: string, modelId: string): void {
    const key = `${provider}:${modelId}`;
    const limit = this.limits.get(key);

    if (limit) {
      limit.cleared = true;
    }
  }

  getActiveLimits(): RateLimitInfo[] {
    return Array.from(this.limits.values()).filter((limit) => !limit.cleared);
  }
}

export const rateLimitTracker = new RateLimitTracker();
