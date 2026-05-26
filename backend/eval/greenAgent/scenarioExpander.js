/**
 * File responsibility: Expand seed E2E agent scenarios into the 20-case Notion evaluation plan coverage.
 * Main responsibilities:
 * - Keep the committed seed dataset small and readable.
 * - Generate deterministic scenario variants for STAR, CV-JD alignment, interview control, voice, company, and report safety risks.
 * - Ensure E2E and Green Agent runners can evaluate at least 20 plan-aligned cases without external services.
 */

const positiveSpecs = [
  ['vague_star_answer', 'behavioural', 'junior', ['communication', 'teamwork', 'SQL'], 'LinkedIn analysis', 'Graduate Data Analyst', ['teamwork', 'result', 'communication']],
  ['missing_result_answer', 'behavioural', 'junior', ['Python', 'communication', 'dashboard'], 'salary dashboard', 'Junior Data Analyst', ['action', 'result', 'stakeholder communication']],
  ['candidate_overclaims_skill', 'combined', 'junior', ['JavaScript', 'Node.js', 'SQL'], 'campus events app', 'Graduate Software Developer', ['backend api', 'sql', 'communication']],
  ['jd_cloud_cv_no_cloud', 'technical', 'intermediate', ['Node.js', 'REST APIs', 'MongoDB'], 'food assistant API', 'Cloud Backend Developer', ['api design', 'deployment', 'cloud gap']],
  ['technical_mode_no_behavioural_drift', 'technical', 'intermediate', ['React', 'Node.js', 'MongoDB', 'Vitest'], 'AI food assistant', 'Intermediate Full Stack Developer', ['api design', 'mongodb', 'testing']],
  ['behavioural_mode_no_coding_question', 'behavioural', 'junior', ['communication', 'teamwork', 'problem solving'], 'team sprint project', 'Graduate Business Analyst', ['teamwork', 'problem solving', 'result']],
  ['combined_mode_balanced', 'combined', 'intermediate', ['Python', 'SQL', 'Power BI', 'communication'], 'job market analytics', 'Data Analyst', ['data cleaning', 'dashboard', 'stakeholder communication']],
  ['junior_too_hard_question_guard', 'technical', 'junior', ['Java', 'SQL', 'debugging'], 'course registration database', 'Graduate Software Developer', ['java', 'sql', 'debugging']],
  ['senior_too_basic_question_guard', 'technical', 'senior', ['architecture', 'Node.js', 'AWS', 'mentoring'], 'platform migration', 'Senior Backend Engineer', ['architecture', 'risk', 'mentoring']],
  ['nz_context_enabled', 'behavioural', 'junior', ['communication', 'collaboration', 'adaptability'], 'NZ interview practice', 'Graduate Consultant', ['collaboration', 'humility', 'evidence']],
  ['nz_context_disabled', 'technical', 'intermediate', ['Python', 'SQL', 'testing'], 'analytics pipeline', 'Data Engineer', ['pipeline', 'testing', 'sql']],
  ['company_info_available', 'behavioural', 'junior', ['research', 'communication', 'backend API'], 'company motivation prep', 'Software Intern', ['company motivation', 'research', 'project fit']],
  ['company_info_missing', 'behavioural', 'junior', ['research', 'communication', 'self awareness'], 'interview preparation', 'Software Intern', ['research caution', 'role motivation', 'confirmation']],
  ['one_word_answer', 'behavioural', 'junior', ['communication', 'teamwork', 'clarification'], 'group assignment', 'Graduate Analyst', ['clarification', 'teamwork', 'result']],
  ['candidate_says_dont_know', 'combined', 'junior', ['Python', 'SQL', 'learning mindset'], 'course database', 'Graduate Developer', ['supportive followup', 'learning', 'sql']],
  ['noisy_voice_transcript', 'combined', 'junior', ['Python', 'SQL', 'data cleaning'], 'salary cleaning', 'Junior Data Analyst', ['voice noise', 'data cleaning', 'result']],
  ['long_answer_weak_structure', 'behavioural', 'intermediate', ['communication', 'leadership', 'project delivery'], 'capstone handover', 'Project Coordinator', ['star structure', 'action', 'result']],
  ['repeated_question_risk', 'technical', 'intermediate', ['React', 'Node.js', 'testing'], 'web app testing', 'Full Stack Developer', ['react state', 'node api', 'testing']],
];

