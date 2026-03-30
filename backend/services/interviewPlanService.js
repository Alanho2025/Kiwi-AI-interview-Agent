import { callDeepSeek } from './deepseekService.js';

const extractJsonObject = (text) => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
};

export const generatePlan = async (cvText, jdText, settings) => {
  const prompt = `
    Analyze this CV and Job Description.
    Settings: Seniority: ${settings.seniorityLevel}, Focus: ${settings.focusArea}, NZ Culture Fit: ${settings.enableNZCultureFit}.
    
    Extract the candidate's name from the CV (if not found, use "Candidate").
    Extract the job title from the Job Description summary (if not found, use "Software Engineer").
    
    Return a JSON object with EXACTLY these keys:
    - candidateName (string)
    - jobTitle (string)
    - matchScore (number 1-100)
    - strengths (array of strings)
    - gaps (array of strings)
    - interviewFocus (array of strings)
    - planPreview (string)

    CV Text:
    ${cvText.substring(0, 2000)}

    JD Text:
    ${jdText.substring(0, 2000)}
  `;
  
  try {
    const responseText = await callDeepSeek(
      prompt,
      'You analyze CVs and job descriptions and return only valid JSON with the requested schema.'
    );
    const result = JSON.parse(extractJsonObject(responseText));
    
    // Ensure all fields exist
    return {
      candidateName: result.candidateName || 'Candidate',
      jobTitle: result.jobTitle || '',
      matchScore: result.matchScore || 80,
      strengths: result.strengths || ["Relevant experience"],
      gaps: result.gaps || ["Specific domain knowledge"],
      interviewFocus: result.interviewFocus || ["Technical skills", "Behavioral"],
      planPreview: result.planPreview || "A balanced interview focusing on technical depth and behavioral scenarios."
    };
  } catch (error) {
    console.error("Failed to generate plan from DeepSeek, using fallback:", error);
    return {
      candidateName: 'Candidate', // Fallback
      jobTitle: '', // Fallback, let controller handle it
      matchScore: 85,
      strengths: ["Relevant experience", "Technical skills"],
      gaps: ["Specific domain knowledge mentioned in JD"],
      interviewFocus: ["Technical depth", "Behavioral scenarios"],
      planPreview: "A balanced interview focusing on technical depth and behavioral scenarios."
    };
  }
};
