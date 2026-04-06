import { GoogleGenAI } from '@google/genai';

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('No API key');
    return;
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    console.log('Testing gemini-3.1-pro-preview...');
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: 'Hello'
    });
    console.log('Success:', response.text);
  } catch (e: any) {
    console.log('Error 3.1-pro:', e.status, e.message);
  }

  try {
    console.log('Testing gemini-3-flash-preview...');
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Hello'
    });
    console.log('Success:', response.text);
  } catch (e: any) {
    console.log('Error 3-flash:', e.status, e.message);
  }
}

test();
