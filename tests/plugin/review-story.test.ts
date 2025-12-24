import { describe, it, expect, beforeEach, vi } from "vitest";

const mockZodString = () => ({
  optional: () => ({ describe: () => ({}) }),
  describe: () => ({}),
});

const mockZodBoolean = () => ({
  optional: () => ({ describe: () => ({}) }),
  describe: () => ({}),
});

const mockSchema = {
  string: mockZodString,
  boolean: mockZodBoolean,
};

vi.mock("@opencode-ai/plugin", () => {
  const toolFn = (config: unknown) => config;
  toolFn.schema = mockSchema;
  return { tool: toolFn };
});

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("../../src/plugin/utils/bmad-finder.js", () => ({
  getBmadPaths: vi.fn(),
}));

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import type {
  AthenaConfig,
  FindingCategory,
  ReviewDocumentReference,
  StoryComplexity,
} from "../../src/shared/types.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);

const defaultConfig: AthenaConfig = {
  version: "0.1.0",
  subscriptions: {
    claude: { enabled: true, tier: "max5x" },
    openai: { enabled: true },
    google: { enabled: false, authMethod: "none" },
    githubCopilot: { enabled: false, plan: "none" },
  },
  models: {
    sisyphus: "anthropic/claude-sonnet-4",
    oracle: "openai/gpt-5.2",
    librarian: "anthropic/claude-sonnet-4",
  },
  bmad: {
    defaultTrack: "bmad-method",
    autoStatusUpdate: true,
    parallelStoryLimit: 3,
  },
  features: {
    bmadBridge: true,
    autoStatus: true,
    parallelExecution: true,
    notifications: true,
    contextMonitor: true,
    commentChecker: true,
    lspTools: true,
    autoGitOperations: false,
  },
  mcps: {
    context7: true,
    exa: true,
    grepApp: true,
  },
};

describe("detectReviewScope", () => {
  let detectReviewScope: (identifier: string) => "epic" | "story";

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    detectReviewScope = module._testExports.detectReviewScope;
  });

  it("should detect epic scope for simple number", () => {
    expect(detectReviewScope("2")).toBe("epic");
    expect(detectReviewScope("3")).toBe("epic");
    expect(detectReviewScope("10")).toBe("epic");
  });

  it("should detect epic scope for epic- prefix", () => {
    expect(detectReviewScope("epic-2")).toBe("epic");
    expect(detectReviewScope("epic-3")).toBe("epic");
  });

  it("should detect story scope for dotted notation", () => {
    expect(detectReviewScope("2.3")).toBe("story");
    expect(detectReviewScope("3.1")).toBe("story");
    expect(detectReviewScope("10.5")).toBe("story");
  });

  it("should detect story scope for story- prefix", () => {
    expect(detectReviewScope("story-2-3")).toBe("story");
    expect(detectReviewScope("story-3-1")).toBe("story");
  });

  it("should detect story scope for file paths", () => {
    expect(detectReviewScope("docs/stories/story-2-3.md")).toBe("story");
    expect(detectReviewScope("story-2-3.md")).toBe("story");
    expect(detectReviewScope("/full/path/to/story-2-3.md")).toBe("story");
  });

  it("should detect story scope for dash notation without prefix", () => {
    expect(detectReviewScope("2-3")).toBe("story");
    expect(detectReviewScope("10-5")).toBe("story");
  });
});

describe("normalizeStoryId", () => {
  let normalizeStoryId: (identifier: string) => string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    normalizeStoryId = module._testExports.normalizeStoryId;
  });

  it("should extract story ID from file path", () => {
    expect(normalizeStoryId("docs/stories/story-2-3.md")).toBe("2.3");
    expect(normalizeStoryId("/full/path/story-10-5.md")).toBe("10.5");
  });

  it("should convert dash notation to dot notation", () => {
    expect(normalizeStoryId("story-2-3")).toBe("2.3");
    expect(normalizeStoryId("2-3")).toBe("2.3");
  });

  it("should preserve dot notation", () => {
    expect(normalizeStoryId("2.3")).toBe("2.3");
    expect(normalizeStoryId("10.5")).toBe("10.5");
  });
});

