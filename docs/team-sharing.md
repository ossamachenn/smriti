# Team Sharing

Smriti's team sharing works through git — no cloud service, no accounts, no sync infrastructure.

## How It Works

1. **Export** knowledge from your local memory to a `.smriti/` directory
2. **Commit** the `.smriti/` directory to your project repo
3. **Teammates pull** and import the shared knowledge into their local memory

The `.smriti/` directory lives inside your project repo alongside your code.

## Exporting Knowledge

### Share by project

```bash
smriti share --project myapp
```

This exports all sessions tagged with project `myapp` to the project's `.smriti/knowledge/` directory.

### Share by category

```bash
smriti share --category decision
smriti share --category architecture/design
```

### Share a specific session

```bash
smriti share --session abc12345
```

### Custom output directory

```bash
smriti share --project myapp --output /path/to/.smriti
```

## Output Format

```
.smriti/
├── config.json                # Sharing configuration
├── index.json                 # Manifest of all shared files
└── knowledge/
    ├── decision/
    │   └── 2026-02-10_auth-migration-approach.md
    ├── bug-fix/
    │   └── 2026-02-09_connection-pool-fix.md
    └── uncategorized/
        └── 2026-02-08_initial-setup.md
```

Each knowledge file is markdown with YAML frontmatter:

```markdown
---
id: abc12345
category: decision/technical
project: myapp
agent: claude-code
author: alice
shared_at: 2026-02-10T15:30:00.000Z
tags: ["decision", "decision/technical"]
---

# Auth migration approach

> Summary of the session if available

**user**: How should we handle the auth migration?

**assistant**: I'd recommend a phased approach...
```

## Importing Knowledge

When a teammate has shared knowledge:

```bash
git pull                       # Get the latest .smriti/ files
smriti sync --project myapp    # Import into local memory
```

Or import from a specific directory:

```bash
smriti sync --input /path/to/.smriti
```

### Deduplication

Content is hashed before import. If the same knowledge has already been imported, it's skipped automatically. You can safely run `smriti sync` repeatedly.

## Viewing Contributions

```bash
smriti team
```

Shows who has shared what:

```
Author    Shared  Categories           Latest
alice     12      decision, bug/fix    2026-02-10
bob       8       architecture, code   2026-02-09
```

## Git Integration

Add `.smriti/` to your repo:

```bash
cd /path/to/myapp
git add .smriti/
git commit -m "Share auth migration knowledge"
git push
```

### `.gitignore` Recommendations

The `config.json` and `index.json` should be committed. If you want to be selective:

```gitignore
# Commit everything in .smriti/
!.smriti/
```

## Workflow Example

### Alice (shares knowledge)

```bash
# Alice had a productive session about auth
smriti share --project myapp --category decision

# Commit to the project repo
cd ~/projects/myapp
git add .smriti/
git commit -m "Share auth migration decisions"
git push
```

### Bob (imports knowledge)

```bash
# Bob pulls the latest
cd ~/projects/myapp
git pull

# Import Alice's shared knowledge
smriti sync --project myapp

# Now Bob can recall Alice's context
smriti recall "auth migration" --project myapp
```

Bob's AI agent now has access to Alice's decisions without Alice needing to explain anything.
