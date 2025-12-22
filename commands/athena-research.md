---
description: Research patterns, implementations, or documentation using Librarian
---

# Athena Research - Librarian-Powered Research

Use Librarian, the research specialist, to find patterns, examples, and documentation.

## When to Use This Command

- Finding implementation examples in the codebase
- Researching design patterns to apply
- Looking up library/framework documentation
- Understanding unfamiliar parts of the codebase

## Step 1: Define Your Research Question

Be specific about what you need:
- "How is authentication implemented in this project?"
- "Find examples of API endpoint patterns"
- "What testing patterns are used for React components?"
- "How do other parts of the code handle error states?"

## Step 2: Invoke Librarian

Ask @librarian to research:

```
@librarian I need to implement <feature>.

Context:
- Using <technology/framework>
- Per architecture: <relevant pattern>
- Similar to: <any existing code reference>

Please find:
1. Examples in this codebase
2. Best practices for this pattern
3. Any relevant documentation
```

### Librarian Research Process

Librarian will:
1. Search the codebase for relevant patterns
2. Use documentation lookup tools (context7)
3. Search for examples online if needed (exa)
4. Search GitHub for similar implementations (grep_app)

### Research Sources

- **Local Codebase**: Find patterns already in use
- **context7**: Look up library documentation
- **websearch_exa**: Find tutorials and guides
- **grep_app**: Find GitHub examples

## Step 3: Synthesize Findings

Librarian will provide:
- Summary of relevant patterns found
- Code examples from the codebase
- External references for deeper reading
- Recommendations for your specific case

## Step 4: Apply to Your Task

Use the research to inform your implementation:
- Follow established patterns in the codebase
- Apply best practices from documentation
- Adapt examples to your specific needs

## Available Research Tools

Librarian has access to:
- **Codebase search**: Find patterns in your project
- **context7 MCP**: Official documentation lookup
- **grep.app MCP**: Search GitHub public repositories
- **websearch_exa MCP**: General web search
