/**
 * Debug logger for CLI installer
 *
 * Enabled when ATHENA_DEBUG environment variable is set.
 * Outputs to stderr to avoid interfering with CLI output.
 */

const isDebugEnabled = (): boolean => {
  return process.env.ATHENA_DEBUG === "1" || process.env.ATHENA_DEBUG === "true";
};

export function debugLog(context: string, data: unknown): void {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toISOString();
  console.error(`[ATHENA_DEBUG ${timestamp}] ${context}:`, JSON.stringify(data, null, 2));
}

export function debugSection(title: string): void {
  if (!isDebugEnabled()) return;

  console.error(`\n${"=".repeat(60)}`);
  console.error(`  ${title}`);
  console.error(`${"=".repeat(60)}\n`);
}
