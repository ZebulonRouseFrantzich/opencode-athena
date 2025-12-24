/**
 * Install command
 *
 * Interactive installer for OpenCode Athena.
 * Supports presets for quick configuration.
 */

import { confirm, select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { DEFAULTS, VERSION } from "../../shared/constants.js";
import type { InstallAnswers, InstallOptions, SubscriptionAnswers } from "../../shared/types.js";
import { ConfigGenerator } from "../generators/config-generator.js";
import {
  gatherAdvanced,
  gatherFeatures,
  gatherMethodology,
  gatherModels,
  gatherSubscriptions,
  validatePresetModels,
} from "../questions/index.js";
import {
  type LoadedConfigs,
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
import { migrateConfigs } from "../utils/migrations/index.js";
import { checkPrerequisites } from "../utils/prerequisites.js";
import {
  PRESET_NAMES,
  type PresetConfig,
  type PresetDefaults,
  formatPresetSummary,
  isValidPresetName,
  listPresets,
  loadPreset,
  presetToDefaults,
} from "../utils/preset-loader.js";

type InstallMode = "fresh" | "upgrade" | "reconfigure";

interface ModeDetectionResult {
  mode: InstallMode;
  existingVersion?: string;
  configs?: LoadedConfigs;
}

function detectInstallMode(options: InstallOptions, configs: LoadedConfigs): ModeDetectionResult {
  if (options.reconfigure) {
    return { mode: "reconfigure" };
  }

  if (!configs.athena) {
    return { mode: "fresh" };
  }

  return {
    mode: "upgrade",
    existingVersion: configs.athenaVersion || "0.0.1",
    configs,
  };
}

async function runUpgradeFlow(
  configs: LoadedConfigs,
  existingVersion: string,
  options: InstallOptions
): Promise<void> {
  const { athena, omo } = configs;

  logger.section("Upgrading Configuration");

  console.log(chalk.cyan(`\nCurrent version: ${existingVersion}`));
  console.log(chalk.cyan(`New version: ${VERSION}\n`));

  if (!options.yes) {
    const proceed = await confirm({
      message: "Upgrade existing installation?",
      default: true,
    });

    if (!proceed) {
      logger.info("Upgrade cancelled.");
      process.exit(0);
    }
  }

  const spinner = ora("Creating backup...").start();
  const backups = createBackups();
  const backupCount = [backups.athenaBackup, backups.omoBackup, backups.opencodeBackup].filter(
    Boolean
  ).length;
  spinner.succeed(`Created ${backupCount} backup file(s)`);

  const migrationSpinner = ora("Applying migrations...").start();
  const migrationResult = migrateConfigs(athena || {}, omo || {}, existingVersion);

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
  const updatedFeatures = existingFeatures;

  if (newFeatures.length > 0 && !options.yes) {
    logger.section("New Features Available");

    for (const feature of newFeatures) {
      if (feature === "autoGitOperations") {
        const enable = await confirm({
          message: "Enable automatic git operations? (commits, pushes by agents)",
          default: false,
        });
        if (updatedFeatures) {
          if (enable) {
            updatedFeatures.enabledFeatures.push("auto-git");
          }
        }
      }
    }
  }

  let finalSubscriptions = existingSubscriptions;

  if (!options.yes) {
    const changeSubscriptions = await confirm({
      message: "Do you want to modify your LLM subscriptions?",
      default: false,
    });

    if (changeSubscriptions) {
      logger.section("LLM Subscriptions");
      finalSubscriptions = await gatherSubscriptions();
    }
  }

  if (!finalSubscriptions) {
    logger.error("Could not extract subscription information from existing config.");
    logger.info("Please run with --reconfigure to set up from scratch.");
    process.exit(1);
  }

  const fullAnswers: InstallAnswers = {
    subscriptions: finalSubscriptions,
    models: existingModels || {
      sisyphus: "",
      oracle: "",
      librarian: "",
    },
    methodology: existingMethodology || {
      defaultTrack: "bmad-method",
      autoStatusUpdate: true,
    },
    features: updatedFeatures || {
      enabledFeatures: [],
      mcps: [],
    },
    advanced: existingAdvanced || {
      parallelStoryLimit: 3,
      experimental: [],
    },
    installLocation: options.local ? "local" : "global",
  };

  const merged = mergeConfigs({
    existingAthena: migrationResult.athenaConfig,
    existingOmo: migrationResult.omoConfig,
    fullAnswers,
  });

  const writeSpinner = ora("Writing configuration...").start();
  writeMergedConfigs(merged);
  writeSpinner.succeed("Configuration files updated");

  const fileManager = new FileManager();
  const commandsSpinner = ora("Updating bridge commands...").start();
  const copiedCommands = await fileManager.copyCommands();
  commandsSpinner.succeed(`Updated ${copiedCommands.length} bridge commands`);

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

export async function install(options: InstallOptions): Promise<void> {
  logger.banner();

  const spinner = ora("Checking prerequisites...").start();

  const prereqs = await checkPrerequisites();

  if (!prereqs.node.installed) {
    spinner.fail("Node.js not found");
    logger.error("Please install Node.js 20+ first: https://nodejs.org/");
    process.exit(1);
  }

  if (!prereqs.node.compatible) {
    spinner.warn(`Node.js ${prereqs.node.version} detected. Recommended: 20+`);
  }

  if (!prereqs.opencode.installed) {
    spinner.fail("OpenCode not found");
    logger.error("Please install OpenCode first: https://opencode.ai/docs");
    process.exit(1);
  }

  if (!prereqs.opencode.compatible) {
    spinner.warn(`OpenCode ${prereqs.opencode.version} detected. Recommended: 1.0.132+`);
  } else {
    spinner.succeed(`OpenCode ${prereqs.opencode.version || ""} detected`);
  }

  const existingConfigs = loadExistingConfigs();
  const modeResult = detectInstallMode(options, existingConfigs);

  if (modeResult.mode === "upgrade" && modeResult.configs && modeResult.existingVersion) {
    await runUpgradeFlow(modeResult.configs, modeResult.existingVersion, options);
    return;
  }

  if (modeResult.mode === "reconfigure") {
    logger.info("Reconfiguring from scratch (--reconfigure flag)");
  }

  // Step 2: Handle preset loading
  let preset: PresetConfig | null = null;
  let presetDefaults: PresetDefaults | null = null;
  let presetName: string | null = null;

  // Validate and load preset from --preset flag
  if (options.preset && options.preset !== "none") {
    if (!isValidPresetName(options.preset)) {
      logger.error(`Invalid preset: "${options.preset}"`);
      logger.info(`Valid presets: ${PRESET_NAMES.join(", ")}`);
      process.exit(1);
    }

    try {
      preset = loadPreset(options.preset);
      presetDefaults = presetToDefaults(preset);
      presetName = options.preset;
      logger.success(`Loaded preset: ${options.preset}`);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  // If no preset specified via flag, ask interactively (unless --yes)
  if (!preset && !options.yes) {
    const selectedPreset = await askForPreset();
    if (selectedPreset) {
      preset = selectedPreset.preset;
      presetDefaults = presetToDefaults(preset);
      presetName = selectedPreset.name;
    }
  }

  // Step 3: Always gather subscription information (regardless of preset)
  logger.section("LLM Subscriptions");

  const subscriptions = await gatherSubscriptions();

  // Step 4: If preset loaded, show summary and ask if they want to customize
  let shouldCustomize = true;

  if (preset && presetDefaults && presetName) {
    // Check if preset models are compatible with subscriptions
    const modelWarnings = validatePresetModels(presetDefaults.models, subscriptions);
    if (modelWarnings.length > 0) {
      console.log(chalk.yellow("\nPreset model compatibility warnings:"));
      for (const warning of modelWarnings) {
        console.log(chalk.yellow(`  - ${warning}`));
      }
      console.log();
    }

    // Show preset summary
    console.log(chalk.bold("\nPreset Configuration:\n"));
    console.log(chalk.gray(formatPresetSummary(preset, presetName)));
    console.log();

    // Ask if they want to customize (unless --yes flag)
    if (options.yes) {
      shouldCustomize = false;
      logger.info("Using preset defaults (--yes flag)");
    } else {
      shouldCustomize = await confirm({
        message: "Would you like to customize these settings?",
        default: false,
      });
    }
  }

  // Step 5: Gather configuration (with preset defaults if available)
  let models: InstallAnswers["models"];
  let methodology: InstallAnswers["methodology"];
  let features: InstallAnswers["features"];
  let advanced: InstallAnswers["advanced"];

  if (!shouldCustomize && presetDefaults) {
    // Use preset defaults directly (validated against subscriptions)
    logger.section("Applying Preset Configuration");

    // For models, we still need to validate and potentially substitute
    const availableModels = await import("../questions/models.js").then((m) =>
      m.getAvailableModels(subscriptions)
    );

    // Fail early if no models are available
    if (availableModels.length === 0) {
      logger.error(
        "No models available. Please enable at least one provider (Claude, OpenAI, or Google)."
      );
      process.exit(1);
    }

    models = {
      sisyphus: getValidModelOrFirst(presetDefaults.models.sisyphus, availableModels),
      oracle: getValidModelOrFirst(presetDefaults.models.oracle, availableModels),
      librarian: getValidModelOrFirst(presetDefaults.models.librarian, availableModels),
      frontend: getValidModelOrFirst(presetDefaults.models.frontend, availableModels),
      documentWriter: getValidModelOrFirst(presetDefaults.models.documentWriter, availableModels),
      multimodalLooker: getValidModelOrFirst(
        presetDefaults.models.multimodalLooker,
        availableModels
      ),
    };

    methodology = presetDefaults.methodology;
    features = presetDefaults.features;
    advanced = presetDefaults.advanced;

    logger.success("Preset configuration applied");
  } else {
    // Interactive configuration (with preset defaults if available)

    // Model selection
    logger.section("Model Selection");
    models = await gatherModels(subscriptions, presetDefaults?.models);

    // Methodology preferences
    logger.section("Methodology Preferences");
    methodology = await gatherMethodology(presetDefaults?.methodology);

    // Feature selection
    logger.section("Feature Selection");
    features = await gatherFeatures(presetDefaults?.features);

    // Advanced options (optional, unless --advanced flag)
    if (options.advanced) {
      logger.section("Advanced Configuration");
      advanced = await gatherAdvanced(presetDefaults?.advanced);
    } else {
      advanced = presetDefaults?.advanced ?? {
        parallelStoryLimit: DEFAULTS.parallelStoryLimit,
        experimental: [],
      };
    }
  }

  // Step 6: Generate configuration
  logger.section("Generating Configuration");

  const answers: InstallAnswers = {
    subscriptions,
    models,
    methodology,
    features,
    advanced,
    installLocation: options.local ? "local" : "global",
  };

  const generator = new ConfigGenerator(answers);
  const files = await generator.generate();

  // Step 7: Preview files
  console.log(chalk.bold("Files to be created/modified:\n"));
  for (const file of files) {
    const action = file.exists ? chalk.yellow("update") : chalk.green("create");
    console.log(chalk.gray(`  [${action}] ${file.path}`));
  }
  console.log();

  // Step 8: Confirm installation
  if (!options.yes) {
    const proceed = await confirm({
      message: "Proceed with installation?",
      default: true,
    });

    if (!proceed) {
      logger.info("Installation cancelled.");
      process.exit(0);
    }
  }

  // Step 9: Install
  const installSpinner = ora("Installing OpenCode Athena...").start();

  try {
    const fileManager = new FileManager(generator.getConfigDir());

    // Write configuration files
    await fileManager.writeFiles(files);
    installSpinner.text = "Configuration files written...";

    // Install npm dependencies
    const packages = generator.getRequiredPackages();
    if (packages.length > 0) {
      installSpinner.text = `Installing dependencies: ${packages.join(", ")}...`;
      await fileManager.installDependencies(packages);
    }

    // Copy command files
    installSpinner.text = "Installing commands...";
    const copiedCommands = await fileManager.copyCommands();

    installSpinner.succeed("Installation complete!");

    if (copiedCommands.length > 0) {
      logger.info(`Installed ${copiedCommands.length} bridge commands`);
    }
  } catch (error) {
    installSpinner.fail("Installation failed");
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Step 10: Print next steps
  printNextSteps(subscriptions);
}

/**
 * Ask user if they want to start from a preset
 */
async function askForPreset(): Promise<{ preset: PresetConfig; name: string } | null> {
  const presets = listPresets();

  const choices = [
    { name: "No preset - Configure everything manually", value: "none" },
    ...presets.map((p) => ({
      name: `${p.name} - ${p.description}`,
      value: p.name,
    })),
  ];

  const selected = await select({
    message: "Start from a preset?",
    choices,
    default: "standard",
  });

  if (selected === "none") {
    return null;
  }

  try {
    const preset = loadPreset(selected);
    return { preset, name: selected };
  } catch (error) {
    logger.warn(`Failed to load preset: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get a valid model ID or fall back to the first available model
 */
function getValidModelOrFirst(
  modelId: string | undefined,
  availableModels: Array<{ id: string }>
): string {
  if (modelId && availableModels.some((m) => m.id === modelId)) {
    return modelId;
  }
  return availableModels[0]?.id ?? "";
}

/**
 * Print next steps after installation
 */
function printNextSteps(subscriptions: SubscriptionAnswers): void {
  const steps: string[] = [];

  if (subscriptions.hasClaude) {
    steps.push(`Run: ${chalk.cyan("opencode auth login")} -> Select Anthropic -> Claude Pro/Max`);
  }

  if (subscriptions.hasOpenAI) {
    steps.push(`Run: ${chalk.cyan("opencode auth login")} -> Select OpenAI -> ChatGPT Plus/Pro`);
  }

  if (subscriptions.hasGoogle) {
    steps.push(`Run: ${chalk.cyan("opencode auth login")} -> Select Google -> OAuth with Google`);
  }

  if (subscriptions.hasGitHubCopilot) {
    steps.push(`Run: ${chalk.cyan("opencode auth login")} -> Select GitHub Copilot`);
  }

  logger.successBanner("OPENCODE ATHENA INSTALLED SUCCESSFULLY!");

  console.log(chalk.bold("Next Steps:\n"));
  steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });

  console.log(chalk.bold("\nThen start OpenCode and try:\n"));
  console.log(`  ${chalk.cyan("/athena-dev")}      Implement a BMAD story with Sisyphus`);
  console.log(`  ${chalk.cyan("/athena-status")}   Check sprint status`);
  console.log(`  ${chalk.cyan("/athena-info")}     View toolkit configuration`);

  console.log(chalk.bold("\nFor BMAD project setup:\n"));
  console.log(`  ${chalk.cyan("npx bmad-method@alpha install")}   Install BMAD in your project`);

  console.log(
    chalk.gray("\nDocumentation: https://github.com/ZebulonRouseFrantzich/opencode-athena")
  );
  console.log();
}
