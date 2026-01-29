
-- ==============================================================================
-- ⚠️ SCRIPT DE CORREÇÃO DE PERMISSÕES (RODE ISTO NO SQL EDITOR) ⚠️
-- ==============================================================================

-- 1. Garante que o bucket 'documents' existe e é público (Sem dar erro se já existir)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('documents', 'documents', true);
EXCEPTION WHEN unique_violation THEN
    -- Se já existe, garante que é público
    UPDATE storage.buckets SET public = true WHERE id = 'documents';
END $$;

-- 2. Limpa políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Acesso Total Documentos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to documents" ON storage.objects;

-- 3. Cria a política que libera TUDO (Upload, Download, Delete) para o bucket 'documents'
CREATE POLICY "Acesso Total Documentos"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- ==============================================================================
-- FIM DA CORREÇÃO DE STORAGE
-- O restante abaixo é a estrutura do banco de dados (Tabelas)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('ADMIN', 'CLIENT')) DEFAULT 'CLIENT',
  pin TEXT NOT NULL, 
  whatsapp TEXT,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Templates table (New)
CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Template Steps table (New)
CREATE TABLE IF NOT EXISTS public.template_steps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id TEXT REFERENCES public.templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  expected_duration INTEGER DEFAULT 0,
  step_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Cases table (Added template_id)
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES public.templates(id),
  title TEXT NOT NULL,
  case_type TEXT NOT NULL,
  benefit_type TEXT, 
  status TEXT CHECK (status IN ('ACTIVE', 'CONCLUDED', 'MOVED_TO_JUDICIAL')) DEFAULT 'ACTIVE',
  start_date DATE DEFAULT CURRENT_DATE,
  responsible_lawyer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Steps table
CREATE TABLE IF NOT EXISTS public.steps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT CHECK (status IN ('LOCKED', 'CURRENT', 'COMPLETED')) DEFAULT 'LOCKED',
  step_order INTEGER NOT NULL,
  completed_date DATE,
  admin_comment TEXT,
  expected_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Desativa RLS nas tabelas principais para facilitar acesso inicial (opcional, mas recomendado para este app simples)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_steps DISABLE ROW LEVEL SECURITY;

-- SEED DATA FOR TEMPLATES --
INSERT INTO public.templates (id, label, is_system) VALUES
('ADMINISTRATIVO_PREVIDENCIARIO', 'Administrativo Previdenciário (Padrão)', TRUE),
('JUDICIAL_PREVIDENCIARIO', 'Judicial Previdenciário (Padrão)', TRUE),
('JUDICIAL_TRABALHISTA', 'Judicial Trabalhista (Padrão)', TRUE),
('GENERICO_ADMINISTRATIVO', 'Genérico - Administrativo', FALSE),
('GENERICO_JUDICIAL', 'Genérico - Judicial', FALSE)
ON CONFLICT (id) DO NOTHING;

-- INSERT STEPS (Example for Genérico Adm) --
INSERT INTO public.template_steps (template_id, label, expected_duration, step_order) VALUES
('GENERICO_ADMINISTRATIVO', 'Análise de Documentos', 5, 0),
('GENERICO_ADMINISTRATIVO', 'Protocolo Administrativo', 5, 1),
('GENERICO_ADMINISTRATIVO', 'Aguardando Análise', 45, 2),
('GENERICO_ADMINISTRATIVO', 'Cumprimento de Exigência', 30, 3),
('GENERICO_ADMINISTRATIVO', 'Decisão Administrativa', 30, 4),
('GENERICO_ADMINISTRATIVO', 'Recurso Administrativo', 15, 5),
('GENERICO_ADMINISTRATIVO', 'Conclusão', 0, 6)
ON CONFLICT DO NOTHING;
