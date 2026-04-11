# CV Domain Test Checklist

## Critical API tests
- upload CV rejects unsupported extension
- upload CV rejects unsupported MIME type
- recent CV list does not include raw CV text
- select CV only returns owned CVs
- rebuild CV profile only works for owned CVs
- delete CV only works for owned CVs
- export CV only works for owned CVs
- match analysis requires an owned CV
- match analysis returns a persisted `matchAnalysisId`
- session creation accepts an owned `matchAnalysisId`

## Service tests
- profile rebuild updates `cvProfile`, `displayProfile`, and parse warnings
- soft delete marks both file record and document content as deleted
- export payload includes redacted display data and normalized profile data only
- question pool sent to the client strips internal trace fields
