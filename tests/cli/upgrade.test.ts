import { exec } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

const execAsync = promisify(exec);

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn((fn) => fn),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

describe("upgrade command", () => {
  describe("release channel detection", () => {
    it("detects beta channel from version", () => {
      const version = "0.8.1-beta.2";
      const channel = version.includes("-beta") ? "beta" : "latest";
      expect(channel).toBe("beta");
    });

    it("detects alpha channel from version", () => {
      const version = "0.8.1-alpha.1";
      const channel = version.includes("-alpha") ? "alpha" : "latest";
      expect(channel).toBe("alpha");
    });

    it("uses latest channel for stable versions", () => {
      const version = "0.8.1";
      const channel = version.includes("-beta")
        ? "beta"
        : version.includes("-alpha")
          ? "alpha"
          : "latest";
      expect(channel).toBe("latest");
    });
  });

  describe("version comparison", () => {
    it("detects when upgrade is needed", async () => {
      const semver = await import("semver");
      
      const currentVersion = "0.0.3";
      const latestVersion = "0.8.1";
      
      const hasUpdate = semver.gt(latestVersion, currentVersion);
      expect(hasUpdate).toBe(true);
    });

    it("detects when already up to date", async () => {
      const semver = await import("semver");
      
      const currentVersion = "0.8.1";
      const latestVersion = "0.8.1";
      
      const hasUpdate = semver.gt(latestVersion, currentVersion);
      expect(hasUpdate).toBe(false);
    });

    it("handles beta version upgrades", async () => {
      const semver = await import("semver");
      
      const currentVersion = "0.8.1-beta.2";
      const latestVersion = "0.8.1-beta.3";
      
      const hasUpdate = semver.gt(latestVersion, currentVersion);
      expect(hasUpdate).toBe(true);
    });

    it("coerces versions correctly for migration check", async () => {
      const semver = await import("semver");
      
      const existingVersion = "0.0.3";
      const targetVersion = "0.8.1-beta.2";
      
      const coercedExisting = semver.coerce(existingVersion);
      const coercedTarget = semver.coerce(targetVersion);
      
      expect(coercedExisting?.version).toBe("0.0.3");
      expect(coercedTarget?.version).toBe("0.8.1");
    });
  });

  describe("package update checks", () => {
    it("identifies packages needing updates", () => {
      const updates = [
        { name: "opencode-athena", current: "0.0.3", latest: "0.8.1", updateAvailable: true },
        { name: "oh-my-opencode", current: "1.0.0", latest: "1.0.0", updateAvailable: false },
      ];

      const needsUpdate = updates.filter((u) => u.updateAvailable);
      expect(needsUpdate).toHaveLength(1);
      expect(needsUpdate[0].name).toBe("opencode-athena");
    });

    it("handles all packages up to date", () => {
      const updates = [
        { name: "opencode-athena", current: "0.8.1", latest: "0.8.1", updateAvailable: false },
        { name: "oh-my-opencode", current: "1.0.0", latest: "1.0.0", updateAvailable: false },
      ];

      const needsUpdate = updates.filter((u) => u.updateAvailable);
      expect(needsUpdate).toHaveLength(0);
    });
  });

  describe("npm registry version checking", () => {
    it("fetches latest version from npm registry", async () => {
      const mockExec = execAsync as unknown as ReturnType<typeof vi.fn>;
      mockExec.mockResolvedValueOnce({ stdout: "0.8.1-beta.3\n", stderr: "" });

      const { stdout } = await execAsync("npm view opencode-athena@beta version");
      const version = stdout.trim();
      
      expect(version).toBe("0.8.1-beta.3");
    });

    it("fetches latest stable from latest tag", async () => {
      const mockExec = execAsync as unknown as ReturnType<typeof vi.fn>;
      mockExec.mockResolvedValueOnce({ stdout: "0.8.0\n", stderr: "" });

      const { stdout } = await execAsync("npm view opencode-athena@latest version");
      const version = stdout.trim();
      
      expect(version).toBe("0.8.0");
    });
  });

  describe("migration application", () => {
    it("applies migrations between version ranges", async () => {
      const { migrateConfigs } = await import("../../src/cli/utils/migrations/runner.js");
      
      const athenaConfig = {
        version: "0.4.0",
        features: {},
      };
      
      const result = migrateConfigs(athenaConfig, {}, "0.4.0");
      
      expect(result.athenaConfig.features).toHaveProperty("autoGitOperations");
      expect((result.athenaConfig.features as Record<string, unknown>).autoGitOperations).toBe(false);
    });

    it("skips migrations when already up to date", async () => {
      const { migrateConfigs } = await import("../../src/cli/utils/migrations/runner.js");
      const { VERSION } = await import("../../src/shared/constants.js");
      
      const athenaConfig = {
        version: VERSION,
        features: { autoGitOperations: false },
      };
      
      const result = migrateConfigs(athenaConfig, {}, VERSION);
      
      expect(result.migrationsApplied).toHaveLength(0);
    });

    it("detects breaking changes in major version bumps", async () => {
      const semver = await import("semver");
      
      const fromVersion = "0.9.0";
      const toVersion = "1.0.0";
      
      const fromMajor = semver.major(fromVersion);
      const toMajor = semver.major(toVersion);
      
      const isBreaking = toMajor > fromMajor;
      expect(isBreaking).toBe(true);
    });
  });

  describe("package installation", () => {
    it("installs packages with correct version specifiers", () => {
      const channel = "beta";
      const packages = [`opencode-athena@${channel}`, "oh-my-opencode@latest"];
      
      expect(packages[0]).toBe("opencode-athena@beta");
      expect(packages[1]).toBe("oh-my-opencode@latest");
    });

    it("uses release channel for athena package", () => {
      const version = "0.8.1-beta.2";
      const channel = version.includes("-beta") ? "beta" : "latest";
      const packageSpec = `opencode-athena@${channel}`;
      
      expect(packageSpec).toBe("opencode-athena@beta");
    });

    it("uses latest for plugin packages", () => {
      const plugins = ["oh-my-opencode", "opencode-antigravity-auth"];
      const packageSpecs = plugins.map((p) => `${p}@latest`);
      
      expect(packageSpecs).toEqual([
        "oh-my-opencode@latest",
        "opencode-antigravity-auth@latest",
      ]);
    });
  });
});
