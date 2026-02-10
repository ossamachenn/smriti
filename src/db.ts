/**
 * db.ts - Database schema, migrations, and connection for Smriti
 *
 * Uses the shared QMD SQLite database. All Smriti tables are prefixed with
 * `smriti_` to avoid collisions. Does NOT alter existing QMD tables.
 */

import { Database } from "bun:sqlite";
import { QMD_DB_PATH } from "./config";

// =============================================================================
// Connection
// =============================================================================

let _db: Database | null = null;

/** Get or create the shared database connection */
export function getDb(path?: string): Database {
  if (_db) return _db;
  _db = new Database(path || QMD_DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  return _db;
}

/** Close the database connection */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// =============================================================================
// Schema Initialization
// =============================================================================

/** Create all Smriti tables if they don't exist */
export function initializeSmritiTables(db: Database): void {
  db.exec(`
    -- Agent registry
    CREATE TABLE IF NOT EXISTS smriti_agents (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      log_pattern TEXT,
      parser TEXT NOT NULL
    );

    -- Project registry
    CREATE TABLE IF NOT EXISTS smriti_projects (
      id TEXT PRIMARY KEY,
      path TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Session metadata (maps to QMD's memory_sessions)
    CREATE TABLE IF NOT EXISTS smriti_session_meta (
      session_id TEXT PRIMARY KEY,
      agent_id TEXT,
      project_id TEXT,
      FOREIGN KEY (agent_id) REFERENCES smriti_agents(id),
      FOREIGN KEY (project_id) REFERENCES smriti_projects(id)
    );

    -- Category taxonomy (hierarchical)
    CREATE TABLE IF NOT EXISTS smriti_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      description TEXT,
      FOREIGN KEY (parent_id) REFERENCES smriti_categories(id)
    );

    -- Message categorization (many-to-many)
    CREATE TABLE IF NOT EXISTS smriti_message_tags (
      message_id INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source TEXT DEFAULT 'manual',
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
      content_hash TEXT
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
  `);
}

// =============================================================================
// Seed Data
// =============================================================================

/** Default agent definitions */
const DEFAULT_AGENTS = [
  {
    id: "claude-code",
    display_name: "Claude Code",
    log_pattern: "~/.claude/projects/*/*.jsonl",
    parser: "claude",
  },
  {
    id: "codex",
    display_name: "Codex CLI",
    log_pattern: "~/.codex/**/*.jsonl",
    parser: "codex",
  },
  {
    id: "cursor",
    display_name: "Cursor",
    log_pattern: ".cursor/**/*.json",
    parser: "cursor",
  },
] as const;

/** Default category taxonomy */
const DEFAULT_CATEGORIES: Array<{
  id: string;
  name: string;
  parent_id: string | null;
  description: string;
}> = [
    // Top-level
    { id: "code", name: "Code", parent_id: null, description: "Code-related knowledge" },
    { id: "architecture", name: "Architecture", parent_id: null, description: "System architecture and design" },
    { id: "bug", name: "Bug", parent_id: null, description: "Bugs and debugging" },
    { id: "feature", name: "Feature", parent_id: null, description: "Feature work" },
    { id: "project", name: "Project", parent_id: null, description: "Project setup and configuration" },
    { id: "decision", name: "Decision", parent_id: null, description: "Decisions and rationale" },
    { id: "topic", name: "Topic", parent_id: null, description: "Learning and knowledge topics" },

    // Code children
    { id: "code/implementation", name: "Implementation", parent_id: "code", description: "Code implementation details" },
    { id: "code/pattern", name: "Pattern", parent_id: "code", description: "Design patterns and idioms" },
    { id: "code/review", name: "Review", parent_id: "code", description: "Code review insights" },
    { id: "code/snippet", name: "Snippet", parent_id: "code", description: "Useful code snippets" },

    // Architecture children
    { id: "architecture/design", name: "Design", parent_id: "architecture", description: "System design" },
    { id: "architecture/decision", name: "Decision", parent_id: "architecture", description: "Architecture decisions (ADRs)" },
    { id: "architecture/tradeoff", name: "Tradeoff", parent_id: "architecture", description: "Architecture tradeoffs" },

    // Bug children
    { id: "bug/report", name: "Report", parent_id: "bug", description: "Bug reports" },
    { id: "bug/fix", name: "Fix", parent_id: "bug", description: "Bug fixes" },
    { id: "bug/investigation", name: "Investigation", parent_id: "bug", description: "Bug investigation and debugging" },

    // Feature children
    { id: "feature/requirement", name: "Requirement", parent_id: "feature", description: "Feature requirements" },
    { id: "feature/design", name: "Design", parent_id: "feature", description: "Feature design" },
    { id: "feature/implementation", name: "Implementation", parent_id: "feature", description: "Feature implementation" },

    // Project children
    { id: "project/setup", name: "Setup", parent_id: "project", description: "Project setup and scaffolding" },
    { id: "project/config", name: "Config", parent_id: "project", description: "Configuration" },
    { id: "project/dependency", name: "Dependency", parent_id: "project", description: "Dependencies and package management" },

    // Decision children
    { id: "decision/technical", name: "Technical", parent_id: "decision", description: "Technical decisions" },
    { id: "decision/process", name: "Process", parent_id: "decision", description: "Process decisions" },
    { id: "decision/tooling", name: "Tooling", parent_id: "decision", description: "Tooling decisions" },

    // Topic children
    { id: "topic/learning", name: "Learning", parent_id: "topic", description: "Learning and tutorials" },
    { id: "topic/explanation", name: "Explanation", parent_id: "topic", description: "Explanations and deep dives" },
    { id: "topic/comparison", name: "Comparison", parent_id: "topic", description: "Comparisons and evaluations" },
  ];

/** Seed agents and categories (idempotent) */
export function seedDefaults(db: Database): void {
  const insertAgent = db.prepare(
    `INSERT OR IGNORE INTO smriti_agents (id, display_name, log_pattern, parser)
     VALUES (?, ?, ?, ?)`
  );
  for (const agent of DEFAULT_AGENTS) {
    insertAgent.run(agent.id, agent.display_name, agent.log_pattern, agent.parser);
  }

  const insertCategory = db.prepare(
    `INSERT OR IGNORE INTO smriti_categories (id, name, parent_id, description)
     VALUES (?, ?, ?, ?)`
  );
  for (const cat of DEFAULT_CATEGORIES) {
    insertCategory.run(cat.id, cat.name, cat.parent_id, cat.description);
  }
}

// =============================================================================
// Convenience
// =============================================================================

/** Initialize DB, create tables, seed defaults. Returns the DB instance. */
export function initSmriti(dbPath?: string): Database {
  const db = getDb(dbPath);
  initializeSmritiTables(db);
  seedDefaults(db);
  return db;
}

// =============================================================================
// CRUD Helpers
// =============================================================================

export function upsertProject(
  db: Database,
  id: string,
  path?: string,
  description?: string
): void {
  db.prepare(
    `INSERT INTO smriti_projects (id, path, description) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       path = COALESCE(excluded.path, path),
       description = COALESCE(excluded.description, description)`
  ).run(id, path || null, description || null);
}

export function upsertSessionMeta(
  db: Database,
  sessionId: string,
  agentId?: string,
  projectId?: string
): void {
  db.prepare(
    `INSERT INTO smriti_session_meta (session_id, agent_id, project_id) VALUES (?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       agent_id = COALESCE(excluded.agent_id, agent_id),
       project_id = COALESCE(excluded.project_id, project_id)`
  ).run(sessionId, agentId || null, projectId || null);
}

export function tagMessage(
  db: Database,
  messageId: number,
  categoryId: string,
  confidence: number = 1.0,
  source: string = "manual"
): void {
  db.prepare(
    `INSERT OR REPLACE INTO smriti_message_tags (message_id, category_id, confidence, source)
     VALUES (?, ?, ?, ?)`
  ).run(messageId, categoryId, confidence, source);
}

export function tagSession(
  db: Database,
  sessionId: string,
  categoryId: string,
  confidence: number = 1.0,
  source: string = "manual"
): void {
  db.prepare(
    `INSERT OR REPLACE INTO smriti_session_tags (session_id, category_id, confidence, source)
     VALUES (?, ?, ?, ?)`
  ).run(sessionId, categoryId, confidence, source);
}

export function getCategories(db: Database, parentId?: string): Array<{
  id: string;
  name: string;
  parent_id: string | null;
  description: string;
}> {
  if (parentId !== undefined) {
    return db
      .prepare(
        `SELECT id, name, parent_id, description FROM smriti_categories WHERE parent_id = ?`
      )
      .all(parentId) as any;
  }
  return db
    .prepare(`SELECT id, name, parent_id, description FROM smriti_categories ORDER BY id`)
    .all() as any;
}

export function getCategoryTree(db: Database): Map<
  string,
  { id: string; name: string; description: string; children: string[] }
> {
  const all = getCategories(db);
  const tree = new Map<string, { id: string; name: string; description: string; children: string[] }>();

  // Insert top-level first
  for (const cat of all.filter((c) => !c.parent_id)) {
    tree.set(cat.id, { id: cat.id, name: cat.name, description: cat.description, children: [] });
  }

  // Attach children
  for (const cat of all.filter((c) => c.parent_id)) {
    const parent = tree.get(cat.parent_id!);
    if (parent) parent.children.push(cat.id);
  }

  return tree;
}

export function addCategory(
  db: Database,
  id: string,
  name: string,
  parentId?: string,
  description?: string
): void {
  db.prepare(
    `INSERT INTO smriti_categories (id, name, parent_id, description) VALUES (?, ?, ?, ?)`
  ).run(id, name, parentId || null, description || null);
}

export function listProjects(db: Database): Array<{
  id: string;
  path: string | null;
  description: string | null;
  created_at: string;
}> {
  return db.prepare(`SELECT * FROM smriti_projects ORDER BY created_at DESC`).all() as any;
}

export function listAgents(db: Database): Array<{
  id: string;
  display_name: string;
  log_pattern: string | null;
  parser: string;
}> {
  return db.prepare(`SELECT * FROM smriti_agents ORDER BY id`).all() as any;
}
