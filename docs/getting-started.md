# Getting Started

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/zero8dotdev/smriti/main/install.sh | bash
```

The installer will:
1. Check for (and install) [Bun](https://bun.sh)
2. Clone Smriti to `~/.smriti`
3. Install dependencies
4. Create the `smriti` CLI at `~/.local/bin/smriti`
5. Set up the Claude Code auto-save hook

### Verify

```bash
smriti help
```

If `smriti` is not found, add `~/.local/bin` to your PATH:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## First Run

### 1. Ingest your Claude Code conversations

```bash
smriti ingest claude
```

This scans `~/.claude/projects/` for all session transcripts and imports them.

### 2. Check what was imported

```bash
smriti status
```

Output shows session count, message count, and per-agent/per-project breakdowns.

### 3. Search your memory

```bash
smriti search "authentication"
```

### 4. Recall with context

```bash
smriti recall "how did we set up the database"
```

This searches, deduplicates by session, and returns the most relevant snippets.

### 5. Build embeddings for semantic search

```bash
smriti embed
```

After embedding, searches find semantically similar content — not just keyword matches.

## Auto-Save (Claude Code)

If the installer set up the hook, every Claude Code conversation is saved automatically. No action needed — just code as usual.

To verify the hook is active:

```bash
cat ~/.claude/settings.json | grep save-memory
```

## Next Steps

- [CLI Reference](./cli.md) — All commands and options
- [Team Sharing](./team-sharing.md) — Share knowledge via git
- [Configuration](./configuration.md) — Environment variables and customization
- [Architecture](./architecture.md) — How Smriti works under the hood
