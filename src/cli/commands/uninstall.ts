/**
 * Uninstall command
 *
 * Remove OpenCode Athena configuration and dependencies.
 */

import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import type { UninstallOptions } from "../../shared/types.js";
import { FileManager } from "../utils/file-manager.js";
import { logger } from "../utils/logger.js";

/**
 * Main uninstall command handler
 */
export async function uninstall(options: UninstallOptions): Promise<void> {
  logger.banner();

  logger.warn("This will remove OpenCode Athena from your system.");
  console.log();

  // Confirm uninstall
  const proceed = await confirm({
    message: "Are you sure you want to uninstall OpenCode Athena?",
    default: false,
  });

  if (!proceed) {
    logger.info("Uninstall cancelled.");
    return;
  }

  logger.section("Uninstalling OpenCode Athena");

  const fileManager = new FileManager();

  // Step 1: Remove bridge commands
  const commandsSpinner = ora("Removing bridge commands...").start();
  try {
    const removedCommands = await fileManager.removeCommands();
    if (removedCommands.length > 0) {
      commandsSpinner.succeed(`Removed ${removedCommands.length} bridge command(s)`);
    } else {
      commandsSpinner.info("No bridge commands found");
    }
  } catch (err) {
    commandsSpinner.fail("Failed to remove bridge commands");
    logger.error(err instanceof Error ? err.message : String(err));
  }

  // Step 2: Remove config files (unless --keep-config)
  if (!options.keepConfig) {
    const configSpinner = ora("Removing configuration files...").start();
    try {
      const removedFiles = await fileManager.removeConfigFiles();
      if (removedFiles.length > 0) {
        configSpinner.succeed(`Removed ${removedFiles.length} configuration file(s)`);
      } else {
        configSpinner.info("No Athena configuration files found");
      }
    } catch (err) {
      configSpinner.fail("Failed to remove configuration files");
      logger.error(err instanceof Error ? err.message : String(err));
    }
  } else {
    logger.info("Keeping configuration files (--keep-config)");
  }

  // Step 3: Remove from opencode.json
  const opencodeSpinner = ora("Updating opencode.json...").start();
  try {
    const updated = await fileManager.removeFromOpencodeConfig();
    if (updated) {
      opencodeSpinner.succeed("Removed Athena plugins from opencode.json");
    } else {
      opencodeSpinner.info("No Athena plugins found in opencode.json");
    }
  } catch (err) {
    opencodeSpinner.fail("Failed to update opencode.json");
    logger.error(err instanceof Error ? err.message : String(err));
  }

  // Step 4: Remove npm dependencies (unless --keep-deps)
  if (!options.keepDeps) {
    const depsSpinner = ora("Removing npm dependencies...").start();
    try {
      const packagesToRemove = [
        "oh-my-opencode",
        "opencode-antigravity-auth",
        "opencode-openai-codex-auth",
      ];
      await fileManager.uninstallDependencies(packagesToRemove);
      depsSpinner.succeed("Removed npm dependencies");
    } catch (_err) {
      depsSpinner.warn("Some dependencies could not be removed");
    }
  } else {
    logger.info("Keeping npm dependencies (--keep-deps)");
  }

  console.log();
  logger.success("OpenCode Athena has been uninstalled.");

  if (options.keepConfig) {
    logger.info("Configuration files were preserved.");
    logger.info(`Run ${chalk.cyan("opencode-athena install")} to reinstall with existing config.`);
  }

  console.log();
}