const negativeSpecs = [
  ['early_completion_bad_report', 'combined', 'junior', ['Java', 'SQL', 'debugging'], 'course database', 'Graduate Software Developer', ['java', 'sql', 'debugging']],
  ['report_hallucination_negative_probe', 'combined', 'junior', ['Python', 'SQL'], 'data cleaning project', 'Junior Data Analyst', ['python', 'sql', 'communication']],
];

const topicKey = (value = '') => String(value).toLowerCase().replace(/\s+/g, '_');

const categoriesFor = (focusArea, questionCount) => {
  if (focusArea === 'technical') return Array(questionCount).fill('technical');
  if (focusArea === 'behavioural') return Array(questionCount).fill('behavioural');
  return ['behavioural', 'technical', 'behavioural', 'technical', 'behavioural'].slice(0, questionCount);
};

const difficultySignal = (difficulty) => {
  if (difficulty === 'senior') return 'strategy';
  if (difficulty === 'intermediate') return 'trade-off';
  return 'example';
};

const buildPositiveScenario = ([id, focusArea, difficulty, skills, project, roleTitle, topics]) => {
  const questionCount = focusArea === 'combined' ? 5 : 4;
  const categories = categoriesFor(focusArea, questionCount);
  const transcript = [];

  for (let index = 0; index < questionCount; index += 1) {
    const category = categories[index];
    const topic = index === 0 ? 'self_intro' : topics[index % topics.length];
    const signal = difficultySignal(difficulty);
    const question = index === 0
      ? `Hi, thanks for joining. Could you briefly introduce your background and explain how your ${skills[0]} experience fits this ${roleTitle} role?`
      : category === 'technical'
        ? `What ${signal} can you describe from your ${project} project that shows ${topic} using ${skills[index % skills.length]}?`
        : `Tell me about one ${signal} from your ${project} project where your ${topic} work helped the team or user.`;

    transcript.push({
      role: 'ai',
      text: question,
      metadata: {
        stage: index === 0 ? 'opening' : category === 'technical' ? 'technical_core' : 'behavioural',
        topic: topicKey(topic),
        category,
      },
    });

    if (index < questionCount - 1) {
      transcript.push({
        role: 'user',
        text: `In my ${project} project, I used ${skills[index % skills.length]} for ${topics[index % topics.length]} and explained the result to the team.`,
      });
    }
  }

  const expected = {
    firstAiTopic: 'self_intro',
    plannedQuestionCount: questionCount,
    requiredCategories: focusArea === 'combined' ? ['technical', 'behavioural'] : [focusArea],
    requiredTopics: topics.slice(0, 3).map(topicKey),
    forbiddenClaims: ['Kubernetes', 'production machine learning', 'senior leadership', 'medical diagnosis', 'construction engineering expertise'],
  };
  if (focusArea === 'technical') expected.blockedCategories = ['behavioural'];
  if (focusArea === 'behavioural') expected.blockedCategories = ['technical'];

  return {
    id,
    settings: {
      mode: id.includes('voice') ? 'voice' : 'text',
      focusArea,
      difficulty,
      questionCount,
    },
    cvProfile: {
      skills,
      projects: [project],
    },
    jdProfile: {
      roleTitle,
      requiredSkills: [...skills.slice(0, 3), 'communication'],
      preferredSkills: skills.slice(3),
      priorityTopics: topics,
    },
    transcript,
    report: {
      summary: `The candidate is a grounded match for ${roleTitle} because the transcript shows ${skills.slice(0, 3).join(', ')} and project evidence.`,
      sections: [
        { id: 'strengths', content: `Evidence includes ${skills[0]}, ${skills[1]}, and ${project}.` },
        { id: 'gaps', content: `The candidate should add a more measurable result for ${topics[0]}.` },
        { id: 'interaction_feedback', content: 'Answers were relevant and could be stronger with clearer outcomes.' },
        { id: 'reflection_memory', content: `Reuse the ${project} example for future STAR and technical questions.` },
      ],
      evidenceReferences: [skills[0], skills[1], project, topics[0]],
      interviewMetrics: {
        interviewerQuestionCount: questionCount,
        plannedQuestionCount: questionCount,
        candidateTurnCount: questionCount - 1,
        extraAiTurnCount: 0,
      },
      scores: {
        averageInteractionScore: 0.82,
        reflectionCount: 1,
      },
      candidateFeedback: {
        overallTakeaway: `You have relevant ${roleTitle} evidence. Add clearer impact metrics.`,
        plainEnglishMetrics: ['Your answers were grounded in real project experience.'],
        coachingAdvice: ['Use STAR structure and include the result.', 'Connect each answer to the JD priority topic.'],
        answerRewriteExamples: [`In my ${project} project, I used ${skills[0]} to support ${topics[0]} and explained the outcome clearly.`],
      },
    },
    expected,
  };
};

