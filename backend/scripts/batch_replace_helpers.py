#!/usr/bin/env python3
"""
Batch replace duplicate helper functions with commonHelpers imports
"""

import re
from pathlib import Path

# Define files and their replacements (paths relative to project root)
replacements = [
    # Match services
    ("src/services/match/matchValidationTargetBuilder.js", ["ensureArray", "unique"], "../../utils/commonHelpers.js"),
    ("src/services/match/matchExplanationBuilder.js", ["ensureArray"], "../../utils/commonHelpers.js"),
    
    # Report services
    ("src/services/report/claimGroundingService.js", ["ensureArray", "normalizeText", "tokenize"], "../../utils/commonHelpers.js"),
    ("src/services/report/turnRubricService.js", ["normalizeText"], "../../utils/commonHelpers.js"),
    ("src/services/report/reportRewriteService.js", ["ensureArray"], "../../utils/commonHelpers.js"),
    ("src/services/reportCoachingService.js", ["ensureString", "ensureArray"], "../utils/commonHelpers.js"),
    
    # JD services
    ("src/services/jobDescription/jobDescriptionContractBuilder.js", ["ensureArray", "unique"], "../../utils/commonHelpers.js"),
    ("src/services/jobDescription/jobDescriptionSignals.js", ["ensureArray"], "../../utils/commonHelpers.js"),
    ("src/services/jobDescription/jobDescriptionNormalizer.js", ["ensureArray"], "../../utils/commonHelpers.js"),
    ("src/services/jobDescription/jobDescriptionSchemaValidator.js", ["ensureArray", "ensureObject"], "../../utils/commonHelpers.js"),
    
    # Voice services
    ("src/services/voice/transcriptUnderstandingSummary.js", ["normalizeText"], "../../utils/commonHelpers.js"),
    ("src/services/voice/transcriptConfirmationReplyClassifier.js", ["normalizeText"], "../../utils/commonHelpers.js"),
    ("src/services/voice/voiceDeliveryAnalyzerService.js", ["normalizeText"], "../../utils/commonHelpers.js"),
    
    # Agent services
    ("src/services/agents/retrievalAgent.js", ["ensureArray", "unique"], "../../utils/commonHelpers.js"),
    ("src/services/agents/reportGenerator/reportDraftBuilder.js", ["ensureArray"], "../../../utils/commonHelpers.js"),
    ("src/services/agents/interviewerAgent.js", ["normalizeText", "tokenize", "normalizeKey"], "../../utils/commonHelpers.js"),
    
    # Other services
    ("src/services/interviewStateService.js", ["normalizeText", "normalizeKey"], "../utils/commonHelpers.js"),
    ("src/services/interview/interviewTurnPolicy.js", ["ensureArray", "normalizeText"], "../../utils/commonHelpers.js"),
    ("src/services/retrieval/retrievalQualityAssessor.js", ["ensureArray"], "../../utils/commonHelpers.js"),
    ("src/services/company/companyMotivationFitService.js", ["ensureArray", "ensureString", "ensureNumber"], "../../utils/commonHelpers.js"),
    ("src/services/opsLiteVoiceLatencyService.js", ["ensureArray"], "../utils/commonHelpers.js"),
    ("src/services/cv/cvReviewedProfileService.js", ["normalizeText"], "../../utils/commonHelpers.js"),
]

def process_file(filepath, helpers, import_path):
    """Process a single file to replace duplicate helpers"""
    path = Path(filepath)
    if not path.exists():
        print(f"⚠️  File not found: {filepath}")
        return False
    
    content = path.read_text()
    
    # Build import statement
    import_stmt = f"import {{ {', '.join(helpers)} }} from '{import_path}';\n"
    
    # Remove const declarations for these helpers
    for helper in helpers:
        # Match various const declaration patterns
        patterns = [
            rf'^const {helper} = .*?;\n',
            rf'^const {helper} = .*?\n.*?;\n',  # Multi-line
        ]
        for pattern in patterns:
            content = re.sub(pattern, '', content, flags=re.MULTILINE)
    
    # Add import at the top (after existing imports or at start)
    if 'import ' in content:
        # Find last import
        import_lines = [i for i, line in enumerate(content.split('\n')) if line.startswith('import ')]
        if import_lines:
            lines = content.split('\n')
            last_import_idx = import_lines[-1]
            lines.insert(last_import_idx + 1, import_stmt.rstrip())
            content = '\n'.join(lines)
    else:
        content = import_stmt + content
    
    path.write_text(content)
    print(f"✅ Processed: {filepath}")
    return True

def main():
    print("🚀 Starting batch replacement of duplicate helpers...\n")
    
    success_count = 0
    for filepath, helpers, import_path in replacements:
        if process_file(filepath, helpers, import_path):
            success_count += 1
    
    print(f"\n✨ Completed! {success_count}/{len(replacements)} files processed successfully.")

if __name__ == "__main__":
    main()

# Made with Bob
