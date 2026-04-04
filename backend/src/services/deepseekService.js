export const callDeepSeek = async (prompt, systemInstruction = '') => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.warn('DEEPSEEK_API_KEY is missing. Using mock response.');
      return "This is a mock response from DeepSeek. Please set your DEEPSEEK_API_KEY in the .env file.";
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
