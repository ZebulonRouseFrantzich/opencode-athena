/**
 * Plugin Logger - File-based logging for OpenCode Athena plugin runtime
 *
 * Follows oh-my-opencode logging pattern:
 * - Logs to temp file: ${TMPDIR}/opencode-athena.log
 * - Optional console output: ATHENA_DEBUG=1
 * - Silent failures to prevent breaking plugin execution
 */

import { appendFileSync, existsSync, statSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOG_FILE = join(tmpdir(), "opencode-athena.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024;

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PREFIXES: Record<LogLevel, string> = {
  debug: "[DEBUG]",
  info: "[INFO]",
  warn: "[WARN]",
  error: "[ERROR]",
};

function shouldLog(level: LogLevel): boolean {
  if (level === "warn" || level === "error") return true;
  return process.env.ATHENA_DEBUG === "1" || process.env.ATHENA_DEBUG === "true";
}

function shouldConsoleLog(): boolean {
  return process.env.ATHENA_DEBUG === "1" || process.env.ATHENA_DEBUG === "true";
}

function formatLogEntry(
  level: LogLevel,
  component: string,
  message: string,
  data?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const prefix = LEVEL_PREFIXES[level];
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  return `[${timestamp}] ${prefix} [${component}] ${message}${dataStr}\n`;
}

function rotateLogIfNeeded(): void {
  try {
    if (existsSync(LOG_FILE)) {
      const stats = statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        truncateSync(LOG_FILE, 0);
      }
    }
  } catch {
    // Silent - logging infrastructure should never break plugin
  }
}

function writeLog(entry: string): void {
  try {
    rotateLogIfNeeded();
    appendFileSync(LOG_FILE, entry);
  } catch {
    // Silent - logging infrastructure should never break plugin
  }
}

/**
 * Create a scoped logger for a specific component.
 * Public API - docstring required for discoverability.
 *
 * @example
 * const log = createPluginLogger("party-discussion");
 * log.debug("Starting session", { sessionId: "abc123" });
 */
export function createPluginLogger(component: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>): void => {
      if (!shouldLog("debug")) return;
      const entry = formatLogEntry("debug", component, message, data);
      writeLog(entry);
      if (shouldConsoleLog()) {
        console.debug(`[Athena:${component}] ${message}`, data ?? "");
      }
    },

    info: (message: string, data?: Record<string, unknown>): void => {
      if (!shouldLog("info")) return;
      const entry = formatLogEntry("info", component, message, data);
      writeLog(entry);
      if (shouldConsoleLog()) {
        console.info(`[Athena:${component}] ${message}`, data ?? "");
      }
    },

    warn: (message: string, data?: Record<string, unknown>): void => {
      const entry = formatLogEntry("warn", component, message, data);
      writeLog(entry);
      if (shouldConsoleLog()) {
        console.warn(`[Athena:${component}] ${message}`, data ?? "");
      }
    },

    error: (message: string, data?: Record<string, unknown>): void => {
      const entry = formatLogEntry("error", component, message, data);
      writeLog(entry);
      if (shouldConsoleLog()) {
        console.error(`[Athena:${component}] ${message}`, data ?? "");
      }
    },
  };
}

/** Returns log file path: ${TMPDIR}/opencode-athena.log */
export function getLogFilePath(): string {
  return LOG_FILE;
}

/** Truncates the log file to zero bytes */
export function clearLog(): void {
  try {
    if (existsSync(LOG_FILE)) {
      truncateSync(LOG_FILE, 0);
    }
  } catch {
    // Silent - logging infrastructure should never break plugin
  }
}
