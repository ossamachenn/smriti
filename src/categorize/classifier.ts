/**
 * categorize/classifier.ts - Rule-based + optional LLM classification
 *
 * Classifies messages and sessions into the Smriti category taxonomy.
 * Rule-based matching runs first; LLM is invoked only for ambiguous cases.
 */

import type { Database } from "bun:sqlite";
import { tagMessage, tagSession } from "../db";
import { CLASSIFY_LLM_THRESHOLD, OLLAMA_HOST, OLLAMA_MODEL } from "../config";
import { ALL_CATEGORY_IDS } from "./schema";

// =============================================================================
// Types
// =============================================================================

export type ClassifyResult = {
  categoryId: string;
  confidence: number;
  source: "rule" | "llm";
};

// =============================================================================
// Rule-Based Classification
// =============================================================================

/** Keyword patterns mapped to categories with weights */
const RULES: Array<{
  pattern: RegExp;
  category: string;
  weight: number;
}> = [
  // Bug-related
  { pattern: /\b(bug|error|crash|exception|traceback|stack\s*trace|segfault)\b/i, category: "bug/report", weight: 0.8 },
  { pattern: /\b(fix(ed|ing)?|patch(ed|ing)?|resolve[ds]?|hotfix)\b/i, category: "bug/fix", weight: 0.7 },
  { pattern: /\b(debug(ging)?|investigat(e|ing)|diagnos(e|ing)|root\s*cause)\b/i, category: "bug/investigation", weight: 0.7 },

  // Code patterns
  { pattern: /\b(refactor(ing)?|clean\s*up|pattern|idiom|best\s*practice)\b/i, category: "code/pattern", weight: 0.7 },
  { pattern: /\b(implement(ation|ed|ing)?|code|function|class|method|module)\b/i, category: "code/implementation", weight: 0.5 },
  { pattern: /\b(review|pr|pull\s*request|code\s*review|feedback)\b/i, category: "code/review", weight: 0.6 },
  { pattern: /\b(snippet|example|sample|boilerplate|template)\b/i, category: "code/snippet", weight: 0.6 },

  // Architecture
  { pattern: /\b(architect(ure)?|system\s*design|high[\s-]?level|diagram|component)\b/i, category: "architecture/design", weight: 0.7 },
  { pattern: /\b(trade[\s-]?off|pro(s)?\s*(and|&|vs)\s*con(s)?|alternative|comparison)\b/i, category: "architecture/tradeoff", weight: 0.7 },
  { pattern: /\b(ADR|architecture\s*decision|decided\s*to\s*use|chose|went\s*with)\b/i, category: "architecture/decision", weight: 0.7 },

  // Feature
  { pattern: /\b(requirement|spec(ification)?|user\s*story|acceptance\s*criteria)\b/i, category: "feature/requirement", weight: 0.7 },
  { pattern: /\b(feature|add(ing)?|new\s+functionality|enhancement)\b/i, category: "feature/implementation", weight: 0.5 },
  { pattern: /\b(design|wireframe|mockup|ux|ui\s*design)\b/i, category: "feature/design", weight: 0.6 },

  // Project
  { pattern: /\b(setup|scaffold|bootstrap|init(ialize)?|getting\s*started)\b/i, category: "project/setup", weight: 0.7 },
  { pattern: /\b(config(uration)?|\.env|settings|yaml|toml|\.json)\b/i, category: "project/config", weight: 0.6 },
  { pattern: /\b(depend(ency|encies)|package|npm|bun\s*install|yarn|pnpm|version)\b/i, category: "project/dependency", weight: 0.7 },

  // Decision
  { pattern: /\b(should\s*we|decision|decided|let'?s\s*(go|use)|approach)\b/i, category: "decision/technical", weight: 0.6 },
  { pattern: /\b(process|workflow|methodology|agile|sprint|convention)\b/i, category: "decision/process", weight: 0.6 },
  { pattern: /\b(tool(ing)?|ide|editor|framework|library\s*choice)\b/i, category: "decision/tooling", weight: 0.6 },

  // Topic
  { pattern: /\b(learn(ing)?|tutorial|guide|how\s*to|explain|what\s*is)\b/i, category: "topic/learning", weight: 0.5 },
  { pattern: /\b(explain(ation)?|deep\s*dive|understand(ing)?|concept)\b/i, category: "topic/explanation", weight: 0.6 },
  { pattern: /\b(compar(e|ing|ison)|vs\.?|versus|benchmark|which\s*is\s*better)\b/i, category: "topic/comparison", weight: 0.7 },
];

/**
 * Classify text using keyword rules.
 * Returns all matches sorted by confidence (weight * match density).
 */
export function classifyByRules(text: string): ClassifyResult[] {
  const results: ClassifyResult[] = [];
  const textLower = text.toLowerCase();
  const wordCount = textLower.split(/\s+/).length;

  for (const rule of RULES) {
    const matches = textLower.match(new RegExp(rule.pattern, "gi"));
    if (matches) {
      // Density: how many keyword matches relative to text length
      const density = Math.min(matches.length / Math.max(wordCount / 10, 1), 1);
      const confidence = rule.weight * (0.5 + 0.5 * density);
      results.push({
        categoryId: rule.category,
        confidence,
        source: "rule",
      });
    }
  }

  // Deduplicate: keep highest confidence per category
  const best = new Map<string, ClassifyResult>();
  for (const r of results) {
    const existing = best.get(r.categoryId);
    if (!existing || r.confidence > existing.confidence) {
      best.set(r.categoryId, r);
    }
  }

  return Array.from(best.values()).sort((a, b) => b.confidence - a.confidence);
}

// =============================================================================
// LLM Classification (Optional)
// =============================================================================

/**
 * Classify text using Ollama for ambiguous cases.
 * Only called when rule-based confidence is below threshold.
 */
export async function classifyByLLM(
  text: string
): Promise<ClassifyResult | null> {
  try {
    const categoryList = ALL_CATEGORY_IDS.join(", ");
    const prompt = `Classify the following conversation snippet into exactly ONE of these categories: ${categoryList}

Return ONLY the category ID, nothing else.

Text:
${text.slice(0, 2000)}`;

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 50 },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { response?: string };
    const categoryId = data.response?.trim().toLowerCase();

    if (categoryId && ALL_CATEGORY_IDS.includes(categoryId as any)) {
      return {
        categoryId,
        confidence: 0.7,
        source: "llm",
      };
    }
  } catch {
    // LLM not available, fall through
  }

  return null;
}

// =============================================================================
// Classification Pipeline
// =============================================================================

/**
 * Classify a single message. Returns the best classification.
 */
export async function classifyMessage(
  text: string,
  useLLM: boolean = false
): Promise<ClassifyResult | null> {
  const ruleResults = classifyByRules(text);

  if (ruleResults.length > 0 && ruleResults[0].confidence >= CLASSIFY_LLM_THRESHOLD) {
    return ruleResults[0];
  }

  // If rule-based is weak and LLM is enabled, try LLM
  if (useLLM) {
    const llmResult = await classifyByLLM(text);
    if (llmResult) return llmResult;
  }

  // Return best rule-based even if weak
  return ruleResults[0] || null;
}

/**
 * Auto-categorize all uncategorized sessions in the database.
 */
export async function categorizeUncategorized(
  db: Database,
  options: {
    useLLM?: boolean;
    onProgress?: (msg: string) => void;
    sessionId?: string;
  } = {}
): Promise<{ categorized: number; skipped: number }> {
  let query: string;
  let params: any[];

  if (options.sessionId) {
    query = `
      SELECT ms.id, ms.session_id, ms.role, ms.content
      FROM memory_messages ms
      WHERE ms.session_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM smriti_message_tags mt WHERE mt.message_id = ms.id
        )
      ORDER BY ms.id
    `;
    params = [options.sessionId];
  } else {
    query = `
      SELECT ms.id, ms.session_id, ms.role, ms.content
      FROM memory_messages ms
      WHERE NOT EXISTS (
        SELECT 1 FROM smriti_message_tags mt WHERE mt.message_id = ms.id
      )
      ORDER BY ms.id
    `;
    params = [];
  }

  const messages = db.prepare(query).all(...params) as Array<{
    id: number;
    session_id: string;
    role: string;
    content: string;
  }>;

  let categorized = 0;
  let skipped = 0;

  // Also track session-level categories
  const sessionCategories = new Map<string, Map<string, number>>();

  for (const msg of messages) {
    const result = await classifyMessage(msg.content, options.useLLM);
    if (result) {
      tagMessage(db, msg.id, result.categoryId, result.confidence, result.source);
      categorized++;

      // Track category frequency per session
      if (!sessionCategories.has(msg.session_id)) {
        sessionCategories.set(msg.session_id, new Map());
      }
      const counts = sessionCategories.get(msg.session_id)!;
      counts.set(result.categoryId, (counts.get(result.categoryId) || 0) + 1);

      if (options.onProgress && categorized % 50 === 0) {
        options.onProgress(`Categorized ${categorized} messages...`);
      }
    } else {
      skipped++;
    }
  }

  // Apply session-level tags based on most frequent categories
  for (const [sessionId, counts] of sessionCategories) {
    // Get top category for the session
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topCategory] = sorted[0];
      // Use parent category for session-level tag
      const parentCategory = topCategory.includes("/")
        ? topCategory.split("/")[0]
        : topCategory;
      tagSession(db, sessionId, parentCategory, 0.8, "auto");

      // Also tag with the specific subcategory if it's dominant
      if (sorted[0][1] >= 2) {
        tagSession(db, sessionId, topCategory, 0.7, "auto");
      }
    }
  }

  return { categorized, skipped };
}
