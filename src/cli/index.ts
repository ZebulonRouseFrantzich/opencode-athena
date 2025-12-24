/**
 * OpenCode Athena CLI
 *
 * Interactive installer and management tool for OpenCode Athena.
 */

import chalk from "chalk";
import { Command } from "commander";
import { DISPLAY_NAME, TAGLINE, VERSION } from "../shared/constants.js";
import { doctor } from "./commands/doctor.js";
import { info } from "./commands/info.js";
import { install } from "./commands/install.js";
import { uninstall } from "./commands/uninstall.js";
import { update } from "./commands/update.js";
import { listPresets } from "./utils/preset-loader.js";

const program = new Command();

program
  .name("opencode-athena")
  .description(
    `${chalk.cyan(DISPLAY_NAME)} - ${TAGLINE}\nUnified oh-my-opencode + BMAD METHOD toolkit for OpenCode`
  )
  .version(VERSION);

program
  .command("install")
  .description("Install and configure OpenCode Athena")
  .option(
    "-p, --preset <preset>",
    "Use a preset configuration (minimal, standard, enterprise, solo-quick)",
    "standard"
  )
  .option("-y, --yes", "Skip confirmation prompts", false)
  .option("--advanced", "Show advanced configuration options", false)
  .option("--global", "Install globally (default)", true)
  .option("--local", "Install to current project only", false)
  .option("--list-presets", "List available presets and exit", false)
  .option("--reconfigure", "Force full reconfiguration (ignore existing config)", false)
  .action(async (options) => {
    if (options.listPresets) {
      displayPresets();
      return;
    }
    await install(options);
  });

program
  .command("upgrade")
  .description("Upgrade OpenCode Athena configuration to latest version")
  .option("-y, --yes", "Skip confirmation prompts", false)
  .action(async (options) => {
    await install({ ...options, preset: undefined, advanced: false, global: true, local: false });
  });

program
  .command("update")
  .description("Update OpenCode Athena to latest version")
  .option("--check", "Check for updates without installing", false)
  .action(update);

program
  .command("doctor")
  .description("Diagnose and fix common issues")
  .option("--fix", "Automatically fix issues", false)
  .action(doctor);

program
  .command("uninstall")
  .description("Remove OpenCode Athena")
  .option("--keep-config", "Keep configuration files", false)
  .option("--keep-deps", "Keep npm dependencies", false)
  .action(uninstall);

program.command("info").description("Show current configuration and status").action(info);

/**
 * Display available presets in a formatted way
 */
function displayPresets(): void {
  console.log(chalk.bold.cyan("\nAvailable Presets:\n"));

  const presets = listPresets();

  for (const preset of presets) {
    console.log(chalk.bold(`  ${preset.name}`));
    console.log(chalk.gray(`    ${preset.description}`));
    console.log();
  }

  console.log(chalk.gray("Usage: opencode-athena install --preset <name>"));
  console.log(chalk.gray("       opencode-athena install --preset standard --yes\n"));
}

program.parse();
