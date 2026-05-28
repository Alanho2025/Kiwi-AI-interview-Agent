#!/bin/bash

# Script to replace duplicate helper functions with imports from commonHelpers
# Phase 1: aiControl directory (18 files)

set -e

echo "=== Replacing duplicate functions in aiControl directory ==="
echo ""

# Array of files to process
files=(
  "backend/src/services/aiControl/evidenceBundleService.js"
  "backend/src/services/aiControl/experienceMemoryService.js"
  "backend/src/services/aiControl/userCoachingMemoryService.js"
  "backend/src/services/aiControl/agentTraceService.js"
  "backend/src/services/aiControl/starRubricService.js"
  "backend/src/services/aiControl/dynamicSlotService.js"
  "backend/src/services/aiControl/abductiveReasoningService.js"
  "backend/src/services/aiControl/interviewModeGuard.js"
  "backend/src/services/aiControl/interviewEvaluatorService.js"
  "backend/src/services/aiControl/reflectionWriterService.js"
  "backend/src/services/aiControl/decisionContextBuilder.js"
  "backend/src/services/aiControl/interviewEnvironmentService.js"
  "backend/src/services/aiControl/modelActionSelectorService.js"
  "backend/src/services/aiControl/compactInterviewContextService.js"
  "backend/src/services/aiControl/fastAnswerUnderstandingService.js"
  "backend/src/services/aiControl/actionPlanner.js"
  "backend/src/services/aiControl/questionRanker.js"
)

count=0
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing: $file"
    count=$((count + 1))
  else
    echo "WARNING: File not found: $file"
  fi
done

echo ""
echo "Total files to process: $count"
echo ""
echo "This script is a placeholder. Actual replacement should be done carefully file by file."
echo "Recommendation: Use Bob AI to process each file individually with proper testing."

# Made with Bob
