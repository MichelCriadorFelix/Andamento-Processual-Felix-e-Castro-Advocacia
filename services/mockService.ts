
import { User, LegalCase, LoginCredentials, Step, BenefitType, CaseStatus, CaseTemplate, TemplateStep } from '../types';
import { INITIAL_TEMPLATES, INITIAL_CLIENTS, ADMIN_NAMES } from '../constants';

// Chaves para persistência no navegador
const STORAGE_KEYS = {
  USERS: 'fec_adv_users_v1',
  CASES: 'fec_adv_cases_v1',
  TEMPLATES: 'fec_adv_templates_v1'
};

// Helpers de Storage
const getStored = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

const setStored = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

// Estado Inicial carregado do LocalStorage ou Defaults
let users: User[] = getStored(STORAGE_KEYS.USERS, [...INITIAL_CLIENTS]);
let cases: LegalCase[] = getStored(STORAGE_KEYS.CASES, []); 
let templates: CaseTemplate[] = getStored(STORAGE_KEYS.TEMPLATES, [...INITIAL_TEMPLATES]);

export const mockService = {
  // --- AUTH & USERS ---
  login: async (creds: LoginCredentials): Promise<{ user: User | null; error?: string }> => {
    // Recarrega users para garantir sincronia entre abas
    users = getStored(STORAGE_KEYS.USERS, users);
    
    const user = users.find(
      u => u.name.toLowerCase() === creds.identifier.toLowerCase() 
           && u.pin === creds.secret 
           && !u.archived
    );
    if (user) return { user };
    return { user: null, error: 'Credenciais inválidas (Modo Local).' };
  },

  register: async (name: string, pin: string): Promise<{ user: User | null; error?: string }> => {
    users = getStored(STORAGE_KEYS.USERS, users);
    const existing = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return { user: null, error: 'Usuário já cadastrado. Faça login.' };

    const isRestrictedAdmin = ADMIN_NAMES.some(n => n.toLowerCase() === name.trim().toLowerCase());
    const role = isRestrictedAdmin ? 'ADMIN' : 'CLIENT';

    const newUser: User = { id: `u-${Date.now()}`, name, pin, role, archived: false };
    users = [...users, newUser];
    setStored(STORAGE_KEYS.USERS, users);
    
    return { user: newUser };
  },

  createUser: async (name: string, pin: string, role: 'CLIENT' | 'ADMIN', whatsapp?: string, jobTitle?: string) => {
    const newUser: User = { id: `u-${Date.now()}`, name, pin, role, whatsapp, jobTitle, archived: false };
    users = [...users, newUser];
    setStored(STORAGE_KEYS.USERS, users);
    return newUser;
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    users = users.map(u => u.id === id ? { ...u, ...updates } : u);
    setStored(STORAGE_KEYS.USERS, users);
  },

  deleteUser: async (id: string) => {
    users = users.filter(u => u.id !== id);
    setStored(STORAGE_KEYS.USERS, users);
  },

  getAllUsers: () => {
    users = getStored(STORAGE_KEYS.USERS, users);
    return users.sort((a, b) => a.name.localeCompare(b.name));
  },

  // --- TEMPLATES ---
  getTemplates: async (): Promise<CaseTemplate[]> => {
    templates = getStored(STORAGE_KEYS.TEMPLATES, templates);
    return templates;
  },

  createTemplate: async (label: string) => {
    const newTemplate: CaseTemplate = {
      id: `custom-${Date.now()}`,
      label,
      steps: [],
      isSystem: false
    };
    templates = [...templates, newTemplate];
    setStored(STORAGE_KEYS.TEMPLATES, templates);
    return newTemplate;
  },

  deleteTemplate: async (id: string) => {
    templates = templates.filter(t => t.id !== id);
    setStored(STORAGE_KEYS.TEMPLATES, templates);
  },

  addTemplateStep: async (templateId: string, label: string, duration: number, positionIndex?: number) => {
    templates = templates.map(t => {
      if (t.id !== templateId) return t;
      
      let newSteps = [...t.steps];
      const newOrder = positionIndex !== undefined ? positionIndex : t.steps.length;

      if (positionIndex !== undefined) {
        newSteps = newSteps.map(s => {
          if (s.stepOrder >= newOrder) {
            return { ...s, stepOrder: s.stepOrder + 1 };
          }
          return s;
        });
      }

      const newStep: TemplateStep = {
        id: `ts-${Date.now()}`,
        label,
        expectedDuration: duration,
        stepOrder: newOrder
      };
      
      newSteps.push(newStep);
      newSteps.sort((a, b) => a.stepOrder - b.stepOrder);

      return { ...t, steps: newSteps };
    });
    setStored(STORAGE_KEYS.TEMPLATES, templates);
  },

  deleteTemplateStep: async (templateId: string, stepId: string) => {
     templates = templates.map(t => {
      if (t.id !== templateId) return t;
      const filtered = t.steps.filter(s => s.id !== stepId);
      const reindexed = filtered.map((s, idx) => ({ ...s, stepOrder: idx }));
      return { ...t, steps: reindexed };
    });
    setStored(STORAGE_KEYS.TEMPLATES, templates);
  },

  // --- CASES ---
  getCasesByClient: (clientId: string) => {
    cases = getStored(STORAGE_KEYS.CASES, cases);
    return cases.filter(c => c.clientId === clientId);
  },

  getAllCases: () => {
    cases = getStored(STORAGE_KEYS.CASES, cases);
    users = getStored(STORAGE_KEYS.USERS, users);
    return cases.map(c => {
      const client = users.find(u => u.id === c.clientId);
      return { ...c, clientName: client?.name || 'Desconhecido' };
    });
  },

  addCase: (clientId: string, templateId: string, title: string, benefitType?: BenefitType, responsibleLawyer?: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) throw new Error("Template not found");

    const newCase: LegalCase = {
      id: `case-${Date.now()}`,
      clientId,
      type: templateId, 
      benefitType,
      title,
      responsibleLawyer,
      startDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      steps: template.steps.map((s, idx) => ({
        id: `s-${Date.now()}-${idx}`,
        label: s.label,
        status: idx === 0 ? 'CURRENT' : 'LOCKED',
        stepOrder: idx,
        expectedDuration: s.expectedDuration
      }))
    };
    cases = [...cases, newCase];
    setStored(STORAGE_KEYS.CASES, cases);
    return newCase;
  },

  updateStep: (caseId: string, stepId: string, comment: string | null, action: 'COMPLETE' | 'COMMENT_ONLY' | 'UPDATE_LABEL', newLabel?: string, completionDate?: string, newDuration?: number) => {
    cases = cases.map(c => {
      if (c.id !== caseId) return c;
      const stepIndex = c.steps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) return c;

      const newSteps = [...c.steps];
      const currentStep = { ...newSteps[stepIndex] };

      if (comment !== null) currentStep.adminComment = comment;
      if (newLabel) currentStep.label = newLabel;
      if (newDuration !== undefined) currentStep.expectedDuration = newDuration;

      if (action === 'COMPLETE') {
        currentStep.status = 'COMPLETED';
        currentStep.completedDate = completionDate || new Date().toISOString().split('T')[0];
        if (stepIndex + 1 < newSteps.length) {
          newSteps[stepIndex + 1] = { ...newSteps[stepIndex + 1], status: 'CURRENT' };
        }
      }

      newSteps[stepIndex] = currentStep;
      return { ...c, steps: newSteps };
    });
    setStored(STORAGE_KEYS.CASES, cases);
  },

  addStep: (caseId: string, label: string, position: number, duration: number) => {
    cases = cases.map(c => {
      if (c.id !== caseId) return c;
      const newStep: Step = {
        id: `s-${Date.now()}`,
        label,
        status: 'LOCKED',
        stepOrder: position,
        expectedDuration: duration
      };
      const updatedSteps = [...c.steps];
      updatedSteps.splice(position, 0, newStep);
      const reindexed = updatedSteps.map((s, idx) => ({ ...s, stepOrder: idx }));
      return { ...c, steps: reindexed };
    });
    setStored(STORAGE_KEYS.CASES, cases);
  },

  deleteStep: (stepId: string) => {
    cases = cases.map(c => ({
      ...c,
      steps: c.steps.filter(s => s.id !== stepId)
    }));
    setStored(STORAGE_KEYS.CASES, cases);
  },

  updateCaseStatus: (caseId: string, status: CaseStatus) => {
    cases = cases.map(c => c.id === caseId ? { ...c, status } : c);
    setStored(STORAGE_KEYS.CASES, cases);
  },

  deleteCase: (caseId: string) => {
    cases = cases.filter(c => c.id !== caseId);
    setStored(STORAGE_KEYS.CASES, cases);
  },
  
  updateCaseTitle: (caseId: string, newTitle: string) => {
    cases = cases.map(c => c.id === caseId ? { ...c, title: newTitle } : c);
    setStored(STORAGE_KEYS.CASES, cases);
  },

  transformToJudicial: (oldCase: LegalCase) => {
    cases = cases.map(c => c.id === oldCase.id ? { ...c, status: 'MOVED_TO_JUDICIAL' } : c);
    
    let targetTemplate = templates.find(t => t.id === 'JUDICIAL_PREVIDENCIARIO');
    if (!targetTemplate) targetTemplate = templates.find(t => t.id === 'GENERICO_JUDICIAL');
    if (!targetTemplate) targetTemplate = templates[0];

    const newCase: LegalCase = {
      id: `case-${Date.now()}`,
      clientId: oldCase.clientId,
      type: targetTemplate.id,
      benefitType: oldCase.benefitType,
      title: `Judicial: ${oldCase.title}`,
      responsibleLawyer: oldCase.responsibleLawyer,
      startDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      steps: targetTemplate.steps.map((s, idx) => ({
        id: `s-jud-${Date.now()}-${idx}`,
        label: s.label,
        status: idx === 0 ? 'CURRENT' : 'LOCKED',
        stepOrder: idx,
        expectedDuration: s.expectedDuration
      }))
    };
    cases = [...cases, newCase];
    setStored(STORAGE_KEYS.CASES, cases);
    return newCase;
  }
};
