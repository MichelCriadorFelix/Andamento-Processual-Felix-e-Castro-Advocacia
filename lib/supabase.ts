
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DE SEGURANÇA ---
// O código abaixo tenta encontrar as chaves em todas as variações possíveis
// que o Vercel costuma criar automaticamente.

const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    // @ts-ignore
    return process.env[key];
  }
  return '';
};

// Tenta encontrar a URL em várias opções comuns do Vercel
const supabaseUrl = 
  getEnv('VITE_SUPABASE_URL') || 
  getEnv('NEXT_PUBLIC_SUPABASE_URL') || 
  getEnv('VITE_SUPABASE_SUPABASE_URL'); // Nome específico do seu print

// Tenta encontrar a Chave Anônima (Anon Key)
const supabaseAnonKey = 
  getEnv('VITE_SUPABASE_ANON_KEY') || 
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 
  getEnv('VITE_SUPABASE_SUPABASE_ANON_KEY'); // Nome específico do seu print

// Verifica se as chaves existem
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("⚠️ ALERTA DE SEGURANÇA: Supabase não conectado. As chaves de API não foram encontradas nas variáveis de ambiente.");
}

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