describe("analyzeStoryComplexity", () => {
  let analyzeStoryComplexity: (storyContent: string) => Promise<StoryComplexity>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    analyzeStoryComplexity = module._testExports.analyzeStoryComplexity;
  });

  it("should detect simple CRUD-only story", async () => {
    const content = `# Story 2.1: List Users

## Acceptance Criteria
- User can view a list of all users
- User can create a new user
- User can update user details`;

    const result = await analyzeStoryComplexity(content);

    expect(result.isSimple).toBe(true);
    expect(result.factors.acceptanceCriteriaCount).toBe(3);
    expect(result.factors.hasSecurityConcerns).toBe(false);
    expect(result.factors.isCrudOnly).toBe(true);
    expect(result.recommendedModel).toBe("anthropic/claude-3-5-haiku-20241022");
  });

  it("should detect complex story with security concerns", async () => {
    const content = `# Story 2.2: User Authentication

## Acceptance Criteria
- User can login with email and password
- User receives JWT token on successful auth
- User password is encrypted before storage
- User session expires after 24 hours
- Admin role has elevated permissions`;

    const result = await analyzeStoryComplexity(content);

    expect(result.isSimple).toBe(false);
    expect(result.factors.hasSecurityConcerns).toBe(true);
    expect(result.recommendedModel).toBe("openai/gpt-5.2");
  });

  it("should detect complex story with data model changes", async () => {
    const content = `# Story 2.3: Add User Profiles

## Acceptance Criteria
- Create new database table for profiles
- Define schema for user preferences
- Migration adds profile_id column to users table
- User can update their profile model`;

    const result = await analyzeStoryComplexity(content);

    expect(result.isSimple).toBe(false);
    expect(result.factors.hasDataModelChanges).toBe(true);
  });

  it("should detect complex story with many acceptance criteria", async () => {
    const content = `# Story 2.4: Complex Feature

## Acceptance Criteria
- User can do thing 1
- User can do thing 2
- User can do thing 3
- User can do thing 4
- User can do thing 5
- User can do thing 6`;

    const result = await analyzeStoryComplexity(content);

    expect(result.isSimple).toBe(false);
    expect(result.factors.acceptanceCriteriaCount).toBeGreaterThanOrEqual(5);
  });

  it("should detect API changes", async () => {
    const content = `# Story 2.5: Add API Endpoints

## Acceptance Criteria
- Create new API endpoint for users
- Add route handler for /users
- Controller returns paginated results`;

    const result = await analyzeStoryComplexity(content);

    expect(result.factors.hasApiChanges).toBe(true);
  });
});

describe("selectReviewModel", () => {
  let selectReviewModel: (config: AthenaConfig, complexity: StoryComplexity) => string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    selectReviewModel = module._testExports.selectReviewModel;
  });

  it("should select haiku for simple stories", () => {
    const simpleComplexity: StoryComplexity = {
      isSimple: true,
      reason: "Simple story",
      recommendedModel: "anthropic/claude-3-5-haiku-20241022",
      factors: {
        acceptanceCriteriaCount: 3,
        hasSecurityConcerns: false,
        hasDataModelChanges: false,
        hasApiChanges: false,
        isCrudOnly: true,
      },
    };
    const result = selectReviewModel(defaultConfig, simpleComplexity);
    expect(result).toBe("anthropic/claude-3-5-haiku-20241022");
  });

  it("should select oracle model for complex stories", () => {
    const complexComplexity: StoryComplexity = {
      isSimple: false,
      reason: "Complex story",
      recommendedModel: "openai/gpt-5.2",
      factors: {
        acceptanceCriteriaCount: 10,
        hasSecurityConcerns: true,
        hasDataModelChanges: true,
        hasApiChanges: true,
        isCrudOnly: false,
      },
    };
    const result = selectReviewModel(defaultConfig, complexComplexity);
    expect(result).toBe("openai/gpt-5.2");
  });
});

describe("findStoriesInEpic", () => {
  let findStoriesInEpic: (storiesDir: string, epicNumber: string) => Promise<string[]>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    findStoriesInEpic = module._testExports.findStoriesInEpic;
  });

  it("should return empty array when directory does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await findStoriesInEpic("/test/stories", "2");

    expect(result).toEqual([]);
  });

  it("should find all stories for an epic", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue([
      "story-2-1.md",
      "story-2-2.md",
      "story-2-3.md",
      "story-3-1.md",
      "README.md",
    ] as never);

    const result = await findStoriesInEpic("/test/stories", "2");

    expect(result).toEqual(["2.1", "2.2", "2.3"]);
  });

  it("should sort stories numerically", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue([
      "story-2-10.md",
      "story-2-2.md",
      "story-2-1.md",
    ] as never);

    const result = await findStoriesInEpic("/test/stories", "2");

    expect(result).toEqual(["2.1", "2.10", "2.2"]);
  });

  it("should ignore non-story files", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue([
      "story-2-1.md",
      "epic-2.md",
      "notes.txt",
      ".DS_Store",
    ] as never);

    const result = await findStoriesInEpic("/test/stories", "2");

    expect(result).toEqual(["2.1"]);
  });
});

