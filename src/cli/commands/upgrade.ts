import { exec } from "node:child_process";
import { promisify } from "node:util";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import semver from "semver";
import { VERSION } from "../../shared/constants.js";
import type { InstallAnswers, SubscriptionAnswers, UpgradeOptions } from "../../shared/types.js";
import { ConfigGenerator } from "../generators/config-generator.js";
import {
  detectNewFeatures,
  extractAdvanced,
  extractFeatures,
  extractMethodology,
  extractModels,
  extractSubscriptions,
  loadExistingConfigs,
} from "../utils/config-loader.js";
import { createBackups, mergeConfigs, writeMergedConfigs } from "../utils/config-merger.js";
import { FileManager } from "../utils/file-manager.js";
import { logger } from "../utils/logger.js";
import { migrateConfigs, migrateLegacyFiles } from "../utils/migrations/index.js";
import { getInstalledPlugins } from "../utils/prerequisites.js";

const execAsync = promisify(exec);

interface PackageUpdate {
  name: string;
  current: string;
  latest: string;
  updateAvailable: boolean;
}

type ReleaseChannel = "latest" | "beta" | "alpha";

function detectReleaseChannel(version: string): ReleaseChannel {
  if (version.includes("-beta")) return "beta";
  if (version.includes("-alpha")) return "alpha";
  return "latest";
}

async function getLatestVersion(
  packageName: string,
  tag: ReleaseChannel = "latest"
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`npm view ${packageName}@${tag} version`);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function checkPackageUpdate(name: string, currentVersion: string): Promise<PackageUpdate> {
  const latest = await getLatestVersion(name);
  const hasUpdate =
    latest !== null && semver.valid(latest) && semver.valid(currentVersion)
      ? semver.gt(latest, currentVersion)
      : latest !== null && latest !== currentVersion;
  return {
    name,
    current: currentVersion,
    latest: latest || currentVersion,
    updateAvailable: hasUpdate,
  };
}

