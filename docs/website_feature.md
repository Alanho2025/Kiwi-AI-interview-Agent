# Project Requirements - First draft

> This is a living document. Update it as the project evolves.
Each feature stage should be reflected here before you start coding.
> 

---

## Project Overview

An AI-powered mock interview web app that helps users practise job interviews based on their CV and a target job description.

The system allows users to sign in, upload their CV, paste a job description, and complete a short AI-led interview session using text mode or the product-wired voice mode. The AI generates interview questions based on the match between the user's background and the job requirements, then produces a feedback report after the session.

This MVP is focused on delivering a working end-to-end interview experience. The current safest product flow is CV upload, pasted JD parsing, human review gates, CV-JD match, interview planning, text interview, and report output. Voice is product-wired but still depends on credentials for the configured Azure/ElevenLabs provider order, authenticated WebSocket access, microphone permission, and E2E verification.

---

## Current Stage: MVP AI Interview Agent

### What it does

- Allows users to sign in before starting the interview flow
- Supports `Continue with Google` as a login option
- Requests permission to access the user's microphone
- Allows users to upload:
    - one CV file
    - pasted job description text
- Supports both desktop and mobile-friendly file upload
- Parses the uploaded CV and pasted job description
- Extracts key information from both documents, such as:
    - skills
    - work experience
    - projects
    - job requirements
    - preferred qualifications
- Matches CV content with the job description
- Builds a basic interview plan before the conversation starts
- Starts the interview with a self-introduction question
- Asks follow-up questions based on:
    - the user's answer
    - the uploaded CV
    - the uploaded job description
- Asks a small number of role-related or technical questions
- Supports question-limited and time-limited session setup
- Ends the interview by configured completion rules
- Prevents prepared and live assessment-equivalent duplicate questions while preserving distinct follow-ups
- Generates a grounded feedback report from countable questions and accepted answers after the interview
- Supports question-specific rubrics, transcript-risk warnings, evidence-source rows, report QA, at most two grounded wording-repair attempts, and a commercial stress-test cost summary
- Supports resumable voice-recording upload and asynchronous MP3 conversion without blocking report navigation
- Displays the report in the web interface

### What it does NOT do (yet)

- Does not support multiple interview rounds in one session
- Does not provide a full recruiter-grade evaluation
- Does not guarantee highly accurate scoring for all industries or job types
- Does not support video interview input
- Does not support real-time facial expression analysis
- Does not include advanced user profile settings
- Does not guarantee indefinite interview-history retention; session history exists but retention policy and cleanup apply
- Does not support collaborative reviewer feedback
- Does not provide deeply customised company-specific question banks
- Does not support multilingual interview mode unless added later
- Does not currently implement JD file upload; current JD flow is pasted text
- Does not guarantee live voice readiness without configured speech-provider credentials and browser/device setup
- Does not provide account-wide deletion or encryption-at-rest guarantees; retention cleanup exists but is operationally gated and disabled by default

---

## Core User Flow (MVP)

1. User enters the landing page
2. User signs in
3. User uploads or selects a CV
4. User reviews parsed CV match fields
5. User pastes a job description
6. System parses the JD into a structured rubric
7. User reviews the parsed JD rubric
8. System extracts and matches key information
9. System generates an interview plan
10. AI starts the interview with a self-introduction question
11. AI asks follow-up and role-related questions
12. Session ends by configured question or time rules
13. System generates and displays a feedback report
14. System runs report QA, may perform bounded grounded repair, and stores an explicit report status
15. User can inspect turn rubrics, evidence sources, transcript risks, recording status, and commercial stress-test cost summary where usage events were recorded

---

## Functional Requirements

### Authentication

- The system must require login before starting an interview session
- The system should support `Continue with Google`
- The system may support other login methods later

### Microphone Access

- The system must ask for microphone permission before starting voice interaction
- If permission is denied, the system must show a clear error or fallback message
- The system supports text interview mode. Text mode remains the safest demo path when voice dependencies are unavailable.

### CV and Job Description Input

- The system must allow users to upload a CV file
- The system must allow users to paste job description text
- JD file upload is a backlog item, not current implementation
- The system must support common file upload interactions on both desktop and mobile
- The system should validate file type and file size
- The system should show upload success or failure messages clearly

### Document Processing

- The system must parse the CV after upload and parse the job description after pasted text input
- The system must extract useful structured information from both documents
- The system should identify overlaps and gaps between the CV and job description
- The system must use this information to guide interview question generation

### Interview Question Planning

- The system must generate a simple interview plan before the interview starts
- The plan should include:
    - one self-introduction opener
    - several follow-up questions
    - several role-fit or technical questions
- The question plan should be influenced by:
    - CV content
    - job description requirements
    - skill match results

### Interview Session

- The system must begin with a self-introduction question
- The system must ask follow-up questions based on the user's previous answer
- The system should ask a limited number of technical or job-fit questions
- The system must support configured question and time limits
- The system should stop asking new questions when the configured completion rule is reached
- The system must end the session cleanly when time is up

### Feedback Report

- The system must generate a report after the interview
- The report should include:
    - overall impression
    - strengths
    - gaps or weak areas
    - job-fit observations
    - suggested improvements
- Report generation includes QA. It may include repair history, evidence/transcript-risk diagnostics, and commercial cost summary data when available.
- The system must display the report in a readable format on the web page

---

## Non-Functional Requirements

- The interface should be simple and easy to understand
- The upload and interview flow should be usable on both desktop and mobile devices
- The system should respond fast enough to maintain a basic interview conversation
- The system should handle permission denial and upload failure gracefully
- The system should keep the MVP architecture simple and easy to extend later
- The system should be built in a way that future features can be added without major rewrite
