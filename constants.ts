
import { BenefitType, CaseTemplate } from './types';

export const ADMIN_NAMES = [
  'Michel Felix',
  'Luana Castro', 
  'Fabrícia Sousa'
];

// Configuração dos Benefícios
export const PREVIDENCIARIO_BENEFITS: Record<BenefitType, { label: string; hasExam: boolean }> = {
  'BPC_IDOSO': { label: 'BPC Idoso', hasExam: false },
  'APOSENTADORIA_IDADE': { label: 'Aposentadoria por Idade', hasExam: false },
  'APOSENTADORIA_CONTRIBUICAO': { label: 'Aposentadoria por Tempo de Contribuição', hasExam: false },
  'APOSENTADORIA_ESPECIAL': { label: 'Aposentadoria Especial', hasExam: false },
  'APOSENTADORIA_DEFICIENCIA': { label: 'Aposentadoria Pessoa com Deficiência', hasExam: true },
  'BPC_DEFICIENTE': { label: 'BPC Deficiente', hasExam: true },
  'PENSAO_MORTE': { label: 'Pensão por Morte', hasExam: false },
  'AUXILIO_MATERNIDADE': { label: 'Auxílio-Maternidade', hasExam: false },
  'AUXILIO_RECLUSAO': { label: 'Auxílio-Reclusão', hasExam: false },
  'AUXILIO_DOENCA': { label: 'Auxílio-Doença', hasExam: true },
  'APOSENTADORIA_INVALIDEZ': { label: 'Aposentadoria por Invalidez', hasExam: true },
  'AUXILIO_ACIDENTE': { label: 'Auxílio-Acidente', hasExam: true },
  'OUTROS': { label: 'Outros', hasExam: false }
};

// Dados Iniciais (Seed) para os Templates
export const INITIAL_TEMPLATES: CaseTemplate[] = [
  {
    id: 'ADMINISTRATIVO_PREVIDENCIARIO',
    label: 'Administrativo Previdenciário (Padrão)',
    isSystem: true,
    steps: [
      { id: 't1-1', label: 'Envio da Documentação', expectedDuration: 0, stepOrder: 0 },
      { id: 't1-2', label: 'Confecção do Processo', expectedDuration: 10, stepOrder: 1 },
      { id: 't1-3', label: 'Entrada / Protocolo', expectedDuration: 1, stepOrder: 2 },
      { id: 't1-4', label: 'Exigência a Cumprir', expectedDuration: 30, stepOrder: 3 },
      { id: 't1-5', label: 'Conclusão (Concedido/Negado)', expectedDuration: 45, stepOrder: 4 },
      { id: 't1-6', label: 'Informações de Pagamento', expectedDuration: 30, stepOrder: 5 },
      { id: 't1-7', label: 'Preparo Judicial (Se Negado)', expectedDuration: 15, stepOrder: 6 }
    ]
  },
  {
    id: 'JUDICIAL_PREVIDENCIARIO',
    label: 'Judicial Previdenciário (Padrão)',
    isSystem: true,
    steps: [
      { id: 't2-1', label: 'Envio da Documentação', expectedDuration: 0, stepOrder: 0 },
      { id: 't2-2', label: 'Confecção do Processo', expectedDuration: 30, stepOrder: 1 },
      { id: 't2-3', label: 'Entrada no Tribunal', expectedDuration: 1, stepOrder: 2 },
      { id: 't2-4', label: 'Despacho do Juízo', expectedDuration: 30, stepOrder: 3 },
      { id: 't2-5', label: 'Perícia Médica', expectedDuration: 45, stepOrder: 4 },
      { id: 't2-6', label: 'Resultado da Perícia', expectedDuration: 30, stepOrder: 5 },
      { id: 't2-7', label: 'Contestação / Acordo', expectedDuration: 30, stepOrder: 6 },
      { id: 't2-8', label: 'Réplica / Decisão Acordo', expectedDuration: 30, stepOrder: 7 },
      { id: 't2-9', label: 'Sentença', expectedDuration: 120, stepOrder: 8 },
      { id: 't2-10', label: 'Pagamento', expectedDuration: 60, stepOrder: 9 },
      { id: 't2-11', label: 'Análise de Recurso', expectedDuration: 15, stepOrder: 10 }
    ]
  },
  {
    id: 'JUDICIAL_TRABALHISTA',
    label: 'Judicial Trabalhista (Padrão)',
    isSystem: true,
    steps: [
      { id: 't3-1', label: 'Envio da Documentação', expectedDuration: 0, stepOrder: 0 },
      { id: 't3-2', label: 'Confecção do Processo', expectedDuration: 30, stepOrder: 1 },
      { id: 't3-3', label: 'Entrada no Tribunal', expectedDuration: 1, stepOrder: 2 },
      { id: 't3-4', label: 'Despacho do Juízo', expectedDuration: 30, stepOrder: 3 },
      { id: 't3-5', label: 'Marcação de Audiência', expectedDuration: 60, stepOrder: 4 },
      { id: 't3-6', label: 'Alegações Finais', expectedDuration: 15, stepOrder: 5 },
      { id: 't3-7', label: 'Sentença', expectedDuration: 30, stepOrder: 6 },
      { id: 't3-8', label: 'Fase de Execução', expectedDuration: 180, stepOrder: 7 },
      { id: 't3-9', label: 'Análise de Recurso', expectedDuration: 15, stepOrder: 8 }
    ]
  },
  {
    id: 'GENERICO_ADMINISTRATIVO',
    label: 'Genérico - Administrativo (Outras Áreas)',
    isSystem: false,
    steps: [
      { id: 't4-1', label: 'Análise de Documentos', expectedDuration: 5, stepOrder: 0 },
      { id: 't4-2', label: 'Protocolo Administrativo', expectedDuration: 5, stepOrder: 1 },
      { id: 't4-3', label: 'Aguardando Análise', expectedDuration: 45, stepOrder: 2 },
      { id: 't4-4', label: 'Cumprimento de Exigência', expectedDuration: 30, stepOrder: 3 },
      { id: 't4-5', label: 'Decisão Administrativa', expectedDuration: 30, stepOrder: 4 },
      { id: 't4-6', label: 'Recurso Administrativo', expectedDuration: 15, stepOrder: 5 },
      { id: 't4-7', label: 'Conclusão', expectedDuration: 0, stepOrder: 6 }
    ]
  },
  {
    id: 'GENERICO_JUDICIAL',
    label: 'Genérico - Judicial (Outras Áreas)',
    isSystem: false,
    steps: [
      { id: 't5-1', label: 'Análise e Documentação', expectedDuration: 10, stepOrder: 0 },
      { id: 't5-2', label: 'Petição Inicial', expectedDuration: 15, stepOrder: 1 },
      { id: 't5-3', label: 'Protocolo / Distribuição', expectedDuration: 2, stepOrder: 2 },
      { id: 't5-4', label: 'Citação da Parte Ré', expectedDuration: 45, stepOrder: 3 },
      { id: 't5-5', label: 'Audiência', expectedDuration: 60, stepOrder: 4 },
      { id: 't5-6', label: 'Sentença', expectedDuration: 90, stepOrder: 5 },
      { id: 't5-7', label: 'Fase Recursal', expectedDuration: 30, stepOrder: 6 },
      { id: 't5-8', label: 'Execução / Cumprimento', expectedDuration: 60, stepOrder: 7 }
    ]
  }
];

export const INITIAL_CLIENTS = [
  { id: 'client-1', name: 'João da Silva', pin: '123456', role: 'CLIENT' as const },
];
