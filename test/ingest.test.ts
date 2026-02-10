import { test, expect } from "bun:test";
import { parseClaudeJsonl, deriveProjectId, deriveProjectPath } from "../src/ingest/claude";
import { parseCodexJsonl } from "../src/ingest/codex";
import { parseCursorJson } from "../src/ingest/cursor";

// =============================================================================
// Claude Parser Tests
// =============================================================================

test("parseClaudeJsonl extracts user and assistant messages", () => {
  const jsonl = [
    JSON.stringify({
      type: "user",
      sessionId: "abc",
      message: { role: "user", content: "How do I fix this bug?" },
      timestamp: "2026-02-10T12:00:00Z",
      uuid: "u1",
    }),
    JSON.stringify({
      type: "assistant",
      sessionId: "abc",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "You can fix it by..." },
          { type: "thinking", thinking: "Let me think..." },
        ],
      },
      timestamp: "2026-02-10T12:00:01Z",
      uuid: "u2",
    }),
  ].join("\n");

  const messages = parseClaudeJsonl(jsonl);
  expect(messages.length).toBe(2);
  expect(messages[0].role).toBe("user");
  expect(messages[0].content).toBe("How do I fix this bug?");
  expect(messages[1].role).toBe("assistant");
  expect(messages[1].content).toBe("You can fix it by...");
});

test("parseClaudeJsonl skips meta and non-message entries", () => {
  const jsonl = [
    JSON.stringify({
      type: "file-history-snapshot",
      messageId: "x",
    }),
    JSON.stringify({
      type: "user",
      isMeta: true,
      message: { role: "user", content: "<command-name>test</command-name>" },
    }),
    JSON.stringify({
      type: "user",
      message: { role: "user", content: "<local-command-stdout>ok</local-command-stdout>" },
    }),
    JSON.stringify({
      type: "user",
      message: { role: "user", content: "Real question here" },
      timestamp: "2026-02-10T12:00:00Z",
    }),
  ].join("\n");

  const messages = parseClaudeJsonl(jsonl);
  expect(messages.length).toBe(1);
  expect(messages[0].content).toBe("Real question here");
});

test("parseClaudeJsonl handles malformed lines", () => {
  const jsonl = "not json\n{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"hello\"}}\n{broken";
  const messages = parseClaudeJsonl(jsonl);
  expect(messages.length).toBe(1);
  expect(messages[0].content).toBe("hello");
});

test("deriveProjectId uses PROJECTS_ROOT to extract clean project name", () => {
  // These tests rely on real filesystem paths existing under ~/zero8.dev
  // "-Users-zero8-zero8.dev-openfga" -> path resolves -> strip PROJECTS_ROOT -> "openfga"
  expect(deriveProjectId("-Users-zero8-zero8.dev-smriti")).toBe("smriti");
});

test("deriveProjectPath reconstructs real filesystem path", () => {
  // With greedy path resolution, "zero8.dev" is a real directory
  expect(deriveProjectPath("-Users-zero8-zero8.dev-smriti")).toBe("/Users/zero8/zero8.dev/smriti");
});

// =============================================================================
// Codex Parser Tests
// =============================================================================

test("parseCodexJsonl extracts messages", () => {
  const jsonl = [
    JSON.stringify({ role: "user", content: "Write a hello world" }),
    JSON.stringify({ role: "assistant", content: "console.log('hello')" }),
    JSON.stringify({ role: "system", content: "You are helpful" }),
  ].join("\n");

  const messages = parseCodexJsonl(jsonl);
  expect(messages.length).toBe(2);
  expect(messages[0].role).toBe("user");
  expect(messages[1].role).toBe("assistant");
});

test("parseCodexJsonl handles content arrays", () => {
  const jsonl = JSON.stringify({
    role: "assistant",
    content: [
      { type: "text", text: "Here is the code:" },
      { type: "text", text: "console.log('hi')" },
    ],
  });

  const messages = parseCodexJsonl(jsonl);
  expect(messages.length).toBe(1);
  expect(messages[0].content).toContain("Here is the code:");
  expect(messages[0].content).toContain("console.log('hi')");
});

// =============================================================================
// Cursor Parser Tests
// =============================================================================

test("parseCursorJson extracts messages from conversation object", () => {
  const json = JSON.stringify({
    id: "conv1",
    title: "Fix Bug",
    messages: [
      { role: "user", content: "Fix the auth bug" },
      { role: "assistant", content: "I'll fix the authentication issue" },
    ],
  });

  const messages = parseCursorJson(json);
  expect(messages.length).toBe(2);
  expect(messages[0].role).toBe("user");
  expect(messages[1].content).toContain("authentication");
});

test("parseCursorJson handles tabs with messages", () => {
  const json = JSON.stringify({
    tabs: [
      {
        id: "tab1",
        messages: [
          { role: "user", content: "Question 1" },
          { role: "assistant", content: "Answer 1" },
        ],
      },
      {
        id: "tab2",
        messages: [{ role: "user", content: "Question 2" }],
      },
    ],
  });

  const messages = parseCursorJson(json);
  expect(messages.length).toBe(3);
});

test("parseCursorJson handles array of conversations", () => {
  const json = JSON.stringify([
    { messages: [{ role: "user", content: "Q1" }] },
    { messages: [{ role: "user", content: "Q2" }] },
  ]);

  const messages = parseCursorJson(json);
  expect(messages.length).toBe(2);
});

test("parseCursorJson handles invalid JSON gracefully", () => {
  const messages = parseCursorJson("not json at all");
  expect(messages.length).toBe(0);
});
