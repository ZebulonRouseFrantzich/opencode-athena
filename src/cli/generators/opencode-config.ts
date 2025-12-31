/**
 * OpenCode config generator
 *
 * Generates and updates the opencode.json configuration file.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { InstallAnswers } from "../../shared/types.js";

/**
 * Generate opencode.json configuration
 */
export async function generateOpencodeConfig(
  answers: InstallAnswers,
  configDir: string
): Promise<Record<string, unknown>> {
  // Load existing config if present
  const configPath = join(configDir, "opencode.json");
  let existingConfig: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      existingConfig = JSON.parse(content);
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  // Build plugin array
  const plugins: string[] = ["opencode-athena/plugin", "oh-my-opencode"];

  if (answers.subscriptions.hasGoogle && answers.subscriptions.googleAuth === "antigravity") {
    plugins.push("opencode-antigravity-auth");
  }

  if (answers.subscriptions.hasOpenAI) {
    plugins.push("opencode-openai-codex-auth");
  }

  // Merge with existing config
  const existingPlugins = (existingConfig.plugin as string[]) || [];
  const mergedPlugins = [...new Set([...existingPlugins, ...plugins])];

  const config: Record<string, unknown> = {
    ...existingConfig,
    $schema: existingConfig.$schema || "https://opencode.ai/config.json",
    plugin: mergedPlugins,
  };

  // Add provider configs if Claude subscription
  if (answers.subscriptions.hasClaude) {
    const existingProvider = (existingConfig.provider as Record<string, unknown>) || {};
    const existingAnthropic = (existingProvider.anthropic as Record<string, unknown>) || {};
    const existingAnthropicModels = (existingAnthropic.models as Record<string, unknown>) || {};

    config.provider = {
      ...existingProvider,
      anthropic: {
        ...existingAnthropic,
        models: {
          ...existingAnthropicModels,
          // Add thinking model variants
          "claude-opus-4-5-thinking": {
            id: "claude-opus-4-5",
            options: {
              thinking: {
                type: "enabled",
                budgetTokens: 32000,
              },
            },
          },
          "claude-sonnet-4-5-thinking": {
            id: "claude-sonnet-4-5",
            options: {
              thinking: {
                type: "enabled",
                budgetTokens: 10000,
              },
            },
          },
        },
      },
    };
  }

  // Add OpenAI provider config if present
  if (answers.subscriptions.hasOpenAI) {
    const existingProvider = (config.provider as Record<string, unknown>) || {};
    const existingOpenAI = (existingProvider.openai as Record<string, unknown>) || {};
    const existingOpenAIModels = (existingOpenAI.models as Record<string, unknown>) || {};

    config.provider = {
      ...existingProvider,
      openai: {
        ...existingOpenAI,
        models: {
          ...existingOpenAIModels,
          // Add reasoning effort configurations
          "gpt-5.1-high": {
            id: "gpt-5.1",
            options: {
              reasoningEffort: "high",
              reasoningSummary: "auto",
            },
          },
        },
      },
    };
  }

  // Add Google Antigravity provider config if present
  if (answers.subscriptions.hasGoogle && answers.subscriptions.googleAuth === "antigravity") {
    const existingProvider = (config.provider as Record<string, unknown>) || {};
    const existingGoogle = (existingProvider.google as Record<string, unknown>) || {};
    const existingGoogleModels = (existingGoogle.models as Record<string, unknown>) || {};

    config.provider = {
      ...existingProvider,
      google: {
        ...existingGoogle,
        models: {
          ...existingGoogleModels,
          // Gemini models
          "gemini-3-pro-high": {
            name: "Gemini 3 Pro High (Antigravity)",
            limit: {
              context: 1048576,
              output: 65535,
            },
            modalities: {
              input: ["text", "image", "pdf"],
              output: ["text"],
            },
          },
          "gemini-3-pro-low": {
            name: "Gemini 3 Pro Low (Antigravity)",
            limit: {
              context: 1048576,
              output: 65535,
            },
            modalities: {
              input: ["text", "image", "pdf"],
              output: ["text"],
            },
          },
          "gemini-3-flash": {
            name: "Gemini 3 Flash (Antigravity)",
            limit: {
              context: 1048576,
              output: 65536,
            },
            modalities: {
              input: ["text", "image", "pdf"],
              output: ["text"],
            },
          },
          // Claude models via Antigravity
          "claude-sonnet-4-5": {
            name: "Claude Sonnet 4.5 (Antigravity)",
            limit: {
              context: 200000,
              output: 64000,
            },
            modalities: {
              input: ["text", "image", "pdf"],
              output: ["text"],
            },
          },
          "claude-sonnet-4-5-thinking": {
            name: "Claude Sonnet 4.5 Thinking (Antigravity)",
            limit: {
              context: 200000,
              output: 64000,
            },
            modalities: {
              input: ["text", "image", "pdf"],
              output: ["text"],
            },
          },
          "claude-opus-4-5-thinking": {
            name: "Claude Opus 4.5 Thinking (Antigravity)",
            limit: {
              context: 200000,
              output: 64000,
            },
            modalities: {
              input: ["text", "image", "pdf"],
              output: ["text"],
            },
          },
          // GPT models via Antigravity
          "gpt-oss-120b-medium": {
            name: "GPT-OSS 120B Medium (Antigravity)",
            limit: {
              context: 131072,
              output: 32768,
            },
            modalities: {
              input: ["text", "image", "pdf"],
              output: ["text"],
            },
          },
        },
      },
    };
  }

  return config;
}

/**
 * Get the list of plugins to install based on answers
 */
export function getRequiredPlugins(answers: InstallAnswers): string[] {
  const plugins: string[] = ["opencode-athena", "oh-my-opencode"];

  if (answers.subscriptions.hasGoogle && answers.subscriptions.googleAuth === "antigravity") {
    plugins.push("opencode-antigravity-auth");
  }

  if (answers.subscriptions.hasOpenAI) {
    plugins.push("opencode-openai-codex-auth");
  }

  return plugins;
}
