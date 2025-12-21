/**
 * Doctor command
 *
 * Diagnose and fix common issues with OpenCode Athena installation.
 */

import chalk from "chalk";
import ora from "ora";
import { CONFIG_PATHS } from "../../shared/constants.js";
import type { DoctorOptions } from "../../shared/types.js";
import { FileManager } from "../utils/file-manager.js";
import { logger } from "../utils/logger.js";
import { checkOhMyOpenCode, checkPrerequisites, validateJsonFile } from "../utils/prerequisites.js";
import { validateAthenaConfig, validateJsonConfig } from "../utils/validators.js";

interface DiagnosticResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fix?: () => Promise<void>;
}

/**
 * Main doctor command handler
 */
export async function doctor(options: DoctorOptions): Promise<void> {
  logger.banner();
  logger.section("Running Diagnostics");

  const results: DiagnosticResult[] = [];
  const fileManager = new FileManager();

  // Check 1: Node.js version
  const prereqs = await checkPrerequisites();

  results.push({
    name: "Node.js",
    status: prereqs.node.installed ? (prereqs.node.compatible ? "pass" : "warn") : "fail",
    message: prereqs.node.installed
      ? prereqs.node.compatible
        ? `Version ${prereqs.node.version} is compatible`
        : `Version ${prereqs.node.version} detected, 20+ recommended`
      : "Not installed",
  });

  // Check 2: OpenCode installation
  results.push({
    name: "OpenCode",
    status: prereqs.opencode.installed ? (prereqs.opencode.compatible ? "pass" : "warn") : "fail",
    message: prereqs.opencode.installed
      ? prereqs.opencode.compatible
        ? `Version ${prereqs.opencode.version} is compatible`
        : `Version ${prereqs.opencode.version} detected, 1.0.132+ recommended`
      : "Not installed",
  });

  // Check 3: Athena config exists and is valid
  const athenaConfigValid = validateJsonFile(CONFIG_PATHS.globalAthenaConfig);
  if (athenaConfigValid.valid) {
    const config = fileManager.readJsonFile(CONFIG_PATHS.globalAthenaConfig);
    const schemaValidation = validateAthenaConfig(config);
    results.push({
      name: "Athena Config",
      status: schemaValidation.valid ? "pass" : "warn",
      message: schemaValidation.valid
        ? "Valid configuration"
        : `Schema issues: ${schemaValidation.errors.join(", ")}`,
    });
  } else {
    results.push({
      name: "Athena Config",
      status: "fail",
      message: athenaConfigValid.error || "Not found",
      fix: async () => {
        logger.info("Run 'opencode-athena install' to create configuration");
      },
    });
  }

  // Check 4: OpenCode config exists and is valid
  const opencodeConfigValid = validateJsonConfig(CONFIG_PATHS.globalOpencodeConfig);
  results.push({
    name: "OpenCode Config",
    status: opencodeConfigValid.valid ? "pass" : "fail",
    message: opencodeConfigValid.valid ? "Valid JSON" : opencodeConfigValid.errors[0] || "Invalid",
  });

  // Check 5: oh-my-opencode config exists and is valid
  const omoConfigValid = validateJsonConfig(CONFIG_PATHS.globalOmoConfig);
  results.push({
    name: "oh-my-opencode Config",
    status: omoConfigValid.valid ? "pass" : "warn",
    message: omoConfigValid.valid ? "Valid JSON" : omoConfigValid.errors[0] || "Not found",
  });

  // Check 6: oh-my-opencode is installed
  const omoInstalled = await checkOhMyOpenCode();
  results.push({
    name: "oh-my-opencode Plugin",
    status: omoInstalled.installed ? "pass" : "fail",
    message: omoInstalled.installed ? `Version ${omoInstalled.version}` : "Not installed",
    fix: async () => {
      const spinner = ora("Installing oh-my-opencode...").start();
      try {
        await fileManager.installDependencies(["oh-my-opencode"]);
        spinner.succeed("oh-my-opencode installed");
      } catch (err) {
        spinner.fail("Failed to install oh-my-opencode");
        throw err;
      }
    },
  });

  // Check 7: Commands directory exists
  const commandsDirExists = fileManager.exists(CONFIG_PATHS.commandsDir);
  results.push({
    name: "Commands Directory",
    status: commandsDirExists ? "pass" : "warn",
    message: commandsDirExists ? "Exists" : "Not found",
    fix: async () => {
      const spinner = ora("Creating commands directory...").start();
      try {
        await fileManager.ensureDir(CONFIG_PATHS.commandsDir);
        await fileManager.copyCommands();
        spinner.succeed("Commands directory created and populated");
      } catch (err) {
        spinner.fail("Failed to create commands directory");
        throw err;
      }
    },
  });

  // Display results
  logger.section("Diagnostic Results");

  let hasFailures = false;
  let hasWarnings = false;
  const fixableIssues: DiagnosticResult[] = [];

  for (const result of results) {
    let icon: string;
    let color: (s: string) => string;

    switch (result.status) {
      case "pass":
        icon = "✓";
        color = chalk.green;
        break;
      case "warn":
        icon = "!";
        color = chalk.yellow;
        hasWarnings = true;
        break;
      case "fail":
        icon = "✖";
        color = chalk.red;
        hasFailures = true;
        if (result.fix) {
          fixableIssues.push(result);
        }
        break;
    }

    console.log(`  ${color(icon)} ${result.name}: ${result.message}`);
  }

  console.log();

  // Summary
  if (hasFailures) {
    logger.error("Some checks failed.");

    if (fixableIssues.length > 0 && options.fix) {
      logger.section("Applying Fixes");

      for (const issue of fixableIssues) {
        if (issue.fix) {
          try {
            await issue.fix();
          } catch (err) {
            logger.error(
              `Failed to fix ${issue.name}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      }

      logger.blank();
      logger.info("Run 'opencode-athena doctor' again to verify fixes.");
    } else if (fixableIssues.length > 0) {
      logger.info(`Run ${chalk.cyan("opencode-athena doctor --fix")} to attempt automatic fixes.`);
    }
  } else if (hasWarnings) {
    logger.warn("Some checks have warnings, but Athena should work.");
  } else {
    logger.success("All checks passed! OpenCode Athena is healthy.");
  }
}
