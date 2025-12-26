import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/plugin/utils/bmad-finder.js", () => ({
  findAgentFiles: vi.fn(),
}));

import { findAgentFiles } from "../../src/plugin/utils/bmad-finder.js";
import { BMAD_AGENT_FULL_PERSONAS } from "../../src/shared/types.js";

const mockFindAgentFiles = vi.mocked(findAgentFiles);

const FIXTURES_DIR = join(process.cwd(), "tests/fixtures/bmad-v6/_bmad/bmm/agents");

describe("persona-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("filenameToAgentType", () => {
    it("should map analyst.agent.yaml to analyst", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("analyst.agent.yaml")).toBe("analyst");
    });

    it("should map dev.agent.yaml to dev", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("dev.agent.yaml")).toBe("dev");
    });

    it("should map architect.agent.yaml to architect", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("architect.agent.yaml")).toBe("architect");
    });

    it("should map pm.agent.yaml to pm", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("pm.agent.yaml")).toBe("pm");
    });

    it("should map sm.agent.yaml to sm", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("sm.agent.yaml")).toBe("sm");
    });

    it("should map tea.agent.yaml to tea", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("tea.agent.yaml")).toBe("tea");
    });

    it("should map tech-writer.agent.yaml to tech-writer", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("tech-writer.agent.yaml")).toBe("tech-writer");
    });

    it("should map ux-designer.agent.yaml to ux-designer", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("ux-designer.agent.yaml")).toBe("ux-designer");
    });

    it("should return null for unknown agent files", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("unknown-agent.agent.yaml")).toBeNull();
    });

    it("should handle full file paths", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      expect(_testExports.filenameToAgentType("/path/to/dev.agent.yaml")).toBe("dev");
    });
  });

  describe("parsePrinciples", () => {
    it("should parse multi-line principles with dashes", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const principles = `- First principle
- Second principle
- Third principle`;

      const result = _testExports.parsePrinciples(principles);
      expect(result).toEqual(["First principle", "Second principle", "Third principle"]);
    });

    it("should handle principles with extra whitespace", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const principles = `  - First principle  
  - Second principle  `;

      const result = _testExports.parsePrinciples(principles);
      expect(result).toEqual(["First principle", "Second principle"]);
    });

    it("should filter out empty lines", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const principles = `- First principle

- Second principle
`;

      const result = _testExports.parsePrinciples(principles);
      expect(result).toEqual(["First principle", "Second principle"]);
    });

    it("should return empty array for empty input", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const result = _testExports.parsePrinciples("");
      expect(result).toEqual([]);
    });
  });

  describe("parseAgentYaml", () => {
    it("should parse analyst.agent.yaml correctly", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const filePath = join(FIXTURES_DIR, "analyst.agent.yaml");

      const result = await _testExports.parseAgentYaml(filePath);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("analyst");
      expect(result?.persona.name).toBe("Mary");
      expect(result?.persona.title).toBe("Business Analyst");
      expect(result?.persona.icon).toBe("📊");
      expect(result?.persona.perspective).toBe("Strategic Business Analyst + Requirements Expert");
      expect(result?.persona.principles).toContain("Every business challenge has root causes waiting to be discovered");
    });

    it("should parse dev.agent.yaml correctly", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const filePath = join(FIXTURES_DIR, "dev.agent.yaml");

      const result = await _testExports.parseAgentYaml(filePath);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("dev");
      expect(result?.persona.name).toBe("Amelia");
      expect(result?.persona.title).toBe("Developer Agent");
      expect(result?.persona.icon).toBe("💻");
    });

    it("should return null for unknown agent type", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const filePath = join(FIXTURES_DIR, "unknown.agent.yaml");

      const result = await _testExports.parseAgentYaml(filePath);
      expect(result).toBeNull();
    });

    it("should fall back to built-in values for missing fields", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const filePath = join(FIXTURES_DIR, "architect.agent.yaml");

      const result = await _testExports.parseAgentYaml(filePath);

      expect(result).not.toBeNull();
      expect(result?.persona.expertise).toBeDefined();
    });
  });

  describe("loadFromYamlFiles", () => {
    it("should load multiple agent files", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const agentFiles = [
        join(FIXTURES_DIR, "analyst.agent.yaml"),
        join(FIXTURES_DIR, "dev.agent.yaml"),
        join(FIXTURES_DIR, "architect.agent.yaml"),
      ];

      const result = await _testExports.loadFromYamlFiles(agentFiles);

      expect(result.size).toBe(3);
      expect(result.get("analyst")).toBeDefined();
      expect(result.get("dev")).toBeDefined();
      expect(result.get("architect")).toBeDefined();
    });

    it("should skip invalid agent files", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const agentFiles = [
        join(FIXTURES_DIR, "analyst.agent.yaml"),
        join(FIXTURES_DIR, "nonexistent.agent.yaml"),
      ];

      const result = await _testExports.loadFromYamlFiles(agentFiles);

      expect(result.size).toBe(1);
      expect(result.get("analyst")).toBeDefined();
    });
  });

  describe("loadPersonas", () => {
    it("should return built-in personas when no agent files found", async () => {
      mockFindAgentFiles.mockResolvedValue([]);

      const { loadPersonas } = await import("../../src/plugin/utils/persona-loader.js");
      const result = await loadPersonas("/test/project");

      expect(result.size).toBeGreaterThan(0);
      expect(result.get("architect")).toBeDefined();
      expect(result.get("dev")).toBeDefined();
    });

    it("should merge YAML personas with built-in personas", async () => {
      mockFindAgentFiles.mockResolvedValue([
        join(FIXTURES_DIR, "analyst.agent.yaml"),
        join(FIXTURES_DIR, "dev.agent.yaml"),
      ]);

      const { loadPersonas } = await import("../../src/plugin/utils/persona-loader.js");
      const result = await loadPersonas("/test/project");

      const analyst = result.get("analyst");
      expect(analyst).toBeDefined();
      expect(analyst?.name).toBe("Mary");
      expect(analyst?.title).toBe("Business Analyst");

      const architect = result.get("architect");
      expect(architect).toBeDefined();
      expect(architect?.name).toBe(BMAD_AGENT_FULL_PERSONAS.architect.name);
    });

    it("should override built-in personas with YAML personas", async () => {
      mockFindAgentFiles.mockResolvedValue([join(FIXTURES_DIR, "architect.agent.yaml")]);

      const { loadPersonas } = await import("../../src/plugin/utils/persona-loader.js");
      const result = await loadPersonas("/test/project");

      const architect = result.get("architect");
      expect(architect?.name).toBe("Winston");
      expect(architect?.title).toBe("System Architect");
    });
  });

  describe("getPersona", () => {
    it("should return persona from map if exists", async () => {
      const { getPersona } = await import("../../src/plugin/utils/persona-loader.js");
      const customPersona = { ...BMAD_AGENT_FULL_PERSONAS.architect, name: "Custom Name" };
      const personas = new Map([["architect", customPersona]]);

      const result = getPersona(personas as any, "architect");
      expect(result.name).toBe("Custom Name");
    });

    it("should fall back to built-in persona if not in map", async () => {
      const { getPersona } = await import("../../src/plugin/utils/persona-loader.js");
      const personas = new Map();

      const result = getPersona(personas as any, "architect");
      expect(result).toEqual(BMAD_AGENT_FULL_PERSONAS.architect);
    });
  });

  describe("selectAgentsForFinding", () => {
    it("should select security-focused agents for security findings", async () => {
      const { selectAgentsForFinding } = await import("../../src/plugin/utils/persona-loader.js");
      const agents = selectAgentsForFinding("security", "medium");

      expect(agents).toContain("architect");
      expect(agents).toContain("dev");
      expect(agents).toContain("tea");
    });

    it("should select logic-focused agents for logic findings", async () => {
      const { selectAgentsForFinding } = await import("../../src/plugin/utils/persona-loader.js");
      const agents = selectAgentsForFinding("logic", "medium");

      expect(agents).toContain("dev");
      expect(agents).toContain("tea");
      expect(agents).toContain("analyst");
    });

    it("should include PM for high severity findings", async () => {
      const { selectAgentsForFinding } = await import("../../src/plugin/utils/persona-loader.js");
      const agents = selectAgentsForFinding("performance", "high");

      expect(agents).toContain("pm");
    });

    it("should limit to 3 agents", async () => {
      const { selectAgentsForFinding } = await import("../../src/plugin/utils/persona-loader.js");
      const agents = selectAgentsForFinding("security", "high");

      expect(agents.length).toBeLessThanOrEqual(3);
    });
  });

  describe("error handling", () => {
    it("should handle file read errors gracefully", async () => {
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");
      const nonexistentPath = "/nonexistent/path/dev.agent.yaml";

      const result = await _testExports.parseAgentYaml(nonexistentPath);

      expect(result).toBeNull();
    });

    it("should handle malformed YAML gracefully", async () => {
      vi.doMock("node:fs/promises", async () => {
        const actual = await vi.importActual<typeof import("node:fs/promises")>(
          "node:fs/promises"
        );
        return {
          ...actual,
          readFile: vi.fn().mockResolvedValue("invalid: yaml: content: [unclosed"),
        };
      });

      vi.resetModules();
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");

      const result = await _testExports.parseAgentYaml(
        join(FIXTURES_DIR, "dev.agent.yaml")
      );

      expect(result).toBeNull();

      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    });

    it("should handle empty YAML files gracefully", async () => {
      vi.doMock("node:fs/promises", async () => {
        const actual = await vi.importActual<typeof import("node:fs/promises")>(
          "node:fs/promises"
        );
        return {
          ...actual,
          readFile: vi.fn().mockResolvedValue(""),
        };
      });

      vi.resetModules();
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");

      const result = await _testExports.parseAgentYaml(
        join(FIXTURES_DIR, "dev.agent.yaml")
      );

      expect(result).toBeNull();

      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    });

    it("should handle YAML missing required fields", async () => {
      vi.doMock("node:fs/promises", async () => {
        const actual = await vi.importActual<typeof import("node:fs/promises")>(
          "node:fs/promises"
        );
        return {
          ...actual,
          readFile: vi.fn().mockResolvedValue("agent:\n  metadata:\n    id: test"),
        };
      });

      vi.resetModules();
      const { _testExports } = await import("../../src/plugin/utils/persona-loader.js");

      const result = await _testExports.parseAgentYaml(
        join(FIXTURES_DIR, "dev.agent.yaml")
      );

      expect(result).toBeNull();

      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    });

    it("should fall back to built-in personas when all agent files fail to parse", async () => {
      mockFindAgentFiles.mockResolvedValue([
        join(FIXTURES_DIR, "nonexistent1.agent.yaml"),
        join(FIXTURES_DIR, "nonexistent2.agent.yaml"),
      ]);

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { loadPersonas } = await import("../../src/plugin/utils/persona-loader.js");
      const result = await loadPersonas("/test/project");

      expect(result.size).toBeGreaterThan(0);
      expect(result.get("architect")).toBeDefined();
      expect(result.get("dev")).toBeDefined();

      consoleWarnSpy.mockRestore();
    });
  });
});
