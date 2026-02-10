-- Smriti Schema Extensions
-- These tables live alongside QMD's existing tables in ~/.cache/qmd/index.sqlite
-- They do NOT alter any existing QMD tables.

-- Agent registry
CREATE TABLE IF NOT EXISTS smriti_agents (
  id TEXT PRIMARY KEY,          -- 'claude-code', 'codex', 'cursor'
  display_name TEXT NOT NULL,
  log_pattern TEXT,             -- Glob for finding agent logs
  parser TEXT NOT NULL          -- Parser module identifier
);

-- Project registry
CREATE TABLE IF NOT EXISTS smriti_projects (
  id TEXT PRIMARY KEY,          -- 'myapp', 'openfga'
  path TEXT,                    -- Filesystem path
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Session metadata (maps to QMD's memory_sessions without altering it)
CREATE TABLE IF NOT EXISTS smriti_session_meta (
  session_id TEXT PRIMARY KEY,  -- FK to memory_sessions.id
  agent_id TEXT,                -- FK to smriti_agents.id
  project_id TEXT,              -- FK to smriti_projects.id
  FOREIGN KEY (agent_id) REFERENCES smriti_agents(id),
  FOREIGN KEY (project_id) REFERENCES smriti_projects(id)
);

-- Category taxonomy (hierarchical)
CREATE TABLE IF NOT EXISTS smriti_categories (
  id TEXT PRIMARY KEY,          -- 'code/pattern', 'decision/technical'
  name TEXT NOT NULL,           -- 'Pattern', 'Technical'
  parent_id TEXT,               -- 'code', null for top-level
  description TEXT,
  FOREIGN KEY (parent_id) REFERENCES smriti_categories(id)
);

-- Message categorization (many-to-many)
CREATE TABLE IF NOT EXISTS smriti_message_tags (
  message_id INTEGER NOT NULL,  -- FK to memory_messages.id
  category_id TEXT NOT NULL,    -- FK to smriti_categories.id
  confidence REAL DEFAULT 1.0,  -- Classification confidence
  source TEXT DEFAULT 'manual', -- 'manual' | 'auto' | 'team'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, category_id),
  FOREIGN KEY (category_id) REFERENCES smriti_categories(id)
);

-- Session-level categorization
CREATE TABLE IF NOT EXISTS smriti_session_tags (
  session_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source TEXT DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, category_id),
  FOREIGN KEY (category_id) REFERENCES smriti_categories(id)
);

-- Team sharing log
CREATE TABLE IF NOT EXISTS smriti_shares (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  message_id INTEGER,
  category_id TEXT,
  project_id TEXT,
  author TEXT,
  shared_at TEXT NOT NULL DEFAULT (datetime('now')),
  content_hash TEXT              -- For dedup on import
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smriti_session_meta_agent
  ON smriti_session_meta(agent_id);
CREATE INDEX IF NOT EXISTS idx_smriti_session_meta_project
  ON smriti_session_meta(project_id);
CREATE INDEX IF NOT EXISTS idx_smriti_message_tags_category
  ON smriti_message_tags(category_id);
CREATE INDEX IF NOT EXISTS idx_smriti_session_tags_category
  ON smriti_session_tags(category_id);
CREATE INDEX IF NOT EXISTS idx_smriti_shares_hash
  ON smriti_shares(content_hash);
