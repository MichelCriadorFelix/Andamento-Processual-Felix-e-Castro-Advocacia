
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

export interface UserQualification {
  gender?: string;
  age?: number | string;
  contributionTime?: string;
  hasMedicalReport?: boolean | string;
  cid?: string;
  disabilityType?: string;
  lastContributionDate?: string;
  ppp?: string;
  documents?: string;
  inssDenied?: string;
  courtDenied?: string;
  [key: string]: any; // Allow other fields from analyzer
}

export interface User {
  id: string;
  name: string;
  role: Role;
  pin?: string; 
  email?: string;
  whatsapp?: string;
  address?: string;
  jobTitle?: string; // Novo: Cargo (Advogado, Secretária, etc)
  archived?: boolean;
  analysisResult?: string;
  analysisData?: any;
  qualification?: UserQualification; // Novo: Qualificação do cliente
}

export interface Step {
  id: string;
  label: string;
  description?: string;
  status: 'LOCKED' | 'CURRENT' | 'COMPLETED';
  completedDate?: string;
  appointmentDate?: string; // Novo: Data de agendamento (perícia, audiência, etc)
  adminComment?: string;
  stepOrder: number; 
  expectedDuration?: number;
}

export interface Expertise {
  id: string;
  name: string;
  date: string;
  time: string;
}

export interface LegalCase {
  id: string;
  clientId: string;
  type: CaseType; // Agora armazena o ID do Template ou a Key antiga
  templateId?: string; // Referência direta ao template
  benefitType?: BenefitType;
  title: string;
  responsibleLawyer?: string; // Novo: Advogado Responsável
  startDate: string;
  status: CaseStatus;
  steps: Step[];
  clientName?: string; // Opcional para facilitar display
  caseNumber?: string; // Número do processo
  expertiseDate?: string; // Legacy: Data da perícia (mantido para compatibilidade)
  expertises?: Expertise[]; // Novo: Lista de perícias
  orientations?: string; // Orientações
  alerts?: string; // Alertas
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

export interface CaseDocument {
  id: string;
  name: string;
  url: string;
  created_at: string;
  size?: number;
  // Auditoria
  uploadedBy?: string;
  uploaderRole?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
  image: string;
  description: string;
  order: number;
}
