/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: taxonomyService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { TERM_ALIASES } from '../config/taxonomyAliases.js';
import { ROLE_CANONICAL_RULES } from '../config/roleCanonicalRules.js';
import { slugifyLabel, prettifyCanonicalRole } from '../utils/stringUtils.js';

/**
 * Purpose: Execute the main responsibility for normalizeTaxonomyLabel.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeTaxonomyLabel = (value = '') => {
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return '';
  return TERM_ALIASES.get(cleaned) || slugifyLabel(cleaned);
};

/**
 * Purpose: Execute the main responsibility for buildTaxonomyItem.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildTaxonomyItem = (label, extra = {}) => ({
  id: normalizeTaxonomyLabel(label),
  label: label?.trim() || '',
  ...extra,
});

/**
 * Purpose: Execute the main responsibility for uniqueById.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const uniqueById = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.id || normalizeTaxonomyLabel(item?.label || item || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

/**
 * Purpose: Execute the main responsibility for mergeUniqueLabels.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const mergeUniqueLabels = (...groups) => {
  const flattened = groups.flat().filter(Boolean);
  const mapped = flattened.map((item) => typeof item === 'string' ? buildTaxonomyItem(item) : buildTaxonomyItem(item.label || item.id || '', item));
  return uniqueById(mapped);
};

/**
 * Purpose: Execute the main responsibility for canonicalizeRole.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const canonicalizeRole = (title = '', fallbackText = '') => {
  const combined = `${title} ${fallbackText}`.trim();
  for (const rule of ROLE_CANONICAL_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(combined))) {
      return { roleCanonical: rule.canonical, roleFamily: rule.family };
    }
  }
  return {
    roleCanonical: normalizeTaxonomyLabel(title || fallbackText || 'target_role') || 'target_role',
    roleFamily: /data|analytics|machine learning|sql|python/i.test(combined) ? 'data_science' : 'general',
  };
};

/**
 * Purpose: Execute the main responsibility for inferRoleLevel.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const inferRoleLevel = (text = '') => {
  const combined = String(text || '');
  const head = combined.split(/\n/).slice(0, 8).join(' ');
  if (/graduate programme/i.test(head)) return 'graduate';
  if (/\bgraduate\b/i.test(head) && !/post graduate/i.test(head)) return 'graduate';
  if (/\b(?:intern|apprentice)\b/i.test(head)) return 'intern';
  if (/\b(?:junior|entry level|entry-level|associate)\b/i.test(head)) return 'junior';
  if (/\b(?:principal|staff)\b/i.test(head)) return 'staff_plus';
  if (/\b(?:senior)\b/i.test(head)) return 'senior';
  if (/\b(?:lead)\b|\bhead of\b/i.test(head)) return 'lead';
  if (/\bmanager\b/i.test(head)) return 'leadership';
  if (/\bgraduate\b/i.test(combined) && !/post graduate/i.test(combined)) return 'graduate';
  if (/\b(?:intern|apprentice)\b/i.test(combined)) return 'intern';
  if (/\b(?:junior|entry level|entry-level|associate)\b/i.test(combined)) return 'junior';
  if (/\b(?:principal|staff)\b/i.test(combined)) return 'staff_plus';
  if (/\b(?:senior)\b/i.test(combined) || /\b[5-9]\+ years?\b/i.test(combined)) return 'senior';
  if (/\b(?:lead)\b|\bhead of\b/i.test(combined)) return 'lead';
  if (/\bmanager\b/i.test(combined)) return 'leadership';
  if (/\b(?:intermediate|mid)\b/i.test(combined) || /\b[234]\+ years?\b/i.test(combined)) return 'mid';
  return 'mid';
};

// Re-export string utilities for backward compatibility
export { slugifyLabel, prettifyCanonicalRole };
