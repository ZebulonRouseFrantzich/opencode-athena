import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parse as parseYaml } from "yaml";
import type { BmadAgentFullPersona, BmadAgentType } from "../../shared/types.js";
import { BMAD_AGENT_FULL_PERSONAS } from "../../shared/types.js";
import { findAgentFiles } from "./bmad-finder.js";

interface BmadAgentYaml {
  agent: {
    metadata: {
      id: string;
      name: string;
      title: string;
      icon: string;
      module?: string;
    };
    persona: {
      role: string;
      identity: string;
      communication_style: string;
      principles: string;
    };
  };
}

function filenameToAgentType(filename: string): BmadAgentType | null {
  const base = basename(filename, ".agent.yaml");

  const typeMap: Record<string, BmadAgentType> = {
    analyst: "analyst",
    architect: "architect",
    dev: "dev",
    pm: "pm",
    sm: "sm",
    tea: "tea",
    "tech-writer": "tech-writer",
    "ux-designer": "ux-designer",
  };

  return typeMap[base] || null;
}

function parsePrinciples(principlesText: string): string[] {
  const lines = principlesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter((line) => line.startsWith("-"))
    .map((line) => line.substring(1).trim())
    .filter(Boolean);
}

/**
 * Parse a BMAD agent YAML file into a persona object.
 *
 * YAML-to-TypeScript field mappings:
 * - agent.persona.role → persona.perspective
 * - agent.persona.communication_style → persona.communicationStyle
 *
 * Falls back to built-in personas for missing or invalid fields.
 */
async function parseAgentYaml(
  filePath: string
): Promise<{ type: BmadAgentType; persona: BmadAgentFullPersona } | null> {
  const agentType = filenameToAgentType(filePath);
  if (!agentType) {
    return null;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    const data = parseYaml(content) as BmadAgentYaml;

    if (!data?.agent?.metadata || !data?.agent?.persona) {
      return null;
    }

    const { metadata, persona: personaData } = data.agent;
    const fallback = BMAD_AGENT_FULL_PERSONAS[agentType];

    const principles = personaData.principles
      ? parsePrinciples(personaData.principles)
      : fallback.principles;

    const persona: BmadAgentFullPersona = {
      type: agentType,
      name: metadata.name || fallback.name,
      title: metadata.title || fallback.title,
      icon: metadata.icon || fallback.icon,
      expertise: fallback.expertise,
      perspective: personaData.role || fallback.perspective,
      identity: personaData.identity || fallback.identity,
      communicationStyle: personaData.communication_style || fallback.communicationStyle,
      principles,
    };

    return { type: agentType, persona };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[Athena] Failed to parse agent YAML at ${filePath}: ${errorMessage}`);
    return null;
  }
}

async function loadFromYamlFiles(
  agentFiles: string[]
): Promise<Map<BmadAgentType, BmadAgentFullPersona>> {
  const personas = new Map<BmadAgentType, BmadAgentFullPersona>();

  for (const filePath of agentFiles) {
    const result = await parseAgentYaml(filePath);
    if (result) {
      personas.set(result.type, result.persona);
    }
  }

  return personas;
}

export async function loadPersonas(
  projectRoot: string
): Promise<Map<BmadAgentType, BmadAgentFullPersona>> {
  const agentFiles = await findAgentFiles(projectRoot);

  if (agentFiles.length > 0) {
    const yamlPersonas = await loadFromYamlFiles(agentFiles);

    if (yamlPersonas.size > 0) {
      const merged = new Map<BmadAgentType, BmadAgentFullPersona>();

      for (const [type, persona] of Object.entries(BMAD_AGENT_FULL_PERSONAS)) {
        merged.set(type as BmadAgentType, persona);
      }

      for (const [type, persona] of yamlPersonas) {
        merged.set(type, persona);
      }

      return merged;
    }
  }

  return new Map(
    Object.entries(BMAD_AGENT_FULL_PERSONAS) as [BmadAgentType, BmadAgentFullPersona][]
  );
}

export function getPersona(
  personas: Map<BmadAgentType, BmadAgentFullPersona>,
  agentType: BmadAgentType
): BmadAgentFullPersona {
  return personas.get(agentType) || BMAD_AGENT_FULL_PERSONAS[agentType];
}

export function selectAgentsForFinding(category: string, severity: string): BmadAgentType[] {
  const agents: BmadAgentType[] = [];

  switch (category) {
    case "security":
      agents.push("architect", "dev", "tea");
      break;
    case "logic":
      agents.push("dev", "tea", "analyst");
      break;
    case "performance":
      agents.push("architect", "dev");
      break;
    case "bestPractices":
      agents.push("dev", "tech-writer");
      break;
    default:
      agents.push("dev", "architect");
  }

  if (severity === "high" && !agents.includes("pm")) {
    agents.push("pm");
  }

  return agents.slice(0, 3);
}

export function buildAgentSystemPrompt(
  persona: BmadAgentFullPersona,
  phase2Analysis?: string
): string {
  const principlesList = persona.principles.map((p) => `- ${p}`).join("\n");

  let prompt = `You are ${persona.name}, the ${persona.title} from the BMAD team.

**Your Icon**: ${persona.icon}
**Your Expertise**: ${persona.expertise.join(", ")}
**Your Perspective**: ${persona.perspective}

**Your Identity**:
${persona.identity}

**Your Communication Style**:
${persona.communicationStyle}

**Your Principles**:
${principlesList}

**Response Guidelines**:
- Stay in character as ${persona.name}
- Speak from your ${persona.perspective} perspective
- Be concise but substantive (2-4 sentences per point)
- Reference other agents by name when building on or disagreeing with their points
- Use your icon ${persona.icon} at the start of your responses`;

  if (phase2Analysis) {
    prompt += `

**Your Previous Analysis** (from Phase 2):
${phase2Analysis}

Use your previous analysis to inform this discussion. You already have context on these findings.`;
  }

  return prompt;
}

export const _testExports = {
  filenameToAgentType,
  parsePrinciples,
  parseAgentYaml,
  loadFromYamlFiles,
};