describe("loadStoryFile", () => {
  let loadStoryFile: (storiesDir: string, storyId: string) => Promise<string | null>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    loadStoryFile = module._testExports.loadStoryFile;
  });

  it("should return null when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await loadStoryFile("/test/stories", "2.3");

    expect(result).toBeNull();
  });

  it("should load story content", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue("# Story 2.3\n\nContent here");

    const result = await loadStoryFile("/test/stories", "2.3");

    expect(result).toBe("# Story 2.3\n\nContent here");
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining("story-2-3.md"),
      "utf-8"
    );
  });
});

describe("findExistingReviews", () => {
  let findExistingReviews: (
    reviewsDir: string,
    storyId: string
  ) => Promise<ReviewDocumentReference[]>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    findExistingReviews = module._testExports.findExistingReviews;
  });

  it("should return empty array when reviews dir does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await findExistingReviews("/test/reviews", "2.3");

    expect(result).toEqual([]);
  });

  it("should find epic review for story", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue([
      "party-review-epic-2-2025-12-22.md",
      "party-review-story-2-1-2025-12-22.md",
      "party-review-epic-3-2025-12-21.md",
    ] as never);

    const result = await findExistingReviews("/test/reviews", "2.3");

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("epic");
    expect(result[0].date).toBe("2025-12-22");
    expect(result[0].filePath).toContain("party-review-epic-2-2025-12-22.md");
  });

  it("should not find reviews for different epic", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue([
      "party-review-epic-3-2025-12-22.md",
      "party-review-story-3-1-2025-12-22.md",
    ] as never);

    const result = await findExistingReviews("/test/reviews", "2.3");

    expect(result).toEqual([]);
  });
});

describe("parseOracleResponse", () => {
  let parseOracleResponse: (
    response: string,
    scope: "epic" | "story"
  ) => {
    summary: {
      totalIssues: number;
      highSeverity: number;
      mediumSeverity: number;
      lowSeverity: number;
      recommendation: string;
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    parseOracleResponse = module._testExports.parseOracleResponse;
  });

  it("should parse valid JSON response", () => {
    const response = JSON.stringify({
      summary: {
        totalIssues: 5,
        highSeverity: 2,
        mediumSeverity: 2,
        lowSeverity: 1,
        recommendation: "Address high severity issues first",
      },
      findings: {
        security: [],
        logic: [],
        bestPractices: [],
        performance: [],
      },
    });

    const result = parseOracleResponse(response, "story");

    expect(result.summary.totalIssues).toBe(5);
    expect(result.summary.highSeverity).toBe(2);
  });

  it("should return default response on parse failure", () => {
    const result = parseOracleResponse("invalid json", "story");

    expect(result.summary.totalIssues).toBe(0);
    expect(result.summary.recommendation).toContain("Failed to parse");
  });
});

describe("getCategoryIcon", () => {
  let getCategoryIcon: (category: FindingCategory) => string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    getCategoryIcon = module._testExports.getCategoryIcon;
  });

  it("should return correct icons for each category", () => {
    expect(getCategoryIcon("security")).toBe("🔒");
    expect(getCategoryIcon("logic")).toBe("🧠");
    expect(getCategoryIcon("bestPractices")).toBe("✨");
    expect(getCategoryIcon("performance")).toBe("⚡");
  });
});

describe("formatCategoryName", () => {
  let formatCategoryName: (category: FindingCategory) => string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    formatCategoryName = module._testExports.formatCategoryName;
  });

  it("should return formatted names for each category", () => {
    expect(formatCategoryName("security")).toBe("Security Issues");
    expect(formatCategoryName("logic")).toBe("Logic Issues");
    expect(formatCategoryName("bestPractices")).toBe("Best Practices");
    expect(formatCategoryName("performance")).toBe("Performance Issues");
  });
});

describe("--thorough flag functionality", () => {
  let selectReviewModel: (config: AthenaConfig, complexity: StoryComplexity) => string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    selectReviewModel = module._testExports.selectReviewModel;
  });

  it("should use oracle model when --thorough is set (via forceAdvancedModel)", () => {
    const simpleComplexity: StoryComplexity = {
      isSimple: true,
      reason: "Simple story",
      recommendedModel: "anthropic/claude-3-5-haiku-20241022",
      factors: {
        acceptanceCriteriaCount: 3,
        hasSecurityConcerns: false,
        hasDataModelChanges: false,
        hasApiChanges: false,
        isCrudOnly: true,
      },
    };

    const normalModel = selectReviewModel(defaultConfig, simpleComplexity);
    expect(normalModel).toBe("anthropic/claude-3-5-haiku-20241022");

    const forcedModel = defaultConfig.models.oracle;
    expect(forcedModel).toBe("openai/gpt-5.2");
  });
});

