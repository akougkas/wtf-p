# WTF-P (Write The Freaking Paper)

WTF-P is a context engineering toolkit designed to structure academic writing with AI assistants (specifically tailored for Claude Code, but adaptable). It transforms the writing process from a simple chat into a rigorous, spec-driven workflow involving planning, execution, and verification phases.

## Project Overview

- **Purpose:** To provide a structured, verifiable, and state-aware system for writing academic papers using AI. It solves common issues like hallucinated citations and loss of context in long documents.
- **Core Concept:** "Context Engineering" — preparing precise inputs and specifications (Markdown files) to guide the AI's output.
- **Key Components:**
    - **CLI (`bin/`):** Node.js scripts for installing and uninstalling the tool (copying files to the user's configuration).
    - **Commands (`commands/wtfp/`):** Markdown files defining the `/wtfp:*` slash commands available to the AI.
    - **Workflows (`write-the-f-paper/workflows/`):** Detailed instructional files for specific writing tasks (e.g., planning a section, reviewing text).
    - **Templates (`write-the-f-paper/templates/`):** Scaffolding for various document types and academic venues.

## Building and Running

This project is a CLI tool that installs configuration files for an AI assistant.

### Installation & Setup
To install the tool locally for development or usage:
```bash
# Install dependencies
npm install

# Run the installer locally (simulates npx wtf-p --local)
node bin/install.js --local
```

### Testing
The project includes sanity checks and integration tests.
```bash
# Run sanity tests (checks file structure and package config)
npm test

# Run integration tests
npm run test:integration

# Run all tests
npm run test:all
```

### Scripts
- `npm run preflight`: Runs `scripts/preflight.js` (likely pre-release checks).
- `npm run release`: Runs `scripts/release.js` for release management.

## Development Conventions

### Command Architecture
New commands live in `commands/wtfp/` and must follow a strict Markdown format:
- **YAML Frontmatter:** Defines `name`, `description`, and `allowed-tools`.
- **Structure:** Must include `<objective>`, `<context>`, and `<process>` XML-like blocks.
- **Interaction:** ALWAYS use the `AskUserQuestion` tool for user input. Never ask inline text questions.

### Workflows & Compression
Workflows in `write-the-f-paper/workflows/` often have two versions:
- `*.md`: Verbose, human-readable version.
- `*.wcn.md`: "Workflow Compression Notation" version for token efficiency.

### Contribution Guidelines
- **Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat(commands): add x`, `fix(cli): fix y`).
- **JavaScript Style:** Use `const`/`let`, async/await, and descriptive variable names.
- **Testing:** New features should be tested locally using `node bin/install.js --local` and verifying behavior in the AI session.

### Naming Conventions
- `new-*`: Initialize a new entity (e.g., `new-paper`).
- `create-*`: Generate structure (e.g., `create-outline`).
- `plan-*`: Planning phase actions.
- `write-*`: Execution phase actions.
- `review-*`: Verification phase actions.
