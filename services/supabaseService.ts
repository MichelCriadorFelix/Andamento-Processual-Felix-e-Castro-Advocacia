
import { supabase } from '../lib/supabase';
import { User, LegalCase, LoginCredentials, CaseType, Step, BenefitType, CaseStatus, CaseTemplate, TemplateStep, CaseDocument } from '../types';
import { ADMIN_NAMES } from '../constants';

const mapCaseFromDB = (dbCase: any, dbSteps: any[], dbClient: any): LegalCase => {
  return {
    id: dbCase.id,
    clientId: dbCase.client_id,
    type: dbCase.template_id || dbCase.case_type, // Fallback
    benefitType: dbCase.benefit_type as BenefitType,
    title: dbCase.title,
    responsibleLawyer: dbCase.responsible_lawyer, // Novo campo
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
    // Map snake_case to camelCase if needed for jobTitle
    return { user: { ...userProfile, jobTitle: userProfile.job_title } };
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
    return { user: { ...data, jobTitle: data.job_title } };
  },

  createUser: async (name: string, pin: string, role: 'CLIENT' | 'ADMIN', whatsapp?: string, jobTitle?: string) => {
    if (!supabase) return;
    const payload: any = { name, pin, role, whatsapp };
    if (jobTitle) payload.job_title = jobTitle;

    const { data, error } = await supabase.from('profiles').insert([payload]).select().single();
    if (error) throw error;
    return { ...data, jobTitle: data.job_title };
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    if (!supabase) return;
    const dbUpdates: any = { ...updates };
    
    // Mapeia camelCase para snake_case do banco
    if (updates.jobTitle !== undefined) {
      dbUpdates.job_title = updates.jobTitle;
      delete dbUpdates.jobTitle;
    }
    
    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', id);
    if (error) throw error;
  },

  deleteUser: async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
  },

  getAllUsers: async () => {
    if (!supabase) return [];
    // Retorna todos os usuários (Clientes e Admins) ordenados por nome
    const { data } = await supabase.from('profiles').select('*').order('name');
    return data?.map(u => ({ ...u, jobTitle: u.job_title })) || [];
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
    const newId = `custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    const { data, error } = await supabase.from('templates').insert([{ 
      id: newId,
      label, 
      is_system: false 
    }]).select().single();
    
    if (error) throw error;
    return { id: data.id, label: data.label, steps: [], isSystem: false };
  },

  deleteTemplate: async (id: string) => {
    if (!supabase) return;
    await supabase.from('templates').delete().eq('id', id);
  },

  addTemplateStep: async (templateId: string, label: string, duration: number, positionIndex?: number) => {
    if (!supabase) return;
    
    if (positionIndex !== undefined) {
      const { data: stepsToShift } = await supabase
        .from('template_steps')
        .select('id, step_order')
        .eq('template_id', templateId)
        .gte('step_order', positionIndex);
      
      if (stepsToShift && stepsToShift.length > 0) {
        for (const s of stepsToShift) {
          await supabase
            .from('template_steps')
            .update({ step_order: s.step_order + 1 })
            .eq('id', s.id);
        }
      }

      await supabase.from('template_steps').insert([{
        template_id: templateId,
        label,
        expected_duration: duration,
        step_order: positionIndex
      }]);

    } else {
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
     const { data: stepToDelete } = await supabase.from('template_steps').select('step_order').eq('id', stepId).single();
     await supabase.from('template_steps').delete().eq('id', stepId);

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

  addCase: async (clientId: string, templateId: string, title: string, benefitType?: BenefitType, responsibleLawyer?: string) => {
    if (!supabase) return;
    
    const { data: newCase, error } = await supabase
      .from('cases')
      .insert([{ 
        client_id: clientId, 
        template_id: templateId, 
        case_type: templateId, 
        benefit_type: benefitType,
        title, 
        responsible_lawyer: responsibleLawyer, 
        start_date: new Date(),
        status: 'ACTIVE'
      }])
      .select()
      .single();

    if (error || !newCase) throw error;

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

    await supabase.from('steps').update(updates).eq('id', stepId);

    if (action === 'COMPLETE') {
      const { data: currentStep } = await supabase.from('steps').select('step_order').eq('id', stepId).single();
      
      if (currentStep) {
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

    await supabase.from('cases').update({ status: 'MOVED_TO_JUDICIAL' }).eq('id', oldCase.id);

    const { data: templates } = await supabase.from('templates').select('*');
    let targetTemplateId = 'JUDICIAL_PREVIDENCIARIO';
    
    const judPrevExists = templates?.find(t => t.id === 'JUDICIAL_PREVIDENCIARIO');
    if (!judPrevExists) {
      const genericJud = templates?.find(t => t.id === 'GENERICO_JUDICIAL');
      if (genericJud) targetTemplateId = genericJud.id;
    }

    const { data: newCase, error } = await supabase
      .from('cases')
      .insert([{ 
        client_id: oldCase.clientId, 
        template_id: targetTemplateId,
        case_type: targetTemplateId, 
        benefit_type: oldCase.benefitType,
        title: `Judicial: ${oldCase.title}`, 
        responsible_lawyer: oldCase.responsibleLawyer, 
        start_date: new Date(),
        status: 'ACTIVE'
      }])
      .select()
      .single();

    if (error || !newCase) throw error;

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
  },

  // --- DOCUMENTS ---
  uploadDocument: async (caseId: string, fileName: string, fileBlob: Blob) => {
    if (!supabase) return;
    
    // Sanitização rigorosa
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, ''); 
    // Garante que o nome não fique vazio
    const finalName = safeFileName || `doc_${Date.now()}`;
    const path = `${caseId}/${Date.now()}_${finalName}.pdf`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(path, fileBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error("Erro detalhado do Supabase Upload:", error);
      throw error;
    }
    return data;
  },
  
  deleteDocument: async (caseId: string, fileName: string) => {
    if (!supabase) return;
    const { error } = await supabase.storage
      .from('documents')
      .remove([`${caseId}/${fileName}`]);
    if (error) throw error;
  },

  getDocuments: async (caseId: string): Promise<CaseDocument[]> => {
     if (!supabase) return [];
     const { data, error } = await supabase.storage
       .from('documents')
       .list(caseId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
     
     if (error) return [];

     return data.map(f => {
       const { data: publicUrl } = supabase.storage.from('documents').getPublicUrl(`${caseId}/${f.name}`);
       return {
         name: f.name,
         url: publicUrl.publicUrl,
         created_at: f.created_at,
         size: f.metadata?.size
       };
     });
  }
};
