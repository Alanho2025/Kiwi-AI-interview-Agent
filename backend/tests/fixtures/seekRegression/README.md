# SEEK JD Parser Test Fixtures

This folder contains 10 raw SEEK-style job descriptions and matching expected JSON outputs.

## How to use

- `raw/seek_job_XX.txt` contains the raw copied job description.
- `expected/*.expected.json` contains one expected output per JD.
- `expected.all.json` contains all 10 expected outputs in one file.

## Recommended test focus

These fixtures should be used for robustness tests, not only smoke tests.

Minimum assertions:
1. The parser extracts the real job title, not the SEEK category.
2. The parser extracts the real company, not employment type, salary, or category metadata.
3. Heading-only labels such as `Bonus`, `Experience Level`, `Responsibilities`, and `Key Requirements` must not become requirement items.
4. Responsibilities should come from responsibility/action sections.
5. Core requirements and nice-to-have requirements should not be mixed.
6. Skills can be inferred, but requirement items should keep source evidence.
7. Missing benefits or application notes should be allowed, but fabricated content should fail.
8. Confidence should drop or fallback should trigger when metadata is incomplete or ambiguous.

## Suggested parser contract

Each parsed item should include source evidence in the backend if possible:

```js
{
  value: "Strong SQL skills and experience with Python",
  sourceText: "Strong SQL skills and experience with Python (or similar)",
  sourceSection: "requirements",
  confidence: 0.95
}
```

The UI can display `value`, but tests should verify `sourceText`.
