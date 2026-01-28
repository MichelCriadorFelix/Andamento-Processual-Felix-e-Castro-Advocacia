
import { createClient } from '@supabase/supabase-js';

// --- ÁREA DE CONFIGURAÇÃO DE EMERGÊNCIA ---
// 1. A URL já está configurada (do seu print anterior).
// 2. A chave ANON: No print que você mandou agora, copie o valor do campo "Chave publicável".
//    Cole esse código longo dentro das aspas abaixo em MANUAL_SUPABASE_ANON_KEY.

const MANUAL_SUPABASE_URL = "https://ysdaithcdnmqvvfwrhit.supabase.co"; 
const MANUAL_SUPABASE_ANON_KEY = ""; // <--- COLE A CHAVE 'publicável' AQUI DENTRO (Começa com eyJ... ou sb_publishable...)

// Tenta obter as variáveis de ambiente de diferentes fontes
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

// A lógica agora é: 1. Tenta chaves manuais -> 2. Tenta chaves da Vercel (Vite) -> 3. Tenta chaves Next.js
const supabaseUrl = MANUAL_SUPABASE_URL || getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = MANUAL_SUPABASE_ANON_KEY || getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Verifica se as chaves existem
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
