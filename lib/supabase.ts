
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DE SEGURANÇA ---
// NUNCA deixe as chaves escritas aqui diretamente (Hardcoded).
// Elas devem ser configuradas nas "Environment Variables" da Vercel ou no arquivo .env local.

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

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Verifica se as chaves existem
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("⚠️ ALERTA DE SEGURANÇA: Supabase não conectado. As chaves de API não foram encontradas nas variáveis de ambiente.");
}

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
