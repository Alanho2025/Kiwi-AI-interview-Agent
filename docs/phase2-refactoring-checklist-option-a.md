# Phase 2 Refactoring Checklist - Option A: Pure Helper Functions

**Status**: Ready to begin
**Risk Level**: LOW (Pure functions, no side effects)
**Test Baseline**: Backend 97 tests pass, Frontend 55 tests pass

---

## File 1: transcriptNormalizer.js (55 lines)

**Location**: `backend/src/services/voice/transcriptNormalizer.js`

### Current Behaviour Contract

**Public API**:
- `normalizeTranscript(rawText = '')` - Main export, normalizes ASR transcripts

**Return Value**:
```javascript
{
  rawText: string,           // Original input after spacing collapse
  normalizedText: string,    // Text after safe replacements
  changed: boolean,          // Whether any changes were made
  corrections: Array<{       // List of applied corrections
    pattern: string,
    replacement: string
  }>
}
```

**Pure Functions** (can be extracted):
1. `collapseSpacing(text)` - Line 32, pure text transformation
2. Pattern matching logic (lines 39-45) - pure iteration over SAFE_REPLACEMENTS

**Constants** (can be extracted):
- `SAFE_REPLACEMENTS` - Array of [RegExp, string] tuples (lines 9-30)

**Current Usage**:
- `realtimeSpeechSessionService.js` - imports and uses `normalizeTranscript`
- `elevenLabsRealtimeSpeechSessionService.js` - imports and uses `normalizeTranscript`
- `duplexVoiceRobustness.test.js` - imports for testing

**Side Effects**: NONE (pure function)

**State**: NONE (stateless)

**Integration Points**:
- Used by voice services for ASR transcript cleanup
- No database, no network, no file I/O

### Existing Tests

**Location**: `backend/tests/robustness/voice/duplexVoiceRobustness.test.js`
- Imports `normalizeTranscript` but no dedicated unit tests found
- Only integration-level usage in voice robustness tests

### Missing Tests (MUST ADD BEFORE REFACTORING)

**Required Test Coverage**:
1. ✗ Test `collapseSpacing` with multiple spaces, tabs, newlines
2. ✗ Test `normalizeTranscript` with empty/null/undefined input
3. ✗ Test each SAFE_REPLACEMENT pattern individually
4. ✗ Test multiple replacements in single input
5. ✗ Test case-insensitive matching (e.g., "REACT QUERY" → "React Query")
6. ✗ Test that corrections array captures all changes
7. ✗ Test that `changed` flag is accurate
8. ✗ Test that original text is preserved in `rawText`
9. ✗ Test spacing collapse before and after replacements
10. ✗ Test no changes when input has no matching patterns

**Test File to Create**: `backend/tests/unit/transcriptNormalizer.test.js`

### Allowed Extractions (Safe)

1. **Extract `collapseSpacing` to separate file**:
   - Target: `backend/src/utils/textNormalizers.js`
   - Pure function, no dependencies
   - Can be reused elsewhere

2. **Extract `SAFE_REPLACEMENTS` to config**:
   - Target: `backend/src/config/transcriptReplacements.js`
   - Pure data, no logic
   - Easier to maintain and extend

3. **Extract pattern application logic**:
   - Target: Helper function in same file or `textNormalizers.js`
   - Pure iteration logic

### Disallowed Changes (MUST PRESERVE)

1. ❌ DO NOT change `normalizeTranscript` function signature
2. ❌ DO NOT change return value structure
3. ❌ DO NOT change replacement patterns (business logic)
4. ❌ DO NOT change the order of replacements
5. ❌ DO NOT add async behavior
6. ❌ DO NOT add side effects (logging, metrics, etc.)

### Post-Refactor Test Commands

```bash
# Run unit tests for extracted functions
cd backend && npm test -- tests/unit/transcriptNormalizer.test.js

# Run voice robustness tests (integration)
cd backend && npm test -- tests/robustness/voice/

# Run full backend test suite
cd backend && npm run test:all

# Run lint
cd backend && npm run lint
```

---

## File 2: taxonomyService.js (203 lines)

**Location**: `backend/src/services/taxonomyService.js`

### Current Behaviour Contract

