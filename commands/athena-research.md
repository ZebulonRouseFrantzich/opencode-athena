---
description: Research patterns, implementations, or documentation using Librarian
---

# Athena Research - Librarian-Powered Research

Use Librarian, the research specialist, to find patterns, examples, and documentation from multiple sources.

**You are Sisyphus, the orchestrator.** You will coordinate Librarian's research capabilities with Explore for comprehensive information gathering.

## When to Use This Command

- Learning how to use an unfamiliar library or framework
- Finding implementation patterns for a specific use case
- Looking up official documentation and best practices
- Understanding how similar problems are solved in open source
- Researching before implementing a complex feature

## Step 1: Define Your Research Goals

### 1.1 Load Story Context (if researching for a story)

If this research is for an implementation task:

```
athena_get_story()
```

This provides:
- Story requirements (what you need to build)
- Architecture patterns (project conventions to follow)
- Technology constraints (what frameworks/libraries to use)

### 1.2 Clarify What You Need

Be specific about your research goals:

**Good research questions:**
- "How do I implement JWT authentication in Express.js with refresh tokens?"
- "What's the recommended way to handle form validation in React Hook Form?"
- "How should I structure a GraphQL resolver for nested relationships?"

**Vague research questions (too broad):**
- "How do I use React?" (too general)
- "What's a good database?" (no context)
- "Help me with authentication" (no specifics)

## Step 2: Multi-Source Research

### 2.1 Internal Codebase Research (Explore)

**First**, check what already exists in your codebase using **@explore**:

```
@explore I need to research existing patterns for {feature/technology}.

Please find:
1. Existing implementations of {similar functionality}
2. How {technology/pattern} is currently used in this project
3. Any established conventions or helpers for this use case
4. Related tests that show expected behavior

Return file paths with brief descriptions of what you found.
```

**Why start with Explore:**
- Discover existing patterns to follow
- Avoid reinventing what already exists
- Understand project-specific conventions
- Find code you can extend or reference

### 2.2 External Research (Librarian)

**Then**, use **@librarian** for external knowledge:

```
@librarian I need to research {topic} for my implementation.

## Context

**What I'm Building:**
{brief description of feature}

**Technology Stack:**
{relevant frameworks, libraries, versions}

**Project Constraints:**
{any architectural constraints from athena_get_story or project knowledge}

**What Explore Found:**
{brief summary of internal patterns, if any}

## Research Questions

1. **Best Practices:** What are the recommended patterns for {specific thing}?
2. **Official Documentation:** What does the official {library} documentation say about {specific API/feature}?
3. **Common Pitfalls:** What mistakes do developers commonly make with {technology}?
4. **Examples:** How have other production projects implemented {similar feature}?

## Desired Output

Please provide:
1. **Summary** - Key findings in 2-3 paragraphs
2. **Code Examples** - Concrete implementation examples
3. **Recommendations** - What approach I should take given my constraints
4. **Sources** - Links to documentation and references for further reading
```

### 2.3 Parallel Research (Optional)

For comprehensive research, run **multiple Librarian queries in parallel**:

```
# Background task 1: Official documentation
@librarian Research official {library} documentation for {specific feature}.
Focus on API reference and official examples.

# Background task 2: GitHub examples
@librarian Search GitHub for production implementations of {feature}.
Focus on well-maintained repos with similar tech stack.

# Background task 3: Best practices
@librarian Find articles and guides about best practices for {pattern}.
Focus on recent content (2024+) and authoritative sources.
```

## Step 3: Research by Use Case

### Use Case A: Learning a New Library

```
@librarian I need to learn how to use {library} for {specific purpose}.

**My Goal:** {what you want to accomplish}
**My Stack:** {your project's relevant technologies}
**My Experience:** {what you already know about similar tools}

Please research:
1. **Getting Started** - How to set up and configure {library}
2. **Core Concepts** - Key abstractions and patterns to understand
3. **API Reference** - Main APIs I'll need for {specific purpose}
4. **Examples** - Code examples for my use case
5. **Gotchas** - Common mistakes and how to avoid them
```

### Use Case B: Design Pattern Research

```
@librarian I need to research the best pattern for {specific problem}.

**Problem:** {describe the problem you're solving}
**Constraints:** {technical constraints, performance requirements, etc.}
**Options Considered:** {patterns you're aware of}

Please research:
1. **Pattern Comparison** - Compare {pattern A} vs {pattern B} for my use case
2. **Trade-offs** - Pros and cons of each approach
3. **Real-World Usage** - How production codebases handle this
4. **Recommendation** - Which pattern fits my constraints best
```

