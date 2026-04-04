# Project Requirements - First draft

> This is a living document. Update it as the project evolves.
Each feature stage should be reflected here before you start coding.
> 

---

## Project Overview

An AI-powered mock interview web app that helps users practise job interviews based on their CV and a target job description.

The system allows users to sign in, upload their CV and job description, and complete a short AI-led interview session using voice input. The AI generates interview questions based on the match between the user's background and the job requirements, then produces a feedback report after the session.

This MVP is focused on delivering a simple, working end-to-end interview experience. It should prioritise usability, basic voice interaction, document upload, question generation, timed interview flow, and report output.

---

## Current Stage: MVP AI Interview Agent

### What it does

- Allows users to sign in before starting the interview flow
- Supports `Continue with Google` as a login option
- Requests permission to access the user's microphone
- Allows users to upload:
    - one CV file
    - one job description file, or pasted job description text
- Supports both desktop and mobile-friendly file upload
- Parses the uploaded CV and job description
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
- Limits the interview session to around 5 minutes
- Ends the interview automatically when time is up
- Generates a basic feedback report after the interview
- Displays the report in the web interface

### What it does NOT do (yet)

- Does not support multiple interview rounds in one session
- Does not provide a full recruiter-grade evaluation
- Does not guarantee highly accurate scoring for all industries or job types
- Does not support video interview input
- Does not support real-time facial expression analysis
- Does not include advanced user profile settings
- Does not store long-term interview history unless added later
- Does not support collaborative reviewer feedback
- Does not provide deeply customised company-specific question banks
- Does not support multilingual interview mode unless added later

---

## Core User Flow (MVP)

1. User enters the landing page
2. User signs in
3. User grants microphone permission
4. User uploads CV and job description
5. System parses both files
6. System extracts and matches key information
7. System generates a simple interview plan
8. AI starts the interview
9. AI asks self-introduction first
10. AI asks follow-up and role-related questions
11. Interview runs for up to 5 minutes
12. Session ends
13. System generates and displays a feedback report

---

## Functional Requirements

### Authentication

- The system must require login before starting an interview session
- The system should support `Continue with Google`
- The system may support other login methods later

### Microphone Access

- The system must ask for microphone permission before starting voice interaction
- If permission is denied, the system must show a clear error or fallback message
- The system should allow a text-based fallback later if needed, but this is optional for MVP

### CV and Job Description Input

- The system must allow users to upload a CV file
- The system must allow users to upload a job description file or paste job description text
- The system must support common file upload interactions on both desktop and mobile
- The system should validate file type and file size
- The system should show upload success or failure messages clearly

### Document Processing

- The system must parse the CV and job description after upload
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
- The system must keep the whole interview within about 5 minutes
- The system should stop asking new questions when time is nearly finished
- The system must end the session cleanly when time is up

### Feedback Report

- The system must generate a report after the interview
- The report should include:
    - overall impression
    - strengths
    - gaps or weak areas
    - job-fit observations
    - suggested improvements
- The system must display the report in a readable format on the web page

---

## Non-Functional Requirements

- The interface should be simple and easy to understand
- The upload and interview flow should be usable on both desktop and mobile devices
- The system should respond fast enough to maintain a basic interview conversation
- The system should handle permission denial and upload failure gracefully
- The system should keep the MVP architecture simple and easy to extend later
- The system should be built in a way that future features can be added without major rewrite