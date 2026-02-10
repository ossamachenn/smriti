# Configuration

Smriti uses environment variables for configuration. Bun auto-loads `.env` files, so you can set these in a `.env.local` file in the smriti directory.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `QMD_DB_PATH` | `~/.cache/qmd/index.sqlite` | Path to the shared SQLite database |
| `CLAUDE_LOGS_DIR` | `~/.claude/projects` | Claude Code session logs directory |
| `CODEX_LOGS_DIR` | `~/.codex` | Codex CLI session logs directory |
| `SMRITI_PROJECTS_ROOT` | `~/zero8.dev` | Root directory for project detection |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama API endpoint |
| `QMD_MEMORY_MODEL` | `qwen3:8b-tuned` | Ollama model for synthesis/summarization |
| `SMRITI_CLASSIFY_THRESHOLD` | `0.5` | Confidence below which LLM classification triggers |
| `SMRITI_AUTHOR` | `$USER` | Author name for team sharing |

## Projects Root

The `SMRITI_PROJECTS_ROOT` variable controls how Smriti derives project IDs from Claude Code session paths.

Claude Code encodes project paths in directory names like `-Users-zero8-zero8.dev-openfga`. Smriti reconstructs the real path and strips the projects root prefix:

| Claude Dir Name | Derived Project ID |
|----------------|-------------------|
| `-Users-zero8-zero8.dev-openfga` | `openfga` |
| `-Users-zero8-zero8.dev-avkash-regulation-hub` | `avkash/regulation-hub` |
| `-Users-zero8-zero8.dev` | `zero8.dev` |

To change the projects root:

```bash
export SMRITI_PROJECTS_ROOT="$HOME/projects"
```

## Database Location

By default, Smriti shares QMD's database at `~/.cache/qmd/index.sqlite`. This means your QMD document search and Smriti memory search share the same vector index — no duplication.

To use a separate database:

```bash
export QMD_DB_PATH="$HOME/.cache/smriti/memory.sqlite"
```

## Ollama Setup

Ollama is optional. It's used for:
- `smriti recall --synthesize` — Synthesize recalled context into a summary
- `smriti categorize --llm` — LLM-assisted categorization

Install and start Ollama:

```bash
# Install (macOS)
brew install ollama

# Start the server
ollama serve

# Pull the default model
ollama pull qwen3:8b-tuned
```

To use a different model:

```bash
export QMD_MEMORY_MODEL="mistral:7b"
```

## Claude Code Hook

The install script sets up an auto-save hook at `~/.claude/hooks/save-memory.sh`. This requires:

- **jq** — for parsing the hook's JSON input
- **Claude Code** — must be installed with hooks support

The hook is configured in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/.claude/hooks/save-memory.sh",
            "timeout": 30,
            "async": true
          }
        ]
      }
    ]
  }
}
```

To disable the hook, remove the entry from `settings.json` or set `SMRITI_NO_HOOK=1` during install.
