/**
 * claude.ts - Claude Code conversation parser
 *
 * Reads JSONL transcripts from ~/.claude/projects/ and normalizes
 * to QMD's addMessage() format with agent and project metadata.
 */

import { existsSync } from "fs";
import { basename } from "path";
import { CLAUDE_LOGS_DIR, PROJECTS_ROOT } from "../config";
import { addMessage } from "../qmd";
import type { ParsedMessage, IngestResult, IngestOptions } from "./index";

/** Shape of a Claude Code JSONL entry */
type ClaudeEntry = {
  type: "user" | "assistant" | "file-history-snapshot" | string;
  sessionId?: string;
  cwd?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string; thinking?: string }>;
  };
  isMeta?: boolean;
  timestamp?: string;
  uuid?: string;
};

/**
 * Extract text content from a Claude message content field.
 * Content can be a string or an array of content blocks.
 */
function extractContent(
  content: string | Array<{ type: string; text?: string; thinking?: string }>
): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!)
    .join("\n");
}

/**
 * Reconstruct a real filesystem path from a Claude projects directory name.
 *
 * Claude encodes paths by replacing "/" with "-", but folder names can also
 * contain "-". We greedily match from the left, picking the longest existing
 * directory segment at each step.
 *
 * e.g. "-Users-zero8-zero8.dev-openfga" -> "/Users/zero8/zero8.dev/openfga"
 */
export function deriveProjectPath(dirName: string): string {
  const raw = dirName.replace(/^-/, "");
  const parts = raw.split("-");

  const segments: string[] = [];
  let i = 0;
  while (i < parts.length) {
    // Greedily try to join as many parts as possible into one segment
    let best = parts[i];
    let bestLen = 1;
    for (let j = i + 1; j < parts.length; j++) {
      const candidate = parts.slice(i, j + 1).join("-");
      const candidatePath = "/" + [...segments, candidate].join("/");
      if (existsSync(candidatePath)) {
        best = candidate;
        bestLen = j - i + 1;
      }
    }
    segments.push(best);
    i += bestLen;
  }

  return "/" + segments.join("/");
}

/**
 * Derive a project ID from a Claude projects directory name.
 *
 * Uses PROJECTS_ROOT to strip the known prefix and return just the
 * project-relative portion.
 *
 * e.g. with PROJECTS_ROOT="/Users/zero8/zero8.dev":
 *   "-Users-zero8-zero8.dev-openfga" -> "openfga"
 *   "-Users-zero8-zero8.dev-avkash-regulation-hub" -> "avkash/regulation-hub"
 *   "-Users-zero8-zero8.dev" -> "zero8.dev" (the root itself)
 *   "-Users-zero8" -> "home" (outside projects root)
 */
export function deriveProjectId(dirName: string): string {
  const realPath = deriveProjectPath(dirName);

  // Normalize: strip trailing slashes for comparison
  const root = PROJECTS_ROOT.replace(/\/+$/, "");

  if (realPath === root) {
    // The projects root directory itself
    return basename(root);
  }

  if (realPath.startsWith(root + "/")) {
    // Inside projects root - return the relative path
    return realPath.slice(root.length + 1);
  }

  // Outside projects root - fallback
  return basename(realPath) || "home";
}

/**
 * Parse a single Claude Code JSONL file into normalized messages.
 */
export function parseClaudeJsonl(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const lines = content.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    let entry: ClaudeEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // Skip malformed lines
    }

    // Skip non-message entries
    if (
      entry.type !== "user" &&
      entry.type !== "assistant"
    ) {
      continue;
    }

    // Skip meta messages (hooks, commands)
    if (entry.isMeta) continue;

    // Must have message content
    if (!entry.message?.content) continue;

    const text = extractContent(entry.message.content);
    if (!text.trim()) continue;

    // Skip system/command content
    if (
      text.startsWith("<local-command-") ||
      text.startsWith("<command-name>")
    ) {
      continue;
    }

    messages.push({
      role: entry.message.role || entry.type,
      content: text,
      timestamp: entry.timestamp,
      metadata: {
        uuid: entry.uuid,
        cwd: entry.cwd,
      },
    });
  }

  return messages;
}

/**
 * Discover all Claude Code sessions from the logs directory.
 * Returns an array of { sessionId, projectDir, filePath }.
 */
export async function discoverClaudeSessions(
  logsDir?: string
): Promise<
  Array<{
    sessionId: string;
    projectDir: string;
    filePath: string;
  }>
> {
  const dir = logsDir || CLAUDE_LOGS_DIR;
  const glob = new Bun.Glob("*/*.jsonl");
  const sessions: Array<{
    sessionId: string;
    projectDir: string;
    filePath: string;
  }> = [];

  for await (const match of glob.scan({ cwd: dir, absolute: false })) {
    const [projectDir, filename] = match.split("/");
    if (!projectDir || !filename) continue;
    const sessionId = filename.replace(".jsonl", "");
    sessions.push({
      sessionId,
      projectDir,
      filePath: `${dir}/${match}`,
    });
  }

  return sessions;
}

/**
 * Ingest Claude Code sessions into QMD's memory.
 */
export async function ingestClaude(
  options: IngestOptions = {}
): Promise<IngestResult> {
  const { db, existingSessionIds, onProgress } = options;
  if (!db) throw new Error("Database required for ingestion");

  const { upsertProject, upsertSessionMeta } = await import("../db");

  const sessions = await discoverClaudeSessions(options.logsDir);
  const result: IngestResult = {
    agent: "claude-code",
    sessionsFound: sessions.length,
    sessionsIngested: 0,
    messagesIngested: 0,
    skipped: 0,
    errors: [],
  };

  for (const session of sessions) {
    // Skip already-ingested sessions
    if (existingSessionIds?.has(session.sessionId)) {
      result.skipped++;
      continue;
    }

    try {
      const file = Bun.file(session.filePath);
      const content = await file.text();
      const messages = parseClaudeJsonl(content);

      if (messages.length === 0) {
        result.skipped++;
        continue;
      }

      // Derive project info
      const projectId = deriveProjectId(session.projectDir);
      const projectPath = deriveProjectPath(session.projectDir);

      // Ensure project exists
      upsertProject(db, projectId, projectPath);

      // Extract title from first user message
      const firstUser = messages.find((m) => m.role === "user");
      const title = firstUser
        ? firstUser.content.slice(0, 100).replace(/\n/g, " ")
        : "";

      // Add messages via QMD
      for (const msg of messages) {
        await addMessage(db, session.sessionId, msg.role, msg.content, {
          title,
          metadata: msg.metadata,
        });
      }

      // Attach Smriti metadata
      upsertSessionMeta(db, session.sessionId, "claude-code", projectId);

      result.sessionsIngested++;
      result.messagesIngested += messages.length;

      if (onProgress) {
        onProgress(
          `Ingested ${session.sessionId} (${messages.length} messages)`
        );
      }
    } catch (err: any) {
      result.errors.push(`${session.sessionId}: ${err.message}`);
    }
  }

  return result;
}
