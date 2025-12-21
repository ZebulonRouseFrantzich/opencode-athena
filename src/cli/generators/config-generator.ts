/**
 * Config Generator
 *
 * Orchestrates generation of all configuration files.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_PATHS } from "../../shared/constants.js";
import type { GeneratedFile, InstallAnswers } from "../../shared/types.js";
import { generateAthenaConfig } from "./athena-config.js";
import { generateOmoConfig } from "./omo-config.js";
import { generateOpencodeConfig, getRequiredPlugins } from "./opencode-config.js";

export class ConfigGenerator {
  private answers: InstallAnswers;
  private configDir: string;

  constructor(answers: InstallAnswers) {
    this.answers = answers;
    this.configDir =
      answers.installLocation === "local"
        ? join(process.cwd(), ".opencode")
        : CONFIG_PATHS.globalConfigDir;
  }

  /**
   * Get the configuration directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Generate all configuration files
   */
  async generate(): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate opencode.json
    const opencodeConfig = await generateOpencodeConfig(this.answers, this.configDir);
    files.push({
      path: join(this.configDir, "opencode.json"),
      content: JSON.stringify(opencodeConfig, null, 2),
      exists: existsSync(join(this.configDir, "opencode.json")),
    });

    // Generate oh-my-opencode.json
    const omoConfig = generateOmoConfig(this.answers);
    files.push({
      path: join(this.configDir, "oh-my-opencode.json"),
      content: JSON.stringify(omoConfig, null, 2),
      exists: existsSync(join(this.configDir, "oh-my-opencode.json")),
    });

    // Generate athena.json
    const athenaConfig = generateAthenaConfig(this.answers);
    files.push({
      path: join(this.configDir, "athena.json"),
      content: JSON.stringify(athenaConfig, null, 2),
      exists: existsSync(join(this.configDir, "athena.json")),
    });

    return files;
  }

  /**
   * Get the list of npm packages to install
   */
  getRequiredPackages(): string[] {
    return getRequiredPlugins(this.answers);
  }
}
