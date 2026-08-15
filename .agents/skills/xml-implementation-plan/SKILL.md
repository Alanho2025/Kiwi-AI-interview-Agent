---
name: xml-implementation-plan
description: Forces the use of the strict Contract-Driven Development XML framework for all implementation plans instead of the default markdown format.
---

# XML Implementation Plan Skill

This skill overrides the default markdown-based `implementation_plan.md` format. When you are in planning mode or when a user explicitly requests an implementation plan, you **MUST ALWAYS** use this strict XML template. This enforces Contract-Driven Development and boundary control.

## File Format & Location

- Create the plan artifact as `implementation_plan.xml` instead of `.md`.
- Save it inside the standard artifacts directory: `<appDataDir>/brain/<conversation-id>/implementation_plan.xml`.

## Mandatory XML Schema Template

Copy and fill out the following exact XML structure for your plans. Omit sections only if they are entirely irrelevant, but strive to complete all tags to maintain rigor.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<implementation_plan id="[feature-name-phase-x]" version="1.0" status="ready_for_implementation">
  
  <!-- 1. Plan Boundaries -->
  <plan_boundary>
    <requested_output>Complete implementation-level XML plan for the requested feature/phase.</requested_output>
    <phase_name>[Name of the phase or feature]</phase_name>
    <source_of_truth>[Reference doc or research artifact]</source_of_truth>
    <parent_outline>[Reference outline if applicable]</parent_outline>
    <prior_phase>[Reference prior phase if applicable]</prior_phase>
    <authorization>This document plans the feature. Execution requires explicit owner approval.</authorization>
    <release_boundary>[Describe if this is an internal slice or ready for release]</release_boundary>
  </plan_boundary>

  <!-- 2. Phase Overview -->
  <phase_overview>
    <phase_number>[Phase Number]</phase_number>
    <phase_name>[Name of the phase]</phase_name>
    <phase_goal>[Primary objective of the phase]</phase_goal>
    <observable_end_state>[What exact changes will be observable when done]</observable_end_state>
    <depends_on>
      <dependency>[Prerequisite condition 1]</dependency>
    </depends_on>
    <provides_to>
      <consumer phase="[Next Phase]">[What this provides to the next phase]</consumer>
    </provides_to>
  </phase_overview>

  <!-- 3. Research & Audit Gate -->
  <research_gate status="ready_for_plan">
    <evidence_examined>
      <item path="[file_path.js]" lines="[line_ranges]">[What was found]</item>
    </evidence_examined>
    <confirmed_current_state>
      <item>[Fact about current architecture]</item>
    </confirmed_current_state>
    <gaps>
      <item>[Current architectural gaps]</item>
    </gaps>
    <weak_reasoning>
      <item>[Flaws in current implementation]</item>
    </weak_reasoning>
    <unsupported_assumptions>
      <item>[Assumptions that need validation]</item>
    </unsupported_assumptions>
    <assumption_alignment>
      <item status="[human-aligned | evidence-validated | implementation-decision]">[Assumption validation status]</item>
    </assumption_alignment>
    <missing_requirements>
      <item>[Requirements not yet covered]</item>
    </missing_requirements>
    <ambiguities>
      <item>[Unresolved design ambiguities]</item>
    </ambiguities>
    <contradictions>
      <item>[Conflicting logic or specs]</item>
    </contradictions>
    <questions_that_require_human_answers>None or [List of blocking questions for the user]</questions_that_require_human_answers>
  </research_gate>

  <!-- 4. Execution Details & Work Packages -->
  <phase_sequence>
    <phase id="[Phase ID]" name="[Phase Name]">
      <goal>[Goal of this specific phase sequence]</goal>
      <work_packages>
        
        <work_package id="[WP-1]" name="[Work Package Name]">
          
          <!-- Task Budget & Boundary Contract -->
          <task_contract>
            <one_observable_goal>[Single goal for this work package]</one_observable_goal>
            <allowed_areas>
              <area>[Allowed directory or file]</area>
            </allowed_areas>
            <forbidden_areas>
              <area>[Directories or files to NOT touch]</area>
            </forbidden_areas>
            <budgets>
              <total_task_owned_files>[Max allowed files modified]</total_task_owned_files>
              <incremental_changed_lines>[Max allowed changed lines]</incremental_changed_lines>
              <production_files>[Max production files]</production_files>
              <test_files>[Max test files]</test_files>
              <documentation_files>[Max doc files]</documentation_files>
              <implementation_cycles>[Max execution cycles, e.g. 3]</implementation_cycles>
            </budgets>
            <stop_rule>[Conditions under which the agent must stop and report back]</stop_rule>
          </task_contract>

          <dependencies>
            <dependency>[Dependency on other WPs]</dependency>
          </dependencies>

          <!-- Component Design -->
          <implementation_design>
            <component path="[file_path]" role="[Role of the component]">
              <contract>[What must this component guarantee]</contract>
              <pseudocode><![CDATA[
[Write logic or pseudocode here]
              ]]></pseudocode>
            </component>
          </implementation_design>

          <!-- Verification Policy -->
          <verification>
            <test_files>
              <test_file path="[test_file_path]" intent="[What this test proves]" />
            </test_files>
          </verification>

        </work_package>
      </work_packages>
    </phase>
  </phase_sequence>

  <!-- 5. Quality Audit -->
  <three_pass_audit>
    <pass id="1" name="Implementation">
      <check>
        <criterion>[Quality standard 1]</criterion>
        <failure_behavior>[What happens if it fails]</failure_behavior>
      </check>
    </pass>
    <pass id="2" name="Robustness Testing">
      <check>
        <criterion>[Test requirement]</criterion>
        <failure_behavior>[What happens if it fails]</failure_behavior>
      </check>
    </pass>
    <pass id="3" name="Documentation & Sync">
      <check>
        <criterion>[Docs sync requirement]</criterion>
        <failure_behavior>[What happens if it fails]</failure_behavior>
      </check>
    </pass>
  </three_pass_audit>

</implementation_plan>
```

## Behavior Enforcement

1. **Never use markdown**: If the user asks for a plan or if you enter planning mode, you must write `implementation_plan.xml` instead of `implementation_plan.md`.
2. **Set UserFacing=true**: When creating the artifact, ensure `UserFacing=true` and `RequestFeedback=true` so the user can review and approve it.
3. **Be Specific**: In `<evidence_examined>` and `<pseudocode>`, be highly detailed. Use line numbers and exact references to the codebase.
4. **Enforce Budgets**: Strictly enforce the `<budgets>` and `<task_contract>` during execution. If the implementation requires more files or lines than budgeted, you must stop and request approval.
