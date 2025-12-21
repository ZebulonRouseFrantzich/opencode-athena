/**
 * Info command
 *
 * Display current configuration and status.
 */

import chalk from "chalk";
import { CONFIG_PATHS, VERSION } from "../../shared/constants.js";
import type { AthenaConfig } from "../../shared/types.js";
import { FileManager } from "../utils/file-manager.js";
import { logger } from "../utils/logger.js";
import { checkPrerequisites, getInstalledPlugins } from "../utils/prerequisites.js";

/**
 * Main info command handler
 */
export async function info(): Promise<void> {
  logger.banner();

  const fileManager = new FileManager();

  // Load Athena config
  const athenaConfig = fileManager.readJsonFile<AthenaConfig>(CONFIG_PATHS.globalAthenaConfig);

  if (!athenaConfig) {
    logger.warn("OpenCode Athena is not installed.");
    logger.info(`Run ${chalk.cyan("opencode-athena install")} to get started.`);
    return;
  }

  // Version info
  logger.section("Version Information");
  logger.keyValue("Athena Version", athenaConfig.version || VERSION);

  // Prerequisites
  logger.section("Prerequisites");
  const prereqs = await checkPrerequisites();

  const nodeStatus = prereqs.node.installed
    ? prereqs.node.compatible
      ? chalk.green("✓")
      : chalk.yellow("!")
    : chalk.red("✖");
  logger.keyValue("Node.js", `${nodeStatus} ${prereqs.node.version || "not found"}`);

  const opencodeStatus = prereqs.opencode.installed
    ? prereqs.opencode.compatible
      ? chalk.green("✓")
      : chalk.yellow("!")
    : chalk.red("✖");
  logger.keyValue("OpenCode", `${opencodeStatus} ${prereqs.opencode.version || "not found"}`);

  // Subscriptions
  logger.section("Configured Providers");

  const claudeStatus = athenaConfig.subscriptions.claude.enabled
    ? chalk.green("enabled")
    : chalk.gray("disabled");
  logger.keyValue(
    "Claude",
    `${claudeStatus}${athenaConfig.subscriptions.claude.tier !== "none" ? ` (${athenaConfig.subscriptions.claude.tier})` : ""}`
  );

  const openaiStatus = athenaConfig.subscriptions.openai.enabled
    ? chalk.green("enabled")
    : chalk.gray("disabled");
  logger.keyValue("OpenAI", openaiStatus);

  const googleStatus = athenaConfig.subscriptions.google.enabled
    ? chalk.green("enabled")
    : chalk.gray("disabled");
  logger.keyValue(
    "Google",
    `${googleStatus}${athenaConfig.subscriptions.google.authMethod !== "none" ? ` (${athenaConfig.subscriptions.google.authMethod})` : ""}`
  );

  // Models
  logger.section("Agent Models");
  logger.keyValue("Sisyphus", athenaConfig.models.sisyphus);
  logger.keyValue("Oracle", athenaConfig.models.oracle);
  logger.keyValue("Librarian", athenaConfig.models.librarian);
  if (athenaConfig.models.frontend) {
    logger.keyValue("Frontend", athenaConfig.models.frontend);
  }
  if (athenaConfig.models.documentWriter) {
    logger.keyValue("Doc Writer", athenaConfig.models.documentWriter);
  }
  if (athenaConfig.models.multimodalLooker) {
    logger.keyValue("Multimodal", athenaConfig.models.multimodalLooker);
  }

  // BMAD settings
  logger.section("BMAD Settings");
  logger.keyValue("Default Track", athenaConfig.bmad.defaultTrack);
  logger.keyValue("Auto Status Update", athenaConfig.bmad.autoStatusUpdate ? "yes" : "no");
  logger.keyValue("Parallel Story Limit", athenaConfig.bmad.parallelStoryLimit.toString());

  // Features
  logger.section("Features");
  const features = athenaConfig.features;
  const featureList = [
    { name: "BMAD Bridge", enabled: features.bmadBridge },
    { name: "Auto Status", enabled: features.autoStatus },
    { name: "Parallel Exec", enabled: features.parallelExecution },
    { name: "Notifications", enabled: features.notifications },
    { name: "Context Monitor", enabled: features.contextMonitor },
    { name: "Comment Checker", enabled: features.commentChecker },
    { name: "LSP Tools", enabled: features.lspTools },
  ];

  for (const feature of featureList) {
    const status = feature.enabled ? chalk.green("on") : chalk.gray("off");
    logger.keyValue(feature.name, status);
  }

  // MCPs
  logger.section("MCP Servers");
  const mcps = athenaConfig.mcps;
  logger.keyValue("context7", mcps.context7 ? chalk.green("on") : chalk.gray("off"));
  logger.keyValue("exa", mcps.exa ? chalk.green("on") : chalk.gray("off"));
  logger.keyValue("grep_app", mcps.grepApp ? chalk.green("on") : chalk.gray("off"));

  // Installed plugins
  logger.section("Installed Plugins");
  const plugins = await getInstalledPlugins();

  if (Object.keys(plugins).length === 0) {
    logger.info("No plugins installed in OpenCode config directory");
  } else {
    for (const [name, version] of Object.entries(plugins)) {
      logger.keyValue(name, version);
    }
  }

  // Configuration paths
  logger.section("Configuration Paths");
  logger.keyValue("Config Dir", CONFIG_PATHS.globalConfigDir);
  logger.keyValue("Athena Config", CONFIG_PATHS.globalAthenaConfig);
  logger.keyValue("Commands Dir", CONFIG_PATHS.commandsDir);

  console.log();
}
