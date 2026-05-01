/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: deepseekService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

/**
 * Purpose: Execute the main responsibility for callDeepSeek.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const isMockAiMode = () => process.env.AI_TEST_MODE === 'mock';
const isRealAiMode = () => process.env.AI_TEST_MODE === 'real';
const buildMockDeepSeekResponse = () => 'This is a mock response from DeepSeek. Please set DEEPSEEK_API_KEY to run real AI eval.';

const resolveDeepSeekApiKey = () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) return apiKey;
  if (isMockAiMode()) return null;
  if (isRealAiMode()) {
    throw new Error('DEEPSEEK_API_KEY is required when AI_TEST_MODE=real. Real eval must not silently use mock output.');
  }
  console.warn('DEEPSEEK_API_KEY is missing. Using mock response.');
  return null;
};

export const callDeepSeek = async (prompt, systemInstruction = '') => {
  try {
    const apiKey = resolveDeepSeekApiKey();
    if (!apiKey) {
      return buildMockDeepSeekResponse();
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemInstruction || 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API Error:', error);
    throw error;
  }
};

/**
 * Purpose: Execute the main responsibility for callDeepSeekStream.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns an async generator yielding text chunks as they arrive from the DeepSeek stream.
 */
export const callDeepSeekStream = async function* (prompt, systemInstruction = '') {
  const apiKey = resolveDeepSeekApiKey();
  if (!apiKey) {
    yield buildMockDeepSeekResponse();
    return;
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      stream: true,
      messages: [
        { role: 'system', content: systemInstruction || 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmed.slice(6));
          const chunk = data.choices?.[0]?.delta?.content || '';
          if (chunk) yield chunk;
        } catch (e) {
          // ignore incomplete JSON chunks
        }
      }
    }
  }
};