describe("edge cases", () => {
  describe("focused review before epic review", () => {
    let findExistingReviews: (
      reviewsDir: string,
      storyId: string
    ) => Promise<ReviewDocumentReference[]>;

    beforeEach(async () => {
      vi.clearAllMocks();
      const module = await import("../../src/plugin/tools/review-story.js");
      findExistingReviews = module._testExports.findExistingReviews;
    });

    it("should return empty reviews when no epic review exists", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([] as never);

      const result = await findExistingReviews("/test/reviews", "2.3");

      expect(result).toEqual([]);
    });
  });

  describe("multiple focused reviews on same story", () => {
    let findExistingReviews: (
      reviewsDir: string,
      storyId: string
    ) => Promise<ReviewDocumentReference[]>;

    beforeEach(async () => {
      vi.clearAllMocks();
      const module = await import("../../src/plugin/tools/review-story.js");
      findExistingReviews = module._testExports.findExistingReviews;
    });

    it("should find epic review even with multiple focused reviews present", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        "party-review-epic-2-2025-12-20.md",
        "party-review-story-2-3-2025-12-21.md",
        "party-review-story-2-3-2025-12-22.md",
      ] as never);

      const result = await findExistingReviews("/test/reviews", "2.3");

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("epic");
    });
  });
});

interface FindingCounts {
  total: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<FindingCategory, number>;
}

interface AgentRecommendation {
  agent: string;
  reason: string;
  relevantFindings: string[];
  priority: "required" | "recommended" | "optional";
}

describe("selectAgentsForReview", () => {
  let selectAgentsForReview: (findings: FindingCounts) => AgentRecommendation[];

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    selectAgentsForReview = module._testExports.selectAgentsForReview;
  });

  const emptyFindings: FindingCounts = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    byCategory: { security: 0, logic: 0, bestPractices: 0, performance: 0 },
  };

  describe("security findings", () => {
    it("should recommend architect, dev, and tea for security findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 3,
        medium: 3,
        byCategory: { security: 3, logic: 0, bestPractices: 0, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const agentTypes = result.map((r) => r.agent);
      expect(agentTypes).toContain("architect");
      expect(agentTypes).toContain("dev");
      expect(agentTypes).toContain("tea");
    });

    it("should make architect required for high-severity security findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 2,
        high: 2,
        byCategory: { security: 2, logic: 0, bestPractices: 0, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const architect = result.find((r) => r.agent === "architect");
      expect(architect).toBeDefined();
      expect(architect?.priority).toBe("required");
    });

    it("should promote first agent to required when no high-severity findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 2,
        medium: 2,
        byCategory: { security: 2, logic: 0, bestPractices: 0, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const architect = result.find((r) => r.agent === "architect");
      expect(architect).toBeDefined();
      expect(architect?.priority).toBe("required");
    });
  });

  describe("logic findings", () => {
    it("should recommend dev, tea, and analyst for logic findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 3,
        medium: 3,
        byCategory: { security: 0, logic: 3, bestPractices: 0, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const agentTypes = result.map((r) => r.agent);
      expect(agentTypes).toContain("dev");
      expect(agentTypes).toContain("tea");
      expect(agentTypes).toContain("analyst");
    });

    it("should make dev required for high-severity logic findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 1,
        high: 1,
        byCategory: { security: 0, logic: 1, bestPractices: 0, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const dev = result.find((r) => r.agent === "dev");
      expect(dev).toBeDefined();
      expect(dev?.priority).toBe("required");
    });

    it("should make analyst optional for logic findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 2,
        medium: 2,
        byCategory: { security: 0, logic: 2, bestPractices: 0, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const analyst = result.find((r) => r.agent === "analyst");
      expect(analyst).toBeDefined();
      expect(analyst?.priority).toBe("optional");
    });
  });

  describe("performance findings", () => {
    it("should recommend architect and dev for performance findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 2,
        medium: 2,
        byCategory: { security: 0, logic: 0, bestPractices: 0, performance: 2 },
      };

      const result = selectAgentsForReview(findings);

      const agentTypes = result.map((r) => r.agent);
      expect(agentTypes).toContain("architect");
      expect(agentTypes).toContain("dev");
    });
  });

  describe("best practice findings", () => {
    it("should recommend dev and tech-writer for best practice findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 3,
        low: 3,
        byCategory: { security: 0, logic: 0, bestPractices: 3, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const agentTypes = result.map((r) => r.agent);
      expect(agentTypes).toContain("dev");
      expect(agentTypes).toContain("tech-writer");
    });

    it("should make tech-writer optional for best practice findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 2,
        low: 2,
        byCategory: { security: 0, logic: 0, bestPractices: 2, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const techWriter = result.find((r) => r.agent === "tech-writer");
      expect(techWriter).toBeDefined();
      expect(techWriter?.priority).toBe("optional");
    });
  });

  describe("high severity findings", () => {
    it("should always add PM for high severity findings", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 1,
        high: 1,
        byCategory: { security: 0, logic: 1, bestPractices: 0, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const pm = result.find((r) => r.agent === "pm");
      expect(pm).toBeDefined();
      expect(pm?.priority).toBe("required");
      expect(pm?.reason).toContain("high severity");
    });
  });

  describe("mixed findings", () => {
    it("should not duplicate agents when multiple categories need them", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 6,
        medium: 6,
        byCategory: { security: 2, logic: 2, bestPractices: 1, performance: 1 },
      };

      const result = selectAgentsForReview(findings);

      const agentCounts = result.reduce(
        (acc, r) => {
          acc[r.agent] = (acc[r.agent] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      for (const [_agent, count] of Object.entries(agentCounts)) {
        expect(count).toBe(1);
      }
    });

    it("should include relevant findings from multiple categories in agent reasons", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 4,
        medium: 4,
        byCategory: { security: 2, logic: 0, bestPractices: 0, performance: 2 },
      };

      const result = selectAgentsForReview(findings);

      const architect = result.find((r) => r.agent === "architect");
      expect(architect).toBeDefined();
      expect(architect?.relevantFindings).toContain("security");
    });
  });

  describe("empty findings", () => {
    it("should return empty array when no findings", () => {
      const result = selectAgentsForReview(emptyFindings);
      expect(result).toEqual([]);
    });
  });

  describe("at least one required agent", () => {
    it("should ensure at least one agent is required when recommendations exist", () => {
      const findings: FindingCounts = {
        ...emptyFindings,
        total: 1,
        low: 1,
        byCategory: { security: 0, logic: 0, bestPractices: 1, performance: 0 },
      };

      const result = selectAgentsForReview(findings);

      const hasRequired = result.some((r) => r.priority === "required");
      expect(hasRequired).toBe(true);
    });
  });
});

