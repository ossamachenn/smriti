# Smriti - Conversation Memory System

**Smriti** (from Sanskrit "memory") is a unified memory system that stores, searches, and recalls conversations, knowledge base, and interactions with all AI agents. It leverages local LLMs, hybrid search (BM25 + vector embeddings), and SQLite for persistent, token-efficient context retrieval.

## Project Overview

Smriti extends QMD (the on-device search engine) with a **conversation memory layer** that allows you to:

1. **Automatically save** all conversations with Claude Code, Ollama, and other agents
2. **Search** across past interactions using full-text search (BM25) and semantic vector search
3. **Recall** relevant context with optional Ollama synthesis
4. **Summarize** sessions to compress knowledge
5. **Embed** messages for vector-based semantic search

### Architecture

```
┌─────────────────────────────────────────┐
│         Claude Code / Other Agents      │
└────────────────┬────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │   Auto-Save Hook Layer     │ (save-memory.sh)
    │   Stores to SQLite         │
    └────────────┬───────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │     Smriti Memory Storage              │
    │  (~/.cache/qmd/index.sqlite)           │
    │                                        │
    │  • memory_sessions                     │
    │  • memory_messages                     │
    │  • memory_fts (FTS5 index)            │
    │  • content_vectors (embeddings)        │
    └────────────┬─────────────────────────┘
                 │
         ┌───────┴──────────┐
         ▼                  ▼
    Full-Text Search    Vector Search
    (BM25 + porter)     (sqlite-vec + RRF)
         │                  │
         └───────┬──────────┘
                 ▼
         Recall + Synthesis
         (via Ollama or inject raw)
```

## Setup

### Prerequisites

- **Bun** >= 1.0
- **Ollama** (optional, for summarization and synthesis)
  - Running at `http://127.0.0.1:11434` (configurable via `OLLAMA_HOST`)
  - With model `qwen3:8b-tuned` (configurable via `QMD_MEMORY_MODEL`)
- **SQLite3** (bundled with Bun)
- **Node-llama-cpp** (for embeddings via embeddinggemma)

### Installation

```bash
bun install
```

### Environment

Create `.env.local` (optional):

```env
OLLAMA_HOST=http://127.0.0.1:11434
QMD_MEMORY_MODEL=qwen3:8b-tuned
SMRITI_DB_PATH=~/.cache/qmd/index.sqlite
```

## Usage

All commands use `qmd memory <subcommand>`. This integrates with the system-wide QMD installation.

### Manual Commands

#### Save a conversation

```bash
# Start a new session and save messages
qmd memory save <session-id> user "How do I configure Ollama?"
qmd memory save <session-id> assistant "You can configure Ollama by..."

# Or create a new session with auto-generated ID
qmd memory save new user "What is RAG?"
# Returns: Session created with ID: abc123
```

#### Import transcript from file

```bash
# Import from a chat transcript (supports chat and jsonl formats)
qmd memory save-transcript ~/transcript.txt --title "Setup Session"
qmd memory save-transcript ~/export.jsonl --title "Agent Logs" --format jsonl
```

#### List sessions

```bash
# List all sessions (default: 5 most recent)
qmd memory list

# List all sessions with pagination
qmd memory list -n 20 --all

# JSON output
qmd memory list --json
```

#### Show session content

```bash
# Show messages in a session
qmd memory show <session-id>

# Show as JSON
qmd memory show <session-id> --json

# Show only first 10 messages
qmd memory show <session-id> -l 10
```

#### Search memory

```bash
# Full-text + vector search (BM25 + semantic)
qmd memory search "how to configure Ollama"

# Get top 10 results
qmd memory search "GPU settings" -n 10

# JSON output
qmd memory search "local models" --json

# CSV output
qmd memory search "setup instructions" --csv

# Full document snippets
qmd memory search "authentication" --full
```

#### Recall with context synthesis

```bash
# Retrieve relevant past context (BM25 + vector, deduplicated by session)
qmd memory recall "GPU settings for Ollama"

# Get top 5 sessions with relevant messages
qmd memory recall "model configuration" -n 5

# Synthesize into a single coherent context block via Ollama
qmd memory recall "local deployment" --synthesize

# Customize the synthesizing model
qmd memory recall "setup process" --synthesize --model qwen3:0.5b

# Control synthesis output length
qmd memory recall "troubleshooting" --synthesize --max-tokens 200
```

#### Embed messages for vector search

