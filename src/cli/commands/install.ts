/**
 * Install command
 *
 * Interactive installer for OpenCode Athena.
 */

import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { DEFAULTS } from "../../shared/constants.js";
import type { InstallAnswers, InstallOptions } from "../../shared/types.js";
import { ConfigGenerator } from "../generators/config-generator.js";
import {
  gatherAdvanced,
  gatherFeatures,
  gatherMethodology,
  gatherModels,
  gatherSubscriptions,
} from "../questions/index.js";
import { FileManager } from "../utils/file-manager.js";
import { logger } from "../utils/logger.js";
import { checkPrerequisites } from "../utils/prerequisites.js";

/**
 * Main install command handler
 */
export async function install(options: InstallOptions): Promise<void> {
  // Display banner
  logger.banner();

  // Step 1: Check prerequisites
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

  // Check for existing installation
  if (prereqs.athena.installed && !options.yes) {
    const overwrite = await confirm({
      message: `OpenCode Athena ${prereqs.athena.version || ""} is already installed. Overwrite configuration?`,
      default: false,
    });
    if (!overwrite) {
      logger.info("Installation cancelled.");
      process.exit(0);
    }
  }

  // Step 2: Gather subscription information
  logger.section("LLM Subscriptions");

  const subscriptions = await gatherSubscriptions();

  // Step 3: Model selection
  logger.section("Model Selection");

  const models = await gatherModels(subscriptions);

  // Step 4: Methodology preferences
  logger.section("Methodology Preferences");

  const methodology = await gatherMethodology();

  // Step 5: Feature selection
  logger.section("Feature Selection");

  const features = await gatherFeatures();

  // Step 6: Advanced options (optional)
  let advanced: { parallelStoryLimit?: number; experimental?: string[] } = {
    parallelStoryLimit: DEFAULTS.parallelStoryLimit,
    experimental: [],
  };

  if (options.advanced) {
    logger.section("Advanced Configuration");
    advanced = await gatherAdvanced();
  }

  // Step 7: Generate configuration
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

  // Step 8: Preview files
  console.log(chalk.bold("Files to be created/modified:\n"));
  for (const file of files) {
    const action = file.exists ? chalk.yellow("update") : chalk.green("create");
    console.log(chalk.gray(`  [${action}] ${file.path}`));
  }
  console.log();

  // Step 9: Confirm installation
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

  // Step 10: Install
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

  // Step 11: Print next steps
  printNextSteps(subscriptions);
}

/**
 * Print next steps after installation
 */
function printNextSteps(subscriptions: InstallAnswers["subscriptions"]): void {
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
