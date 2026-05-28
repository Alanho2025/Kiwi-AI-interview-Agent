#!/bin/bash
# Script to replace duplicate helper functions with commonHelpers imports

# Match services
sed -i '' '1s/^/import { ensureArray, unique } from "..\/..\/utils\/commonHelpers.js";\n/' backend/src/services/match/matchAnalysisContractBuilder.js
sed -i '' '/^const ensureArray/d; /^const unique/d' backend/src/services/match/matchAnalysisContractBuilder.js

sed -i '' '1s/^/import { ensureArray, unique } from "..\/..\/utils\/commonHelpers.js";\n/' backend/src/services/match/matchValidationTargetBuilder.js
sed -i '' '/^const ensureArray/d; /^const unique/d' backend/src/services/match/matchValidationTargetBuilder.js

sed -i '' '1s/^/import { ensureArray } from "..\/..\/utils\/commonHelpers.js";\n/' backend/src/services/match/matchExplanationBuilder.js
sed -i '' '/^const ensureArray/d' backend/src/services/match/matchExplanationBuilder.js

# Report services
sed -i '' '1s/^/import { ensureArray, normalizeText, tokenize } from "..\/..\/utils\/commonHelpers.js";\n/' backend/src/services/report/claimGroundingService.js
sed -i '' '/^const ensureArray/d; /^const normalizeText/d; /^const tokenize/d' backend/src/services/report/claimGroundingService.js

sed -i '' '1s/^/import { normalizeText } from "..\/..\/utils\/commonHelpers.js";\n/' backend/src/services/report/turnRubricService.js
sed -i '' '/^const normalizeText/d' backend/src/services/report/turnRubricService.js

sed -i '' '1s/^/import { ensureArray } from "..\/..\/utils\/commonHelpers.js";\n/' backend/src/services/report/reportRewriteService.js
sed -i '' '/^const ensureArray/d' backend/src/services/report/reportRewriteService.js

echo "Duplicate helper functions replaced successfully!"

# Made with Bob
