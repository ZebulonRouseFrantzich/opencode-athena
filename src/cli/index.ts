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
  .option("-p, --preset <preset>", "Use a preset configuration", "standard")
  .option("-y, --yes", "Skip confirmation prompts", false)
  .option("--advanced", "Show advanced configuration options", false)
  .option("--global", "Install globally (default)", true)
  .option("--local", "Install to current project only", false)
  .action(install);

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

program.parse();
