import { test, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { initializeSmritiTables, seedDefaults } from "../src/db";
import { listTeamContributions } from "../src/team/sync";

let db: Database;

beforeAll(() => {
  db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

  // Create QMD tables
  db.exec(`
    CREATE TABLE memory_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      summary TEXT,
      summary_at TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE memory_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE CASCADE
    );
  `);

  initializeSmritiTables(db);
  seedDefaults(db);
});

afterAll(() => {
  db.close();
});

test("listTeamContributions returns empty when no shares", () => {
  const contributions = listTeamContributions(db);
  expect(contributions.length).toBe(0);
});

test("listTeamContributions groups by author", () => {
  const now = new Date().toISOString();

  // Insert some shares
  db.prepare(
    `INSERT INTO smriti_shares (id, session_id, category_id, author, shared_at, content_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("s1", "sess1", "decision", "alice", now, "hash1");

  db.prepare(
    `INSERT INTO smriti_shares (id, session_id, category_id, author, shared_at, content_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("s2", "sess2", "bug", "alice", now, "hash2");

  db.prepare(
    `INSERT INTO smriti_shares (id, session_id, category_id, author, shared_at, content_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("s3", "sess3", "code", "bob", now, "hash3");

  const contributions = listTeamContributions(db);
  expect(contributions.length).toBe(2);

  const alice = contributions.find((c) => c.author === "alice");
  expect(alice).toBeDefined();
  expect(alice!.count).toBe(2);

  const bob = contributions.find((c) => c.author === "bob");
  expect(bob).toBeDefined();
  expect(bob!.count).toBe(1);
});
