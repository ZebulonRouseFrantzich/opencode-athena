/**
 * Cross-platform notification utility
 *
 * Sends desktop notifications on macOS/Linux, falls back to console on Windows.
 */

import { platform } from "node:os";
import type { PluginInput } from "@opencode-ai/plugin";

type ShellExecutor = PluginInput["$"];

/**
 * Send a desktop notification
 *
 * Platform support:
 * - macOS: Uses osascript (built-in)
 * - Linux: Uses notify-send (requires libnotify)
 * - Windows: Falls back to console.log
 *
 * @param message - The notification message
 * @param title - The notification title
 * @param $ - Shell executor from plugin context
 */
export async function sendNotification(
  message: string,
  title: string,
  $: ShellExecutor
): Promise<void> {
  const os = platform();

  try {
    if (os === "darwin") {
      // macOS - use osascript (built-in)
      await $`osascript -e ${"display notification \"" + escapeAppleScript(message) + "\" with title \"" + escapeAppleScript(title) + "\""}`;
    } else if (os === "linux") {
      // Linux - use notify-send (requires libnotify)
      await $`notify-send ${title} ${message}`;
    } else {
      // Windows and others - fall back to console
      logNotification(title, message);
    }
  } catch {
    // Silently fall back to console if notification fails
    logNotification(title, message);
  }
}

/**
 * Escape special characters for AppleScript strings
 */
function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Log notification to console as fallback
 */
function logNotification(title: string, message: string): void {
  console.log(`[${title}] ${message}`);
}
