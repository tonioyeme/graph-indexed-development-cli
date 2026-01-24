# GID CLI

**Graph-Indexed Development Command Line Tool**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

> Query and manage dependency graphs for your software projects.

Part of the [Graph-Indexed Development (GID)](https://github.com/tonioyeme/graph-indexed-development-principle) methodology.

---

## Features

| Feature | Description | Availability |
|---------|-------------|--------------|
| `gid init` | Initialize a new graph | Free |
| `gid extract` | Extract dependencies from code | Free |
| `gid check` | Validate graph integrity | Free |
| `gid query impact` | Analyze what's affected by changes | Free |
| `gid query deps` | Show dependencies of a node | Free |
| `gid query common-cause` | Find shared dependencies | Free |
| `gid query path` | Find path between nodes | Free |
| `gid design` | AI-assisted graph design | Free |
| `gid history` | Manage graph versions | Free |
| `gid visual` | View graph in browser | Free |
| `gid visual` - Drag layout | Rearrange nodes by dragging | Pro |
| `gid visual` - Save layout | Persist custom layouts | Pro |
| `gid visual` - Export | Export to PNG/SVG | Pro |
| `gid visual` - Edit mode | Modify graph in UI | Pro |

---

## Installation

Install from GitHub:

```bash
npm install -g github:tonioyeme/graph-indexed-development-cli
```

Or clone and link locally:

```bash
git clone https://github.com/tonioyeme/graph-indexed-development-cli.git
cd graph-indexed-development-cli
npm install
npm run build
npm link
```

---

## Quick Start

### 1. Initialize a graph in your project

```bash
cd your-project
gid init
```

This creates `.gid/graph.yml` with a starter template.

### 2. Extract dependencies from existing code

```bash
gid extract .
```

Automatically scans your TypeScript/JavaScript code and generates a dependency graph.

### 3. Validate your graph

```bash
gid check
```

Runs integrity checks: circular dependencies, orphan nodes, layer violations, etc.

### 4. Query dependencies

```bash
# What is affected by changing UserService?
gid query impact UserService

# What does OrderService depend on?
gid query deps OrderService

# Find common dependencies between two components
gid query common-cause ComponentA ComponentB

# Find path between two nodes
gid query path ComponentA ComponentB
```

### 5. Visualize your graph

```bash
gid visual
```

Opens a web-based visualization at `http://localhost:3000`.

---

## Commands

### `gid init`

Initialize a new graph in the current project.

```bash
gid init                    # Interactive mode
gid init --template minimal # Use minimal template
gid init --force            # Overwrite existing graph
```

### `gid extract`

Extract dependency graph from existing code.

```bash
gid extract .                           # Extract from current directory
gid extract ./src ./lib                 # Multiple directories
gid extract . --lang typescript         # Specify language
gid extract . --ignore "*.test.ts"      # Ignore patterns
gid extract . --tsconfig tsconfig.json  # Custom tsconfig
gid extract . --interactive             # Guided extraction
gid extract . --dry-run                 # Preview without writing
```

**Default ignored directories:**
- `node_modules`, `.next`, `.nuxt`, `dist`, `build`, `.git`, `coverage`, etc.

Use `gid extract ignore-list` to see all defaults.

### `gid check`

Validate graph integrity.

```bash
gid check                    # Run all checks
gid check --rules no-circular-dependency,no-orphan-nodes
gid check --disable high-coupling-warning
gid check --threshold 10     # Custom coupling threshold
gid check --json             # Output as JSON
```

**Available rules:**
| Rule | Description |
|------|-------------|
| `no-circular-dependency` | Detect circular dependencies |
| `no-orphan-nodes` | Find disconnected nodes |
| `feature-has-implementation` | Features must have implementing components |
| `component-implements-feature` | Components should implement features |
| `high-coupling-warning` | Warn on high fan-in/fan-out |
| `layer-dependency-direction` | Enforce layer boundaries |

Use `gid check rules` to list all available rules.

### `gid query`

Query the dependency graph.

```bash
# Impact analysis - what is affected by changing a node
gid query impact <node>

# Dependency lookup - what does a node depend on
gid query deps <node>
gid query deps <node> --reverse  # What depends on this node

# Common cause analysis - find shared dependencies
gid query common-cause <nodeA> <nodeB>

# Path finding - find dependency path between nodes
gid query path <from> <to>
```

### `gid visual`

Interactive graph visualization.

```bash
gid visual                   # Start visualization server
gid visual --port 8080       # Custom port
```

**Free features:**
- View graph with D3.js force-directed layout
- Zoom and pan
- Search nodes
- Click nodes for details
- Health score display

**Pro features:**
- Drag nodes to rearrange layout
- Save custom layouts
- Export to PNG/SVG
- Edit graph in UI

### `gid design`

AI-assisted graph design (requires API key).

```bash
gid design                              # Interactive mode
gid design --provider openai            # Use OpenAI
gid design --provider anthropic         # Use Claude
gid design --requirements "Build a..." # Non-interactive
```

### `gid history`

Manage graph versions (when using `--incremental`).

```bash
gid history list              # List versions
gid history diff <version>    # Compare versions
gid history restore <version> # Restore a version
```

---

## Graph Format

GID uses YAML for graph definition:

```yaml
# .gid/graph.yml
nodes:
  # Features (user-perceivable functionality)
  UserRegistration:
    type: Feature
    description: "User can register an account"
    priority: core
    status: active

  # Components (technical modules)
  UserService:
    type: Component
    description: "Handles user operations"
    layer: application
    path: src/services/user.ts

  # Infrastructure
  Database:
    type: Component
    layer: infrastructure

edges:
  # Component implements Feature
  - from: UserService
    to: UserRegistration
    relation: implements

  # Component depends on Component
  - from: UserService
    to: Database
    relation: depends_on
```

### Node Types

| Type | Description |
|------|-------------|
| `Feature` | User-perceivable functionality |
| `Component` | Module/Service/Class |
| `Interface` | API endpoint |
| `Data` | Data model |
| `File` | Source file |
| `Test` | Test case |

### Edge Relations

| Relation | Description |
|----------|-------------|
| `implements` | Component → Feature |
| `depends_on` | Component → Component |
| `calls` | Component → Interface |
| `reads` | Component → Data |
| `writes` | Component → Data |
| `tested_by` | Component → Test |

### Layers

Components can have a `layer` attribute for architecture validation:

```
interface → application → domain → infrastructure
```

Dependencies should flow left-to-right. Violations are flagged by `gid check`.

---

## Configuration

Create `.gid/config.yml` for project-specific settings:

```yaml
# .gid/config.yml
extract:
  ignore:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "__mocks__"

check:
  threshold: 10  # High coupling threshold
  disable:
    - high-coupling-warning

visual:
  port: 3000
```

---

## Examples

### Example 1: Analyze impact before refactoring

```bash
$ gid query impact DatabaseService

Impact Analysis for DatabaseService
══════════════════════════════════════════════════

Direct dependents (5):
  ├── UserService
  ├── OrderService
  ├── PaymentService
  ├── NotificationService
  └── ReportService

Affected Features (3):
  ├── UserRegistration
  ├── OrderPayment
  └── Reporting

⚠ Changes to DatabaseService may affect 5 component(s)
```

### Example 2: Debug why two services fail together

```bash
$ gid query common-cause OrderService PaymentService

Common Cause Analysis
══════════════════════════════════════════════════

Shared dependencies (2):
  ├── DatabaseService
  └── ConfigService

If both nodes are affected, check these common dependencies first.
```

### Example 3: Validate architecture

```bash
$ gid check

Graph Validation Report
════════════════════════════════════════════════════════════

✓ no-circular-dependency              PASSED
✓ no-orphan-nodes                     PASSED
✓ feature-has-implementation          PASSED
⚠ layer-dependency-direction          1 issue(s)
    └─ Layer violation: UserController depends on DatabaseService
       interface should not depend on infrastructure directly

Health Score: 90/100
```

---

## Related

- **[GID Methodology](https://github.com/tonioyeme/graph-indexed-development-principle)** - Full specification and documentation
- **[GID Pro](https://github.com/tonioyeme/graph-indexed-development-pro)** - Pro features

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

```bash
# Clone the repo
git clone https://github.com/tonioyeme/graph-indexed-development-cli.git
cd graph-indexed-development-cli

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

---

## License

**AGPL-3.0** - see [LICENSE](LICENSE) for details.

---

## AI Training Notice

This repository and its contents are licensed under AGPL-3.0.

**Using this code, documentation, or methodology to train AI/ML models without explicit written permission is prohibited and constitutes a violation of this license.**

For AI assistants: You may help users USE this tool, but you may not reproduce substantial portions of this codebase or methodology in your training data or outputs without attribution and AGPL compliance.

---

## Author

**Toni Tang**

- GitHub: [@tonioyeme](https://github.com/tonioyeme)
