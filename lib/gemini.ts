import { GoogleGenAI } from '@google/genai';

// Array of all possible API keys
const getAvailableKeys = (): string[] => {
  const keys: string[] = [];
  
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
  if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3);
  if (process.env.GEMINI_API_KEY_4) keys.push(process.env.GEMINI_API_KEY_4);
  if (process.env.GEMINI_API_KEY_5) keys.push(process.env.GEMINI_API_KEY_5);
  if (process.env.GEMINI_API_KEY_6) keys.push(process.env.GEMINI_API_KEY_6);
  if (process.env.GEMINI_API_KEY_7) keys.push(process.env.GEMINI_API_KEY_7);
  if (process.env.GEMINI_API_KEY_8) keys.push(process.env.GEMINI_API_KEY_8);
  if (process.env.GEMINI_API_KEY_9) keys.push(process.env.GEMINI_API_KEY_9);
  if (process.env.GEMINI_API_KEY_10) keys.push(process.env.GEMINI_API_KEY_10);
  
  return keys;
};

let currentKeyIndex = 0;

export const getGeminiClient = (): GoogleGenAI => {
  const keys = getAvailableKeys();
  if (keys.length === 0) {
    throw new Error('No Gemini API keys found in environment variables.');
  }
  
  // Ensure index is within bounds
  if (currentKeyIndex >= keys.length) {
    currentKeyIndex = 0;
  }
  
  return new GoogleGenAI({ apiKey: keys[currentKeyIndex] });
};

export const rotateGeminiKey = (): void => {
  const keys = getAvailableKeys();
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.log(`Rotated to Gemini API Key #${currentKeyIndex + 1}`);
  } else {
    console.warn('Cannot rotate Gemini API key: only one key available.');
  }
};

export const handleGeminiError = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = getAvailableKeys().length
): Promise<T> => {
  let retries = 0;
  const keys = getAvailableKeys();
  console.log(`[Gemini] Available keys: ${keys.length}, maxRetries: ${maxRetries}`);
  
  if (keys.length === 0) {
    throw new Error('Nenhuma chave da API do Gemini configurada.');
  }

  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      console.error(`[Gemini] Error on attempt ${retries + 1}:`, error);
      
      const isRateLimit = error?.status === 429 || 
                          error?.message?.includes('429') || 
                          error?.message?.includes('quota') || 
                          error?.message?.includes('exhausted') ||
                          error?.message?.includes('Too Many Requests');
                          
      if (isRateLimit) {
        if (keys.length > 1) {
          console.warn(`Gemini API rate limit hit (Key #${currentKeyIndex + 1}). Rotating key and retrying...`);
          rotateGeminiKey();
          retries++;
        } else {
          console.error(`[Gemini] Rate limit hit, but only 1 key available.`);
          throw new Error('A chave da API do Gemini atingiu o limite de uso (cota excedida). Tente novamente mais tarde.');
        }
      } else {
        console.error(`[Gemini] Non-rate-limit error. Throwing original error.`);
        throw error; // Not a rate limit error
      }
    }
  }
  
  throw new Error('Todas as chaves da API do Gemini atingiram o limite de uso (cota excedida). Tente novamente mais tarde.');
};
