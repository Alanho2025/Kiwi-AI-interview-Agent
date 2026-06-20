---
name: parse-jd
description: |
  Extracts structured requirements from Job Descriptions, separating essential vs preferred skills.
  Use this skill when the user uploads a JD, asks to extract job requirements, or requests JD parsing.
  Do NOT use for comparing a candidate CV to the JD.
version: 1.0.0
license: MIT
allowed-tools: [Read, Bash, Write]
---
# Parse Job Description (JD)

## When to use
- A user uploads or pastes a Job Description.
- The system needs to determine the essential requirements, preferred skills, and application instructions for a role.

## When NOT to use
- Do NOT use to score a candidate against the JD (use `match-cv-jd` instead).
- Do NOT use to plan an interview session.

## Workflow
1. Parse the provided Job Description text.
2. Extract the following entities:
   - **Company Details**: Company name, role title, and role family.
   - **Requirements (Essential)**: The mandatory skills and experiences required for the role.
   - **Requirements (Preferred)**: The "nice-to-have" skills and bonuses.
   - **Responsibilities**: The day-to-day duties expected in the role.
   - **Application Instructions**: Any specific steps required to apply.
3. **Noise Filtering**: Separate marketing noise and company fluff from actual skills and requirements.
4. **Normalization**: If a JD uses vague skills, still produce clear role-level targets.
5. Save the structured requirements to the database and normalized skills to `parsed_skills`.