const buildNegativeScenario = ([id, focusArea, difficulty, skills, project, roleTitle, topics]) => {
  const questionCount = 5;
  return {
    id,
    settings: {
      mode: id.includes('voice') ? 'voice' : 'text',
      focusArea,
      difficulty,
      questionCount,
    },
    cvProfile: {
      skills: skills.slice(0, 2),
      projects: [project],
    },
    jdProfile: {
      roleTitle,
      requiredSkills: skills.slice(0, 2),
      priorityTopics: topics,
    },
    transcript: [
      {
        role: 'ai',
        text: `Tell me about ${skills[0]}.`,
        metadata: { stage: 'technical_core', topic: topicKey(topics[0]), category: 'technical' },
      },
      { role: 'user', text: `I used ${skills[0]} in a class project.` },
    ],
    report: {
      summary: 'The candidate is excellent because they have Kubernetes, production machine learning, and senior leadership experience.',
      sections: [{ id: 'strengths', content: 'Strong production machine learning.' }],
      claimedSkills: ['Kubernetes', 'production machine learning'],
      evidenceReferences: [],
      interviewMetrics: {
        interviewerQuestionCount: 1,
        plannedQuestionCount: questionCount,
        candidateTurnCount: 1,
        extraAiTurnCount: 0,
      },
      scores: { averageInteractionScore: 0.95, reflectionCount: 0 },
      candidateFeedback: { overallTakeaway: 'Great answer.', plainEnglishMetrics: [], coachingAdvice: [], answerRewriteExamples: [] },
    },
    expected: {
      shouldPass: false,
      maxPassingScore: 0.7,
      firstAiTopic: 'self_intro',
      plannedQuestionCount: questionCount,
      requiredCategories: ['technical', 'behavioural'],
      requiredTopics: topics.slice(0, 3).map(topicKey),
      forbiddenClaims: ['Kubernetes', 'production machine learning', 'senior leadership'],
    },
  };
};

export const expandInterviewScenariosToPlanCoverage = (seedScenarios = []) => {
  const byId = new Map(seedScenarios.map((scenario) => [scenario.id, scenario]));
  const generated = [...positiveSpecs.map(buildPositiveScenario), ...negativeSpecs.map(buildNegativeScenario)];

  for (const scenario of generated) {
    if (!byId.has(scenario.id)) {
      byId.set(scenario.id, scenario);
    }
  }

  return [...byId.values()].slice(0, 20);
};
