# Version History

## JD Parser Phase 2
- Added normalized bluepoint output for responsibilities, requirements, benefits, and application instructions.
- Added raw section preservation under `rawSections` so original JD evidence is still available.
- Added `evidenceMap` to link normalized points back to source text.
- Added bluepoint normalizers for responsibilities, requirements, benefits, soft skills, and application instructions.
- Updated rubric builder to return `sections` as normalized points and `normalized` as a mirrored structured view.
- Updated schema validator to preserve `rawSections`, `normalized`, and `evidenceMap`.
- Added normalization-focused tests and updated JD section tests to reflect bluepoint output.


## JD parser phase 3
- Fixed downstream JD contract builder to preserve normalized preferred skills and raw preferred evidence together.
- Added candidate ranking tests for header tokenization and labeled company extraction.
- Expanded metamorphic stability coverage with lowercase paragraph and reordered variants.
- Expanded adversarial coverage to ensure marketing noise stays out of company and skill extraction.
## JD Parser Phase 4
- Fixed malformed newline escaping in `tests/jobDescription/jobDescriptionMetamorphic.test.js` so Vitest and Vite import analysis can parse the file correctly.
- Preserved Phase 3 contract compatibility changes while keeping metamorphic stability coverage for lowercase paragraph and reordered variants.

