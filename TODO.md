# Skill Requirement Extraction Fix - TODO

## 批准計劃
- [ ] 基於用戶確認的計劃：增強 jobDescriptionService.js 用 AI + rule 提取 skills，避免空白。
- 依賴：jobDescriptionService.js (primary), matchService.js (secondary)。

## 步驟分解 (依序完成)
1. [x] **新增 AI 技能提取**：已加 `extractSkillsWithAI` + 整合到 `buildStructuredJobDescriptionRubric` (async)，AI first + rule fallback。
2. [x] **增強 rule-based fallback**：已加 `collectDynamicTechnicalSkills` / `collectDynamicSoftSkills`，測試通過：提取 Python/AWS/K8s。
3. [x] **更新 buildStructuredJobDescriptionRubric**：skills = AI || fallback。
4. [x] **更新 matchService.js**：async 支持，簡化 strengths/gaps 只列 skills 關鍵字 (無 'evidence' 前綴)。
5. [x] **更新 analyzeController**：await matchData。
6. [ ] **測試**：全流程。
7. [ ] **完成**：attempt_completion。

進度將每步更新此文件。當前：步驟2 完成，測試 fallback 後繼續 AI。
