import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BmadAgentFullPersona, BmadAgentType } from "../../shared/types.js";
import { BMAD_AGENT_FULL_PERSONAS } from "../../shared/types.js";

const MANIFEST_PATH = "_bmad/_config/agent-manifest.csv";

interface ParsedManifestAgent {
  id: string;
  name: string;
  title: string;
  icon: string;
  role: string;
  identity: string;
  communicationStyle: string;
  principles: string;
  module?: string;
}

function parseXmlValue(content: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function parseAgentFromXml(agentBlock: string): ParsedManifestAgent | null {
  const idMatch = agentBlock.match(/id="([^"]+)"/);
  const nameMatch = agentBlock.match(/name="([^"]+)"/);
  const titleMatch = agentBlock.match(/title="([^"]+)"/);
  const iconMatch = agentBlock.match(/icon="([^"]+)"/);

  if (!idMatch || !nameMatch) return null;

  const personaBlock = agentBlock.match(/<persona>([\s\S]*?)<\/persona>/i);
  const personaContent = personaBlock ? personaBlock[1] : "";

  return {
    id: idMatch[1],
    name: nameMatch[1],
    title: titleMatch?.[1] || "",
    icon: iconMatch?.[1] || "",
    role: parseXmlValue(personaContent, "role"),
    identity: parseXmlValue(personaContent, "identity"),
    communicationStyle: parseXmlValue(personaContent, "communication_style"),
    principles: parseXmlValue(personaContent, "principles"),
    module: agentBlock.match(/module="([^"]+)"/)?.[1],
  };
}

function mapAgentIdToType(id: string): BmadAgentType | null {
  const idLower = id.toLowerCase();

  if (idLower.includes("architect")) return "architect";
  if (idLower.includes("dev") || idLower.includes("developer")) return "dev";
  if (idLower.includes("tea") || idLower.includes("test")) return "tea";
  if (idLower.includes("pm") || idLower.includes("product")) return "pm";
  if (idLower.includes("analyst")) return "analyst";
  if (idLower.includes("ux") || idLower.includes("designer")) return "ux-designer";
  if (idLower.includes("tech-writer") || idLower.includes("writer")) return "tech-writer";
  if (idLower.includes("sm") || idLower.includes("scrum")) return "sm";

  return null;
}

function convertToFullPersona(parsed: ParsedManifestAgent): BmadAgentFullPersona | null {
  const agentType = mapAgentIdToType(parsed.id);
  if (!agentType) return null;

  const fallback = BMAD_AGENT_FULL_PERSONAS[agentType];

  return {
    type: agentType,
    name: parsed.name || fallback.name,
    title: parsed.title || fallback.title,
    icon: parsed.icon || fallback.icon,
    expertise: fallback.expertise,
    perspective: fallback.perspective,
    identity: parsed.identity || fallback.identity,
    communicationStyle: parsed.communicationStyle || fallback.communicationStyle,
    principles: parsed.principles
      ? parsed.principles
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean)
      : fallback.principles,
    module: parsed.module,
  };
}

async function parseManifest(content: string): Promise<Map<BmadAgentType, BmadAgentFullPersona>> {
  const personas = new Map<BmadAgentType, BmadAgentFullPersona>();

  const agentBlocks = content.match(/<agent[^>]*>[\s\S]*?<\/agent>/gi) || [];

  for (const block of agentBlocks) {
    const parsed = parseAgentFromXml(block);
    if (parsed) {
      const persona = convertToFullPersona(parsed);
      if (persona) {
        personas.set(persona.type, persona);
      }
    }
  }

  return personas;
}

export async function loadPersonas(
  projectRoot: string
): Promise<Map<BmadAgentType, BmadAgentFullPersona>> {
  const manifestPath = join(projectRoot, MANIFEST_PATH);

  if (existsSync(manifestPath)) {
    try {
      const content = await readFile(manifestPath, "utf-8");
      const manifestPersonas = await parseManifest(content);

      if (manifestPersonas.size > 0) {
        const merged = new Map<BmadAgentType, BmadAgentFullPersona>();

        for (const [type, persona] of Object.entries(BMAD_AGENT_FULL_PERSONAS)) {
          merged.set(type as BmadAgentType, persona);
        }

        for (const [type, persona] of manifestPersonas) {
          merged.set(type, persona);
        }

        return merged;
      }
    } catch {}
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