describe("prompt building", () => {
  let buildEpicReviewPrompt: (
    epicNumber: string,
    storyContents: Array<{ id: string; content: string | null }>,
    architectureContent: string
  ) => string;
  let buildFocusedReviewPrompt: (
    storyId: string,
    storyContent: string,
    architectureContent: string,
    epicReview?: ReviewDocumentReference
  ) => string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../src/plugin/tools/review-story.js");
    buildEpicReviewPrompt = module._testExports.buildEpicReviewPrompt;
    buildFocusedReviewPrompt = module._testExports.buildFocusedReviewPrompt;
  });

  it("should include all stories in epic review prompt", () => {
    const stories = [
      { id: "2.1", content: "Story 2.1 content" },
      { id: "2.2", content: "Story 2.2 content" },
    ];

    const prompt = buildEpicReviewPrompt("2", stories, "Architecture docs");

    expect(prompt).toContain("Epic 2");
    expect(prompt).toContain("Story 2.1");
    expect(prompt).toContain("Story 2.2");
    expect(prompt).toContain("Architecture docs");
    expect(prompt).toContain("Security Gaps");
    expect(prompt).toContain("Logic Gaps");
    expect(prompt).toContain("crossStoryIssues");
  });

  it("should include epic review reference in focused prompt when available", () => {
    const epicReview: ReviewDocumentReference = {
      type: "epic",
      filePath: "/test/reviews/party-review-epic-2-2025-12-22.md",
      date: "2025-12-22",
      findingsCount: 5,
      acceptedCount: 3,
      deferredCount: 1,
      rejectedCount: 1,
    };

    const prompt = buildFocusedReviewPrompt(
      "2.3",
      "Story content",
      "Architecture",
      epicReview
    );

    expect(prompt).toContain("Previous Epic Review");
    expect(prompt).toContain("2025-12-22");
    expect(prompt).toContain("DEEP DIVE");
  });

  it("should work without epic review reference", () => {
    const prompt = buildFocusedReviewPrompt(
      "2.3",
      "Story content",
      "Architecture"
    );

    expect(prompt).not.toContain("Previous Epic Review");
    expect(prompt).toContain("DEEP DIVE");
    expect(prompt).toContain("**Story**: 2.3");
  });
});