**Public API** (7 exports):
1. `slugifyLabel(value = '')` - Convert to snake_case slug
2. `normalizeTaxonomyLabel(value = '')` - Normalize using aliases or slugify
3. `buildTaxonomyItem(label, extra = {})` - Create taxonomy object with id
4. `uniqueById(items = [])` - Deduplicate by id
5. `mergeUniqueLabels(...groups)` - Merge and deduplicate multiple groups
6. `canonicalizeRole(title = '', fallbackText = '')` - Match role to canonical form
7. `inferRoleLevel(text = '')` - Infer seniority level from text
8. `prettifyCanonicalRole(canonical = '')` - Convert snake_case to Title Case

**Pure Functions** (ALL are pure, can be extracted):
- All 8 exported functions are pure transformations
- No side effects, no state, no I/O

**Constants** (can be extracted):
- `TERM_ALIASES` - Map of term variations to canonical forms (lines 12-64)
- `ROLE_CANONICAL_RULES` - Array of role matching rules (lines 66-78)

**Current Usage**:
- Used throughout backend for skill/role normalization
- JD parsing, CV analysis, matching services
- No direct frontend usage

**Side Effects**: NONE (all pure functions)

**State**: NONE (stateless)

**Integration Points**:
- Used by parsing services, matching services
- No database, no network, no file I/O

### Existing Tests

**Search Required**: Need to find existing tests for taxonomyService

**Command to run**:
```bash
find backend/tests -name "*.test.js" -exec grep -l "taxonomyService" {} \;
```

### Missing Tests (MUST ADD BEFORE REFACTORING)

**Required Test Coverage**:

**For `slugifyLabel`**:
1. ✗ Test basic conversion: "Hello World" → "hello_world"
2. ✗ Test special characters removal
3. ✗ Test leading/trailing underscores removal
4. ✗ Test multiple consecutive underscores collapse
5. ✗ Test empty string handling

**For `normalizeTaxonomyLabel`**:
6. ✗ Test alias lookup (e.g., "power bi" → "power_bi")
7. ✗ Test fallback to slugify when no alias
8. ✗ Test case-insensitive matching
9. ✗ Test empty/whitespace handling

**For `buildTaxonomyItem`**:
10. ✗ Test basic item creation with id and label
11. ✗ Test extra properties merge
12. ✗ Test empty label handling

**For `uniqueById`**:
13. ✗ Test deduplication by id
14. ✗ Test handling items without id (fallback to label)
15. ✗ Test empty array handling
16. ✗ Test order preservation

**For `mergeUniqueLabels`**:
17. ✗ Test merging multiple groups
18. ✗ Test string to object conversion
19. ✗ Test deduplication across groups
20. ✗ Test null/undefined filtering

**For `canonicalizeRole`**:
21. ✗ Test each ROLE_CANONICAL_RULES pattern
22. ✗ Test fallback behavior
23. ✗ Test combined title + fallbackText matching
24. ✗ Test roleFamily assignment

**For `inferRoleLevel`**:
25. ✗ Test each level detection (graduate, intern, junior, etc.)
26. ✗ Test priority order (head vs body text)
27. ✗ Test default to 'mid' when no match
28. ✗ Test edge cases (e.g., "post graduate" should not match "graduate")

**For `prettifyCanonicalRole`**:
29. ✗ Test snake_case to Title Case conversion
30. ✗ Test empty string handling
31. ✗ Test multiple underscores

**Test File to Create**: `backend/tests/unit/taxonomyService.test.js`

### Allowed Extractions (Safe)

1. **Extract `TERM_ALIASES` to config**:
   - Target: `backend/src/config/taxonomyAliases.js`
   - Pure data, easier to maintain

2. **Extract `ROLE_CANONICAL_RULES` to config**:
   - Target: `backend/src/config/roleCanonicalRules.js`
   - Pure data, easier to extend

3. **Extract string utilities**:
   - `slugifyLabel` → `backend/src/utils/stringUtils.js`
   - `prettifyCanonicalRole` → `backend/src/utils/stringUtils.js`
   - Reusable across codebase

4. **Extract role inference logic**:
   - `canonicalizeRole` and `inferRoleLevel` → `backend/src/services/roleInferenceService.js`
   - Cohesive domain logic

