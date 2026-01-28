
import { User, LegalCase, LoginCredentials, CaseType, Step, BenefitType, CaseStatus, CaseTemplate, TemplateStep } from '../types';
import { INITIAL_TEMPLATES, INITIAL_CLIENTS, ADMIN_NAMES } from '../constants';

let users: User[] = [...INITIAL_CLIENTS];
let cases: LegalCase[] = []; 
let templates: CaseTemplate[] = [...INITIAL_TEMPLATES];

export const mockService = {
  // --- AUTH & USERS ---
  login: async (creds: LoginCredentials): Promise<{ user: User | null; error?: string }> => {
    const user = users.find(
      u => u.name.toLowerCase() === creds.identifier.toLowerCase() 
           && u.pin === creds.secret 
           && !u.archived
    );
    if (user) return { user };
    return { user: null, error: 'Credenciais inválidas.' };
  },

  register: async (name: string, pin: string): Promise<{ user: User | null; error?: string }> => {
    const existing = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existing) return { user: null, error: 'Usuário já cadastrado. Faça login.' };

    const isRestrictedAdmin = ADMIN_NAMES.some(n => n.toLowerCase() === name.trim().toLowerCase());
    const role = isRestrictedAdmin ? 'ADMIN' : 'CLIENT';

    const newUser: User = { id: `u-${Date.now()}`, name, pin, role, archived: false };
    users = [...users, newUser];
    return { user: newUser };
  },

  createUser: async (name: string, pin: string, role: 'CLIENT' | 'ADMIN', whatsapp?: string) => {
    const newUser: User = { id: `u-${Date.now()}`, name, pin, role, whatsapp, archived: false };
    users = [...users, newUser];
    return newUser;
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    users = users.map(u => u.id === id ? { ...u, ...updates } : u);
  },

  deleteUser: async (id: string) => {
    users = users.filter(u => u.id !== id);
  },

  getAllClients: () => users.filter(u => u.role === 'CLIENT'),

  // --- TEMPLATES ---
  getTemplates: async (): Promise<CaseTemplate[]> => {
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
    return newTemplate;
  },

  deleteTemplate: async (id: string) => {
    templates = templates.filter(t => t.id !== id);
  },

  addTemplateStep: async (templateId: string, label: string, duration: number, positionIndex?: number) => {
    templates = templates.map(t => {
      if (t.id !== templateId) return t;
      
      let newSteps = [...t.steps];
      const newOrder = positionIndex !== undefined ? positionIndex : t.steps.length;

      // Shift steps if inserting in middle
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
  },

  deleteTemplateStep: async (templateId: string, stepId: string) => {
     templates = templates.map(t => {
      if (t.id !== templateId) return t;
      
      const filtered = t.steps.filter(s => s.id !== stepId);
      // Reindex
      const reindexed = filtered.map((s, idx) => ({ ...s, stepOrder: idx }));

      return { ...t, steps: reindexed };
    });
  },

  // --- CASES ---
  getCasesByClient: (clientId: string) => cases.filter(c => c.clientId === clientId),

  getAllCases: () => {
    return cases.map(c => {
      const client = users.find(u => u.id === c.clientId);
      return { ...c, clientName: client?.name || 'Desconhecido' };
    });
  },

  addCase: (clientId: string, templateId: string, title: string, benefitType?: BenefitType) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) throw new Error("Template not found");

    const newCase: LegalCase = {
      id: `case-${Date.now()}`,
      clientId,
      type: templateId, // Mantendo referência
      benefitType,
      title,
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
  },

  deleteStep: (stepId: string) => {
    cases = cases.map(c => ({
      ...c,
      steps: c.steps.filter(s => s.id !== stepId)
    }));
  },

  updateCaseStatus: (caseId: string, status: CaseStatus) => {
    cases = cases.map(c => c.id === caseId ? { ...c, status } : c);
  },

  deleteCase: (caseId: string) => {
    cases = cases.filter(c => c.id !== caseId);
  },
  
  updateCaseTitle: (caseId: string, newTitle: string) => {
    cases = cases.map(c => c.id === caseId ? { ...c, title: newTitle } : c);
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
    return newCase;
  }
};