export async function upgrade(options: UpgradeOptions): Promise<void> {
  logger.banner();

  const configs = loadExistingConfigs();

  if (!configs.athena) {
    logger.error("No existing Athena installation found.");
    logger.info(`Run ${chalk.cyan("opencode-athena install")} to install for the first time.`);
    process.exit(1);
  }

  const existingVersion = configs.athenaVersion || "0.0.1";

  logger.section("Checking for Updates");

  const spinner = ora("Checking package versions...").start();

  const installedPlugins = await getInstalledPlugins();

  const packagesToCheck = [
    "oh-my-opencode",
    "opencode-antigravity-auth",
    "opencode-openai-codex-auth",
  ];

  const updates: PackageUpdate[] = [];

  const athenaChannel = detectReleaseChannel(VERSION);
  const athenaLatest = await getLatestVersion("opencode-athena", athenaChannel);
  if (athenaLatest) {
    const athenaHasUpdate =
      semver.valid(athenaLatest) && semver.valid(VERSION)
        ? semver.gt(athenaLatest, VERSION)
        : athenaLatest !== VERSION;
    updates.push({
      name: "opencode-athena",
      current: VERSION,
      latest: athenaLatest,
      updateAvailable: athenaHasUpdate,
    });
  }

  for (const pkgName of packagesToCheck) {
    const currentVersion = installedPlugins[pkgName];
    if (currentVersion) {
      const updateInfo = await checkPackageUpdate(pkgName, currentVersion);
      updates.push(updateInfo);
    }
  }

  spinner.stop();

  logger.section("Package Versions");

  const updatesAvailable = updates.filter((u) => u.updateAvailable);

  for (const pkg of updates) {
    const status = pkg.updateAvailable
      ? chalk.yellow(`${pkg.current} -> ${pkg.latest}`)
      : chalk.green(pkg.current);
    logger.keyValue(pkg.name, status);
  }

  console.log();

  if (updatesAvailable.length === 0 && existingVersion === VERSION) {
    logger.success("All packages are up to date!");
    return;
  }

  if (updatesAvailable.length > 0) {
    logger.info(`${updatesAvailable.length} package update(s) available`);
  }

  const coercedExisting = semver.coerce(existingVersion);
  const coercedTarget = semver.coerce(VERSION);

  if (coercedExisting && coercedTarget && semver.lt(coercedExisting, coercedTarget)) {
    logger.info(`Configuration upgrade needed: ${existingVersion} -> ${VERSION}`);
  }

  if (options.check) {
    console.log();
    logger.info(
      `Run ${chalk.cyan("opencode-athena upgrade")} (without --check) to apply upgrades.`
    );
    return;
  }

  const actionCount = updatesAvailable.length + (existingVersion !== VERSION ? 1 : 0);
  if (actionCount === 0) {
    logger.success("Everything is up to date!");
    return;
  }

  if (!options.yes) {
    const proceed = await confirm({
      message: `Upgrade ${actionCount > 1 ? `${actionCount} item(s)` : "configuration"}?`,
      default: true,
    });

    if (!proceed) {
      logger.info("Upgrade cancelled.");
      process.exit(0);
    }
  }

  logger.section("Upgrading Configuration");

  console.log(chalk.cyan(`\nCurrent version: ${existingVersion}`));
  console.log(chalk.cyan(`New version: ${VERSION}\n`));

  const backupSpinner = ora("Creating backup...").start();
  const backups = createBackups();
  const backupCount = [backups.athenaBackup, backups.omoBackup, backups.opencodeBackup].filter(
    Boolean
  ).length;
  backupSpinner.succeed(`Created ${backupCount} backup file(s)`);

  const fileMigrationResult = migrateLegacyFiles();
  if (fileMigrationResult.stateFileMoved || fileMigrationResult.backupsMoved > 0) {
    const moved: string[] = [];
    if (fileMigrationResult.stateFileMoved) moved.push("state file");
    if (fileMigrationResult.backupsMoved > 0)
      moved.push(`${fileMigrationResult.backupsMoved} backup(s)`);
    console.log(chalk.gray(`  Migrated ${moved.join(", ")} to new athena/ directory`));
  }

  const migrationSpinner = ora("Applying migrations...").start();
  const migrationResult = migrateConfigs(configs.athena || {}, configs.omo || {}, existingVersion);

  if (migrationResult.migrationsApplied.length > 0) {
    migrationSpinner.succeed(`Applied ${migrationResult.migrationsApplied.length} migration(s)`);
    for (const migration of migrationResult.migrationsApplied) {
      console.log(chalk.gray(`  • ${migration}`));
    }
  } else {
    migrationSpinner.succeed("No migrations needed");
  }

  if (migrationResult.hasBreakingChanges && !options.yes) {
    console.log(chalk.yellow("\nBreaking changes detected:"));
    for (const warning of migrationResult.breakingChangeWarnings) {
      console.log(chalk.yellow(`  ⚠ ${warning}`));
    }

    const continueUpgrade = await confirm({
      message: "Continue with upgrade despite breaking changes?",
      default: false,
    });

    if (!continueUpgrade) {
      logger.info("Upgrade cancelled. Your backup files are preserved.");
      process.exit(0);
    }
  }

  const existingSubscriptions = extractSubscriptions(migrationResult.athenaConfig);
  const existingModels = extractModels(migrationResult.athenaConfig);
  const existingMethodology = extractMethodology(migrationResult.athenaConfig);
  const existingFeatures = extractFeatures(migrationResult.athenaConfig);
  const existingAdvanced = extractAdvanced(migrationResult.athenaConfig);

  logger.section("Preserved Configuration");

  if (existingSubscriptions) {
    console.log(chalk.bold("Subscriptions:"));
    if (existingSubscriptions.hasClaude)
      console.log(chalk.green(`  ✓ Claude (${existingSubscriptions.claudeTier})`));
    if (existingSubscriptions.hasOpenAI) console.log(chalk.green("  ✓ OpenAI"));
    if (existingSubscriptions.hasGoogle)
      console.log(chalk.green(`  ✓ Google (${existingSubscriptions.googleAuth})`));
    if (existingSubscriptions.hasGitHubCopilot)
      console.log(chalk.green(`  ✓ GitHub Copilot (${existingSubscriptions.copilotPlan})`));
  }

  if (existingModels) {
    console.log(chalk.bold("\nModel Assignments:"));
    console.log(chalk.green(`  ✓ Sisyphus: ${existingModels.sisyphus}`));
    console.log(chalk.green(`  ✓ Oracle: ${existingModels.oracle}`));
    console.log(chalk.green(`  ✓ Librarian: ${existingModels.librarian}`));
  }
  console.log();

  const newFeatures = detectNewFeatures(migrationResult.athenaConfig);

  if (newFeatures.length > 0 && !options.yes) {
    logger.section("New Features Available");

    for (const feature of newFeatures) {
      if (feature === "autoGitOperations") {
        const enable = await confirm({
          message: "Enable automatic git operations? (commits, pushes by agents)",
          default: false,
        });
        if (enable) {
          const migratedFeatures = migrationResult.athenaConfig.features as Record<string, unknown>;
          migratedFeatures.autoGitOperations = true;
        }
      }
    }
  }

  if (!existingSubscriptions) {
    logger.error("Could not extract subscription information from existing config.");
    logger.info("Please run with --reconfigure to set up from scratch.");
    process.exit(1);
  }

  const fullAnswers: InstallAnswers = {
    subscriptions: existingSubscriptions as SubscriptionAnswers,
    models: existingModels || {
      sisyphus: "",
      oracle: "",
      librarian: "",
    },
    methodology: existingMethodology || {
      defaultTrack: "bmad-method",
      autoStatusUpdate: true,
    },
    features: existingFeatures || {
      enabledFeatures: [],
      mcps: [],
    },
    advanced: existingAdvanced || {
      parallelStoryLimit: 3,
      experimental: [],
    },
    installLocation: "global",
  };

  const merged = mergeConfigs({
    existingAthena: migrationResult.athenaConfig,
    existingOmo: migrationResult.omoConfig,
    fullAnswers,
  });

  const writeSpinner = ora("Writing configuration...").start();
  writeMergedConfigs(merged);
  writeSpinner.succeed("Configuration files updated");

  logger.section("Updating Packages");

  const fileManager = new FileManager();

  const athenaUpdate = updatesAvailable.find((u) => u.name === "opencode-athena");
  if (athenaUpdate) {
    const athenaSpinner = ora("Updating opencode-athena...").start();
    try {
      const channel = detectReleaseChannel(VERSION);
      await fileManager.installDependencies([`opencode-athena@${channel}`]);
      athenaSpinner.succeed(`opencode-athena updated to ${athenaUpdate.latest}`);
    } catch (err) {
      athenaSpinner.fail("Failed to update opencode-athena");
      logger.error(err instanceof Error ? err.message : String(err));
    }
  } else {
    const generator = new ConfigGenerator(fullAnswers);
    const packages = generator.getRequiredPackages();

    const athenaPackage = packages.find((p) => p.startsWith("opencode-athena"));
    if (athenaPackage) {
      const athenaSpinner = ora("Installing opencode-athena...").start();
      try {
        const channel = detectReleaseChannel(VERSION);
        await fileManager.installDependencies([`opencode-athena@${channel}`]);
        athenaSpinner.succeed("opencode-athena installed");
      } catch (err) {
        athenaSpinner.fail("Failed to install opencode-athena");
        logger.error(err instanceof Error ? err.message : String(err));
      }
    }
  }

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
  } else {
    const generator = new ConfigGenerator(fullAnswers);
    const allPackages = generator.getRequiredPackages();
    const pluginPackages = allPackages.filter((p) => !p.startsWith("opencode-athena"));

    if (pluginPackages.length > 0) {
      const pluginSpinner = ora(`Installing plugins: ${pluginPackages.join(", ")}...`).start();
      try {
        await fileManager.installDependencies(pluginPackages);
        pluginSpinner.succeed(`Installed ${pluginPackages.length} plugin(s)`);
      } catch (err) {
        pluginSpinner.fail("Failed to install plugins");
        logger.error(err instanceof Error ? err.message : String(err));
      }
    }
  }

  const commandsSpinner = ora("Updating bridge commands...").start();
  try {
    const copiedCommands = await fileManager.copyCommands();
    commandsSpinner.succeed(`Updated ${copiedCommands.length} bridge commands`);
  } catch (_err) {
    commandsSpinner.warn("Could not update bridge commands");
  }

  logger.successBanner(`UPGRADED TO OPENCODE ATHENA ${VERSION}!`);

  if (backups.athenaBackup || backups.omoBackup || backups.opencodeBackup) {
    console.log(chalk.gray("\nBackups saved:"));
    if (backups.athenaBackup) console.log(chalk.gray(`  • ${backups.athenaBackup}`));
    if (backups.omoBackup) console.log(chalk.gray(`  • ${backups.omoBackup}`));
    if (backups.opencodeBackup) console.log(chalk.gray(`  • ${backups.opencodeBackup}`));
  }

  console.log(chalk.gray("\nRestart OpenCode to use the upgraded configuration."));
  console.log();
}
