
import { createClient } from '@supabase/supabase-js';

// --- ÁREA DE CONFIGURAÇÃO DE EMERGÊNCIA ---
// 1. URL do Projeto (Configurada)
// 2. Chave Publicável (Configurada manualmente abaixo)

const MANUAL_SUPABASE_URL = "https://ysdaithcdnmqvvfwrhit.supabase.co"; 
const MANUAL_SUPABASE_ANON_KEY = "sb_publishable_a4LJwyRVaCWUoBAhH3tm6Q_hhehoJha"; // Chave de API Configurada

// Tenta obter as variáveis de ambiente de diferentes fontes (Prioridade: Manual > Vite > Next.js)
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

const supabaseUrl = MANUAL_SUPABASE_URL || getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = MANUAL_SUPABASE_ANON_KEY || getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Verifica se as chaves existem
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
