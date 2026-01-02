/**
 * Provider management command
 *
 * Subcommands:
 * - (no subcommand): Show status
 * - add: Add a provider
 * - remove: Remove a provider
 * - refresh: Re-evaluate model defaults
 * - sync: Sync with OpenCode auth state
 */

import { select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { detectAuthStatus } from "../utils/auth-detector.js";
import { extractSubscriptions, loadExistingConfigs } from "../utils/config-loader.js";
import { logger } from "../utils/logger.js";

type ProviderAction = "status" | "add" | "remove" | "refresh" | "sync";

export interface ProvidersOptions {
  action?: ProviderAction;
}

export async function providers(options: ProvidersOptions): Promise<void> {
  const action = options.action || "status";

  switch (action) {
    case "status":
      await showStatus();
      break;
    case "add":
      await addProvider();
      break;
    case "remove":
      await removeProvider();
      break;
    case "refresh":
      await refreshDefaults();
      break;
    case "sync":
      await syncWithAuth();
      break;
  }
}

async function showStatus(): Promise<void> {
  logger.banner();
  logger.section("Provider Status");

  const configs = loadExistingConfigs();
  if (!configs.athena) {
    logger.error("No Athena configuration found. Run 'opencode-athena install' first.");
    process.exit(1);
  }

  const subscriptions = extractSubscriptions(configs.athena);
  if (!subscriptions) {
    logger.error("Could not read subscription configuration.");
    process.exit(1);
  }

  const spinner = ora("Checking authentication status...").start();
  const authStatus = await detectAuthStatus();
  spinner.stop();

  console.log(chalk.bold("\nConfigured Providers:\n"));

  displayProvider(
    "Claude",
    subscriptions.hasClaude,
    subscriptions.claudeTier,
    authStatus.anthropic
  );
  displayProvider("OpenAI", subscriptions.hasOpenAI, undefined, authStatus.openai);
  displayProvider("Google", subscriptions.hasGoogle, subscriptions.googleAuth, authStatus.google);
  displayProvider(
    "GitHub Copilot",
    subscriptions.hasGitHubCopilot,
    subscriptions.copilotPlan,
    authStatus.githubCopilot
  );

  const models = configs.athena.models as Record<string, string>;
  if (models) {
    console.log(chalk.bold("\nCurrent Model Assignments:\n"));
    console.log(`  ${chalk.cyan("Sisyphus:")}      ${models.sisyphus || "not set"}`);
    console.log(`  ${chalk.cyan("Oracle:")}        ${models.oracle || "not set"}`);
    console.log(`  ${chalk.cyan("Librarian:")}     ${models.librarian || "not set"}`);
    console.log(`  ${chalk.cyan("Frontend:")}      ${models.frontend || "not set"}`);
    console.log(`  ${chalk.cyan("Doc Writer:")}    ${models.documentWriter || "not set"}`);
    console.log(`  ${chalk.cyan("Multimodal:")}    ${models.multimodalLooker || "not set"}`);
  }

  if (!authStatus.anthropic && subscriptions.hasClaude) {
    console.log(chalk.yellow("\n⚠ Tip: Run 'opencode auth login' to authenticate Claude"));
  }
  if (!authStatus.openai && subscriptions.hasOpenAI) {
    console.log(chalk.yellow("⚠ Tip: Run 'opencode auth login' to authenticate OpenAI"));
  }
  if (!authStatus.google && subscriptions.hasGoogle) {
    console.log(chalk.yellow("⚠ Tip: Run 'opencode auth login' to authenticate Google"));
  }
  if (!authStatus.githubCopilot && subscriptions.hasGitHubCopilot) {
    console.log(chalk.yellow("⚠ Tip: Run 'opencode auth login' to authenticate GitHub Copilot"));
  }

  console.log();
}

function displayProvider(
  name: string,
  enabled: boolean,
  tier: string | undefined,
  authenticated: boolean
): void {
  const status = enabled ? chalk.green("✓ Enabled") : chalk.gray("✗ Disabled");
  const auth = enabled
    ? authenticated
      ? chalk.green("✓ Authenticated")
      : chalk.yellow("⚠ Not authenticated")
    : chalk.gray("(disabled)");
  const tierText = tier && tier !== "none" ? chalk.gray(` (${tier})`) : "";

  console.log(`  ${status.padEnd(30)} ${name}${tierText}`);
  console.log(`  ${" ".repeat(30)} Auth: ${auth}`);
}

async function addProvider(): Promise<void> {
  logger.banner();
  logger.section("Add Provider");

  const configs = loadExistingConfigs();
  if (!configs.athena) {
    logger.error("No Athena configuration found. Run 'opencode-athena install' first.");
    process.exit(1);
  }

  const currentSubs = extractSubscriptions(configs.athena);
  if (!currentSubs) {
    logger.error("Could not read subscription configuration.");
    process.exit(1);
  }

  const choices = [];
  if (!currentSubs.hasClaude) choices.push({ name: "Claude Pro/Max", value: "claude" });
  if (!currentSubs.hasOpenAI) choices.push({ name: "OpenAI ChatGPT Plus/Pro", value: "openai" });
  if (!currentSubs.hasGoogle) choices.push({ name: "Google/Gemini", value: "google" });
  if (!currentSubs.hasGitHubCopilot) choices.push({ name: "GitHub Copilot", value: "copilot" });

  if (choices.length === 0) {
    logger.info("All providers are already enabled.");
    return;
  }

  const provider = await select({
    message: "Which provider do you want to add?",
    choices,
  });

  const newSubs = { ...currentSubs };

  if (provider === "claude") {
    newSubs.hasClaude = true;
    newSubs.claudeTier = await select({
      message: "Which Claude tier?",
      choices: [
        { name: "Max 5x", value: "max5x" as const },
        { name: "Max 20x", value: "max20x" as const },
        { name: "Pro", value: "pro" as const },
      ],
    });
  } else if (provider === "openai") {
    newSubs.hasOpenAI = true;
  } else if (provider === "google") {
    newSubs.hasGoogle = true;
    newSubs.googleAuth = await select({
      message: "Google authentication method?",
      choices: [
        { name: "Google Workspace (Antigravity OAuth)", value: "antigravity" as const },
        { name: "Personal Google Account", value: "personal" as const },
        { name: "API Key", value: "api" as const },
      ],
    });
  } else if (provider === "copilot") {
    newSubs.hasGitHubCopilot = true;
    newSubs.copilotPlan = await select({
      message: "Which GitHub Copilot plan?",
      choices: [
        { name: "Enterprise", value: "enterprise" as const },
        { name: "Pro+", value: "pro-plus" as const },
        { name: "Pro", value: "pro" as const },
        { name: "Business", value: "business" as const },
        { name: "Free", value: "free" as const },
      ],
    });
  }

  logger.success(`Provider added: ${provider}`);
  console.log(chalk.gray("\nRun 'opencode-athena providers refresh' to update model defaults."));
}

async function removeProvider(): Promise<void> {
  logger.banner();
  logger.section("Remove Provider");

  logger.info("Not yet implemented.");
}

async function refreshDefaults(): Promise<void> {
  logger.banner();
  logger.section("Refresh Model Defaults");

  logger.info("Not yet implemented.");
}

async function syncWithAuth(): Promise<void> {
  logger.banner();
  logger.section("Sync with OpenCode Auth");

  logger.info("Not yet implemented.");
}
