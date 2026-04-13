# CV / JD / Match Eval

This repo now keeps deterministic regression tests and evaluation runners side by side:

- `tests/` keeps contract and regression guards.
- `eval/` measures parse quality and CV ↔ JD match quality on curated fixtures.

## Available commands

- `npm run eval:jd` → JD parse evaluation
- `npm run eval:cv` → CV parse evaluation
- `npm run eval:cv-jd-match` → CV ↔ JD match evaluation
- `npm run eval:all` → runs all evaluation scripts

## Output

Each runner writes:

- `eval/reports/*.latest.json`
- `eval/reports/*.latest.md`

Those reports are meant to answer three things fast:

1. Which cases are strong right now
2. Which cases are weak right now
3. Which checks failed, so you know what to fix instead of guessing

## Dataset shape

### CV parse dataset

```json
{
  "id": "graduate_software_cv",
  "fixture": "graduate-software-engineer.txt",
  "expected": {
    "candidateName": "Alex Chen",
    "requiredSections": ["summary", "skills", "projects"],
    "requiredSkills": ["sql", "git"],
    "achievementKeywords": ["50%"],
    "capabilityKeywords": ["automation"]
  }
}
```

### CV ↔ JD match dataset

```json
{
  "id": "graduate_cv_to_graduate_jd",
  "cvFixture": "graduate-software-engineer.txt",
  "jdFixture": "graduate-software-developer.txt",
  "expected": {
    "acceptableDecisions": ["moderate_match", "strong_match"],
    "scoreRange": [60, 100],
    "matchedRequirementKeywords": ["sql", "git"],
    "gapKeywords": ["production"],
    "riskKeywords": ["production"]
  }
}
```

The expectations are intentionally flexible. They are there to catch drift, not to force one exact sentence everywhere.
