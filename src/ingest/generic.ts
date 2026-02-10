/**
 * generic.ts - Generic file parser for importing transcripts
 *
 * Supports chat format (role: content) and JSONL format.
 * Wraps QMD's importTranscript() with Smriti metadata.
 */

import { importTranscript } from "../qmd";
import type { IngestResult, IngestOptions } from "./index";

export type GenericIngestOptions = IngestOptions & {
  filePath: string;
  format?: "chat" | "jsonl";
  agentName?: string;
  title?: string;
  sessionId?: string;
  projectId?: string;
};

/**
 * Ingest a transcript file using QMD's importTranscript.
 */
export async function ingestGeneric(
  options: GenericIngestOptions
): Promise<IngestResult> {
  const { db, filePath, format, agentName, title, sessionId, projectId } =
    options;
  if (!db) throw new Error("Database required for ingestion");

  const { upsertSessionMeta, upsertProject } = await import("../db");

  const result: IngestResult = {
    agent: agentName || "generic",
    sessionsFound: 1,
    sessionsIngested: 0,
    messagesIngested: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      result.errors.push(`File not found: ${filePath}`);
      return result;
    }

    const content = await file.text();
    const imported = await importTranscript(db, content, {
      title,
      format: format || "chat",
      sessionId,
    });

    // If a project was specified, register it
    if (projectId) {
      upsertProject(db, projectId);
    }

    // Attach metadata
    upsertSessionMeta(
      db,
      imported.sessionId,
      agentName || "generic",
      projectId
    );

    result.sessionsIngested = 1;
    result.messagesIngested = imported.messageCount;
  } catch (err: any) {
    result.errors.push(err.message);
  }

  return result;
}
