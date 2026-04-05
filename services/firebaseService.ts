import { db, auth, storage, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, addDoc, serverTimestamp, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { User, LegalCase, CaseType, Step, BenefitType, CaseStatus, CaseTemplate, TemplateStep, CaseDocument, TeamMember } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const mapCaseFromDB = (dbCase: any, dbSteps: any[], clientName?: string): LegalCase => {
  return {
    id: dbCase.id,
    clientId: dbCase.clientId,
    type: dbCase.templateId || dbCase.caseType,
    templateId: dbCase.templateId,
    benefitType: dbCase.benefitType as BenefitType,
    title: dbCase.title,
    responsibleLawyer: dbCase.responsibleLawyer,
    startDate: dbCase.startDate,
    status: dbCase.status as CaseStatus,
    clientName: clientName,
    caseNumber: dbCase.caseNumber,
    expertiseDate: dbCase.expertiseDate,
    expertises: dbCase.expertises || [],
    orientations: dbCase.orientations,
    alerts: dbCase.alerts,
    steps: dbSteps
      .filter(s => s.caseId === dbCase.id)
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map(s => ({
        id: s.id,
        label: s.label,
        status: s.status,
        completedDate: s.completedDate,
        adminComment: s.adminComment,
        stepOrder: s.stepOrder,
        expectedDuration: s.expectedDuration,
        appointmentDate: s.appointmentDate
      }))
  } as LegalCase;
};

export const firebaseService = {
  // --- AUTH ---
  getRedirectResult: async () => {
    console.log("Checking for redirect result...");
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        console.log("Redirect result found for:", result.user.email);
      } else {
        console.log("No redirect result found.");
      }
      return result;
    } catch (error) {
      console.error("Error getting redirect result:", error);
      throw error;
    }
  },
  loginWithGoogle: async (): Promise<{ user: User | null; error?: string; redirecting?: boolean }> => {
    console.log("Starting loginWithGoogle...");
    try {
      // Try popup first (opens a new tab/window)
      console.log("Attempting signInWithPopup...");
      const result = await signInWithPopup(auth, googleProvider);
      console.log("signInWithPopup successful:", result.user.email);
      const user = result.user;
      
      // Check if user exists in profiles
      const profileRef = doc(db, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        const profileData = profileSnap.data();
        let role = profileData.role;
        let jobTitle = profileData.jobTitle;
        
        // Force role correction for specific emails
        const isFelix = user.email === 'felixecastroadv@gmail.com';
        const isMichel = user.email === 'michelgeminicriador@gmail.com';
        
        if (isFelix && role !== 'ADMIN') {
          role = 'ADMIN';
          await updateDoc(profileRef, { role: 'ADMIN' });
        }
        
        if (isMichel && role !== 'ADMIN') {
          role = 'ADMIN';
          await updateDoc(profileRef, { role: 'ADMIN' });
        }

        return { user: { id: user.uid, ...profileData, role, jobTitle } as User };
      } else {
        // Check for invitations
        let role: 'ADMIN' | 'CLIENT' = 'CLIENT';
        let jobTitle = '';
        
        if (user.email) {
          const invQ = query(collection(db, 'invitations'), where('email', '==', user.email));
          const invSnap = await getDocs(invQ);
          if (!invSnap.empty) {
            const invData = invSnap.docs[0].data();
            role = invData.role;
            jobTitle = invData.jobTitle || '';
            await deleteDoc(invSnap.docs[0].ref);
          }
        }

        const isFelix = user.email === 'felixecastroadv@gmail.com';
        if (isFelix) role = 'ADMIN';
        
        const newProfile = {
          name: user.displayName || 'Usuário',
          email: user.email,
          role,
          jobTitle,
          uid: user.uid,
          archived: false
        };
        
        await setDoc(profileRef, newProfile);
        return { user: { id: user.uid, ...newProfile } as User };
      }
    } catch (popupError: any) {
      console.warn("Popup failed, error code:", popupError.code, popupError.message);
      
      // If popup is blocked or fails, fall back to redirect
      if (popupError.code === 'auth/popup-blocked' || 
          popupError.code === 'auth/cancelled-popup-request' ||
          popupError.code === 'auth/popup-closed-by-user' ||
          popupError.code === 'auth/internal-error') {
        
        console.log("Falling back to signInWithRedirect...");
        try {
          await signInWithRedirect(auth, googleProvider);
          return { user: null, redirecting: true };
        } catch (redirectError: any) {
          console.error("Redirect failed too:", redirectError);
          return { user: null, error: "O login foi bloqueado pelo seu navegador. Por favor, permita pop-ups ou tente outro navegador." };
        }
      }
      return { user: null, error: popupError.message };
    }
  },

  inviteTeamMember: async (email: string, role: 'ADMIN' | 'CLIENT', jobTitle: string) => {
    const invRef = doc(collection(db, 'invitations'));
    await setDoc(invRef, {
      email,
      role,
      jobTitle,
      createdAt: new Date().toISOString()
    });
  },

  logout: async () => {
    await signOut(auth);
  },

  getUserProfile: async (uid: string): Promise<User | null> => {
    const path = `profiles/${uid}`;
    try {
      const profileRef = doc(db, 'profiles', uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        return { id: uid, ...profileSnap.data() } as User;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  createUserProfile: async (uid: string, data: { email: string; name: string; role: 'ADMIN' | 'CLIENT'; photoURL?: string }) => {
    const path = `profiles/${uid}`;
    try {
      const profileRef = doc(db, 'profiles', uid);
      const payload = { ...data, uid, archived: false };
      await setDoc(profileRef, payload);
      return { id: uid, ...payload } as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  createUser: async (name: string, email: string, role: 'CLIENT' | 'ADMIN', whatsapp?: string, jobTitle?: string) => {
    const path = 'profiles';
    try {
      const newProfileRef = doc(collection(db, 'profiles'));
      const payload: any = { name, email, role, uid: newProfileRef.id, archived: false };
      if (whatsapp !== undefined) payload.whatsapp = whatsapp;
      if (jobTitle !== undefined) payload.jobTitle = jobTitle;

      await setDoc(newProfileRef, payload);
      return { id: newProfileRef.id, ...payload };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    const path = `profiles/${id}`;
    try {
      const ref = doc(db, 'profiles', id);
      
      // Helper to remove undefined values
      const removeUndefined = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(removeUndefined);
        } else if (obj !== null && typeof obj === 'object') {
          const newObj: any = {};
          Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined) {
              newObj[key] = removeUndefined(obj[key]);
            }
          });
          return newObj;
        }
        return obj;
      };

      const sanitizedUpdates = removeUndefined(updates);

      await updateDoc(ref, sanitizedUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteUser: async (id: string) => {
    const path = `profiles/${id}`;
    try {
      await deleteDoc(doc(db, 'profiles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  getAllUsers: async () => {
    const path = 'profiles';
    try {
      const q = query(collection(db, 'profiles'), orderBy('name'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  // --- TEMPLATES ---
  getTemplates: async (): Promise<CaseTemplate[]> => {
    try {
      const snap = await getDocs(collection(db, 'templates'));
      const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const stepsSnap = await getDocs(collection(db, 'template_steps'));
      const allSteps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      return templates.map((t: any) => ({
        id: t.id,
        label: t.label,
        isSystem: t.isSystem,
        steps: allSteps
          .filter((s: any) => s.templateId === t.id)
          .sort((a: any, b: any) => a.stepOrder - b.stepOrder)
          .map((s: any) => ({
            id: s.id,
            label: s.label,
            expectedDuration: s.expectedDuration,
            stepOrder: s.stepOrder
          }))
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'templates');
      return [];
    }
  },

  createTemplate: async (label: string) => {
    const newRef = doc(collection(db, 'templates'));
    await setDoc(newRef, { label, isSystem: false });
    return { id: newRef.id, label, steps: [], isSystem: false };
  },

  deleteTemplate: async (id: string) => {
    await deleteDoc(doc(db, 'templates', id));
  },

  addTemplateStep: async (templateId: string, label: string, duration: number, positionIndex?: number) => {
    const stepsRef = collection(db, 'template_steps');
    
    if (positionIndex !== undefined) {
      const q = query(stepsRef, where('templateId', '==', templateId), where('stepOrder', '>=', positionIndex));
      const snap = await getDocs(q);
      
      for (const d of snap.docs) {
        await updateDoc(doc(db, 'template_steps', d.id), { stepOrder: d.data().stepOrder + 1 });
      }

      await addDoc(stepsRef, {
        templateId,
        label,
        expectedDuration: duration,
        stepOrder: positionIndex
      });
    } else {
      const q = query(stepsRef, where('templateId', '==', templateId));
      const snap = await getDocs(q);
      const maxOrder = snap.size;

      await addDoc(stepsRef, {
        templateId,
        label,
        expectedDuration: duration,
        stepOrder: maxOrder
      });
    }
  },

  deleteTemplateStep: async (templateId: string, stepId: string) => {
    const stepRef = doc(db, 'template_steps', stepId);
    const stepSnap = await getDoc(stepRef);
    if (!stepSnap.exists()) return;
    
    const stepOrder = stepSnap.data().stepOrder;
    await deleteDoc(stepRef);

    const q = query(collection(db, 'template_steps'), where('templateId', '==', templateId), where('stepOrder', '>', stepOrder));
    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
      await updateDoc(doc(db, 'template_steps', d.id), { stepOrder: d.data().stepOrder - 1 });
    }
  },

  // --- CASES ---
  getCasesByClient: async (clientId: string) => {
    const path = 'cases';
    try {
      const q = query(collection(db, 'cases'), where('clientId', '==', clientId));
      const snap = await getDocs(q);
      const cases = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (cases.length === 0) return [];

      const caseIds = cases.map(c => c.id);
      const steps: any[] = [];
      for (let i = 0; i < caseIds.length; i += 10) {
        const chunk = caseIds.slice(i, i + 10);
        const stepsQ = query(collection(db, 'steps'), where('caseId', 'in', chunk));
        const stepsSnap = await getDocs(stepsQ);
        steps.push(...stepsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }

      const clientSnap = await getDoc(doc(db, 'profiles', clientId));
      const clientName = clientSnap.exists() ? clientSnap.data().name : 'Desconhecido';

      return cases.map(c => mapCaseFromDB(c, steps, clientName));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  getAllCases: async () => {
    const path = 'cases';
    try {
      const snap = await getDocs(collection(db, 'cases'));
      const cases = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      const stepsSnap = await getDocs(collection(db, 'steps'));
      const steps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      const profilesSnap = await getDocs(collection(db, 'profiles'));
      const profiles = profilesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      return cases.map(c => {
        const client = profiles.find(p => p.id === c.clientId);
        return mapCaseFromDB(c, steps, client?.name);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  addCase: async (clientId: string, templateId: string, title: string, benefitType?: BenefitType, responsibleLawyer?: string, caseNumber?: string, expertiseDate?: string, orientations?: string, alerts?: string) => {
    const newCaseRef = doc(collection(db, 'cases'));
    const caseData = {
      clientId,
      templateId,
      caseType: templateId,
      benefitType: benefitType || null,
      title,
      responsibleLawyer: responsibleLawyer || null,
      caseNumber: caseNumber || null,
      expertiseDate: expertiseDate || null,
      expertises: [],
      orientations: orientations || null,
      alerts: alerts || null,
      startDate: new Date().toISOString(),
      status: 'ACTIVE'
    };
    await setDoc(newCaseRef, caseData);

    const tStepsQ = query(collection(db, 'template_steps'), where('templateId', '==', templateId), orderBy('stepOrder'));
    const tStepsSnap = await getDocs(tStepsQ);

    const batch = [];
    let idx = 0;
    for (const s of tStepsSnap.docs) {
      const stepData = s.data();
      const newStepRef = doc(collection(db, 'steps'));
      await setDoc(newStepRef, {
        caseId: newCaseRef.id,
        label: stepData.label,
        status: idx === 0 ? 'CURRENT' : 'LOCKED',
        stepOrder: idx,
        expectedDuration: stepData.expectedDuration
      });
      idx++;
    }

    return { id: newCaseRef.id, ...caseData };
  },

  updateStep: async (caseId: string, stepId: string, comment: string | null, action: 'COMPLETE' | 'COMMENT_ONLY' | 'UPDATE_LABEL' | 'REOPEN', newLabel?: string, completionDate?: string, newDuration?: number, appointmentDate?: string) => {
    const updates: any = {};
    if (comment !== null) updates.adminComment = comment;
    if (newLabel) updates.label = newLabel;
    if (newDuration !== undefined) updates.expectedDuration = newDuration;
    if (appointmentDate !== undefined) updates.appointmentDate = appointmentDate;
    
    if (action === 'COMPLETE') {
      updates.status = 'COMPLETED';
      updates.completedDate = completionDate || new Date().toISOString();
    } else if (action === 'REOPEN') {
      updates.status = 'CURRENT';
      updates.completedDate = null;
    }

    await updateDoc(doc(db, 'steps', stepId), updates);

    if (action === 'COMPLETE') {
      const stepSnap = await getDoc(doc(db, 'steps', stepId));
      if (stepSnap.exists()) {
        const currentOrder = stepSnap.data().stepOrder;
        const q = query(collection(db, 'steps'), where('caseId', '==', caseId), where('stepOrder', '>', currentOrder), orderBy('stepOrder', 'asc'));
        const nextStepsSnap = await getDocs(q);
        if (!nextStepsSnap.empty) {
          const nextStep = nextStepsSnap.docs[0];
          await updateDoc(doc(db, 'steps', nextStep.id), { status: 'CURRENT' });
        }
      }
    } else if (action === 'REOPEN') {
      const stepSnap = await getDoc(doc(db, 'steps', stepId));
      if (stepSnap.exists()) {
        const currentOrder = stepSnap.data().stepOrder;
        const q = query(collection(db, 'steps'), where('caseId', '==', caseId), where('stepOrder', '>', currentOrder));
        const nextStepsSnap = await getDocs(q);
        for (const d of nextStepsSnap.docs) {
          await updateDoc(doc(db, 'steps', d.id), { status: 'LOCKED', completedDate: null });
        }
      }
    }
  },

  addStep: async (caseId: string, label: string, position: number, duration: number) => {
    const q = query(collection(db, 'steps'), where('caseId', '==', caseId), where('stepOrder', '>=', position));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(doc(db, 'steps', d.id), { stepOrder: d.data().stepOrder + 1 });
    }

    await addDoc(collection(db, 'steps'), {
      caseId,
      label,
      status: 'LOCKED',
      stepOrder: position,
      expectedDuration: duration
    });
  },

  deleteStep: async (stepId: string) => {
    await deleteDoc(doc(db, 'steps', stepId));
  },

  updateCaseStatus: async (caseId: string, status: CaseStatus) => {
    await updateDoc(doc(db, 'cases', caseId), { status });
  },

  deleteCase: async (caseId: string) => {
    await deleteDoc(doc(db, 'cases', caseId));
  },

  updateCaseTitle: async (caseId: string, newTitle: string) => {
    await updateDoc(doc(db, 'cases', caseId), { title: newTitle });
  },

  updateCaseDetails: async (caseId: string, updates: Partial<LegalCase>) => {
    const removeUndefined = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(removeUndefined);
      else if (obj !== null && typeof obj === 'object') {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined) newObj[key] = removeUndefined(obj[key]);
        });
        return newObj;
      }
      return obj;
    };
    await updateDoc(doc(db, 'cases', caseId), removeUndefined(updates));
  },

  getDocuments: async (caseId: string): Promise<CaseDocument[]> => {
    const q = query(collection(db, 'documents'), where('caseId', '==', caseId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CaseDocument));
  },

  uploadDocumentMetadata: async (caseId: string, name: string, url: string, type: string, stepId?: string) => {
    await addDoc(collection(db, 'documents'), {
      caseId,
      stepId: stepId || null,
      name,
      url,
      type,
      uploadedAt: new Date().toISOString()
    });
  },

  deleteDocumentMetadata: async (docId: string) => {
    await deleteDoc(doc(db, 'documents', docId));
  },

  transformToJudicial: async (oldCase: LegalCase) => {
    await updateDoc(doc(db, 'cases', oldCase.id), { status: 'MOVED_TO_JUDICIAL' });

    const snap = await getDocs(collection(db, 'templates'));
    const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    let targetTemplateId = 'JUDICIAL_PREVIDENCIARIO';
    const judPrevExists = templates.find(t => t.id === 'JUDICIAL_PREVIDENCIARIO');
    if (!judPrevExists) {
      const genericJud = templates.find(t => t.id === 'GENERICO_JUDICIAL');
      if (genericJud) targetTemplateId = genericJud.id;
    }

    const newCaseRef = doc(collection(db, 'cases'));
    const caseData = {
      clientId: oldCase.clientId,
      templateId: targetTemplateId,
      caseType: targetTemplateId,
      benefitType: oldCase.benefitType || null,
      title: `Judicial: ${oldCase.title}`,
      responsibleLawyer: oldCase.responsibleLawyer || null,
      startDate: new Date().toISOString(),
      status: 'ACTIVE'
    };
    await setDoc(newCaseRef, caseData);

    const tStepsQ = query(collection(db, 'template_steps'), where('templateId', '==', targetTemplateId), orderBy('stepOrder'));
    const tStepsSnap = await getDocs(tStepsQ);

    let idx = 0;
    for (const s of tStepsSnap.docs) {
      const stepData = s.data();
      await addDoc(collection(db, 'steps'), {
        caseId: newCaseRef.id,
        label: stepData.label,
        status: idx === 0 ? 'CURRENT' : 'LOCKED',
        stepOrder: idx,
        expectedDuration: stepData.expectedDuration
      });
      idx++;
    }

    return { id: newCaseRef.id, ...caseData };
  },

  // --- STORAGE ---
  uploadFileToStorage: async (caseId: string, fileName: string, fileBlob: Blob, uploadedBy?: string, uploaderRole?: string) => {
    console.log(`Uploading file to storage: ${caseId}/${fileName}`, { type: fileBlob.type, size: fileBlob.size });
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, ''); 
    const finalName = safeFileName || `doc_${Date.now()}`;
    
    let ext = '.jpg';
    if (fileBlob.type === 'application/pdf') ext = '.pdf';
    else if (fileBlob.type === 'image/png') ext = '.png';
    else if (fileBlob.type === 'image/gif') ext = '.gif';
    else if (fileBlob.type === 'image/webp') ext = '.webp';
    
    const finalNameClean = finalName.toLowerCase().endsWith(ext) ? finalName.slice(0, -ext.length) : finalName;
    
    const path = `${caseId}/${Date.now()}_${finalNameClean}${ext}`;
    const storageRef = ref(storage, path);

    const metadata: any = { customMetadata: {} };
    if (uploadedBy) metadata.customMetadata.uploadedBy = uploadedBy;
    if (uploaderRole) metadata.customMetadata.uploaderRole = uploaderRole;

    try {
      await uploadBytes(storageRef, fileBlob, metadata);
      const url = await getDownloadURL(storageRef);
      console.log("File uploaded successfully, URL:", url);
      return { path, url };
    } catch (error) {
      console.error("Error in uploadFileToStorage:", error);
      throw error;
    }
  },
  
  deleteFileFromStorage: async (caseId: string, fileName: string) => {
    const storageRef = ref(storage, `${caseId}/${fileName}`);
    await deleteObject(storageRef);
  },

  testConnection: async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("Firestore connection test successful.");
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. The client is offline.");
      }
    }
  },

  seedDefaultTemplates: async () => {
    const systemTemplates = [
      {
        id: 'ADMINISTRATIVO_PREVIDENCIARIO',
        label: 'Processo Administrativo',
        steps: [
          { label: 'Envio da documentação pelo cliente', expectedDuration: 30 },
          { label: 'Confecção do processo administrativo', expectedDuration: 30 },
          { label: 'Protocolo / Entrada do processo', expectedDuration: 0 },
          { label: 'Exigência do INSS', expectedDuration: 30 },
          { label: 'Perícia Médica', expectedDuration: 0 },
          { label: 'Perícia Social', expectedDuration: 0 },
          { label: 'Aguardar Decisão / Exigência', expectedDuration: 30 },
          { label: 'Mandado de Segurança (se > 90 dias)', expectedDuration: 90 },
          { label: 'Resultado Final (Concedido/Indeferido)', expectedDuration: 0 }
        ]
      },
      {
        id: 'JUDICIAL_PREVIDENCIARIO',
        label: 'Processo Judicial',
        steps: [
          { label: 'Envio da documentação pelo cliente', expectedDuration: 30 },
          { label: 'Confecção do processo judicial', expectedDuration: 30 },
          { label: 'Protocolo da ação no tribunal', expectedDuration: 0 },
          { label: 'Contestação do réu', expectedDuration: 0 },
          { label: 'Despacho do juiz', expectedDuration: 0 },
          { label: 'Perícia Médica', expectedDuration: 0 },
          { label: 'Perícia Social', expectedDuration: 0 },
          { label: 'Réplica ou Impugnação do laudo', expectedDuration: 0 },
          { label: 'Sentença', expectedDuration: 0 },
          { label: 'Recurso (Favorável ou Desfavorável)', expectedDuration: 0 },
          { label: 'Execução', expectedDuration: 0 },
          { label: 'Pagamento', expectedDuration: 0 }
        ]
      }
    ];

    for (const sysT of systemTemplates) {
      const tRef = doc(db, 'templates', sysT.id);
      const tSnap = await getDoc(tRef);
      
      if (!tSnap.exists()) {
        await setDoc(tRef, { label: sysT.label, isSystem: true });
      }

      // Check steps for this template
      const stepsQ = query(collection(db, 'template_steps'), where('templateId', '==', sysT.id));
      const stepsSnap = await getDocs(stepsQ);
      
      if (stepsSnap.empty) {
        console.log(`Seeding steps for ${sysT.id}...`);
        for (let i = 0; i < sysT.steps.length; i++) {
          await addDoc(collection(db, 'template_steps'), {
            templateId: sysT.id,
            label: sysT.steps[i].label,
            expectedDuration: sysT.steps[i].expectedDuration,
            stepOrder: i
          });
        }
      }
    }

    console.log("System templates check/seed completed.");
  },

  updateTemplateStep: async (stepId: string, updates: { label?: string, expectedDuration?: number }) => {
    await updateDoc(doc(db, 'template_steps', stepId), updates);
  },

  reorderTemplateSteps: async (templateId: string, stepIdsInOrder: string[]) => {
    for (let i = 0; i < stepIdsInOrder.length; i++) {
      await updateDoc(doc(db, 'template_steps', stepIdsInOrder[i]), { stepOrder: i });
    }
  },

  reorderCaseSteps: async (caseId: string, stepIdsInOrder: string[]) => {
    for (let i = 0; i < stepIdsInOrder.length; i++) {
      await updateDoc(doc(db, 'steps', stepIdsInOrder[i]), { stepOrder: i });
    }
  },

  // --- TEAM ---
  getTeamMembers: async (): Promise<TeamMember[]> => {
    try {
      const q = query(collection(db, 'team'), orderBy('order'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TeamMember));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'team');
      return [];
    }
  },

  updateTeamMember: async (id: string, updates: Partial<TeamMember>) => {
    const path = `team/${id}`;
    try {
      const { id: _, ...cleanUpdates } = updates as any;
      await updateDoc(doc(db, 'team', id), cleanUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteTeamMember: async (id: string) => {
    const path = `team/${id}`;
    try {
      await deleteDoc(doc(db, 'team', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  addTeamMember: async (member: Omit<TeamMember, 'id'>) => {
    const path = 'team';
    try {
      const newRef = doc(collection(db, 'team'));
      await setDoc(newRef, member);
      return { id: newRef.id, ...member };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  seedTeamMembers: async () => {
    const teamRef = collection(db, 'team');
    const snap = await getDocs(teamRef);
    
    // If there's already data, don't seed
    if (!snap.empty) return;

    const initialTeam = [
      {
        name: "Dr. Michel Felix",
        role: "Advogado Sócio",
        specialty: "Especialista em Direito Previdenciário (RGPS)",
        image: "https://picsum.photos/seed/michel/400/500",
        description: "Atuação especializada na área de benefícios previdenciários.",
        order: 0
      },
      {
        name: "Dra. Luana Castro",
        role: "Advogada Sócia",
        specialty: "Especialista em Direito Previdenciário (RGPS)",
        image: "https://picsum.photos/seed/luana/400/500",
        description: "Atuação especializada na área de benefícios previdenciários.",
        order: 1
      },
      {
        name: "Fabrícia Felix",
        role: "Secretária Executiva",
        specialty: "Gestão de Atendimento e Relacionamento",
        image: "https://picsum.photos/seed/fabricia/400/500",
        description: "O primeiro contato acolhedor e eficiente que garante a organização do seu processo.",
        order: 2
      }
    ];

    for (const member of initialTeam) {
      await addDoc(teamRef, member);
    }
    console.log("Team members seeded.");
  },

  clearDuplicateTeamMembers: async () => {
    const teamRef = collection(db, 'team');
    const snap = await getDocs(teamRef);
    const seen = new Set();
    for (const d of snap.docs) {
      const data = d.data();
      const key = `${data.name}-${data.role}`;
      if (seen.has(key)) {
        await deleteDoc(doc(db, 'team', d.id));
      } else {
        seen.add(key);
      }
    }
  }
};
