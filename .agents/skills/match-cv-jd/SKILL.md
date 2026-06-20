---
name: match-cv-jd
description: |
  Compares a parsed CV profile against a parsed JD to generate an interview preparation plan.
  Use this skill when you need to match a candidate to a role, identify skill gaps, or plan interview questions.
  Do NOT use for the actual voice or text interview execution.
version: 1.0.0
license: MIT
allowed-tools: [Read, Bash, Write]
---
# Match CV to JD

## When to use
- The system needs to generate an interview preparation plan based on an uploaded CV and JD.
- Identifying what a candidate lacks (gaps) and what they excel in relative to the role.

## When NOT to use
- Do NOT use during the active real-time interview session.

## Workflow
1. Load the structured CV profile and the structured JD requirements.
2. **Gap Analysis**: 
   - Identify JD requirements that are missing from the CV. Frame these explicitly as **gaps** (do not invent experience to fill them).
   - Identify partial matches and map them to transferable skills.
3. **Overqualification/Irrelevance**: Identify CV skills that are not required by the JD.
4. **Prioritization**:
   - Rank essential/required skills higher than preferred skills.
   - Select priority topics for the upcoming interview based on the strongest evidence gaps and the most critical role requirements.
5. Generate the seed topics and interview plan. Ensure seed topics map directly to CV skills, projects, or experience, without inventing new ones.
