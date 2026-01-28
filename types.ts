
export type Role = 'ADMIN' | 'CLIENT';

// O CaseType agora é apenas uma referência string para flexibilidade, 
// mas mantemos os tipos legacy para compatibilidade de dados antigos se necessário.
export type CaseType = string; 

export type BenefitType = 
  | 'BPC_IDOSO'
  | 'APOSENTADORIA_IDADE'
  | 'APOSENTADORIA_CONTRIBUICAO'
  | 'APOSENTADORIA_ESPECIAL'
  | 'APOSENTADORIA_DEFICIENCIA'
  | 'BPC_DEFICIENTE'
  | 'PENSAO_MORTE'
  | 'AUXILIO_MATERNIDADE'
  | 'AUXILIO_RECLUSAO'
  | 'AUXILIO_DOENCA'
  | 'APOSENTADORIA_INVALIDEZ'
  | 'AUXILIO_ACIDENTE'
  | 'OUTROS';

export type CaseStatus = 'ACTIVE' | 'CONCLUDED' | 'MOVED_TO_JUDICIAL';

export interface User {
  id: string;
  name: string;
  role: Role;
  pin?: string; 
  email?: string;
  whatsapp?: string;
  archived?: boolean;
}

export interface Step {
  id: string;
  label: string;
  description?: string;
  status: 'LOCKED' | 'CURRENT' | 'COMPLETED';
  completedDate?: string;
  adminComment?: string;
  stepOrder: number; 
  expectedDuration?: number;
}

export interface LegalCase {
  id: string;
  clientId: string;
  type: CaseType; // Agora armazena o ID do Template ou a Key antiga
  templateId?: string; // Referência direta ao template
  benefitType?: BenefitType;
  title: string;
  startDate: string;
  status: CaseStatus;
  steps: Step[];
}

export interface LoginCredentials {
  identifier: string; 
  secret: string; 
}

// --- Novos Tipos para Gerenciador de Templates ---

export interface TemplateStep {
  id: string;
  label: string;
  expectedDuration: number;
  stepOrder: number;
}

export interface CaseTemplate {
  id: string;
  label: string;
  steps: TemplateStep[];
  isSystem?: boolean; // Se true, são os padrões do sistema (Previdenciário/Trabalhista)
}
