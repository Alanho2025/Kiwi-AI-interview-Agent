/**
 * Question building helper functions
 * Extracted from sessionShared.js for better maintainability
 */

const isSeniorLevel = (level = '') => ['senior', 'advanced'].includes(String(level).trim().toLowerCase());

export const buildOpeningQuestion = ({ roleLabel = 'the role', companyName = '', level = 'junior' } = {}) => {
    const cleanCompany = String(companyName || '').trim();
    let cleanRole = String(roleLabel || 'the role').trim();
    if (cleanCompany && cleanRole.toLowerCase().endsWith(cleanCompany.toLowerCase())) {
        cleanRole = cleanRole.slice(0, -cleanCompany.length).trim();
    }
    const companyClause = cleanCompany ? ` with ${cleanCompany}` : '';
    const roleContext = cleanCompany ? `the ${cleanRole} role at ${cleanCompany}` : `the ${cleanRole} role`;
    if (isSeniorLevel(level)) {
        return `Hi, thanks for joining today${companyClause}. To get us started, could you introduce yourself and walk me through the parts of your background that best prepare you for ${roleContext}?`;
    }
    if (String(level) === 'intermediate') {
        return `Hi, thanks for being here today${companyClause}. To start, could you briefly introduce yourself and highlight the experience most relevant to ${roleContext}?`;
    }
    return `Hi, thanks for joining today${companyClause}. Could you briefly introduce yourself and explain what interested you in ${roleContext}?`;
};

export const buildWrapUpQuestion = () => ({
    type: 'wrap_up',
    category: 'closing',
    stage: 'wrap_up',
    topic: 'candidate_questions',
    followUpDepth: 0,
    text: 'Before we finish, what questions do you have for me about the role or team?',
    reason: 'Close the conversation naturally.',
    priority: 999,
    basedOnSkills: [],
    sourceType: 'closing',
    matchedRequirementId: 'closing_questions',
    matchedSkill: 'candidate_questions',
    cvEvidenceRefs: [],
    generationReason: 'Finish naturally and give the candidate space for questions.',
    confidence: 1,
    planPriority: 999,
});

export const buildTechnicalPrompt = ({ skill, level, roleLabel, followUpDepth }) => {
    if (followUpDepth > 0) {
        if (isSeniorLevel(level)) return `What trade-off, risk, or debugging judgement did you handle yourself around ${skill}, and how did you know your approach worked?`;
        if (level === 'intermediate') return `What was your exact approach with ${skill}, and how did you judge whether it worked?`;
        return `What was your exact approach with ${skill}, and what result came from it?`;
    }
    if (isSeniorLevel(level)) return `Tell me about a production-level example where you made an important design, trade-off, or implementation decision using ${skill} for a ${roleLabel} problem.`;
    if (level === 'intermediate') return `Tell me about a project where you used ${skill} and explain the key decisions you made.`;
    return `Tell me about a project where you used ${skill} in a practical way.`;
};

export const buildRoleCompetencyPrompt = ({ target = {}, skill = '', level = 'junior', roleLabel = 'the role', followUpDepth = 0, isTechnicalRequirementCategory, buildCapabilityPrompt } = {}) => {
    const safeTarget = target && typeof target === 'object' ? target : {};
    const category = safeTarget.category || '';
    const capabilityGroup = safeTarget.capabilityGroup || '';
    const capability = safeTarget.normalizedCapability || safeTarget.text || safeTarget.label || skill;
    const capabilityPrompt = buildCapabilityPrompt({ capabilityGroup, category, capability, roleLabel, followUpDepth });
    if (capabilityPrompt) return capabilityPrompt;

    if (!category || isTechnicalRequirementCategory(category, capabilityGroup)) {
        return buildTechnicalPrompt({ skill: capability, level, roleLabel, followUpDepth });
    }

    if (followUpDepth > 0) {
        if (['qualification', 'certification', 'professional_registration', 'insurance_or_indemnity', 'compliance_or_safety', 'availability_or_location'].includes(category)) {
            return `What specific evidence can you provide for ${capability}, and where have you applied it in practice?`;
        }
        if (category === 'customer_or_stakeholder') {
            return `What made that stakeholder situation difficult, what did you do personally, and what was the outcome?`;
        }
        if (category === 'communication' || category === 'report_writing') {
            return `How did you adapt your communication for the audience, and how did you know the message landed?`;
        }
        if (category === 'leadership') {
            return `What decision or support did you personally provide, and what changed for the team or work afterwards?`;
        }
        return `What was the situation, what did you personally do around ${capability}, and what result came from it?`;
    }

    if (['qualification', 'certification', 'professional_registration', 'insurance_or_indemnity'].includes(category)) {
        return `Can you walk me through your ${capability} evidence and how it prepares you for this ${roleLabel} role?`;
    }
    if (category === 'assessment_delivery') {
        return `Tell me about a time you delivered a structured assessment, service, or analysis. What method did you use, and how did you maintain quality?`;
    }
    if (category === 'report_writing') {
        return `Tell me about a professional report or written output you produced. Who used it, and how did you make it accurate and clear?`;
    }
    if (category === 'scheduling_or_time_management') {
        return `Tell me about a time you managed a schedule, calendar, or competing deadlines. How did you keep the work under control?`;
    }
    if (category === 'compliance_or_safety') {
        return `Tell me about a time you had to follow or apply ${capability}. What checks did you make, and what was at stake?`;
    }
    if (category === 'availability_or_location') {
        return `Can you confirm your fit for ${capability}, and explain any practical constraints the team should know about?`;
    }
    if (category === 'customer_or_stakeholder') {
        return `Tell me about a time you worked with a client, customer, referrer, or stakeholder. What happened, what did you do, and what was the outcome?`;
    }
    if (category === 'communication') {
        return `Tell me about a time you used ${capability} in a real work or project situation. Who was the audience, and what result did your communication achieve?`;
    }
    if (category === 'leadership') {
        return `Tell me about a time you showed ${capability}. What did you lead or influence, and what changed because of your actions?`;
    }
    if (category === 'responsibility' || category === 'experience' || category === 'case_management') {
        return `Tell me about a real example where you handled ${capability} for a ${roleLabel} responsibility. What did you own, and what was the result?`;
    }
    if (category === 'nice_to_have') {
        return `The role lists ${capability} as useful. What exposure have you had to it, and how would you build on it if needed?`;
    }
    return `Tell me about a time you demonstrated ${capability}. What was the context, what did you do, and what was the outcome?`;
};

export const buildBehaviouralPrompt = ({ topic, level, followUpDepth }) => {
    if (followUpDepth > 0) {
        return isSeniorLevel(level)
            ? 'What was the situation, what decision did you personally drive, and what changed because of it?'
            : 'What was the situation, what did you do, and what was the outcome?';
    }
    if (isSeniorLevel(level)) return `Tell me about a time when you had to show ${topic} in a situation with judgement, ambiguity, or stakeholder pressure.`;
    if (level === 'intermediate') return `Tell me about a time when you had to show ${topic} in a real work or project situation.`;
    return `Tell me about a time when you had to show ${topic}.`;
};

// Made with Bob