### Use Case C: Troubleshooting Research

```
@librarian I'm encountering {issue} with {technology} and need to understand why.

**The Issue:** {describe what's happening}
**Error Message:** {if applicable}
**What I've Tried:** {previous attempts}

Please research:
1. **Common Causes** - Why does this issue typically occur?
2. **Solutions** - How have others solved this?
3. **Root Cause** - What's the underlying reason for this behavior?
4. **Prevention** - How to avoid this in the future?
```

### Use Case D: Architecture Research

```
@librarian I need to make an architectural decision about {topic}.

**Context:** {what you're building}
**Scale:** {expected load, data volume, team size}
**Constraints:** {technical, business, or timeline constraints}

Please research:
1. **Industry Standards** - How do major companies handle this?
2. **Pattern Options** - What architectural patterns apply?
3. **Trade-off Analysis** - Pros/cons of each approach
4. **Case Studies** - Real examples of each approach in production
```

## Step 4: Synthesize and Apply

### 4.1 Combine Internal + External Findings

After receiving research results:

```markdown
## Research Summary for {topic}

### Internal Patterns (from Explore)
- {pattern 1 found in codebase}
- {pattern 2 found in codebase}
- {existing code to reference}

### External Best Practices (from Librarian)
- {best practice 1}
- {best practice 2}
- {recommended approach}

### Reconciliation
- **Follow:** {internal pattern if it aligns with best practices}
- **Adapt:** {external pattern to fit project conventions}
- **Decision:** {final approach to use}
```

### 4.2 Validate with Oracle (if needed)

For complex architectural decisions, consult **@oracle** to validate:

```
@oracle I've researched {topic} and want to validate my approach.

**Research Findings:**
{summary from Librarian}

**Proposed Approach:**
{what you plan to do}

**Questions:**
1. Does this approach fit our architecture?
2. Are there any risks I'm missing?
3. Is this the right trade-off for our use case?
```

### 4.3 Apply to Implementation

Use your research to guide implementation:

- Follow patterns found in the codebase (consistency)
- Apply best practices from documentation
- Avoid common pitfalls identified in research
- Reference the examples found for similar use cases

## Librarian's Research Sources

Librarian has access to multiple research tools:

| Source | Tool | Best For |
|--------|------|----------|
| **Official Docs** | context7 MCP | API references, official guides |
| **Web Search** | websearch_exa MCP | Tutorials, blog posts, articles |
| **GitHub** | grep.app MCP | Production code examples |
| **Codebase** | Internal tools | Project-specific patterns |

## Research Workflow Summary

```
┌─────────────────────────────────────────────────────────┐
│              1. DEFINE RESEARCH GOALS                    │
│  - Load story context (if applicable)                   │
│  - Clarify specific questions                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│            2. INTERNAL RESEARCH (@explore)               │
│  - Find existing patterns in codebase                   │
│  - Understand project conventions                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│           3. EXTERNAL RESEARCH (@librarian)              │
│  - Official documentation (context7)                    │
│  - Web articles and tutorials (exa)                     │
│  - GitHub examples (grep.app)                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              4. SYNTHESIZE FINDINGS                      │
│  - Combine internal + external knowledge                │
│  - Reconcile differences                                │
│  - Validate with Oracle (if architectural)              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│             5. APPLY TO IMPLEMENTATION                   │
│  - Follow established patterns                          │
│  - Apply best practices                                 │
│  - Reference examples                                   │
└─────────────────────────────────────────────────────────┘
```

## Tips for Effective Research

### Be Specific
- "How to validate email in Zod" beats "how to use Zod"
- Include version numbers when relevant
- Mention your constraints

### Use Multiple Sources
- Start with internal codebase (Explore)
- Then external documentation (Librarian)
- Cross-reference multiple sources

### Time-Box Research
- Set a goal for what you need to learn
- Don't over-research - get enough to start
- You can always research more if needed

### Document Findings
- Save useful patterns for future reference
- Note sources for deeper reading later
- Share findings with team (if applicable)

## Cost Awareness

- **@explore** is cheap/free - use liberally for codebase searches
- **@librarian** costs tokens - be specific with queries
- **Parallel research** is efficient - batch related queries
- **@oracle** is expensive - only for validating complex decisions
