# CLI Reference

## Ingestion

### `smriti ingest <agent>`

Import conversations from an AI agent into Smriti's memory.

| Agent | Source | Format |
|-------|--------|--------|
| `claude` / `claude-code` | `~/.claude/projects/*/*.jsonl` | JSONL |
| `codex` | `~/.codex/**/*.jsonl` | JSONL |
| `cursor` | `.cursor/**/*.json` (requires `--project-path`) | JSON |
| `file` / `generic` | Any file path | Chat or JSONL |
| `all` | All known agents at once | — |

```bash
smriti ingest claude
smriti ingest codex
smriti ingest cursor --project-path /path/to/project
smriti ingest file ~/transcript.txt --title "Planning Session" --format chat
smriti ingest all
```

**Options:**
- `--project-path <path>` — Project directory (required for Cursor)
- `--file <path>` — File path (for generic ingest)
- `--format <chat|jsonl>` — File format (default: `chat`)
- `--title <text>` — Session title
- `--session <id>` — Custom session ID
- `--project <id>` — Assign to a project

## Search

### `smriti search <query>`

Hybrid search across all memory using BM25 full-text and vector similarity.

```bash
smriti search "rate limiting"
smriti search "auth" --project myapp --agent claude-code
smriti search "deployment" --category decision --limit 10
smriti search "API design" --json
```

**Options:**
- `--category <id>` — Filter by category
- `--project <id>` — Filter by project
- `--agent <id>` — Filter by agent (`claude-code`, `codex`, `cursor`)
- `--limit <n>` — Max results (default: 20)
- `--json` — JSON output

### `smriti recall <query>`

Smart recall: searches, deduplicates by session, and optionally synthesizes results into a coherent summary.

```bash
smriti recall "how did we handle caching"
smriti recall "database setup" --synthesize
smriti recall "auth flow" --synthesize --model qwen3:0.5b --max-tokens 200
smriti recall "deployment" --project api --json
```

**Options:**
- `--synthesize` — Synthesize results into one summary via Ollama
- `--model <name>` — Ollama model for synthesis (default: `qwen3:8b-tuned`)
- `--max-tokens <n>` — Max synthesis output tokens
- All filter options from `search`

## Sessions

### `smriti list`

List recent sessions with optional filtering.

```bash
smriti list
smriti list --project myapp --agent claude-code
smriti list --category decision --limit 20
smriti list --all --json
```

**Options:**
- `--all` — Include inactive sessions
- `--json` — JSON output
- All filter options from `search`

### `smriti show <session-id>`

Display all messages in a session.

```bash
smriti show abc12345
smriti show abc12345 --limit 10
smriti show abc12345 --json
```

### `smriti status`

Memory statistics: session counts, message counts, agent breakdowns, project breakdowns, category distribution.

```bash
smriti status
smriti status --json
```

### `smriti projects`

List all registered projects.

```bash
smriti projects
smriti projects --json
```

## Categorization

### `smriti categorize`

Auto-categorize uncategorized sessions using rule-based matching and optional LLM classification.

```bash
smriti categorize
smriti categorize --session abc12345
smriti categorize --llm
```

**Options:**
- `--session <id>` — Categorize a specific session only
- `--llm` — Use Ollama LLM for ambiguous classifications

### `smriti tag <session-id> <category>`

Manually tag a session with a category.

```bash
smriti tag abc12345 decision/technical
smriti tag abc12345 bug/fix
```

### `smriti categories`

Show the category tree.

```bash
smriti categories
```

### `smriti categories add <id>`

Add a custom category.

```bash
smriti categories add infra/monitoring --name "Monitoring" --parent infra --description "Monitoring and observability"
```

## Embeddings

### `smriti embed`

Build vector embeddings for all unembedded messages. Required for semantic search.

```bash
smriti embed
```

## Team Sharing

### `smriti share`

Export sessions as markdown files to a `.smriti/` directory for git-based sharing.

```bash
smriti share --project myapp
smriti share --category decision
smriti share --session abc12345
smriti share --output /custom/path
```

### `smriti sync`

Import team knowledge from a `.smriti/` directory.

```bash
smriti sync
smriti sync --project myapp
smriti sync --input /custom/path
```

### `smriti team`

View team contributions (authors, counts, categories).

```bash
smriti team
```
