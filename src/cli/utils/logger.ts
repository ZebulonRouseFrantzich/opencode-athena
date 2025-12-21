/**
 * Logger utility for CLI output
 *
 * Provides colored, consistent logging for the CLI.
 */

import chalk from "chalk";

export const logger = {
  /**
   * Log an informational message
   */
  info: (message: string): void => {
    console.log(chalk.blue("i"), message);
  },

  /**
   * Log a success message
   */
  success: (message: string): void => {
    console.log(chalk.green("✓"), message);
  },

  /**
   * Log a warning message
   */
  warn: (message: string): void => {
    console.log(chalk.yellow("!"), message);
  },

  /**
   * Log an error message
   */
  error: (message: string): void => {
    console.log(chalk.red("✖"), message);
  },

  /**
   * Log a debug message (only when DEBUG env var is set)
   */
  debug: (message: string): void => {
    if (process.env.DEBUG) {
      console.log(chalk.gray("[debug]"), message);
    }
  },

  /**
   * Log a step in a process
   */
  step: (step: number, total: number, message: string): void => {
    console.log(chalk.cyan(`[${step}/${total}]`), message);
  },

  /**
   * Log a blank line
   */
  blank: (): void => {
    console.log();
  },

  /**
   * Log a section header
   */
  section: (title: string): void => {
    console.log();
    console.log(chalk.bold(title));
    console.log();
  },

  /**
   * Log a key-value pair
   */
  keyValue: (key: string, value: string, indent = 0): void => {
    const padding = "  ".repeat(indent);
    console.log(`${padding}${chalk.gray(`${key}:`)} ${value}`);
  },

  /**
   * Log a list item
   */
  listItem: (item: string, indent = 0): void => {
    const padding = "  ".repeat(indent);
    console.log(`${padding}${chalk.gray("-")} ${item}`);
  },

  /**
   * Display the Athena banner
   */
  banner: (): void => {
    console.log(
      chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                     OPENCODE ATHENA                           ║
║          Strategic Wisdom Meets Practical Execution           ║
╠═══════════════════════════════════════════════════════════════╣
║  Unifying oh-my-opencode + BMAD METHOD for OpenCode           ║
╚═══════════════════════════════════════════════════════════════╝
`)
    );
  },

  /**
   * Display a success banner
   */
  successBanner: (message: string): void => {
    const line = "═".repeat(message.length + 4);
    console.log(
      chalk.green(`
╔${line}╗
║  ${message}  ║
╚${line}╝
`)
    );
  },
};