5. **Extract taxonomy item builders**:
   - Keep `buildTaxonomyItem`, `uniqueById`, `mergeUniqueLabels` together
   - Could move to `backend/src/utils/taxonomyBuilders.js`

### Disallowed Changes (MUST PRESERVE)

1. ❌ DO NOT change any function signatures
2. ❌ DO NOT change return value structures
3. ❌ DO NOT change alias mappings (business logic)
4. ❌ DO NOT change role matching patterns (business logic)
5. ❌ DO NOT change level inference logic (business logic)
6. ❌ DO NOT add async behavior
7. ❌ DO NOT add side effects
8. ❌ DO NOT change the priority order in `inferRoleLevel`

### Post-Refactor Test Commands

```bash
# Run unit tests for taxonomy functions
cd backend && npm test -- tests/unit/taxonomyService.test.js

# Run services that depend on taxonomy
cd backend && npm test -- tests/robustness/jd/
cd backend && npm test -- tests/robustness/cv/
cd backend && npm test -- tests/robustness/match/

# Run full backend test suite
cd backend && npm run test:all

# Run lint
cd backend && npm run lint
```

---

## Refactoring Execution Plan

### Phase 1: Add Missing Tests (DO THIS FIRST)

**Step 1.1**: Create `backend/tests/unit/transcriptNormalizer.test.js`
- Add all 10 missing test cases
- Verify current behavior is captured
- Run: `npm test -- tests/unit/transcriptNormalizer.test.js`

**Step 1.2**: Create `backend/tests/unit/taxonomyService.test.js`
- Add all 31 missing test cases
- Verify current behavior is captured
- Run: `npm test -- tests/unit/taxonomyService.test.js`

**Step 1.3**: Verify test baseline
- Run: `npm run test:all`
- Confirm: Backend tests increase from 97 to ~138 (97 + 10 + 31)

### Phase 2: Extract transcriptNormalizer (AFTER TESTS PASS)

**Step 2.1**: Extract `collapseSpacing`
- Create `backend/src/utils/textNormalizers.js`
- Move function, update import in `transcriptNormalizer.js`
- Run tests, run lint

**Step 2.2**: Extract `SAFE_REPLACEMENTS`
- Create `backend/src/config/transcriptReplacements.js`
- Move constant, update import
- Run tests, run lint

**Step 2.3**: Verify no regressions
- Run: `npm run test:all`
- Run: `npm run lint`
- Confirm: All 138 tests still pass

### Phase 3: Extract taxonomyService (AFTER PHASE 2 COMPLETE)

**Step 3.1**: Extract constants
- Create `backend/src/config/taxonomyAliases.js` for `TERM_ALIASES`
- Create `backend/src/config/roleCanonicalRules.js` for `ROLE_CANONICAL_RULES`
- Update imports
- Run tests, run lint

**Step 3.2**: Extract string utilities
- Create `backend/src/utils/stringUtils.js`
- Move `slugifyLabel` and `prettifyCanonicalRole`
- Update imports in `taxonomyService.js`
- Run tests, run lint

**Step 3.3**: Verify no regressions
- Run: `npm run test:all`
- Run: `npm run lint`
- Confirm: All 138 tests still pass

### Phase 4: Final Verification

**Step 4.1**: Run full test suite
```bash
cd backend && npm run test:all
cd frontend && npm run test:all
```

**Step 4.2**: Run lint
```bash
cd backend && npm run lint
cd frontend && npm run lint
```

**Step 4.3**: Verify file sizes
- `transcriptNormalizer.js`: Should reduce from 55 to ~30 lines
- `taxonomyService.js`: Should reduce from 203 to ~120 lines

**Step 4.4**: Update documentation
- Update `phase2-current-state-snapshot-complete.md` with new file structure
- Document extracted files in refactoring log

---

## Success Criteria

✅ All existing tests pass (97 backend + 55 frontend)
✅ All new tests pass (41 new unit tests added)
✅ No lint errors
✅ No function signature changes
✅ No behavior changes
✅ File sizes reduced
✅ Code is more maintainable
✅ Pure functions are isolated
✅ Constants are in config files

---

## Rollback Plan

If any step fails:
1. Revert the last commit
2. Review test failures
3. Fix issues before proceeding
4. Do not proceed to next step until current step passes

---

**Next Action**: Create unit tests for `transcriptNormalizer.js` (10 test cases)