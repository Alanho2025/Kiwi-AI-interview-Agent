---
name: parse-cv
description: |
  Extracts structured profiles from candidate CVs, including skills, projects, experience, and education.
  Use this skill when the user uploads a CV, asks to extract a candidate profile, or requests CV parsing.
  Do NOT use for matching CVs to Job Descriptions or generating interview plans.
version: 1.0.0
license: MIT
allowed-tools: [Read, Bash, Write]
---
# Parse CV

## When to use
- A user uploads a new CV document (PDF, Word).
- The system needs to extract the candidate's existing skills, projects, and experiences into a structured format for the database.
- Checking what experiences a candidate has previously claimed.

## When NOT to use
- Do NOT use to compare the CV against a Job Description (use `match-cv-jd` instead).
- Do NOT use for generating a final interview report.

## Workflow
1. Parse the uploaded CV document text.
2. Extract the core entities:
   - **Skills**: Identify technical and soft skills.
   - **Experience**: Extract roles, companies, dates, and bullet points.
   - **Projects**: Extract project names, descriptions, and technologies used.
   - **Education**: Extract degrees and institutions.
3. **Deduplication**: Ensure that repeated skills are deduplicated.
4. **Fidelity Rule**: Do NOT invent or infer unsupported skills that are not explicitly present in the CV text.
5. Save the structured profile to the `parsed_profiles` database table and normalized skills to `parsed_skills`.