```bash
# Create embeddings for all new unembedded messages
qmd memory embed

# Prints progress, e.g.: "Embedded 42 new messages (850 tokens)"
```

#### Summarize sessions

```bash
# Summarize a single session via Ollama
qmd memory summarize <session-id>

# Summarize all recent sessions
qmd memory summarize

# Force re-summarization even if already done
qmd memory summarize <session-id> --force

# Use a different model for summarization
qmd memory summarize <session-id> --model mistral:7b
```

#### Memory status

```bash
# Show statistics
qmd memory status

# Output:
# Sessions: 15 (3 active, 12 archived)
# Messages: 284 (198 embedded, 86 unembedded)
# Oldest session: 2026-02-01
# Latest: 2026-02-10
# Storage: 2.3 MB
```

#### Clear/delete sessions

```bash
# Soft-delete a session (marks as inactive)
qmd memory clear <session-id>

# Soft-delete all sessions
qmd memory clear

# Permanently hard-delete
qmd memory clear <session-id> --hard
qmd memory clear --hard  # All sessions permanently deleted
```

## Auto-Save Hook (Claude Code Integration)

Every conversation with Claude Code is automatically saved to Smriti via a hook script.

### How it works

1. **Hook location**: `~/.claude/hooks/save-memory.sh`
2. **Trigger**: Fires on every `Stop` event (after Claude finishes a response)
3. **Operation**: Reads the session transcript JSONL, finds new messages since last run, and saves them
4. **State tracking**: `~/.cache/qmd/memory-hooks/<session-id>.lines` tracks progress
5. **Silent & async**: Runs in background, doesn't block your conversation

### Configuration

Already configured in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "type": "script",
        "command": "bash ~/.claude/hooks/save-memory.sh"
      }
    ]
  }
}
```

No action needed — just talk to Claude Code normally.

## Workflow Examples

### Example 1: Search past context before asking a new question

```bash
# You're starting a new Claude Code session and want to recall how you set up Ollama
qmd memory recall "ollama setup GPU configuration" -n 3

# Output: 3 most relevant snippets from past sessions
# Copy one into your new prompt to give Claude context
```

### Example 2: Build embeddings and do vector search

```bash
# After a few conversations, embed for better semantic search
qmd memory embed

# Now search by meaning instead of keywords
qmd memory search "local model inference"  # Finds semantically similar messages
qmd memory vsearch "how to run models locally"  # Pure vector search
```

### Example 3: Compress knowledge via synthesis

```bash
# Recall and synthesize 5 relevant sessions into one coherent summary
qmd memory recall "authentication flow" -n 5 --synthesize

# Ollama produces: "Based on your past conversations..."
# Much more concise than 5 separate snippets
```

### Example 4: Import old chat logs

```bash
# You have a chat transcript from another tool
qmd memory save-transcript ~/old-conversation.txt --title "OpenFGA Setup"

# Now search across both new and old memories
qmd memory search "OpenFGA"
```

## Database Schema

Smriti uses SQLite with the following tables (in `~/.cache/qmd/index.sqlite`):

```sql
-- Sessions
memory_sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  summary TEXT,
  summary_at DATETIME,
  active BOOLEAN DEFAULT 1
)

-- Messages
memory_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES memory_sessions(id),
  role TEXT NOT NULL,  -- 'user', 'assistant', 'a', etc.
  content TEXT NOT NULL,
  hash TEXT UNIQUE,  -- SHA256(content)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
)

-- Full-text search index (FTS5)
memory_fts (
  session_title,
  role,
  content,
  -- Triggers auto-sync from memory_sessions/memory_messages
)

