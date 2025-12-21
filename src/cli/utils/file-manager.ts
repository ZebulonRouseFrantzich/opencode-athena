/**
 * File Manager
 *
 * Handles file read/write operations for the CLI installer.
 */

import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { CONFIG_PATHS } from "../../shared/constants.js";
import type { GeneratedFile } from "../../shared/types.js";

const execAsync = promisify(exec);

/**
 * Get the package root directory (where commands/ and config/ live)
 */
function getPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  // Navigate from dist/cli/utils/file-manager.js to package root
  return join(dirname(currentFile), "..", "..", "..");
}

export class FileManager {
  private configDir: string;

  constructor(configDir?: string) {
    this.configDir = configDir || CONFIG_PATHS.globalConfigDir;
  }

  /**
   * Get the configuration directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Ensure a directory exists
   */
  async ensureDir(dir: string): Promise<void> {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  /**
   * Write multiple files atomically
   */
  async writeFiles(files: GeneratedFile[]): Promise<void> {
    for (const file of files) {
      const dir = dirname(file.path);
      await this.ensureDir(dir);
      await writeFile(file.path, file.content, "utf-8");
    }
  }

  /**
   * Read a JSON configuration file
   */
  readJsonFile<T = Record<string, unknown>>(path: string): T | null {
    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = readFileSync(path, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Write a JSON configuration file
   */
  async writeJsonFile(path: string, data: unknown): Promise<void> {
    const dir = dirname(path);
    await this.ensureDir(dir);
    await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Check if a file exists
   */
  exists(path: string): boolean {
    return existsSync(path);
  }

  /**
   * Install npm dependencies in the config directory
   */
  async installDependencies(packages: string[]): Promise<void> {
    if (packages.length === 0) return;

    // Ensure config directory exists
    await this.ensureDir(this.configDir);

    // Check if package.json exists, create if not
    const packageJsonPath = join(this.configDir, "package.json");
    if (!existsSync(packageJsonPath)) {
      await writeFile(
        packageJsonPath,
        JSON.stringify(
          {
            name: "opencode-config",
            private: true,
            type: "module",
          },
          null,
          2
        )
      );
    }

    // Install packages
    const packageList = packages.join(" ");
    await execAsync(`npm install ${packageList}`, {
      cwd: this.configDir,
      timeout: 120000,
    });
  }

  /**
   * Uninstall npm dependencies from the config directory
   */
  async uninstallDependencies(packages: string[]): Promise<void> {
    if (packages.length === 0) return;

    const packageList = packages.join(" ");
    try {
      await execAsync(`npm uninstall ${packageList}`, {
        cwd: this.configDir,
        timeout: 60000,
      });
    } catch {
      // Ignore errors if packages aren't installed
    }
  }

  /**
   * Copy bridge commands from package to config directory
   */
  async copyCommands(): Promise<string[]> {
    const commandsDir = CONFIG_PATHS.commandsDir;
    await this.ensureDir(commandsDir);

    const packageRoot = getPackageRoot();
    const sourceCommandsDir = join(packageRoot, "commands");

    const copiedFiles: string[] = [];

    if (existsSync(sourceCommandsDir)) {
      const files = await readdir(sourceCommandsDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          const sourcePath = join(sourceCommandsDir, file);
          const destPath = join(commandsDir, file);
          await copyFile(sourcePath, destPath);
          copiedFiles.push(file);
        }
      }
    }

    return copiedFiles;
  }

  /**
   * Remove bridge commands from config directory
   */
  async removeCommands(): Promise<string[]> {
    const commandsDir = CONFIG_PATHS.commandsDir;
    const removedFiles: string[] = [];

    if (!existsSync(commandsDir)) {
      return removedFiles;
    }

    const files = await readdir(commandsDir);
    for (const file of files) {
      if (file.startsWith("athena-") && file.endsWith(".md")) {
        const filePath = join(commandsDir, file);
        await rm(filePath);
        removedFiles.push(file);
      }
    }

    return removedFiles;
  }

  /**
   * Remove Athena configuration files
   */
  async removeConfigFiles(): Promise<string[]> {
    const removedFiles: string[] = [];

    const filesToRemove = [CONFIG_PATHS.globalAthenaConfig, CONFIG_PATHS.stateFile];

    for (const file of filesToRemove) {
      if (existsSync(file)) {
        await rm(file);
        removedFiles.push(file);
      }
    }

    return removedFiles;
  }

  /**
   * Remove Athena from opencode.json plugin list
   */
  async removeFromOpencodeConfig(): Promise<boolean> {
    const opencodeConfig = this.readJsonFile<{
      plugin?: string[];
      [key: string]: unknown;
    }>(CONFIG_PATHS.globalOpencodeConfig);

    if (!opencodeConfig || !opencodeConfig.plugin) {
      return false;
    }

    const athenaPlugins = [
      "opencode-athena",
      "oh-my-opencode",
      "opencode-antigravity-auth",
      "opencode-openai-codex-auth",
    ];

    const originalLength = opencodeConfig.plugin.length;
    opencodeConfig.plugin = opencodeConfig.plugin.filter(
      (p) => !athenaPlugins.some((ap) => p.includes(ap))
    );

    if (opencodeConfig.plugin.length !== originalLength) {
      await this.writeJsonFile(CONFIG_PATHS.globalOpencodeConfig, opencodeConfig);
      return true;
    }

    return false;
  }

  /**
   * Backup a file before modifying
   */
  async backupFile(path: string): Promise<string | null> {
    if (!existsSync(path)) {
      return null;
    }

    const backupPath = `${path}.backup`;
    await copyFile(path, backupPath);
    return backupPath;
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    const originalPath = backupPath.replace(/\.backup$/, "");
    if (existsSync(backupPath)) {
      await copyFile(backupPath, originalPath);
      await rm(backupPath);
    }
  }
}
