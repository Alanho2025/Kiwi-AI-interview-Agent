export const graduateSoftwareDeveloperRubric = {
  schemaVersion: 'v3',
  title: 'Graduate Software Developer',
  macroCriteria: [
    { id: 'experience', label: 'software delivery experience', weight: 1 },
    { id: 'technical_expertise', label: 'technical stack readiness', weight: 1 },
    { id: 'communication', label: 'communication', weight: 1 },
  ],
  microCriteria: [
    { id: 'csharp', label: 'C#', weight: 1 },
    { id: 'dotnet', label: '.NET', weight: 1 },
    { id: 'sql', label: 'SQL', weight: 1 },
    { id: 'git', label: 'Git', weight: 1 },
    { id: 'agile', label: 'Agile', weight: 1 },
    { id: 'communication', label: 'communication', weight: 1 },
  ],
  requirements: [
    { label: 'Recent tertiary qualification in Computer Science or Software Engineering', type: 'soft', importance: 'high' },
    { label: 'Foundations in C#, .NET, SQL, and Git', type: 'hard', importance: 'high' },
    { label: 'Ability to communicate clearly and learn quickly', type: 'soft', importance: 'high' },
    { label: 'Exposure to Azure or CI/CD pipelines', type: 'soft', importance: 'medium' },
  ],
  weights: {
    macro: { experience: 0.34, technical_expertise: 0.4, communication: 0.26 },
    micro: { csharp: 0.2, dotnet: 0.2, sql: 0.2, git: 0.15, agile: 0.15, communication: 0.1 },
    overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
  },
  interviewTargets: {},
};
