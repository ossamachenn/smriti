# Smriti

**Shared memory for AI-powered engineering teams.**

Built on top of [QMD](https://github.com/tobi/qmd) by Tobi Lütke.

---

## The Problem

Your team ships code with AI agents every day. Claude Code, Cursor, Codex — everyone has their own conversations, their own context, their own decisions buried in chat logs that nobody else can see.

Monday morning: your teammate spent three hours with Claude working through a tricky auth migration. Tuesday: you start a fresh session, ask the same questions, make the same mistakes, and arrive at a slightly different solution. The agent that helped your teammate yesterday has no idea it happened. Your agent has no idea either.

**Every AI session starts from zero.** There is no shared memory. No way for one agent to know what another figured out last week. No way for your Tuesday session to build on Monday's breakthroughs. Decisions, context, debugging insights, architectural choices — all of it evaporates the moment the conversation ends.

This is the biggest gap in AI-assisted development today. The agents are brilliant, but they're amnesic.

## What Smriti Does

Smriti (Sanskrit: *memory*) gives your team a shared memory layer that sits underneath all your AI agents.

Every conversation with every agent is automatically captured, indexed, and made searchable. When you start a new session, you can pull in exactly the context that matters — what was decided, what was tried, what worked — in a single command.

```bash
# What did we figure out about the auth migration?
smriti recall "auth migration approach"

# What has the team been working on?
smriti list --project myapp

# Search across every conversation, every agent, every teammate
smriti search "rate limiting strategy" --project api-service
```

Instead of pasting 20,000 tokens of old conversations into your prompt, Smriti retrieves the 500 tokens that actually matter. Your agents get the context they need without blowing up your token budget.

## The Workflow

Here's what changes when your team runs Smriti:

**1. Conversations are captured automatically**

A lightweight hook saves every Claude Code session in the background. No manual step, no copy-pasting. Your team's collective knowledge accumulates silently as everyone works.

**2. Context flows between sessions**

Starting a new coding session? Pull in what's relevant:

```bash
smriti recall "how did we handle database connection pooling" --synthesize
```

Smriti searches across full-text and semantic indexes, deduplicates by session, and optionally synthesizes the results into a single coherent summary via a local LLM. Your new session starts with the full picture, not a blank slate.

**3. Knowledge stays organized**

Sessions are automatically tagged by project, agent, and category. Search by what matters:

```bash
# Everything about deployment across all agents
smriti search "deployment" --category decision

# What has Cursor been used for on this project?
smriti list --agent cursor --project frontend

# All architectural decisions, team-wide
smriti search "architecture" --category decision
```

**4. Teams share context through git**

Export knowledge to a `.smriti/` directory in your project repo. Commit it. Your teammates pull it and import it into their local memory. No cloud service, no account, no sync infrastructure — just git.

```bash
# Share what you've learned
smriti share --project myapp --category decision

# Pull in what others have shared
smriti sync --project myapp
```

## Install

One command:

```bash
curl -fsSL https://raw.githubusercontent.com/zero8dotdev/smriti/main/install.sh | bash
```

This will:
- Install [Bun](https://bun.sh) if you don't have it
- Clone Smriti to `~/.smriti`
- Set up the `smriti` CLI
- Configure the Claude Code auto-save hook

### Requirements

- **macOS or Linux**
- **Git**
- **Bun** >= 1.0 (installed automatically)
- **jq** (for the auto-save hook)
- **Ollama** (optional — for local summarization and synthesis)

## Commands

```bash
# Ingest conversations from your AI agents
smriti ingest claude          # Claude Code sessions
smriti ingest codex           # Codex CLI sessions
smriti ingest cursor --project-path ./myapp
smriti ingest file transcript.txt --title "Planning Session"
smriti ingest all             # All known agents at once

# Search and recall
smriti search "query"         # Full-text + vector hybrid search
smriti recall "query"         # Smart recall with session deduplication
smriti recall "query" --synthesize  # Synthesize into one coherent summary

# Filter anything by project, agent, or category
smriti search "auth" --project myapp --agent claude-code
smriti list --category decision --project api

# Manage your memory
smriti status                 # Statistics across all agents
smriti list                   # Recent sessions
smriti show <session-id>      # Read a full session
smriti embed                  # Build vector embeddings for semantic search
smriti categorize             # Auto-categorize sessions
smriti projects               # List all tracked projects

# Team sharing
smriti share --project myapp  # Export to .smriti/ for git
smriti sync                   # Import teammates' shared knowledge
smriti team                   # View team contributions
```

## How It Works

```
  Claude Code    Cursor    Codex    Other Agents
       |           |         |          |
       v           v         v          v
  ┌──────────────────────────────────────────┐
  │          Smriti Ingestion Layer           │
  │   (auto-hook + manual ingest commands)   │
  └──────────────────┬───────────────────────┘
                     │
                     v
  ┌──────────────────────────────────────────┐
  │         Local SQLite Database             │
  │                                          │
  │  memory_sessions    memory_messages      │
  │  memory_fts (BM25)  content_vectors      │
  │  project metadata   category tags        │
  └──────────────────┬───────────────────────┘
                     │
            ┌────────┴────────┐
            v                 v
     Full-Text Search    Vector Search
     (BM25 + porter)     (embeddings + RRF)
            │                 │
            └────────┬────────┘
                     v
           Recall + Synthesis
           (optional, via Ollama)
```

Everything runs locally. Your conversations never leave your machine. The SQLite database, the embeddings, the search indexes — all on disk, all yours.

## Token Savings

The real value: **your agents get better context with fewer tokens.**

| Scenario | Without Smriti | With Smriti | Reduction |
|----------|---------------|-------------|-----------|
| Relevant context from past sessions | ~20,000 tokens | ~500 tokens | **40x** |
| Multi-session recall + synthesis | ~10,000 tokens | ~200 tokens | **50x** |
| Full project conversation history | 50,000+ tokens | ~500 tokens | **100x** |

Less token spend, faster responses, more room for the actual work in your context window.

## Privacy

Smriti is local-first by design. No cloud, no telemetry, no accounts.

- All data stored in `~/.cache/qmd/index.sqlite`
- Embeddings computed locally via [node-llama-cpp](https://github.com/withcatai/node-llama-cpp)
- Synthesis via local [Ollama](https://ollama.ai) (optional)
- Team sharing happens through git — you control what gets committed

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/zero8dotdev/smriti/main/uninstall.sh | bash
```

To also remove hook state: `SMRITI_PURGE=1` before the command.

## Documentation

See [CLAUDE.md](./CLAUDE.md) for the full reference — API docs, database schema, architecture details, and troubleshooting.

## Special Thanks

Smriti is built on top of [QMD](https://github.com/tobi/qmd) — a beautifully designed local search engine for markdown files created by [Tobi Lütke](https://github.com/tobi), CEO of Shopify.

QMD gave us the foundation we needed: a fast, local-first SQLite store with full-text search, vector embeddings, and content-addressable hashing — all running on your machine with zero cloud dependencies. Instead of rebuilding that infrastructure from scratch, we were able to focus entirely on the memory layer, multi-agent ingestion, and team sharing that makes Smriti useful.

Thank you, Tobi, for open-sourcing QMD. It's a reminder that the best tools are often the ones that quietly do the hard work so others can build something new on top.

## License

MIT

---

**Smriti** — Your team's AI agents finally remember.
