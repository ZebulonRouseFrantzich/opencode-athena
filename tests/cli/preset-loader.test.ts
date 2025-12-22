/**
 * Tests for the preset loader utility
 */

import { describe, expect, it } from "vitest";
import {
  formatPresetSummary,
  isValidPresetName,
  listPresets,
  loadPreset,
  PRESET_NAMES,
  presetToDefaults,
} from "../../src/cli/utils/preset-loader.js";

describe("preset-loader", () => {
  describe("isValidPresetName", () => {
    it("returns true for valid preset names", () => {
      expect(isValidPresetName("minimal")).toBe(true);
      expect(isValidPresetName("standard")).toBe(true);
      expect(isValidPresetName("enterprise")).toBe(true);
      expect(isValidPresetName("solo-quick")).toBe(true);
    });

    it("returns false for invalid preset names", () => {
      expect(isValidPresetName("invalid")).toBe(false);
      expect(isValidPresetName("")).toBe(false);
      expect(isValidPresetName("STANDARD")).toBe(false);
      expect(isValidPresetName("Standard")).toBe(false);
    });
  });

  describe("loadPreset", () => {
    it("loads standard preset successfully", () => {
      const preset = loadPreset("standard");

      expect(preset).toBeDefined();
      expect(preset.version).toBe("1.0.0");
      expect(preset.description).toContain("Standard");
      expect(preset.models).toBeDefined();
      expect(preset.models.sisyphus).toBeDefined();
      expect(preset.models.oracle).toBeDefined();
      expect(preset.models.librarian).toBeDefined();
      expect(preset.bmad).toBeDefined();
      expect(preset.features).toBeDefined();
      expect(preset.mcps).toBeDefined();
    });

    it("loads minimal preset successfully", () => {
      const preset = loadPreset("minimal");

      expect(preset).toBeDefined();
      expect(preset.description).toContain("Minimal");
      expect(preset.bmad.defaultTrack).toBe("quick-flow");
      expect(preset.features.parallelExecution).toBe(false);
    });

    it("loads enterprise preset successfully", () => {
      const preset = loadPreset("enterprise");

      expect(preset).toBeDefined();
      expect(preset.description).toContain("Enterprise");
      expect(preset.bmad.defaultTrack).toBe("enterprise");
      expect(preset.bmad.parallelStoryLimit).toBe(5);
    });

    it("loads solo-quick preset successfully", () => {
      const preset = loadPreset("solo-quick");

      expect(preset).toBeDefined();
      expect(preset.description).toContain("Solo");
      expect(preset.bmad.defaultTrack).toBe("quick-flow");
    });

    it("throws error for invalid preset name", () => {
      expect(() => loadPreset("invalid")).toThrow(/Invalid preset name/);
    });

    it("throws error with list of valid presets", () => {
      try {
        loadPreset("invalid");
      } catch (error) {
        expect((error as Error).message).toContain("minimal");
        expect((error as Error).message).toContain("standard");
        expect((error as Error).message).toContain("enterprise");
        expect((error as Error).message).toContain("solo-quick");
      }
    });
  });

  describe("listPresets", () => {
    it("returns all 4 presets", () => {
      const presets = listPresets();

      expect(presets).toHaveLength(4);
    });

    it("returns presets with names and descriptions", () => {
      const presets = listPresets();

      for (const preset of presets) {
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.path).toBeDefined();
        expect(PRESET_NAMES).toContain(preset.name);
      }
    });

    it("includes all preset names", () => {
      const presets = listPresets();
      const names = presets.map((p) => p.name);

      expect(names).toContain("minimal");
      expect(names).toContain("standard");
      expect(names).toContain("enterprise");
      expect(names).toContain("solo-quick");
    });
  });

  describe("presetToDefaults", () => {
    it("converts preset models to ModelAnswers format", () => {
      const preset = loadPreset("standard");
      const defaults = presetToDefaults(preset);

      expect(defaults.models).toBeDefined();
      expect(defaults.models.sisyphus).toBe(preset.models.sisyphus);
      expect(defaults.models.oracle).toBe(preset.models.oracle);
      expect(defaults.models.librarian).toBe(preset.models.librarian);
    });

    it("converts preset bmad to MethodologyAnswers format", () => {
      const preset = loadPreset("standard");
      const defaults = presetToDefaults(preset);

      expect(defaults.methodology).toBeDefined();
      expect(defaults.methodology.defaultTrack).toBe(preset.bmad.defaultTrack);
      expect(defaults.methodology.autoStatusUpdate).toBe(preset.bmad.autoStatusUpdate);
    });

    it("converts preset features to FeatureAnswers format", () => {
      const preset = loadPreset("standard");
      const defaults = presetToDefaults(preset);

      expect(defaults.features).toBeDefined();
      expect(defaults.features.enabledFeatures).toBeInstanceOf(Array);

      // Standard preset should have all features enabled
      expect(defaults.features.enabledFeatures).toContain("bmad-bridge");
      expect(defaults.features.enabledFeatures).toContain("auto-status");
      expect(defaults.features.enabledFeatures).toContain("parallel");
      expect(defaults.features.enabledFeatures).toContain("notifications");
    });

    it("converts preset mcps to MCP selection format", () => {
      const preset = loadPreset("standard");
      const defaults = presetToDefaults(preset);

      expect(defaults.features.mcps).toBeInstanceOf(Array);
      expect(defaults.features.mcps).toContain("context7");
      expect(defaults.features.mcps).toContain("exa");
      expect(defaults.features.mcps).toContain("grep_app");
    });

    it("converts minimal preset features correctly (some disabled)", () => {
      const preset = loadPreset("minimal");
      const defaults = presetToDefaults(preset);

      // Minimal should have parallel disabled
      expect(defaults.features.enabledFeatures).not.toContain("parallel");
      expect(defaults.features.enabledFeatures).not.toContain("notifications");

      // But should still have essential features
      expect(defaults.features.enabledFeatures).toContain("bmad-bridge");
      expect(defaults.features.enabledFeatures).toContain("lsp-tools");
    });

    it("includes advanced settings", () => {
      const preset = loadPreset("enterprise");
      const defaults = presetToDefaults(preset);

      expect(defaults.advanced).toBeDefined();
      expect(defaults.advanced.parallelStoryLimit).toBe(5);
    });
  });

  describe("formatPresetSummary", () => {
    it("returns formatted string with preset information", () => {
      const preset = loadPreset("standard");
      const summary = formatPresetSummary(preset, "standard");

      expect(summary).toContain("Preset: standard");
      expect(summary).toContain("Description:");
      expect(summary).toContain("Models:");
      expect(summary).toContain("Sisyphus:");
      expect(summary).toContain("Oracle:");
      expect(summary).toContain("Librarian:");
      expect(summary).toContain("BMAD Settings:");
      expect(summary).toContain("Features:");
      expect(summary).toContain("MCP Servers:");
    });

    it("includes model IDs", () => {
      const preset = loadPreset("standard");
      const summary = formatPresetSummary(preset, "standard");

      expect(summary).toContain(preset.models.sisyphus);
      expect(summary).toContain(preset.models.oracle);
      expect(summary).toContain(preset.models.librarian);
    });
  });

  describe("round-trip consistency", () => {
    it("presetToDefaults output is consistent for same input", () => {
      const preset = loadPreset("standard");

      const defaults1 = presetToDefaults(preset);
      const defaults2 = presetToDefaults(preset);

      expect(defaults1).toEqual(defaults2);
    });

    it("all presets can be loaded and converted", () => {
      for (const name of PRESET_NAMES) {
        const preset = loadPreset(name);
        const defaults = presetToDefaults(preset);

        // Basic structure validation
        expect(defaults.models.sisyphus).toBeDefined();
        expect(defaults.methodology.defaultTrack).toBeDefined();
        expect(defaults.features.enabledFeatures).toBeInstanceOf(Array);
        expect(defaults.features.mcps).toBeInstanceOf(Array);
      }
    });
  });
});
