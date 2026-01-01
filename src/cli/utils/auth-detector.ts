/**
 * Detect OpenCode authentication status
 *
 * Reads ~/.opencode.json to check which providers are authenticated.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AuthStatus {
  anthropic: boolean;
  openai: boolean;
  google: boolean;
  githubCopilot: boolean;
}

interface OpencodeConfig {
  providers?: Record<string, { apiKey?: string; disabled?: boolean }>;
}

export async function detectAuthStatus(): Promise<AuthStatus> {
  const opencodeConfigPath = join(homedir(), ".opencode.json");

  if (!existsSync(opencodeConfigPath)) {
    return {
      anthropic: false,
      openai: false,
      google: false,
      githubCopilot: false,
    };
  }

  try {
    const content = readFileSync(opencodeConfigPath, "utf-8");
    const config = JSON.parse(content) as OpencodeConfig;

    const providers = config.providers || {};

    return {
      anthropic: isProviderAuthenticated(providers, "anthropic"),
      openai: isProviderAuthenticated(providers, "openai"),
      google: isProviderAuthenticated(providers, "google"),
      githubCopilot: isProviderAuthenticated(providers, "github-copilot"),
    };
  } catch {
    return {
      anthropic: false,
      openai: false,
      google: false,
      githubCopilot: false,
    };
  }
}

function isProviderAuthenticated(
  providers: Record<string, { apiKey?: string; disabled?: boolean }>,
  providerName: string
): boolean {
  const provider = providers[providerName];
  if (!provider) return false;

  return provider.apiKey !== undefined && provider.apiKey !== "" && !provider.disabled;
}