-- Embeddings (shared with QMD's document search)
content_vectors (
  hash TEXT PRIMARY KEY REFERENCES memory_messages(hash),
  embedding BLOB  -- 384-dim vector from embeddinggemma
)
```

## API Reference (TypeScript)

### Core Exports

```typescript
import {
  // Session management
  createSession,
  getSession,
  listSessions,
  deleteSession,
  clearAllSessions,

  // Message management
  addMessage,
  getMessages,
  getSessionTranscript,

  // Search
  searchMemoryFTS,
  searchMemoryVec,
  recallMemories,

  // Embedding & summarization
  embedMemoryMessages,
  summarizeSession,
  summarizeRecentSessions,

  // Import
  importTranscript,

  // Status
  getMemoryStatus,

  // Schema
  initializeMemoryTables,
} from "./src/memory.ts";

import {
  ollamaChat,
  ollamaSummarize,
  ollamaRecall,
  ollamaHealthCheck,
} from "./src/ollama.ts";
```

### Example: Programmatic Usage

```typescript
import { Database } from "bun:sqlite";
import {
  createSession,
  addMessage,
  searchMemoryFTS,
  recallMemories,
  initializeMemoryTables,
} from "./src/memory.ts";

const db = new Database("~/.cache/qmd/index.sqlite");
initializeMemoryTables(db);

// Create a session
const session = createSession(db, {
  title: "My Research Session",
});

// Add messages
await addMessage(db, session.id, "user", "What is RAG?");
await addMessage(db, session.id, "assistant", "RAG stands for...");

// Search
const results = searchMemoryFTS(db, "RAG retrieval", 5);
console.log(results);

// Recall with deduplication
const recalled = recallMemories(db, "how does retrieval work", { limit: 3 });
console.log(recalled);
```

## Token Savings

The key benefit of Smriti: **avoid stuffing entire conversation histories into your LLM's context window**.

**Without Smriti:**
- 10 past sessions × ~2000 tokens each = **20,000 tokens** in context
- Most of it irrelevant to your new question

**With Smriti:**
- `qmd memory recall "<question>"` → ~3-5 relevant snippets = **~500 tokens**
- 40x reduction per query

**With synthesis (Ollama):**
- `qmd memory recall "<question>" --synthesize` → 1 coherent paragraph = **~100-200 tokens**
- 100x reduction

## Commands to Update CLAUDE.md

Update QMD CLAUDE.md to reference Smriti:

```bash
# Link to Smriti docs
# cd /path/to/qmd && echo "See /Users/zero8/zero8.dev/smriti/CLAUDE.md for memory layer docs" >> CLAUDE.md
```

## Files

- **src/memory.ts** — Memory storage, search, embedding, recall
- **src/ollama.ts** — Ollama API client (summarize, synthesis, health check)
- **src/formatter.ts** — Output formatting (JSON, CSV, Markdown, CLI)
- **src/cli/memory.ts** — CLI entry point (wired into QMD)
- **src/index.ts** — Main entry point
- **~/.claude/hooks/save-memory.sh** — Auto-save hook script
- **CLAUDE.md** — This file

## Development

Run tests:

```bash
bun test
```

Run in dev mode with hot reload:

```bash
bun --hot src/index.ts
```

Build for production:

```bash
bun build src/index.ts --outdir dist
```

## Key Design Decisions

1. **Embeddings share QMD's tables**: Message hashes go into `content_vectors` + `vectors_vec`, avoiding duplicate storage
2. **Two-step vector search**: Query `vectors_vec` first, then JOIN separately to avoid sqlite-vec hang
3. **Ollama for synthesis only**: Fast local `embeddinggemma` for embeddings; Ollama (qwen3:8b-tuned) handles chat/summarization
4. **Session-based grouping**: Messages belong to sessions; recall deduplicates and pulls surrounding context
5. **Content-addressable**: Messages hashed with SHA256 (same as QMD documents)
6. **Auto-save via hooks**: Claude Code conversations saved without user action

## Troubleshooting

### "Ollama connection refused"
Ensure Ollama is running:
```bash
ollama serve
# Or check OLLAMA_HOST env var
```

### "Vector search returning no results"
Run `qmd memory embed` to create embeddings for new messages:
```bash
qmd memory embed
```

### "Database locked"
If SQLite is locked, ensure no other process is writing to `~/.cache/qmd/index.sqlite`:
```bash
lsof | grep index.sqlite
```

### "Session not found"
List sessions to verify IDs:
```bash
qmd memory list --json
```

## Future Enhancements

- [ ] Support for Anthropic Claude API (add `claude.ts` backend for summarization)
- [ ] Web UI for browsing sessions
- [ ] Automatic session summarization on idle
- [ ] Privacy mode (encrypt sensitive messages)
- [ ] Export sessions as PDF/markdown
- [ ] Integration with VS Code extension

## References

- **QMD**: https://github.com/yourusername/qmd
- **Ollama**: https://ollama.ai
- **SQLite FTS5**: https://www.sqlite.org/fts5.html
- **sqlite-vec**: Vector search extension for SQLite
- **node-llama-cpp**: Local embeddings via embeddinggemma

---

**Smriti** — Your memory layer for a more efficient AI workflow.
