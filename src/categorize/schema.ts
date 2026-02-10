/**
 * categorize/schema.ts - Category taxonomy definitions and CRUD
 *
 * Exports the full category tree as constants and provides
 * operations for managing custom categories.
 */

import type { Database } from "bun:sqlite";
import { getCategories, getCategoryTree, addCategory } from "../db";

// =============================================================================
// Category Constants
// =============================================================================

/** All top-level category IDs */
export const TOP_LEVEL_CATEGORIES = [
  "code",
  "architecture",
  "bug",
  "feature",
  "project",
  "decision",
  "topic",
] as const;

/** All category IDs (flat list) */
export const ALL_CATEGORY_IDS = [
  ...TOP_LEVEL_CATEGORIES,
  "code/implementation",
  "code/pattern",
  "code/review",
  "code/snippet",
  "architecture/design",
  "architecture/decision",
  "architecture/tradeoff",
  "bug/report",
  "bug/fix",
  "bug/investigation",
  "feature/requirement",
  "feature/design",
  "feature/implementation",
  "project/setup",
  "project/config",
  "project/dependency",
  "decision/technical",
  "decision/process",
  "decision/tooling",
  "topic/learning",
  "topic/explanation",
  "topic/comparison",
] as const;

export type CategoryId = (typeof ALL_CATEGORY_IDS)[number] | string;

// =============================================================================
// Category Operations
// =============================================================================

/** List all categories, optionally filtered by parent */
export function listCategories(
  db: Database,
  parentId?: string
): Array<{ id: string; name: string; parent_id: string | null; description: string }> {
  return getCategories(db, parentId);
}

/** Get the full category tree as a Map */
export function categoryTree(db: Database) {
  return getCategoryTree(db);
}

/** Check if a category ID is valid */
export function isValidCategory(db: Database, categoryId: string): boolean {
  const row = db
    .prepare(`SELECT id FROM smriti_categories WHERE id = ?`)
    .get(categoryId) as { id: string } | null;
  return row !== null;
}

/** Add a custom category */
export function createCategory(
  db: Database,
  id: string,
  name: string,
  parentId?: string,
  description?: string
): void {
  if (parentId && !isValidCategory(db, parentId)) {
    throw new Error(`Parent category not found: ${parentId}`);
  }
  addCategory(db, id, name, parentId, description);
}

/** Delete a category and its tags */
export function deleteCategory(db: Database, id: string): void {
  // Remove all tags referencing this category
  db.prepare(`DELETE FROM smriti_message_tags WHERE category_id = ?`).run(id);
  db.prepare(`DELETE FROM smriti_session_tags WHERE category_id = ?`).run(id);
  // Remove children first
  const children = db
    .prepare(`SELECT id FROM smriti_categories WHERE parent_id = ?`)
    .all(id) as { id: string }[];
  for (const child of children) {
    deleteCategory(db, child.id);
  }
  db.prepare(`DELETE FROM smriti_categories WHERE id = ?`).run(id);
}

/**
 * Format the category tree for display.
 * Returns lines like:
 *   code - Code-related knowledge
 *     code/implementation - Code implementation details
 *     code/pattern - Design patterns and idioms
 */
export function formatCategoryTree(db: Database): string {
  const tree = getCategoryTree(db);
  const allCats = getCategories(db);
  const catMap = new Map(allCats.map((c) => [c.id, c]));
  const lines: string[] = [];

  for (const [, node] of tree) {
    lines.push(`${node.id} - ${node.description || node.name}`);
    for (const childId of node.children) {
      const child = catMap.get(childId);
      if (child) {
        lines.push(`  ${child.id} - ${child.description || child.name}`);
      }
    }
  }

  return lines.join("\n");
}
