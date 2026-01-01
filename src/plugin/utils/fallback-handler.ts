/**
 * Fallback Handler
 *
 * Handles provider fallback on rate limits with in-TUI notifications.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig, LLMProvider } from "../../shared/types.js";
import { rateLimitTracker } from "./rate-limit-tracker.js";
import { createPluginLogger } from "./plugin-logger.js";

const log = createPluginLogger("fallback-handler");

interface RateLimitError {
  provider: string;
  modelId: string;
  retryAfter?: number;
}

export async function handleRateLimit(
  error: RateLimitError,
  config: AthenaConfig,
  ctx: PluginInput
): Promise<string | null> {
  const { provider, modelId, retryAfter } = error;
  const routing = config.routing;

  const retryAfterMs = retryAfter ? retryAfter * 1000 : null;
  const defaultRetryMs = routing.fallbackBehavior.retryPeriodMs;

  rateLimitTracker.recordLimit(provider, modelId, retryAfterMs, defaultRetryMs);

  const effectiveRetryMs = retryAfterMs ?? defaultRetryMs;
  const retrySeconds = Math.ceil(effectiveRetryMs / 1000);

  const nextProvider = getNextProvider(provider, modelId, routing);

  if (routing.fallbackBehavior.autoFallback && nextProvider) {
    await showFallbackNotification(ctx, modelId, nextProvider.modelId, retrySeconds, "info");

    scheduleRetryCheck(provider, modelId, effectiveRetryMs, ctx);

    return nextProvider.modelId;
  }

  if (routing.fallbackBehavior.notifyOnRateLimit) {
    await showRateLimitNotification(ctx, modelId, retrySeconds, nextProvider?.modelId);
  }

  return null;
}

async function showRateLimitNotification(
  ctx: PluginInput,
  modelId: string,
  retrySeconds: number,
  fallbackModel?: string
): Promise<void> {
  const fallbackText = fallbackModel ? `\n\nFallback available: ${fallbackModel}` : "";

  await ctx.client.tui
    .showToast({
      body: {
        title: "⚠️ Rate Limit Hit",
        message: `${modelId} rate limited.\nRetry in: ${retrySeconds}s${fallbackText}`,
        variant: "warning",
        duration: 10000,
      },
    })
    .catch(() => {});
}

async function showFallbackNotification(
  ctx: PluginInput,
  originalModel: string,
  fallbackModel: string,
  retrySeconds: number,
  variant: "info" | "warning"
): Promise<void> {
  await ctx.client.tui
    .showToast({
      body: {
        title: "🔄 Provider Fallback",
        message: `${originalModel} rate limited.\nUsing: ${fallbackModel}\n\nWill retry original in ${retrySeconds}s`,
        variant,
        duration: 5000,
      },
    })
    .catch(() => {});
}

async function showRestoredNotification(ctx: PluginInput, modelId: string): Promise<void> {
  await ctx.client.tui
    .showToast({
      body: {
        title: "✓ Provider Restored",
        message: `Switching back to ${modelId}`,
        variant: "success",
        duration: 3000,
      },
    })
    .catch(() => {});
}

function scheduleRetryCheck(
  provider: string,
  modelId: string,
  retryMs: number,
  ctx: PluginInput
): void {
  setTimeout(async () => {
    if (!rateLimitTracker.isRateLimited(provider, modelId)) {
      log.info("Rate limit cleared, provider restored", { provider, modelId });
      await showRestoredNotification(ctx, modelId);
    }
  }, retryMs);
}

function getNextProvider(
  currentProvider: string,
  modelId: string,
  routing: AthenaConfig["routing"]
): { provider: LLMProvider; modelId: string } | null {
  const parts = modelId.split("/");
  const modelFamily = parts.length > 1 ? parts[1] : parts[0];

  const familyType = getModelFamilyType(modelFamily);
  const priorityList = routing.modelFamilyPriority[familyType] || routing.providerPriority;

  const currentIndex = priorityList.findIndex((p) => p === currentProvider);
  if (currentIndex === -1) return null;

  for (let i = currentIndex + 1; i < priorityList.length; i++) {
    const nextProvider = priorityList[i];

    const nextModelId = `${nextProvider}/${modelFamily}`;
    if (!rateLimitTracker.isRateLimited(nextProvider, nextModelId)) {
      return { provider: nextProvider, modelId: nextModelId };
    }
  }

  return null;
}

function getModelFamilyType(modelFamily: string): "claude" | "gpt" | "gemini" {
  if (modelFamily.includes("claude")) return "claude";
  if (modelFamily.includes("gpt")) return "gpt";
  if (modelFamily.includes("gemini")) return "gemini";

  return "claude";
}
