# Interview Question Leveling Reference

本文件定义面试问题分层的业务依据。它给后续 technical requirement 使用，不改变当前 question generation、ranking、report 或 UI 行为。

当前产品已经有 `Junior/Grad`、`Intermediate`、`Advanced` 三个用户可选层级；backend 会归一化为 `junior`、`intermediate`、`advanced`。现有实现主要调整开场语气、追问比例和部分 prompt wording，还没有一份 source-backed rubric 来判断「这题为什么属于这个 level」。

## Source Summary

| Source | 对分层的可用结论 |
| --- | --- |
| [Career Ladders engineering ladder](https://career-ladders.dev/engineering/) | Engineer I 偏清楚任务和 blocker 沟通；Engineer II 负责更大的 feature set；Senior 开始定义 execution plan、拆 scope、mentor、处理技术债和 shifting priorities。 |
| [Levels.fyi SWE level framework](https://www.levels.fyi/blog/swe-level-framework.html) | 行业内常见 leveling 维度是 ambiguity、scope of work、impact；Senior 要 own 中高复杂度 component，可能 lead small project，并指导 junior。 |
| [CircleCI competency matrix article](https://circleci.com/blog/7-steps-to-building-an-engineering-competency-matrix/) | E1-E3 偏 task/project/team execution；E4+ 偏 scale impact 和 leverage。题目难度应该随 scope、ownership、impact 递增。 |
| [Amazon SDE II prep](https://amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep) | SDE II 要展示 autonomy、trade-off、documentation、stakeholder value、system design、coding 和 behavioral evidence。 |
| [Amazon SDE III prep](https://amazon.jobs/content/en/how-we-hire/sde-iii-interview-prep) | Senior/SDE III 重点是 leadership、architectural view、high-performance stable scalable systems，以及 secure、maintainable、extensible code。 |
| [Amazon university SDE OA prep](https://amazon.jobs/content/en/how-we-hire/university/sde-oa) | Student / graduate SDE 更偏 coding、technical problem solving、behavioral skills 和基础可训练信号。 |
| [Google/WIRED structured interview summary](https://www.wired.com/2015/04/hire-like-google/) | 面试题应使用 structured behavioral / situational questions 和 consistent rubric；避免 brainteaser，用 job-relevant evidence 判断。 |
| [MLOps operationalization study](https://arxiv.org/abs/2403.16795) | AI/ML production work 包含 data preparation、experimentation、deployment evaluation、monitoring；成熟度体现在 velocity、visibility、versioning 的平衡。 |
| [AI-mediated software engineering seniority study](https://arxiv.org/abs/2602.00496) | AI 时代 junior 容易在 over-reliance 与 cautious avoidance 间摆荡；senior 更能通过 detailed delegation 保持 agency，并能指导 junior。 |

## Current Repo Context

| Current behavior | Evidence |
| --- | --- |
| UI 层级是 `Junior/Grad`、`Intermediate`、`Advanced`。 | `frontend/src/utils/sessionSettings.js` 和 `frontend/src/utils/sessionDisplay.js` |
| Backend 归一化 key 是 `junior`、`intermediate`、`advanced`，并接受 `senior` alias 到 `advanced`。 | `backend/src/config/interviewBlueprints.js` |
| 当前 blueprint 会调 opening style、follow-up anchors、follow-up 数量和 technical/behavioural strategy。 | `backend/src/config/interviewBlueprints.js` |
| 当前 prompt wording 已有轻量 level 差异：advanced 会问 production-level example、trade-off、risk、debugging judgement；intermediate 会问 approach 和 key decisions；junior 会问 practical use。 | `backend/src/utils/questionBuilders.js` |
| Prepared question pool 现在主要来自 CV seeds、JD requirement、match gap、behavioural fallback、wrap-up。requirement/gap item 还没有 explicit level rubric。 | `backend/src/services/questions/questionPoolComposerService.js` |
| NZ culture question bank 已有 `difficulty: junior/all/senior`，说明题库层已有分层先例。 | `backend/src/data/nzCultureQuestions.js` |
| `docs/Further_requirement.md` 里要求 Intent-Driven Interview，不只分 technical/behavioural，还要按 employer intent 分层。 | `docs/Further_requirement.md` |

## Level Matrix

| Dimension | Beginner | Intermediate | Senior |
| --- | --- | --- | --- |
| Product mapping | UI `Junior/Grad`; backend `junior` | UI `Intermediate`; backend `intermediate` | UI `Advanced`; backend `advanced`; source alias may use `senior` |
| Main interviewer question | 这个人能不能在指导下把基础任务做清楚，并能解释自己做了什么？ | 这个人能不能独立交付一个真实 feature / project，并解释取舍、验证和结果？ | 这个人能不能处理模糊、高风险或跨人问题，并把技术决策连接到业务结果？ |
| Scope | Task、small project、course/project evidence、明确需求下的实现 | Feature lifecycle、project slice、跨模块协作、真实工作责任 | System / product area、architecture direction、team impact、cross-functional alignment |
| Ambiguity | 低。题目应提供清楚 context，不用候选人自己发明问题边界。 | 中。题目可以要求候选人澄清需求、比较方案、说明 unknowns。 | 高。题目应考模糊需求拆解、约束冲突、风险排序、stakeholder pressure。 |
| Ownership | 说明自己具体做的 task、学到什么、如何寻求帮助 | 说明自己 owner 的部分、如何推动、如何 debug、如何 validate | 说明自己如何 drive decision、align people、reduce risk、mentor 或 unblock others |
| Technical depth | 基础概念、工具使用、简单 bug、清楚流程 | Implementation choices、testing、debugging、performance or data quality trade-off | Architecture、reliability、security、observability、scalability、maintainability、failure modes |
| Communication | 清楚讲 task、action、result；能承认 gap | 能针对 teammate/stakeholder 解释技术选择和 evidence | 能影响 non-technical stakeholder、处理冲突、建立共同判断标准 |
| Evidence standard | 一个具体例子即可；允许学习型 evidence | 需要 project evidence、decision evidence、validation evidence | 需要 risk/impact evidence、alternative considered、trade-off rationale、team/customer/business effect |
| Good answer signal | 具体、诚实、可训练、知道自己负责哪一块 | 独立、有判断、有结果、有验证、有反思 | 系统性、风险意识、影响范围清楚、能让 interviewer 更敢 hire |

## Question Taxonomy

| Question type | Beginner | Intermediate | Senior |
| --- | --- | --- | --- |
| Technical | 问「你怎么用过 X？」和「你遇到什么基础问题？」 | 问「你为什么这样实现？」、「怎么 debug/validate？」、「有什么 trade-off？」 | 问「如果 X 要上线/扩展/出错，你怎么设计、观测、回滚、降低风险？」 |
| Behavioural | 问学习、接受反馈、协作、遇到困难时如何求助 | 问 ownership、conflict、deadline、stakeholder expectation、独立推进 | 问影响他人、模糊决策、跨团队 alignment、mentoring、difficult feedback |
| System/design | 只问小范围设计或理解已有设计，例如 API flow、data flow、component responsibility | 问 feature/system slice 的 high-level design、边界、测试、数据流 | 问 architecture、scalability、security/privacy、operability、migration、failure mode |
| AI automation | 问是否能发现 workflow pain、用 AI 做过什么、如何检查输出 | 问何时用 AI vs rule/manual、evaluation、human review、PoC 到可交付流程 | 问 governance、monitoring、privacy、auditability、stakeholder adoption、production risk |
| Gap validation | 问有没有相近经验、怎么学习补 gap | 问 gap 对交付的风险、如何用 transferable evidence 降低风险 | 问 gap 如何影响 system/team/business risk，以及如何做 mitigation plan |
| Career transition | 问为什么转、哪些基础能力可迁移、最近如何学习 | 问过去经验如何映射到当前 JD requirement 和真实 project evidence | 问如何把过往 domain insight 变成 product/technical judgement，降低 hiring risk |

## Classification Rules

一题的 level 不是看题目里有没有高级词，而是看它要求候选人证明什么。

| Rule | Beginner | Intermediate | Senior |
| --- | --- | --- | --- |
| Scope rule | 只需要讲一个明确 task 或小 project | 需要讲一个完整 feature/project slice | 需要讲 system/team/customer/business impact |
| Ambiguity rule | context 已给清楚，候选人不需要自己定边界 | 需要候选人补 assumptions、约束和取舍 | 需要候选人拆解模糊目标、冲突约束和未知风险 |
| Ownership rule | 能说明个人行动即可 | 需要说明独立负责和推动过程 | 需要说明如何带动他人或影响技术方向 |
| Evidence rule | 具体经历 + 学到什么 | 具体经历 + decision + validation + result | 具体经历 + alternatives + risk + impact + follow-through |
| AI rule | 能合理使用 AI 并检查基本输出 | 能设计 evaluation/human review，把 PoC 推向可用 | 能建立 governance、monitoring、privacy 和 failure response |

### Too Shallow

一题对目标 level 过浅时，通常只问「用过什么」、「喜欢什么」、「有没有听过」，没有要求 ownership、decision、validation 或 impact。

Examples:

| Target level | Too shallow question | Better direction |
| --- | --- | --- |
| Intermediate | `Have you used Playwright before?` | `Tell me about a test automation task where you chose what to cover, what not to cover, and how you knew the tests were useful.` |
| Senior | `What is RAG?` | `Tell me about a time you would choose RAG over fine-tuning or prompt-only generation. What risks would you monitor in production?` |

### Too Deep

一题对目标 level 过深时，要求候选人证明远超岗位期望的 architecture ownership、multi-team influence 或 production governance。

Examples:

| Target level | Too deep question | Better direction |
| --- | --- | --- |
| Beginner | `How would you redesign our production RAG architecture for compliance and observability?` | `Tell me about a project where you used retrieved information or external context. How did you check the answer was correct?` |
| Intermediate | `How would you set AI governance strategy across a whole organization?` | `How would you add human review and evaluation checks before an AI automation goes live for one team?` |

### Mismatch

一题 level 不匹配时，通常是 category 对了但 signal 错了。

| Mismatch | Why it fails | Fix |
| --- | --- | --- |
| Technical 题只问 definitions | 只能测记忆，不能测 job evidence | 加上 project context、decision、validation |
| Behavioural 题只问 personality | 不能判断 future job performance | 改成 structured behavioral question，要求 situation、action、result、reflection |
| AI 题只问 tool preference | 不能判断 production judgement | 加上 workflow pain、evaluation、human review、privacy、monitoring |
| Gap 题只问「愿不愿意学」 | 不能降低 hiring risk | 要求 transferable evidence 和 learning plan |

## Example Prompts

### Same Skill: Python Automation

| Level | Prompt | What interviewer is testing |
| --- | --- | --- |
| Beginner | `Tell me about a small project where you used Python to automate a task. What did you build, what part did you write yourself, and what did you learn?` | 基础实践、个人行动、学习能力 |
| Intermediate | `Tell me about a Python automation you owned end to end. What requirement did it solve, what trade-off did you make, and how did you validate the result?` | 独立交付、decision、validation |
| Senior | `Tell me about a production or team-facing automation decision you drove. How did you handle reliability, observability, stakeholder adoption, and failure recovery?` | 系统判断、风险控制、影响范围 |

### Same Skill: Stakeholder Communication

| Level | Prompt | What interviewer is testing |
| --- | --- | --- |
| Beginner | `Tell me about a time you explained a technical task to someone less familiar with it. How did you make it clear?` | 清楚表达、基础 empathy |
| Intermediate | `Tell me about a time you translated a messy stakeholder request into implementation work. What did you clarify, and how did you confirm the solution fit?` | requirement discovery、clarification、delivery evidence |
| Senior | `Tell me about a time stakeholders disagreed on priority or risk. How did you frame the trade-off, align the group, and decide what to do?` | influence、judgement、business/technical alignment |

### Same Skill: AI Workflow Automation

| Level | Prompt | What interviewer is testing |
| --- | --- | --- |
| Beginner | `Tell me about a workflow where AI helped you save time. What was the workflow pain, and how did you check the output?` | workflow awareness、basic AI verification |
| Intermediate | `Tell me about an AI automation or PoC you built or would build for a real workflow. When would you use AI instead of rules, and how would you evaluate quality before handoff?` | AI vs deterministic judgment、evaluation、handoff |
| Senior | `Tell me about how you would take an AI workflow automation from PoC to production. How would you handle privacy, human review, monitoring, failure modes, and stakeholder adoption?` | governance、production risk、operational maturity |

### Same Skill: Debugging

| Level | Prompt | What interviewer is testing |
| --- | --- | --- |
| Beginner | `Tell me about a bug you fixed. What was happening, what did you try, and what did you learn?` | debugging process、learning |
| Intermediate | `Tell me about a difficult bug in a project you owned. How did you isolate the cause, decide on a fix, and prevent regression?` | root cause、ownership、testing |
| Senior | `Tell me about an incident or high-risk defect where the fix had trade-offs. How did you coordinate response, reduce customer impact, and improve the system afterward?` | incident judgement、risk, process improvement |

## Product Mapping

| Product label | Backend key | Reference level | Notes |
| --- | --- | --- | --- |
| `Junior/Grad` | `junior` | Beginner | Use beginner rubric. Good for internship, graduate, entry-level, career-change with limited role evidence. |
| `Intermediate` | `intermediate` | Intermediate | Use intermediate rubric. Good for candidates expected to work independently on feature/project slices. |
| `Advanced` | `advanced` | Senior | Use senior rubric. `senior` wording can be accepted in sources and user-facing planning, but current backend key remains `advanced`. |

## How Future Technical Requirements Should Use This

This file should become the source of truth for question difficulty intent. Technical implementation should map each generated or selected question to:

- `targetLevel`: `beginner`, `intermediate`, or `senior`
- `questionType`: technical, behavioural, system_design, ai_automation, gap_validation, or career_transition
- `expectedSignals`: evidence required by the level
- `levelFitReason`: why the question is appropriate for that level
- `tooShallowRisk` and `tooDeepRisk`: optional classifier/debug fields

Do not use this reference to force every interview into harder questions. The purpose is to match the candidate's chosen level and role evidence, then ask questions that reveal the correct hiring signal.

## Acceptance Criteria For Later Implementation

- A beginner interview should not repeatedly ask production architecture or cross-team governance questions.
- An intermediate interview should ask for decision, validation, and ownership evidence, not just tool familiarity.
- A senior interview should ask at least some questions that test ambiguity, trade-offs, risk, system thinking, and influence.
- AI automation roles should always include workflow pain, evaluation, human review, privacy or production risk at the level appropriate depth.
- Classification should explain why a question is level-appropriate in metadata or diagnostics, not only alter wording.

Evidence status: external source summaries are cited above; current repo behavior is based on inspected source paths listed in Current Repo Context.
