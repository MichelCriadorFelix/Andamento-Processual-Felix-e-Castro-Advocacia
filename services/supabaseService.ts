
import { supabase } from '../lib/supabase';
import { User, LegalCase, LoginCredentials, CaseType, Step, BenefitType, CaseStatus, CaseTemplate, TemplateStep } from '../types';
import { ADMIN_NAMES } from '../constants';

const mapCaseFromDB = (dbCase: any, dbSteps: any[], dbClient: any): LegalCase => {
  return {
    id: dbCase.id,
    clientId: dbCase.client_id,
    type: dbCase.template_id || dbCase.case_type, // Fallback
    benefitType: dbCase.benefit_type as BenefitType,
    title: dbCase.title,
    startDate: dbCase.start_date,
    status: dbCase.status as CaseStatus,
    clientName: dbClient?.name,
    steps: dbSteps
      .filter(s => s.case_id === dbCase.id)
      .sort((a, b) => a.step_order - b.step_order)
      .map(s => ({
        id: s.id,
        label: s.label,
        status: s.status,
        completedDate: s.completed_date,
        adminComment: s.admin_comment,
        stepOrder: s.step_order,
        expectedDuration: s.expected_duration
      }))
  } as LegalCase;
};

export const supabaseService = {
  // --- AUTH ---
  login: async (creds: LoginCredentials): Promise<{ user: User | null; error?: string }> => {
    if (!supabase) return { user: null, error: 'Supabase não configurado.' };
    const { data: userProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('name', creds.identifier.trim())
      .eq('pin', creds.secret.trim())
      .eq('archived', false)
      .single();

    if (error || !userProfile) return { user: null, error: 'Credenciais inválidas.' };
    return { user: userProfile };
  },

  register: async (name: string, pin: string): Promise<{ user: User | null; error?: string }> => {
    if (!supabase) return { user: null, error: 'Supabase off' };
    
    // Check existing
    const { data: existing } = await supabase.from('profiles').select('id').ilike('name', name.trim()).single();
    if (existing) return { user: null, error: 'Usuário já existe.' };

    const isRestrictedAdmin = ADMIN_NAMES.some(n => n.toLowerCase() === name.trim().toLowerCase());
    const role = isRestrictedAdmin ? 'ADMIN' : 'CLIENT';

    const { data, error } = await supabase
      .from('profiles')
      .insert([{ name: name.trim(), pin: pin.trim(), role }])
      .select()
      .single();

    if (error) return { user: null, error: error.message };
    return { user: data };
  },

  createUser: async (name: string, pin: string, role: 'CLIENT' | 'ADMIN', whatsapp?: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('profiles').insert([{ name, pin, role, whatsapp }]).select().single();
    if (error) throw error;
    return data;
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    if (!supabase) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
  },

  deleteUser: async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
  },

  getAllClients: async () => {
    if (!supabase) return [];
    const { data } = await supabase.from('profiles').select('*').eq('role', 'CLIENT').order('name');
    return data || [];
  },

  // --- TEMPLATES (NEW) ---
  getTemplates: async (): Promise<CaseTemplate[]> => {
    if (!supabase) return [];
    
    const { data: templates } = await supabase.from('templates').select('*');
    if (!templates) return [];

    const { data: steps } = await supabase.from('template_steps').select('*');
    const allSteps = steps || [];

    return templates.map(t => ({
      id: t.id,
      label: t.label,
      isSystem: t.is_system,
      steps: allSteps
        .filter(s => s.template_id === t.id)
        .sort((a, b) => a.step_order - b.step_order)
        .map(s => ({
          id: s.id,
          label: s.label,
          expectedDuration: s.expected_duration,
          stepOrder: s.step_order
        }))
    }));
  },

  createTemplate: async (label: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('templates').insert([{ label, is_system: false }]).select().single();
    if (error) throw error;
    return { id: data.id, label: data.label, steps: [], isSystem: false };
  },

  deleteTemplate: async (id: string) => {
    if (!supabase) return;
    await supabase.from('templates').delete().eq('id', id);
  },

  addTemplateStep: async (templateId: string, label: string, duration: number, positionIndex?: number) => {
    if (!supabase) return;
    
    // Se positionIndex for fornecido, precisamos deslocar os itens existentes
    if (positionIndex !== undefined) {
      // 1. Busca passos que precisam ser deslocados
      const { data: stepsToShift } = await supabase
        .from('template_steps')
        .select('id, step_order')
        .eq('template_id', templateId)
        .gte('step_order', positionIndex);
      
      // 2. Atualiza a ordem deles
      if (stepsToShift && stepsToShift.length > 0) {
        for (const s of stepsToShift) {
          await supabase
            .from('template_steps')
            .update({ step_order: s.step_order + 1 })
            .eq('id', s.id);
        }
      }

      // 3. Insere o novo
      await supabase.from('template_steps').insert([{
        template_id: templateId,
        label,
        expected_duration: duration,
        step_order: positionIndex
      }]);

    } else {
      // Comportamento padrão: Adicionar ao final
      const { data: steps } = await supabase.from('template_steps').select('step_order').eq('template_id', templateId);
      const maxOrder = steps ? steps.length : 0;

      await supabase.from('template_steps').insert([{
        template_id: templateId,
        label,
        expected_duration: duration,
        step_order: maxOrder
      }]);
    }
  },

  deleteTemplateStep: async (templateId: string, stepId: string) => {
     if (!supabase) return;
     // 1. Get step to delete to know its order
     const { data: stepToDelete } = await supabase.from('template_steps').select('step_order').eq('id', stepId).single();
     
     // 2. Delete it
     await supabase.from('template_steps').delete().eq('id', stepId);

     // 3. Reorder subsequent steps (gap closing)
     if (stepToDelete) {
       const { data: stepsToShift } = await supabase
         .from('template_steps')
         .select('id, step_order')
         .eq('template_id', templateId)
         .gt('step_order', stepToDelete.step_order);
       
       if (stepsToShift) {
         for (const s of stepsToShift) {
           await supabase
             .from('template_steps')
             .update({ step_order: s.step_order - 1 })
             .eq('id', s.id);
         }
       }
     }
  },

  // --- CASES ---
  getCasesByClient: async (clientId: string) => {
    if (!supabase) return [];
    const { data: cases } = await supabase.from('cases').select('*').eq('client_id', clientId);
    if (!cases) return [];

    const caseIds = cases.map(c => c.id);
    const { data: steps } = await supabase.from('steps').select('*').in('case_id', caseIds);
    const { data: client } = await supabase.from('profiles').select('name').eq('id', clientId).single();

    return cases.map(c => mapCaseFromDB(c, steps || [], client));
  },

  getAllCases: async () => {
    if (!supabase) return [];
    const { data: cases } = await supabase.from('cases').select('*');
    if (!cases) return [];

    const { data: steps } = await supabase.from('steps').select('*');
    const { data: profiles } = await supabase.from('profiles').select('id, name');

    return cases.map(c => {
      const client = profiles?.find(p => p.id === c.client_id);
      return mapCaseFromDB(c, steps || [], client);
    });
  },

  addCase: async (clientId: string, templateId: string, title: string, benefitType?: BenefitType) => {
    if (!supabase) return;
    
    // 1. Create Case
    const { data: newCase, error } = await supabase
      .from('cases')
      .insert([{ 
        client_id: clientId, 
        template_id: templateId, // Armazenando ID do Template
        case_type: templateId, // Legado
        benefit_type: benefitType,
        title, 
        start_date: new Date(),
        status: 'ACTIVE'
      }])
      .select()
      .single();

    if (error || !newCase) throw error;

    // 2. Fetch Template Steps from DB
    const { data: tSteps } = await supabase
      .from('template_steps')
      .select('*')
      .eq('template_id', templateId)
      .order('step_order');

    if (tSteps) {
      const stepsData = tSteps.map((s, idx) => ({
        case_id: newCase.id,
        label: s.label,
        status: idx === 0 ? 'CURRENT' : 'LOCKED',
        step_order: idx,
        expected_duration: s.expected_duration
      }));
      await supabase.from('steps').insert(stepsData);
    }
    
    return newCase;
  },

  updateStep: async (caseId: string, stepId: string, comment: string | null, action: 'COMPLETE' | 'COMMENT_ONLY' | 'UPDATE_LABEL', newLabel?: string, completionDate?: string, newDuration?: number) => {
    if (!supabase) return;

    const updates: any = {};
    if (comment !== null) updates.admin_comment = comment;
    if (newLabel) updates.label = newLabel;
    if (newDuration !== undefined) updates.expected_duration = newDuration;
    
    if (action === 'COMPLETE') {
      updates.status = 'COMPLETED';
      updates.completed_date = completionDate || new Date();
    }

    // 1. Atualiza a etapa atual
    await supabase.from('steps').update(updates).eq('id', stepId);

    if (action === 'COMPLETE') {
      // 2. Busca a etapa atual para saber a ordem
      const { data: currentStep } = await supabase.from('steps').select('step_order').eq('id', stepId).single();
      
      if (currentStep) {
        // 3. Busca a PRÓXIMA etapa disponível (ordem > atual)
        // Isso resolve o problema de buracos na numeração se alguém excluir uma etapa
        const { data: nextStep } = await supabase
          .from('steps')
          .select('id')
          .eq('case_id', caseId)
          .gt('step_order', currentStep.step_order)
          .order('step_order', { ascending: true })
          .limit(1)
          .single();

        if (nextStep) {
          await supabase
            .from('steps')
            .update({ status: 'CURRENT' })
            .eq('id', nextStep.id);
        } else {
          // Se não houver próxima etapa, marca o caso como concluído automaticamente? 
          // Por enquanto não, o advogado faz isso manualmente para evitar conclusões acidentais.
        }
      }
    }
  },

  addStep: async (caseId: string, label: string, position: number, duration: number) => {
    if (!supabase) return;
    const { data: stepsToShift } = await supabase.from('steps').select('id, step_order').eq('case_id', caseId).gte('step_order', position);
    if (stepsToShift) {
       for (const s of stepsToShift) {
         await supabase.from('steps').update({ step_order: s.step_order + 1 }).eq('id', s.id);
       }
    }
    await supabase.from('steps').insert([{
      case_id: caseId,
      label,
      status: 'LOCKED',
      step_order: position,
      expected_duration: duration
    }]);
  },

  deleteStep: async (stepId: string) => {
    if (!supabase) return;
    await supabase.from('steps').delete().eq('id', stepId);
  },

  updateCaseStatus: async (caseId: string, status: CaseStatus) => {
    if (!supabase) return;
    await supabase.from('cases').update({ status }).eq('id', caseId);
  },

  deleteCase: async (caseId: string) => {
    if (!supabase) return;
    await supabase.from('cases').delete().eq('id', caseId);
  },

  updateCaseTitle: async (caseId: string, newTitle: string) => {
    if (!supabase) return;
    await supabase.from('cases').update({ title: newTitle }).eq('id', caseId);
  },

  transformToJudicial: async (oldCase: LegalCase) => {
    if (!supabase) return;

    // 1. Update old case status
    await supabase.from('cases').update({ status: 'MOVED_TO_JUDICIAL' }).eq('id', oldCase.id);

    // 2. Identify Target Template (Generic or Specific)
    // Tenta achar o template judicial padrão, se não, usa o genérico
    const { data: templates } = await supabase.from('templates').select('*');
    let targetTemplateId = 'JUDICIAL_PREVIDENCIARIO';
    
    // Check if JUDICIAL_PREVIDENCIARIO exists in DB (it should be seeded)
    const judPrevExists = templates?.find(t => t.id === 'JUDICIAL_PREVIDENCIARIO');
    if (!judPrevExists) {
      // Fallback to Generic
      const genericJud = templates?.find(t => t.id === 'GENERICO_JUDICIAL');
      if (genericJud) targetTemplateId = genericJud.id;
    }

    // 3. Create new Case
    const { data: newCase, error } = await supabase
      .from('cases')
      .insert([{ 
        client_id: oldCase.clientId, 
        template_id: targetTemplateId,
        case_type: targetTemplateId, 
        benefit_type: oldCase.benefitType,
        title: `Judicial: ${oldCase.title}`, 
        start_date: new Date(),
        status: 'ACTIVE'
      }])
      .select()
      .single();

    if (error || !newCase) throw error;

    // 4. Copy Steps
     const { data: tSteps } = await supabase
      .from('template_steps')
      .select('*')
      .eq('template_id', targetTemplateId)
      .order('step_order');

    if (tSteps) {
      const stepsData = tSteps.map((s, idx) => ({
        case_id: newCase.id,
        label: s.label,
        status: idx === 0 ? 'CURRENT' : 'LOCKED',
        step_order: idx,
        expected_duration: s.expected_duration
      }));
      await supabase.from('steps').insert(stepsData);
    }

    return newCase;
  }
};
