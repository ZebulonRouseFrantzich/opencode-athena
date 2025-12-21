/**
 * Update command
 *
 * Check for and apply updates to OpenCode Athena and its dependencies.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { VERSION } from "../../shared/constants.js";
import type { UpdateOptions } from "../../shared/types.js";
import { FileManager } from "../utils/file-manager.js";
import { logger } from "../utils/logger.js";
import { getInstalledPlugins } from "../utils/prerequisites.js";

const execAsync = promisify(exec);

interface PackageUpdate {
  name: string;
  current: string;
  latest: string;
  updateAvailable: boolean;
}

/**
 * Check npm registry for latest version of a package
 */
async function getLatestVersion(packageName: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`npm view ${packageName} version`);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get update information for a package
 */
async function checkPackageUpdate(name: string, currentVersion: string): Promise<PackageUpdate> {
  const latest = await getLatestVersion(name);
  return {
    name,
    current: currentVersion,
    latest: latest || currentVersion,
    updateAvailable: latest !== null && latest !== currentVersion,
  };
}

/**
 * Main update command handler
 */
export async function update(options: UpdateOptions): Promise<void> {
  logger.banner();
  logger.section("Checking for Updates");

  const spinner = ora("Checking package versions...").start();

  // Get installed plugins
  const installedPlugins = await getInstalledPlugins();

  // Check for updates
  const packagesToCheck = [
    "oh-my-opencode",
    "opencode-antigravity-auth",
    "opencode-openai-codex-auth",
  ];

  const updates: PackageUpdate[] = [];

  // Check opencode-athena itself
  const athenaLatest = await getLatestVersion("opencode-athena");
  if (athenaLatest) {
    updates.push({
      name: "opencode-athena",
      current: VERSION,
      latest: athenaLatest,
      updateAvailable: athenaLatest !== VERSION,
    });
  }

  // Check installed plugins
  for (const pkgName of packagesToCheck) {
    const currentVersion = installedPlugins[pkgName];
    if (currentVersion) {
      const updateInfo = await checkPackageUpdate(pkgName, currentVersion);
      updates.push(updateInfo);
    }
  }

  spinner.stop();

  // Display results
  logger.section("Package Versions");

  const updatesAvailable = updates.filter((u) => u.updateAvailable);

  for (const pkg of updates) {
    const status = pkg.updateAvailable
      ? chalk.yellow(`${pkg.current} -> ${pkg.latest}`)
      : chalk.green(pkg.current);
    logger.keyValue(pkg.name, status);
  }

  console.log();

  if (updatesAvailable.length === 0) {
    logger.success("All packages are up to date!");
    return;
  }

  logger.info(`${updatesAvailable.length} update(s) available`);

  // If check only, stop here
  if (options.check) {
    console.log();
    logger.info(`Run ${chalk.cyan("opencode-athena update")} (without --check) to apply updates.`);
    return;
  }

  // Confirm update
  const proceed = await confirm({
    message: `Update ${updatesAvailable.length} package(s)?`,
    default: true,
  });

  if (!proceed) {
    logger.info("Update cancelled.");
    return;
  }

  // Apply updates
  logger.section("Applying Updates");

  const fileManager = new FileManager();

  // Update opencode-athena if needed
  const athenaUpdate = updatesAvailable.find((u) => u.name === "opencode-athena");
  if (athenaUpdate) {
    const athenaSpinner = ora("Updating opencode-athena...").start();
    try {
      await execAsync("npm install -g opencode-athena@latest");
      athenaSpinner.succeed(`opencode-athena updated to ${athenaUpdate.latest}`);
    } catch (err) {
      athenaSpinner.fail("Failed to update opencode-athena");
      logger.error(err instanceof Error ? err.message : String(err));
    }
  }

  // Update plugins
  const pluginUpdates = updatesAvailable.filter((u) => u.name !== "opencode-athena");
  if (pluginUpdates.length > 0) {
    const pluginSpinner = ora("Updating plugins...").start();
    try {
      const packages = pluginUpdates.map((u) => `${u.name}@latest`);
      await fileManager.installDependencies(packages);
      pluginSpinner.succeed(`Updated ${pluginUpdates.length} plugin(s)`);
    } catch (err) {
      pluginSpinner.fail("Failed to update plugins");
      logger.error(err instanceof Error ? err.message : String(err));
    }
  }

  // Copy latest commands
  const commandsSpinner = ora("Updating bridge commands...").start();
  try {
    await fileManager.copyCommands();
    commandsSpinner.succeed("Bridge commands updated");
  } catch (_err) {
    commandsSpinner.warn("Could not update bridge commands");
  }

  console.log();
  logger.success("Update complete!");
  logger.info("Restart OpenCode to use the updated version.");
}
