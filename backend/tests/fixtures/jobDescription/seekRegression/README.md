# SEEK JD regression fixtures

This fixture set contains 10 real SEEK-style job descriptions and their expected parser contract.

## Purpose

These files are regression inputs for JD parsing robustness. They are not intended to force the full parsed JSON to match exactly. The tests should verify the fields that must stay stable:

- job title
- company name
- location
- employment type
- salary when present
- section boundary behaviour
- responsibility and requirement phrase coverage
- forbidden noise removal
- technical skill signal extraction

## Why this exists

The parser previously made errors such as:

- treating `Engineering - Software (Information & Communication Technology)` as a title
- treating `Contract/Temp` or `Full time` as a company
- adding headings such as `Bonus`, `Stack`, or `Experience Level` as requirement items
- leaking `Employer questions` and SEEK metadata into the parsed role contract

The tests in `tests/robustness/jd/jdSeekRegressionCorpus.test.js` protect against those failures.
