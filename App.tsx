
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { User, LegalCase, Step, CaseType, BenefitType, CaseTemplate, TemplateStep, TeamMember } from './types';
import { firebaseService, mapCaseFromDB } from './services/firebaseService';
import { Timeline } from './components/Timeline';
import { StepModal } from './components/StepModal';
import { CaseChatbot } from './components/CaseChatbot';
import { FloatingSupport } from './components/FloatingSupport';
import { LandingPage } from './components/LandingPage';
import { QualificationCard } from './components/QualificationCard';
import { QualificationModal } from './components/QualificationModal';
import { ClientProfile } from './components/ClientProfile';
import Markdown from 'react-markdown';
import { Scale, LogOut, User as UserIcon, FileText, Briefcase, Users, PlusCircle, Moon, Sun, MessageCircle, Gavel, CheckCheck, ArrowRightLeft, Edit, Trash2, Archive, ChevronLeft, ChevronRight, Search, Lock, Unlock, Settings, List, Plus, X, MoreVertical, Wifi, WifiOff, RefreshCw, Globe, BriefcaseIcon, Shield, AlertTriangle, AlertCircle, Bot, Calculator, Phone, Bell, Download, Camera, Loader2 } from 'lucide-react';
import { PREVIDENCIARIO_BENEFITS } from './constants';

const extractQualificationFromAnalysisData = (analysisData: any) => {
  if (!analysisData || !analysisData.formData) return undefined;
  const formData = analysisData.formData;
  
  let contributionTime = '';
  if (formData.contribYears || formData.contribMonths || formData.contribDays) {
    const parts = [];
    if (formData.contribYears) parts.push(`${formData.contribYears} anos`);
    if (formData.contribMonths) parts.push(`${formData.contribMonths} meses`);
    if (formData.contribDays) parts.push(`${formData.contribDays} dias`);
    contributionTime = parts.join(', ');
  }

  const qualification: any = {
    gender: formData.sex,
    age: formData.age,
    contributionTime: contributionTime || undefined,
    hasMedicalReport: formData.hasMedicalReport,
    cid: formData.illness, // Usually illness contains the CID or disability
    disabilityType: formData.illness, // We map illness to both, admin can refine
    lastContributionDate: formData.lastContribution,
    ppp: formData.hasPPP,
    documents: formData.documents,
    inssDenied: formData.inssDenied,
    courtDenied: formData.courtDenied,
  };

  // Remove undefined values to avoid Firestore errors
  Object.keys(qualification).forEach(key => {
    if (qualification[key] === undefined) {
      delete qualification[key];
    }
  });

  return Object.keys(qualification).length > 0 ? qualification : undefined;
};

const api = firebaseService;
const SESSION_KEY = 'fec_advocacia_session_v1';
const SECRETARY_WHATSAPP = '5521991267020'; // Fabrícia Felix

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      let details = "";
      
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
          errorMessage = "Erro de Permissão: Você não tem autorização para realizar esta operação ou acessar estes dados.";
          details = `Operação: ${parsed.operationType}, Caminho: ${parsed.path}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 text-center border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-serif text-red-950 dark:text-red-100 mb-2">Ops! Algo deu errado</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{errorMessage}</p>
            {details && (
              <div className="text-xs text-left bg-gray-100 dark:bg-gray-800 p-3 rounded mb-6 font-mono overflow-auto max-h-32">
                {details}
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-800 hover:bg-red-900 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface AppNotification {
  id: string;
  caseId: string;
  title: string;
  message: string;
  date: string;
  type: 'EXAM' | 'HEARING' | 'OTHER';
}

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // View State
  const [view, setView] = useState<'LANDING' | 'DASHBOARD' | 'CASE_DETAIL' | 'CLIENT_MANAGER' | 'TEMPLATE_MANAGER' | 'TEAM_MANAGER'>('LANDING');
  
  // Data State
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [users, setUsers] = useState<User[]>([]); 
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const [activeCase, setActiveCase] = useState<LegalCase | null>(null);
  const [activeStep, setActiveStep] = useState<Step | null>(null);

  // Auth State
  const [error, setError] = useState('');

  // Dashboard Actions State
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Admin
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminJobTitle, setNewAdminJobTitle] = useState('Advogado(a)');

  // New Case
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newCaseTemplateId, setNewCaseTemplateId] = useState<string>('');
  const [newBenefitType, setNewBenefitType] = useState<BenefitType | ''>(''); 
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseResponsibleLawyer, setNewCaseResponsibleLawyer] = useState('');
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newCaseExpertiseDate, setNewCaseExpertiseDate] = useState('');
  const [newCaseOrientations, setNewCaseOrientations] = useState('');
  const [newCaseAlerts, setNewCaseAlerts] = useState('');
  
  // Template Manager State
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CaseTemplate | null>(null);
  const [newTemplateStepLabel, setNewTemplateStepLabel] = useState('');
  const [newTemplateStepDuration, setNewTemplateStepDuration] = useState(15);
  const [newTemplateStepPosition, setNewTemplateStepPosition] = useState('END'); // 'END', 'START', or Index

  // Client/User Manager State
  const [userFilter, setUserFilter] = useState<'ALL' | 'TEAM' | 'CLIENTS'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedQualificationUser, setSelectedQualificationUser] = useState<User | null>(null);

  // Modals
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [isEditingCaseDetails, setIsEditingCaseDetails] = useState(false);
  const [isEditingCaseTitle, setIsEditingCaseTitle] = useState(false);
  const [tempCaseTitle, setTempCaseTitle] = useState('');
  const [editingCaseIdForTitle, setEditingCaseIdForTitle] = useState<string | null>(null);
  const [tempCaseListTitle, setTempCaseListTitle] = useState('');
  const [editCaseDetails, setEditCaseDetails] = useState<Partial<LegalCase>>({});
  const [editingTemplateStepId, setEditingTemplateStepId] = useState<string | null>(null);
  const [tempTemplateStep, setTempTemplateStep] = useState({ label: '', expectedDuration: 0 });
  const [editingTeamMemberId, setEditingTeamMemberId] = useState<string | null>(null);
  const [tempTeamMember, setTempTeamMember] = useState<Partial<TeamMember>>({});
  const [tempTeamImageFile, setTempTeamImageFile] = useState<File | null>(null);
  const [uploadingTeamImage, setUploadingTeamImage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if it's iOS and not already installed
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    
    if (isIOS && !isStandalone) {
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback for iOS or already installed
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert('Para instalar no iOS: toque no ícone de Compartilhar e depois em "Adicionar à Tela de Início".');
      } else {
        alert('O aplicativo já está instalado ou seu navegador não suporta instalação direta. Tente instalar pelo menu do navegador.');
      }
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role === 'CLIENT' && cases.length > 0) {
      const newNotifications: AppNotification[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ninetyDaysFromNow = new Date(today);
      ninetyDaysFromNow.setDate(today.getDate() + 90);

      cases.forEach(c => {
        // Check steps for appointmentDate
        c.steps.forEach(step => {
          if (step.appointmentDate) {
            const appDate = new Date(step.appointmentDate);
            appDate.setHours(0, 0, 0, 0);
            
            if (appDate >= today && appDate <= ninetyDaysFromNow) {
              newNotifications.push({
                id: `${c.id}-${step.id}`,
                caseId: c.id,
                title: step.label,
                message: `Olá ${formatName(currentUser.name)}, você tem uma ${step.label.toLowerCase()} marcada para o dia ${new Date(step.appointmentDate).toLocaleDateString('pt-BR')}. Não se esqueça! Entre no seu processo e pergunte no robozinho para tirar suas dúvidas.`,
                date: step.appointmentDate,
                type: step.label.toLowerCase().includes('perícia') ? 'EXAM' : step.label.toLowerCase().includes('audiência') ? 'HEARING' : 'OTHER'
              });
            }
          }
        });

        // Check expertises
        if (c.expertises) {
          c.expertises.forEach(exp => {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            
            if (expDate >= today && expDate <= ninetyDaysFromNow) {
              newNotifications.push({
                id: `${c.id}-${exp.id}`,
                caseId: c.id,
                title: exp.name,
                message: `Olá ${formatName(currentUser.name)}, você tem uma ${exp.name.toLowerCase()} marcada para o dia ${new Date(exp.date).toLocaleDateString('pt-BR')} às ${exp.time}. Não se esqueça! Entre no seu processo e pergunte no robozinho para tirar suas dúvidas.`,
                date: exp.date,
                type: 'EXAM'
              });
            }
          });
        }
      });

      setNotifications(newNotifications);
    } else {
      setNotifications([]);
    }
  }, [currentUser, cases]);

  const NotificationBell = () => {
    if (currentUser?.role !== 'CLIENT') return null;

    return (
      <div className="relative">
        <button 
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-2.5 text-slate-500 hover:text-bordo-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all relative"
          title="Alertas"
        >
          <Bell className="w-5 h-5" />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-widest">Alertas Importantes</h4>
              <button onClick={() => setShowNotifications(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Nenhum alerta no momento.</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    className="p-4 border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => {
                      const c = cases.find(caseItem => caseItem.id === notif.caseId);
                      if (c) {
                        setActiveCase(c);
                        setView('CASE_DETAIL');
                        setShowNotifications(false);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-bordo-100 dark:bg-bordo-900/20 p-2 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-bordo-900 dark:text-bordo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{notif.title}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleDownloadClientReport = (client: User) => {
    const q = client.qualification;
    const report = `
RELATÓRIO DO CLIENTE: ${formatName(client.name).toUpperCase()}
--------------------------------------------------
DADOS DE CONTATO:
E-mail: ${client.email || 'Não informado'}
WhatsApp: ${client.whatsapp || 'Não informado'}
Endereço: ${client.address || 'Não informado'}

QUALIFICAÇÃO TÉCNICA:
Gênero: ${q?.gender || 'Não informado'}
Idade: ${q?.age || 'Não informado'}
Tempo de Contribuição: ${q?.contributionTime || 'Não informado'}
Possui Laudo Médico: ${q?.hasMedicalReport ? 'Sim' : 'Não / Não Informado'}
CID / Doença: ${q?.cid || 'Não informado'}
Tipo de Deficiência: ${q?.disabilityType || 'Não informado'}
Última Contribuição: ${q?.lastContributionDate || 'Não informado'}
Possui PPP: ${q?.ppp ? 'Sim' : 'Não / Não Informado'}
INSS Negado: ${q?.inssDenied || 'Não informado'}
Justiça Negada: ${q?.courtDenied || 'Não informado'}

RESULTADO DA ANÁLISE IA:
${client.analysisResult || 'Nenhuma análise realizada.'}
--------------------------------------------------
Gerado em: ${new Date().toLocaleString('pt-BR')}
    `;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${client.name.replace(/\s+/g, '_').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- PERSISTÊNCIA DE SESSÃO ---
  useEffect(() => {
    api.testConnection();
    
    let authSettled = false;
    let redirectChecked = false;

    // Detect if we are returning from a Firebase Auth redirect
    const isReturningFromRedirect = window.location.search.includes('apiKey') || 
                                   window.location.hash.includes('access_token') ||
                                   window.location.search.includes('mode=signIn') ||
                                   window.location.search.includes('__firebase_request_key');
    
    if (isReturningFromRedirect) {
      console.log("Detected return from redirect, setting isLoggingIn to true");
      setIsLoggingIn(true);
    }

    const checkRedirect = async () => {
      console.log("Checking for redirect result...");
      try {
        const result = await api.getRedirectResult();
        if (result?.user) {
          console.log("Redirect result found user:", result.user.email);
        } else {
          console.log("No redirect result found.");
        }
      } catch (err) {
        console.error("Redirect result error:", err);
        setError("Erro ao processar o login do Google no celular. Verifique se o domínio está autorizado.");
      } finally {
        redirectChecked = true;
        if (authSettled) setLoading(false);
      }
    };

    checkRedirect();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser ? `User: ${firebaseUser.email}` : "No user");
      if (firebaseUser) {
        try {
          console.log("Fetching profile for UID:", firebaseUser.uid);
          let profile = await api.getUserProfile(firebaseUser.uid);
          if (profile) {
            console.log("Profile found, role:", profile.role);
            
            // Force role correction for specific emails
            const isFelix = firebaseUser.email === 'felixecastroadv@gmail.com';
            const isMichel = firebaseUser.email === 'michelgeminicriador@gmail.com';
            
            if (isFelix && profile.role !== 'ADMIN') {
              console.log("Forcing ADMIN role for Felix");
              await api.updateUser(profile.id, { role: 'ADMIN' });
              profile.role = 'ADMIN';
            }
            
            if (isMichel && (profile.role === 'ADMIN' || profile.jobTitle)) {
              console.log("Forcing CLIENT role for Michel");
              await api.updateUser(profile.id, { role: 'CLIENT', jobTitle: '' });
              profile.role = 'CLIENT';
              profile.jobTitle = '';
            }

            if (profile.role === 'ADMIN') {
              api.seedDefaultTemplates().catch(console.error);
            }
            // Check for pending analysis
            const pendingResult = localStorage.getItem('pending_analysis_result');
            const pendingData = localStorage.getItem('pending_analysis_data');
            
            if (pendingResult) {
              const parsedData = pendingData ? JSON.parse(pendingData) : null;
              const qualification = extractQualificationFromAnalysisData(parsedData);
              const updates: any = {};
              
              if (!profile.analysisResult) {
                updates.analysisResult = pendingResult;
                updates.analysisData = parsedData;
              }
              
              if (qualification && (!profile.qualification || Object.keys(profile.qualification).length === 0)) {
                updates.qualification = qualification;
              }
              
              if (Object.keys(updates).length > 0) {
                await api.updateUser(profile.id, updates);
                profile = { ...profile, ...updates };
              }
              
              localStorage.removeItem('pending_analysis_result');
              localStorage.removeItem('pending_analysis_data');
            }

            setCurrentUser(profile);
            console.log("Setting view to DASHBOARD");
            // Redireciona para o dashboard se estiver na landing page
            setView(currentView => currentView === 'LANDING' ? 'DASHBOARD' : currentView);
            setIsLoggingIn(false);
          } else {
            console.log("Profile not found, creating new profile for:", firebaseUser.email);
            const isFelix = firebaseUser.email === 'felixecastroadv@gmail.com';
            const newProfile = await api.createUserProfile(firebaseUser.uid, {
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'Usuário',
              role: isFelix ? 'ADMIN' : 'CLIENT',
              photoURL: firebaseUser.photoURL || undefined
            });
            setCurrentUser(newProfile);
            setView(currentView => currentView === 'LANDING' ? 'DASHBOARD' : currentView);
            setIsLoggingIn(false);
          }
        } catch (e) {
          console.error("Erro ao carregar perfil na persistência:", e);
          setIsLoggingIn(false);
        }
      } else {
        console.log("No firebase user in onAuthStateChanged");
        // Se não há usuário no Firebase, limpamos o state local
        setCurrentUser(null);
        setView('LANDING');
        setIsLoggingIn(false);
      }
      authSettled = true;
      if (redirectChecked) setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const storedDarkMode = localStorage.getItem('fec_dark_mode');
    if (storedDarkMode === 'true') setDarkMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('fec_dark_mode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Real-time listener for current user profile
  useEffect(() => {
    if (!currentUser?.id) return;
    
    const unsubProfile = onSnapshot(doc(db, 'profiles', currentUser.id), (snap) => {
      if (snap.exists()) {
        const profileData = { id: snap.id, ...snap.data() } as User;
        setCurrentUser(prev => {
          // Only update if there are actual changes to avoid unnecessary re-renders
          if (JSON.stringify(prev) !== JSON.stringify(profileData)) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(profileData));
            return profileData;
          }
          return prev;
        });
      }
    });

    return () => unsubProfile();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;

    let unsubCases: () => void;
    let unsubSteps: () => void;
    let unsubUsers: () => void;

    let currentCasesRaw: any[] = [];
    let currentStepsRaw: any[] = [];
    let currentUsersRaw: any[] = [];

    const updateCases = () => {
      const mapped = currentCasesRaw.map(c => {
        const client = currentUsersRaw.find(u => u.id === c.clientId);
        return mapCaseFromDB(c, currentStepsRaw, client?.name);
      });
      setCases(mapped);
      
      setActiveCase(prev => {
        if (!prev) return prev;
        const updated = mapped.find(c => c.id === prev.id);
        return updated || prev;
      });
    };

    // Sempre carrega templates
    firebaseService.getTemplates().then(allTemplates => {
      setTemplates(allTemplates);
      if (allTemplates.length > 0 && !newCaseTemplateId) {
        setNewCaseTemplateId(allTemplates[0].id);
      }
    }).catch(console.error);

    if (currentUser.role === 'ADMIN') {
      if (!newCaseResponsibleLawyer) {
        setNewCaseResponsibleLawyer(currentUser.name);
      }

      unsubUsers = onSnapshot(collection(db, 'profiles'), (snap) => {
        const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
        setUsers(usersData);
        currentUsersRaw = usersData;
        updateCases();
      });

      unsubCases = onSnapshot(collection(db, 'cases'), (snap) => {
        currentCasesRaw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCases();
      });

      unsubSteps = onSnapshot(collection(db, 'steps'), (snap) => {
        currentStepsRaw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCases();
      });
    } else {
      // Client
      unsubUsers = onSnapshot(collection(db, 'profiles'), (snap) => {
        const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
        currentUsersRaw = usersData;
        updateCases();
      });

      const qCases = query(collection(db, 'cases'), where('clientId', '==', currentUser.id));
      unsubCases = onSnapshot(qCases, (snap) => {
        currentCasesRaw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCases();
      });

      unsubSteps = onSnapshot(collection(db, 'steps'), (snap) => {
        currentStepsRaw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCases();
      });
    }

    const unsubTeam = onSnapshot(collection(db, 'team'), (snap) => {
      const teamData = snap.docs.map(d => ({ id: d.id, ...d.data() })) as TeamMember[];
      setTeam(teamData.sort((a, b) => a.order - b.order));
    }, (err) => {
      console.error("Erro ao ouvir equipe:", err);
      setError("Erro ao carregar dados da equipe. Verifique suas permissões.");
    });

    return () => {
      if (unsubCases) unsubCases();
      if (unsubSteps) unsubSteps();
      if (unsubUsers) unsubUsers();
      unsubTeam();
    };
  }, [currentUser?.id, refreshKey]); 

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const handleManualRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoggingIn(true);
    try {
      const result = await api.loginWithGoogle();
      if (result.user) {
        loginUser(result.user);
      } else if (result.redirecting) {
        // Just wait for redirect
        console.log("Redirecting to Google login...");
      } else {
        setError(result.error || 'Erro ao entrar com Google.');
        setIsLoggingIn(false);
      }
    } catch (err) { 
      setError('Erro de conexão ou sistema.'); 
      setIsLoggingIn(false);
    }
  };

  const loginUser = async (user: User) => {
    let finalUser = user;
    
    // Check for pending analysis
    const pendingResult = localStorage.getItem('pending_analysis_result');
    const pendingData = localStorage.getItem('pending_analysis_data');
    
    if (pendingResult) {
      const parsedData = pendingData ? JSON.parse(pendingData) : null;
      const qualification = extractQualificationFromAnalysisData(parsedData);
      const updates: any = {};
      
      if (!user.analysisResult) {
        updates.analysisResult = pendingResult;
        updates.analysisData = parsedData;
      }
      
      if (qualification && (!user.qualification || Object.keys(user.qualification).length === 0)) {
        updates.qualification = qualification;
      }
      
      if (Object.keys(updates).length > 0) {
        await api.updateUser(user.id, updates);
        finalUser = { ...user, ...updates };
      }
      
      localStorage.removeItem('pending_analysis_result');
      localStorage.removeItem('pending_analysis_data');
    }

    setCurrentUser(finalUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(finalUser));
    setView('DASHBOARD');
  };

  const handleLogout = async () => {
    console.log("Botão Sair clicado");
    try {
      await api.logout();
      console.log("Logout no Firebase concluído");
    } catch (e) {
      console.error("Erro ao fazer logout no Firebase:", e);
    }
    // Limpeza garantida do estado local
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null); 
    setActiveCase(null); 
    setCases([]); 
    setView('LANDING');
    console.log("Estado local limpo, redirecionando para Landing");
  };

  // --- ACTIONS ---

  const handleAddCase = async () => {
    if (selectedClientId && newCaseTitle) {
      try {
        if (newCaseTemplateId === 'ADMINISTRATIVO_PREVIDENCIARIO' && !newBenefitType) {
          return;
        }
        // @ts-ignore
        await api.addCase(selectedClientId, newCaseTemplateId, newCaseTitle, newBenefitType as BenefitType, newCaseResponsibleLawyer, newCaseNumber, newCaseExpertiseDate, newCaseOrientations, newCaseAlerts);
        setNewCaseTitle(''); setSelectedClientId(''); setNewBenefitType('');
        setNewCaseNumber(''); setNewCaseExpertiseDate(''); setNewCaseOrientations(''); setNewCaseAlerts('');
        setRefreshKey(k => k + 1);
      } catch (e) { console.error('Erro ao criar processo:', e); }
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if ((api as any).deleteCase) {
      await (api as any).deleteCase(caseId);
      setRefreshKey(k => k + 1);
    }
  };

  const handleArchiveCase = async (caseId: string) => {
     await api.updateCaseStatus(caseId, 'CONCLUDED');
     setRefreshKey(k => k + 1);
  };

  const handleEditCaseTitle = async (c: LegalCase) => {
    setEditingCaseIdForTitle(c.id);
    setTempCaseListTitle(c.title);
  };

  const saveCaseListTitle = async (caseId: string) => {
    if (tempCaseListTitle) {
       // @ts-ignore
       if (api.updateCaseTitle) await api.updateCaseTitle(caseId, tempCaseListTitle);
       setEditingCaseIdForTitle(null);
       setRefreshKey(k => k + 1);
    }
  };

  const handleWhatsAppContact = (clientId: string) => {
    const client = users.find(c => c.id === clientId);
    if (client && client.whatsapp) {
      const num = client.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/55${num}?text=Olá ${formatName(client.name)}, entrando em contato sobre seu processo.`, '_blank');
    } else {
      alert("Este usuário não possui WhatsApp cadastrado.");
    }
  };

  // --- Detail Actions ---
  const handleConcludeCase = async () => {
    if (!activeCase || !currentUser) return;
    
    try {
      // @ts-ignore
      await api.updateCaseStatus(activeCase.id, 'CONCLUDED');
      
      // Atualiza o estado visual local imediatamente
      setActiveCase({ ...activeCase, status: 'CONCLUDED' });
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransformToJudicial = async () => {
    if (!activeCase || !currentUser) return;
    
    try {
      // @ts-ignore
      await api.transformToJudicial(activeCase);
      
      setView('DASHBOARD');
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error(e);
    }
  };

  // --- Template Manager Logic ---

  const handleCreateTemplate = async () => {
    if (!newTemplateName) return;
    try {
      await (api as any).createTemplate(newTemplateName);
      setNewTemplateName('');
      setRefreshKey(k => k + 1);
    } catch(e) { console.error('Erro ao criar template', e); }
  };

  const handleDeleteTemplate = async (id: string) => {
    await (api as any).deleteTemplate(id);
    setSelectedTemplate(null);
    setRefreshKey(k => k + 1);
  };

  const handleAddTemplateStep = async () => {
    if (selectedTemplate && newTemplateStepLabel) {
      // Determine position
      let pos: number | undefined = undefined;
      if (newTemplateStepPosition === 'START') pos = 0;
      else if (newTemplateStepPosition !== 'END') pos = Number(newTemplateStepPosition);

      await (api as any).addTemplateStep(selectedTemplate.id, newTemplateStepLabel, newTemplateStepDuration, pos);
      setNewTemplateStepLabel('');
      // Update local state to reflect immediately or wait refresh
      const updatedList = await (api as any).getTemplates();
      setTemplates(updatedList);
      const updatedSelected = updatedList.find((t: CaseTemplate) => t.id === selectedTemplate.id);
      setSelectedTemplate(updatedSelected || null);
    }
  };

  const handleDeleteTemplateStep = async (stepId: string) => {
     if (selectedTemplate) {
        await (api as any).deleteTemplateStep(selectedTemplate.id, stepId);
        const updatedList = await (api as any).getTemplates();
        setTemplates(updatedList);
        const updatedSelected = updatedList.find((t: CaseTemplate) => t.id === selectedTemplate.id);
        setSelectedTemplate(updatedSelected || null);
     }
  };

  // --- User Manager Logic (Unified) ---
  const handleUpdateUser = async (updatedUser: User) => {
    if ((api as any).updateUser) {
      await (api as any).updateUser(updatedUser.id, { 
        name: updatedUser.name, 
        pin: updatedUser.pin, 
        whatsapp: updatedUser.whatsapp, 
        archived: updatedUser.archived,
        jobTitle: updatedUser.jobTitle,
        role: updatedUser.role
      });
      setEditingUser(null); 
      setRefreshKey(k => k + 1);
    }
  };
  
  const handleDeleteUser = async (id: string) => {
    if ((api as any).deleteUser) { 
      await (api as any).deleteUser(id); 
      setRefreshKey(k => k + 1); 
    } 
  };
  
  const toggleArchiveUser = async (user: User) => {
    await handleUpdateUser({ ...user, archived: !user.archived });
  };
  
  const handleMoveTemplateStep = async (templateId: string, stepId: string, direction: 'UP' | 'DOWN') => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const steps = [...template.steps];
    const index = steps.findIndex(s => s.id === stepId);
    if (index === -1) return;
    
    if (direction === 'UP' && index > 0) {
      [steps[index], steps[index - 1]] = [steps[index - 1], steps[index]];
    } else if (direction === 'DOWN' && index < steps.length - 1) {
      [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
    } else {
      return;
    }
    
    await api.reorderTemplateSteps(templateId, steps.map(s => s.id));
    const updatedList = await api.getTemplates();
    setTemplates(updatedList);
    const updatedSelected = updatedList.find(t => t.id === templateId);
    setSelectedTemplate(updatedSelected || null);
  };

  const handleEditTemplateStep = async (stepId: string, currentLabel: string, currentDuration: number) => {
    setEditingTemplateStepId(stepId);
    setTempTemplateStep({ label: currentLabel, expectedDuration: currentDuration });
  };

  const saveTemplateStepEdit = async () => {
    if (!editingTemplateStepId) return;
    await api.updateTemplateStep(editingTemplateStepId, { 
      label: tempTemplateStep.label, 
      expectedDuration: tempTemplateStep.expectedDuration 
    });
    setEditingTemplateStepId(null);
    const updatedList = await api.getTemplates();
    setTemplates(updatedList);
    if (selectedTemplate) {
      const updatedSelected = updatedList.find(t => t.id === selectedTemplate.id);
      setSelectedTemplate(updatedSelected || null);
    }
  };

  const handleMoveCaseStep = async (caseId: string, stepId: string, direction: 'UP' | 'DOWN') => {
    if (!activeCase) return;
    const steps = [...activeCase.steps];
    const index = steps.findIndex(s => s.id === stepId);
    if (index === -1) return;

    if (direction === 'UP' && index > 0) {
      [steps[index], steps[index - 1]] = [steps[index - 1], steps[index]];
    } else if (direction === 'DOWN' && index < steps.length - 1) {
      [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
    } else {
      return;
    }

    await api.reorderCaseSteps(caseId, steps.map(s => s.id));
    setRefreshKey(k => k + 1);
  };

  // --- Team Manager Logic ---
  const handleUpdateTeamMember = async (id: string, updates: Partial<TeamMember>) => {
    await api.updateTeamMember(id, updates);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSaveTeamMember = async () => {
    if (!editingTeamMemberId) return;
    
    let finalImageUrl = tempTeamMember.image;
    
    if (tempTeamImageFile) {
      setUploadingTeamImage(editingTeamMemberId);
      try {
        // Compress image and convert to base64 to save directly in Firestore
        // This bypasses Firebase Storage which might not be enabled
        finalImageUrl = await compressImage(tempTeamImageFile);
      } catch (e: any) {
        console.error('Erro ao processar a imagem:', e);
        setError(`Erro ao processar imagem: ${e.message || 'Erro desconhecido'}`);
        setUploadingTeamImage(null);
        return;
      }
      setUploadingTeamImage(null);
    }

    await api.updateTeamMember(editingTeamMemberId, { ...tempTeamMember, image: finalImageUrl });
    setEditingTeamMemberId(null);
    setTempTeamImageFile(null);
  };

  const handleClearTeamDuplicates = async () => {
    try {
      await (api as any).clearDuplicateTeamMembers();
    } catch (err) {
      console.error("Erro ao limpar duplicados:", err);
    }
  };

  const handleDeleteTeamMember = async (id: string) => {
    try {
      await api.deleteTeamMember(id);
    } catch (err) {
      console.error("Erro ao remover membro:", err);
    }
  };

  const handleAddTeamMember = async () => {
    const newMember = {
      name: 'Novo Membro',
      role: 'Cargo',
      specialty: 'Especialidade',
      image: 'https://picsum.photos/seed/new/400/500',
      description: 'Descrição do membro.',
      order: team.length
    };
    await api.addTeamMember(newMember);
  };

  const handleMoveTeamMember = async (id: string, direction: 'UP' | 'DOWN') => {
    const index = team.findIndex(m => m.id === id);
    if (index === -1) return;

    const newTeam = [...team];
    if (direction === 'UP' && index > 0) {
      [newTeam[index], newTeam[index - 1]] = [newTeam[index - 1], newTeam[index]];
    } else if (direction === 'DOWN' && index < newTeam.length - 1) {
      [newTeam[index], newTeam[index + 1]] = [newTeam[index + 1], newTeam[index]];
    } else {
      return;
    }

    // Update orders in Firestore
    for (let i = 0; i < newTeam.length; i++) {
      if (newTeam[i].order !== i) {
        await api.updateTeamMember(newTeam[i].id, { order: i });
      }
    }
  };


  // Helpers
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span className="text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 px-2.5 py-1 rounded-full border border-green-100 dark:border-green-900/30">Ativo</span>;
      case 'CONCLUDED': return <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">Concluído</span>;
      case 'MOVED_TO_JUDICIAL': return <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 px-2.5 py-1 rounded-full border border-purple-100 dark:border-purple-900/30">Judicializado</span>;
      default: return null;
    }
  };
  
  // Filtering Cases for Dashboard
  const filteredCases = cases.filter(c => {
    const search = searchTerm.toLowerCase();
    const matchesTitle = c.title.toLowerCase().includes(search);
    const matchesClient = (c as any).clientName?.toLowerCase().includes(search);
    const matchesLawyer = c.responsibleLawyer?.toLowerCase().includes(search);
    const matchesStatus = c.status?.toLowerCase().includes(search);
    return matchesTitle || matchesClient || matchesLawyer || matchesStatus;
  });

  // User/Client Pagination
  const filteredUsers = users.filter(u => {
     if (userFilter === 'TEAM') return u.role === 'ADMIN';
     if (userFilter === 'CLIENTS') return u.role === 'CLIENT';
     return true;
  });
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handleAnalysisComplete = async (result: string, data: any) => {
    if (currentUser) {
      const qualification = extractQualificationFromAnalysisData(data);
      const updates: any = {};
      
      if (!currentUser.analysisResult) {
        updates.analysisResult = result;
        updates.analysisData = data;
      }
      
      if (qualification && (!currentUser.qualification || Object.keys(currentUser.qualification).length === 0)) {
        updates.qualification = qualification;
      }
      
      if (Object.keys(updates).length > 0) {
        await api.updateUser(currentUser.id, updates);
        const updatedUser = { ...currentUser, ...updates };
        setCurrentUser(updatedUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
      }
      
      localStorage.removeItem('pending_analysis_result');
      localStorage.removeItem('pending_analysis_data');
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-12 h-12 text-bordo-900 animate-spin" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">Carregando...</p>
          </div>
        </div>
      ) : (
        <div className="min-h-screen transition-colors duration-300 bg-slate-100 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100">
        
        <button onClick={toggleTheme} className="fixed top-4 right-4 z-50 p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-yellow-400 hover:scale-110 transition-transform shadow-lg">{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>

        {view === 'LANDING' || !currentUser ? (
          <LandingPage 
            onLoginClick={currentUser ? () => setView('DASHBOARD') : handleGoogleLogin} 
            isLoggedIn={!!currentUser}
            isLoggingIn={isLoggingIn}
            onAnalysisComplete={handleAnalysisComplete}
            isInstallable={isInstallable}
            onInstallClick={handleInstallClick}
          />
        ) : (
          <div className="min-h-screen">
            {/* ... Navbar (Mantida) ... */}
            <nav className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white sticky top-0 z-40 shadow-sm border-b border-slate-200 dark:border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                  <div className="flex items-center space-x-4 cursor-pointer group" onClick={() => setView('LANDING')}>
                     <div className="bg-bordo-900 p-2 rounded-xl shadow-lg shadow-bordo-900/20"><Scale className="text-white w-6 h-6" /></div>
                     <div className="flex flex-col">
                       <span className="font-serif text-xl font-bold tracking-tight">Felix e Castro</span>
                       <div className="flex items-center gap-2">
                         <span className="text-[10px] uppercase font-bold text-bordo-900 dark:text-bordo-400 tracking-widest">Advocacia</span>
                         <span className="flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full text-[8px] font-bold border border-green-500/20 uppercase tracking-wide">
                           <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div> Online
                         </span>
                       </div>
                     </div>
                  </div>
                  <div className="flex items-center space-x-3 md:space-x-4">
                    <NotificationBell />
                    {currentUser.role === 'ADMIN' && (
                       <>
                         <button onClick={handleManualRefresh} className="p-2.5 text-slate-500 hover:text-bordo-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all" title="Atualizar Dados">
                            <RefreshCw className="w-4 h-4" />
                         </button>
                         <button onClick={() => setView('CLIENT_MANAGER')} className="hidden md:flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-semibold transition-all">
                           <Users className="w-4 h-4" /><span>Usuários</span>
                         </button>
                         <button onClick={() => setView('TEMPLATE_MANAGER')} className="hidden md:flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-semibold transition-all">
                           <Settings className="w-4 h-4" /><span>Modelos</span>
                         </button>
                       </>
                    )}
                    <button onClick={() => setView('TEAM_MANAGER')} className="hidden md:flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-semibold transition-all">
                      <Globe className="w-4 h-4" /><span>Equipe</span>
                    </button>
                    <button onClick={handleLogout} className="flex items-center space-x-2 px-4 py-2 bg-bordo-900 hover:bg-bordo-950 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-bordo-900/20"><LogOut className="w-4 h-4" /><span className="hidden md:inline">Sair</span></button>
                  </div>
                </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-medium">{error}</p>
                  </div>
                  <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              {/* ... Dashboard View (Mantida) ... */}
              {view === 'DASHBOARD' && (
                <div className="space-y-10 animate-fade-in">

                  {currentUser.role === 'ADMIN' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Clientes Recentes */}
                      <div className="bg-white dark:bg-slate-800 p-6 shadow-sm border-t-4 border-red-900">
                        <h3 className="text-lg font-bold text-red-950 dark:text-red-200 mb-6 flex items-center"><UserIcon className="w-5 h-5 mr-2" /> Clientes Recentes</h3>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                           {users.filter(u => u.role === 'CLIENT' && !u.archived).slice(0, 10).map(client => (
                             <div key={client.id} className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                               <div className="flex justify-between items-start">
                                 <div className="cursor-pointer flex-1" onClick={() => setSelectedClientId(client.id)}>
                                   <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{formatName(client.name)}</p>
                                   <p className="text-xs text-slate-500 dark:text-slate-400">{client.email}</p>
                                 </div>
                                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); setSelectedQualificationUser(client); }}
                                     className="p-1.5 text-slate-400 hover:text-bordo-900 hover:bg-white rounded-md transition-all"
                                     title="Editar Qualificação"
                                   >
                                     <Edit className="w-3.5 h-3.5" />
                                   </button>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleDownloadClientReport(client); }}
                                     className="p-1.5 text-slate-400 hover:text-bordo-900 hover:bg-white rounded-md transition-all"
                                     title="Baixar Relatório"
                                   >
                                     <Download className="w-3.5 h-3.5" />
                                   </button>
                                 </div>
                               </div>
                             </div>
                           ))}
                           {users.filter(u => u.role === 'CLIENT' && !u.archived).length === 0 && (
                             <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Nenhum cliente recente.</p>
                           )}
                        </div>
                      </div>

                      {/* Novo Processo */}
                      <div className="bg-white dark:bg-slate-800 p-6 shadow-sm border-t-4 border-red-900">
                        <h3 className="text-lg font-bold text-red-950 dark:text-red-200 mb-6 flex items-center"><FileText className="w-5 h-5 mr-2" /> Novo Processo</h3>
                        <div className="space-y-4">
                          <select className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
                            <option value="">Selecione o Cliente</option>
                            {users.filter(u => u.role === 'CLIENT' && !u.archived).map(c => (<option key={c.id} value={c.id}>{formatName(c.name)}</option>))}
                          </select>
                          <select className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white" value={newCaseTemplateId} onChange={e => setNewCaseTemplateId(e.target.value)}>
                            {templates.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                          </select>
                          {newCaseTemplateId === 'ADMINISTRATIVO_PREVIDENCIARIO' && (
                             <select className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white" value={newBenefitType} onChange={e => setNewBenefitType(e.target.value as BenefitType)}>
                               <option value="">Tipo de Benefício...</option>
                               {Object.entries(PREVIDENCIARIO_BENEFITS).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}
                             </select>
                          )}
                          <input className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white outline-none" placeholder="Título do Processo" value={newCaseTitle} onChange={e => setNewCaseTitle(e.target.value)} />
                          
                          <select className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white" value={newCaseResponsibleLawyer} onChange={e => setNewCaseResponsibleLawyer(e.target.value)}>
                            <option value="">Advogado Responsável...</option>
                            <option value={currentUser.name}>{currentUser.name}</option>
                            <option value="Dra. Luana">Dra. Luana</option>
                          </select>

                          <input className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white outline-none" placeholder="Número do Processo (Opcional)" value={newCaseNumber} onChange={e => setNewCaseNumber(e.target.value)} />
                          <input type="date" className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white outline-none" placeholder="Data da Perícia (Opcional)" value={newCaseExpertiseDate} onChange={e => setNewCaseExpertiseDate(e.target.value)} />
                          <textarea className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white outline-none" placeholder="Orientações (Opcional)" value={newCaseOrientations} onChange={e => setNewCaseOrientations(e.target.value)} rows={2} />
                          <textarea className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white outline-none" placeholder="Alertas (Opcional)" value={newCaseAlerts} onChange={e => setNewCaseAlerts(e.target.value)} rows={2} />

                          <button onClick={handleAddCase} className="w-full bg-slate-800 text-white py-3 text-xs font-bold uppercase hover:bg-slate-900 mt-2">Iniciar Processo</button>
                        </div>
                      </div>
                      
                      {/* Equipe */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 shadow-inner border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-6 flex items-center"><Users className="w-5 h-5 mr-2" /> Convidar Equipe</h3>
                        <div className="space-y-4 opacity-75 hover:opacity-100">
                           <input type="email" className="w-full border p-2 text-sm rounded bg-white dark:bg-slate-700 dark:text-white" placeholder="E-mail do membro" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
                           
                           {/* Novo Seletor: Cargo/Função */}
                           <select 
                             className="w-full border p-2 text-sm rounded bg-white dark:bg-slate-700 dark:text-white"
                             value={newAdminJobTitle}
                             onChange={e => setNewAdminJobTitle(e.target.value)}
                           >
                             <option value="Advogado(a)">Advogado(a)</option>
                             <option value="Secretário(a)">Secretário(a)</option>
                             <option value="Estagiário(a)">Estagiário(a)</option>
                             <option value="Paralegal">Paralegal</option>
                             <option value="Financeiro">Financeiro</option>
                             <option value="Outro">Outro</option>
                           </select>

                          <button onClick={async () => {
                            if (!newAdminName) return;
                            try {
                              // @ts-ignore
                              await api.inviteTeamMember(newAdminName, 'ADMIN', newAdminJobTitle);
                              alert('Convite enviado! Quando o membro fizer login com o Google usando este e-mail, ele terá acesso de administrador.');
                              setNewAdminName('');
                            } catch (e) {
                              alert('Erro ao enviar convite.');
                            }
                          }} className="w-full bg-slate-400 text-white py-2 text-xs font-bold uppercase hover:bg-slate-500 rounded">Enviar Convite</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lista de Processos */}
                  <div>
                    <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                      <div className="animate-fade-in">
                        <h2 className="text-4xl font-serif font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Olá, {formatName(currentUser.name.split(' ')[0])}</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Bem-vindo ao seu portal jurídico exclusivo.</p>
                      </div>
                      
                      <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-bordo-900">
                          <Search className="h-5 w-5 text-slate-400 group-focus-within:text-bordo-900" />
                        </div>
                        <input
                          type="text"
                          className="block w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl leading-5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bordo-900/20 focus:border-bordo-900 transition-all shadow-sm dark:text-white font-medium"
                          placeholder="Buscar processos ou andamentos..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    {currentUser.role === 'CLIENT' && (
                      <>
                        <ClientProfile 
                          currentUser={currentUser} 
                          onUpdate={(updatedUser) => setCurrentUser(updatedUser)} 
                        />
                        {currentUser.qualification && (
                          <QualificationCard user={currentUser} isAdmin={false} />
                        )}
                      </>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden border border-slate-100 dark:border-slate-800">
                       <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                         <h3 className="font-serif text-xl font-bold text-slate-900 dark:text-white">Seus Andamentos</h3>
                         <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                           <div className="w-2 h-2 bg-bordo-900 rounded-full"></div>
                           <span>{filteredCases.length} Processos</span>
                         </div>
                       </div>
                       {filteredCases.length === 0 ? (
                         <div className="p-12 text-center">
                            {searchTerm ? (
                              <p className="text-slate-500">Nenhum resultado encontrado para sua busca.</p>
                            ) : currentUser.role === 'CLIENT' && currentUser.analysisResult ? (
                              <div className="max-w-3xl mx-auto text-left animate-fade-in">
                                <div className="bg-bordo-50 dark:bg-bordo-900/10 p-10 rounded-[2rem] border border-bordo-100 dark:border-bordo-900/30 shadow-sm">
                                  <div className="flex items-center gap-6 mb-8">
                                    <div className="bg-bordo-900 p-4 rounded-2xl text-white shadow-xl shadow-bordo-900/20">
                                      <Calculator className="w-8 h-8" />
                                    </div>
                                    <div>
                                      <h3 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">Análise de Benefício</h3>
                                      <p className="text-sm text-bordo-900 dark:text-bordo-400 font-bold uppercase tracking-widest mt-1">Relatório Inteligente</p>
                                    </div>
                                  </div>
                                  
                                  <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 mb-10 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm leading-relaxed">
                                    <Markdown>{currentUser.analysisResult}</Markdown>
                                  </div>

                                  <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <a 
                                      href={`https://wa.me/${SECRETARY_WHATSAPP.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-green-600/20 hover:scale-[1.02]"
                                    >
                                      <Phone className="w-6 h-6" /> FALAR COM A SECRETÁRIA AGORA
                                    </a>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">
                                      Clique no botão para iniciar seu atendimento e transformar sua análise em um processo real.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-500">
                                <Briefcase className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                Nenhum processo localizado.
                              </div>
                            )}
                         </div> 
                       ) : (
                         <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                           {filteredCases.map(c => {
                             const template = templates.find(t => t.id === c.type);
                             return (
                               <li key={c.id} className="p-8 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-all group cursor-pointer" onClick={() => { setActiveCase(c); setView('CASE_DETAIL'); }}>
                                 <div className="flex justify-between items-start">
                                   <div className="cursor-pointer flex-1" onClick={() => { setActiveCase(c); setView('CASE_DETAIL'); }}>
                                     <div className="flex items-center gap-2">
                                       {editingCaseIdForTitle === c.id ? (
                                         <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                           <input 
                                             className="text-xl font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700 border border-red-900 rounded px-2"
                                             value={tempCaseListTitle}
                                             onChange={e => setTempCaseListTitle(e.target.value)}
                                             autoFocus
                                           />
                                           <button onClick={() => saveCaseListTitle(c.id)} className="text-green-600"><CheckCheck className="w-5 h-5"/></button>
                                           <button onClick={() => setEditingCaseIdForTitle(null)} className="text-red-600"><X className="w-5 h-5"/></button>
                                         </div>
                                       ) : (
                                         <>
                                           <h4 className="text-xl font-medium text-slate-800 dark:text-slate-200 group-hover:text-red-900">{c.title}</h4>
                                           {renderStatusBadge(c.status || 'ACTIVE')}
                                         </>
                                       )}
                                     </div>
                                     <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2">
                                        {(c as any).clientName && <span className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">Cliente: {formatName((c as any).clientName)}</span>}
                                        {c.responsibleLawyer && <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700"><BriefcaseIcon className="w-3 h-3"/> Adv: {formatName(c.responsibleLawyer)}</span>}
                                        <span className="text-xs text-slate-400 uppercase tracking-wide">{template?.label || c.type}</span>
                                     </div>
                                   </div>
                                   {currentUser.role === 'ADMIN' && (
                                     <div className="flex items-center gap-2">
                                        <button onClick={() => handleWhatsAppContact(c.clientId)} title="Falar no WhatsApp" className="p-2 text-green-600 hover:bg-green-100 rounded-full"><MessageCircle className="w-5 h-5"/></button>
                                        <button onClick={() => handleEditCaseTitle(c)} title="Editar Título" className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full"><Edit className="w-5 h-5"/></button>
                                        <button onClick={() => handleArchiveCase(c.id)} title="Arquivar/Concluir" className="p-2 text-amber-600 hover:bg-amber-100 rounded-full"><Archive className="w-5 h-5"/></button>
                                        <button onClick={() => handleDeleteCase(c.id)} title="Excluir" className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 className="w-5 h-5"/></button>
                                     </div>
                                   )}
                                 </div>
                               </li>
                             );
                           })}
                         </ul>
                       )}
                    </div>
                  </div>
                </div>
              )}

                    {view === 'CASE_DETAIL' && activeCase && (
                <div className="animate-fade-in pb-20">
                  <button onClick={() => setView('DASHBOARD')} className="mb-8 text-xs font-bold text-slate-400 hover:text-bordo-900 flex items-center uppercase tracking-[0.2em] transition-colors group">
                    <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Voltar ao Painel
                  </button>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-900 p-10 md:p-16 text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-bordo-900/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                      <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                          <div className="flex-1">
                             <div className="flex items-center gap-4 mb-6">
                               {renderStatusBadge(activeCase.status || 'ACTIVE')}
                               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Processo #{activeCase.id.slice(-6).toUpperCase()}</span>
                             </div>
                             
                             <div className="flex items-center gap-4">
                               {isEditingCaseTitle ? (
                                 <div className="flex items-center gap-3">
                                   <input 
                                     className="text-3xl md:text-5xl font-serif font-bold bg-white/10 border-b-2 border-white focus:outline-none px-2 py-1 rounded-t-lg"
                                     value={tempCaseTitle}
                                     onChange={e => setTempCaseTitle(e.target.value)}
                                     autoFocus
                                   />
                                   <button 
                                     onClick={async () => {
                                       // @ts-ignore
                                       if (api.updateCaseTitle) await api.updateCaseTitle(activeCase.id, tempCaseTitle);
                                       setActiveCase({ ...activeCase, title: tempCaseTitle });
                                       setIsEditingCaseTitle(false);
                                       setRefreshKey(k => k + 1);
                                     }}
                                     className="bg-white text-slate-900 p-2 rounded-xl hover:scale-110 transition-transform"
                                   >
                                     <CheckCheck className="w-6 h-6" />
                                   </button>
                                   <button onClick={() => setIsEditingCaseTitle(false)} className="text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
                                 </div>
                               ) : (
                                 <>
                                   <h1 className="text-4xl md:text-6xl font-serif font-bold leading-tight">{activeCase.title}</h1>
                                   {currentUser.role === 'ADMIN' && (
                                     <button onClick={() => {
                                       setTempCaseTitle(activeCase.title);
                                       setIsEditingCaseTitle(true);
                                     }} className="text-white/40 hover:text-white transition-colors"><Edit className="w-6 h-6" /></button>
                                   )}
                                 </>
                               )}
                             </div>
                          </div>
                          
                          <div className="flex flex-col gap-4">
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Responsável</p>
                              <p className="font-bold flex items-center gap-2"><UserIcon className="w-4 h-4 text-bordo-400" /> {activeCase.responsibleLawyer || 'Dr. Michel Félix'}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Tipo de Ação</p>
                              <p className="font-bold flex items-center gap-2"><Gavel className="w-4 h-4 text-bordo-400" /> {templates.find(t => t.id === activeCase.type)?.label || activeCase.type}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 md:p-16">
                      {/* CHATBOT PROMINENT CARD (CLIENT ONLY) */}
                      {currentUser.role === 'CLIENT' && (
                        <div className="mb-12 bg-gradient-to-br from-slate-900 to-bordo-950 p-8 md:p-12 rounded-[2rem] shadow-2xl text-white flex flex-col md:flex-row items-center gap-10 animate-fade-in relative overflow-hidden border border-white/10">
                          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                          <div className="relative z-10 bg-white/10 p-6 rounded-full border border-white/20 backdrop-blur-sm">
                            <Bot className="w-16 h-16 text-bordo-400" />
                          </div>
                          <div className="relative z-10 flex-1 text-center md:text-left">
                            <h3 className="text-2xl md:text-3xl font-serif mb-4">Assistente Virtual do Escritório</h3>
                            <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-2xl">
                              Olá! Estou aqui para te ajudar a entender cada passo do seu processo. 
                              Posso tirar dúvidas sobre os andamentos, perícias e como organizar seus documentos médicos.
                            </p>
                            <button 
                              onClick={() => window.dispatchEvent(new CustomEvent('open-chatbot'))}
                              className="bg-bordo-600 text-white px-10 py-4 rounded-full font-bold text-sm hover:bg-bordo-500 transition-all shadow-xl active:scale-95 uppercase tracking-widest"
                            >
                              INICIAR CONVERSA AGORA
                            </button>
                          </div>
                        </div>
                      )}

                     {/* Informações Adicionais do Processo */}
                    <div className="mb-10 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Informações do Processo</h3>
                        {currentUser.role === 'ADMIN' && (
                          <div className="flex gap-2">
                            {isEditingCaseDetails ? (
                              <>
                                <button 
                                  onClick={async () => {
                                    // @ts-ignore
                                    if (api.updateCaseDetails) await api.updateCaseDetails(activeCase.id, editCaseDetails);
                                    setIsEditingCaseDetails(false);
                                    setRefreshKey(k => k + 1);
                                    // Atualiza o caso ativo localmente
                                    setActiveCase({ ...activeCase, ...editCaseDetails });
                                  }} 
                                  className="text-xs flex items-center gap-1 text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded font-bold"
                                >
                                  <CheckCheck className="w-3 h-3" /> Salvar
                                </button>
                                <button 
                                  onClick={() => setIsEditingCaseDetails(false)} 
                                  className="text-xs flex items-center gap-1 text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded font-bold"
                                >
                                  <X className="w-3 h-3" /> Cancelar
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => {
                                  setEditCaseDetails({
                                    caseNumber: activeCase.caseNumber || '',
                                    expertiseDate: activeCase.expertiseDate || '',
                                    expertises: activeCase.expertises || [],
                                    orientations: activeCase.orientations || '',
                                    alerts: activeCase.alerts || ''
                                  });
                                  setIsEditingCaseDetails(true);
                                }} 
                                className="text-xs flex items-center gap-1 text-red-900 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                              >
                                <Edit className="w-3 h-3" /> Editar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {isEditingCaseDetails ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block font-bold">Número do Processo</label>
                            <input 
                              className="w-full border p-2 text-sm rounded dark:bg-slate-700 dark:text-white dark:border-slate-600"
                              value={editCaseDetails.caseNumber || ''}
                              onChange={e => setEditCaseDetails({...editCaseDetails, caseNumber: e.target.value})}
                              placeholder="0000000-00.0000.0.00.0000"
                            />
                          </div>
                          
                          <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                            <div className="flex justify-between items-center mb-4">
                              <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-bold">Perícias Agendadas</label>
                              <button 
                                onClick={() => {
                                  const newExpertise = { id: crypto.randomUUID(), name: '', date: '', time: '' };
                                  setEditCaseDetails({
                                    ...editCaseDetails,
                                    expertises: [...(editCaseDetails.expertises || []), newExpertise]
                                  });
                                }}
                                className="text-xs flex items-center gap-1 text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded font-bold"
                              >
                                <Plus className="w-3 h-3" /> Adicionar Perícia
                              </button>
                            </div>
                            
                            <div className="space-y-4">
                              {(editCaseDetails.expertises || []).map((exp, idx) => (
                                <div key={exp.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 relative group">
                                  <div className="md:col-span-2">
                                    <label className="text-[10px] text-slate-400 uppercase mb-1 block">Nome da Perícia (ex: Médica, Social)</label>
                                    <input 
                                      className="w-full border p-1.5 text-sm rounded dark:bg-slate-800 dark:text-white dark:border-slate-600"
                                      value={exp.name}
                                      onChange={e => {
                                        const newList = [...(editCaseDetails.expertises || [])];
                                        newList[idx].name = e.target.value;
                                        setEditCaseDetails({...editCaseDetails, expertises: newList});
                                      }}
                                      placeholder="Ex: Perícia Médica"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 uppercase mb-1 block">Data</label>
                                    <input 
                                      type="date"
                                      className="w-full border p-1.5 text-sm rounded dark:bg-slate-800 dark:text-white dark:border-slate-600"
                                      value={exp.date}
                                      onChange={e => {
                                        const newList = [...(editCaseDetails.expertises || [])];
                                        newList[idx].date = e.target.value;
                                        setEditCaseDetails({...editCaseDetails, expertises: newList});
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                      <label className="text-[10px] text-slate-400 uppercase mb-1 block">Horário</label>
                                      <input 
                                        type="time"
                                        className="w-full border p-1.5 text-sm rounded dark:bg-slate-800 dark:text-white dark:border-slate-600"
                                        value={exp.time}
                                        onChange={e => {
                                          const newList = [...(editCaseDetails.expertises || [])];
                                          newList[idx].time = e.target.value;
                                          setEditCaseDetails({...editCaseDetails, expertises: newList});
                                        }}
                                      />
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const newList = (editCaseDetails.expertises || []).filter((_, i) => i !== idx);
                                        setEditCaseDetails({...editCaseDetails, expertises: newList});
                                      }}
                                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {(editCaseDetails.expertises || []).length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-2">Nenhuma perícia adicionada.</p>
                              )}
                            </div>
                          </div>

                          <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block font-bold">Orientações</label>
                            <textarea 
                              className="w-full border p-2 text-sm rounded dark:bg-slate-700 dark:text-white dark:border-slate-600 min-h-[100px]"
                              value={editCaseDetails.orientations || ''}
                              onChange={e => setEditCaseDetails({...editCaseDetails, orientations: e.target.value})}
                              placeholder="Orientações para o cliente..."
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block font-bold">Alertas Importantes</label>
                            <textarea 
                              className="w-full border p-2 text-sm rounded dark:bg-slate-700 dark:text-white dark:border-slate-600 min-h-[60px]"
                              value={editCaseDetails.alerts || ''}
                              onChange={e => setEditCaseDetails({...editCaseDetails, alerts: e.target.value})}
                              placeholder="Alertas críticos..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Número do Processo</p>
                            <p className="font-medium text-slate-800 dark:text-slate-200">{activeCase.caseNumber || 'Não informado'}</p>
                          </div>
                          
                          <div className="md:col-span-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Perícias e Audiências Agendadas</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {(() => {
                                const allAppointments = [
                                  ...(activeCase.expertises || []).map(exp => ({ ...exp, type: 'EXPERTISE' })),
                                  ...activeCase.steps
                                    .filter(s => s.appointmentDate)
                                    .map(s => ({ 
                                      id: s.id, 
                                      name: s.label, 
                                      date: s.appointmentDate!, 
                                      time: '',
                                      type: 'STEP'
                                    }))
                                ];

                                if (allAppointments.length === 0 && activeCase.expertiseDate) {
                                  allAppointments.push({
                                    id: 'legacy',
                                    name: 'Perícia Agendada',
                                    date: activeCase.expertiseDate,
                                    time: '',
                                    type: 'LEGACY'
                                  });
                                }

                                if (allAppointments.length === 0) {
                                  return (
                                    <div className="md:col-span-2 py-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded">
                                      <p className="text-xs text-slate-400 italic">Nenhuma perícia ou audiência agendada.</p>
                                    </div>
                                  );
                                }

                                return allAppointments.map((app) => (
                                  <div key={app.id} className="bg-white dark:bg-slate-700/50 p-3 rounded border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <div>
                                      <p className="text-xs font-bold text-red-900 dark:text-red-400 uppercase tracking-tight">{app.name || 'Agendamento'}</p>
                                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                        {app.time && ` às ${app.time}`}
                                      </p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-full">
                                      <FileText className="w-4 h-4 text-red-900 dark:text-red-400" />
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Orientações</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{activeCase.orientations || 'Nenhuma orientação no momento.'}</p>
                          </div>
                          {activeCase.alerts && (
                            <div className="md:col-span-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded">
                              <p className="text-xs text-yellow-800 dark:text-yellow-500 uppercase tracking-wider mb-1 font-bold">Alertas Importantes</p>
                              <p className="text-sm text-yellow-900 dark:text-yellow-200 whitespace-pre-wrap">{activeCase.alerts}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mb-8">
                      <div className="flex justify-between items-end mb-6">
                        <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Linha do Tempo</h3>
                        {currentUser.role === 'ADMIN' && activeCase.status === 'ACTIVE' && (
                          <button onClick={() => setIsAddStepModalOpen(true)} className="flex items-center text-xs font-bold text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded"><PlusCircle className="w-4 h-4 mr-1" /> Adicionar Etapa</button>
                        )}
                      </div>
                      <Timeline steps={activeCase.steps} onStepClick={setActiveStep} isAdmin={currentUser.role === 'ADMIN' && activeCase.status === 'ACTIVE'} startDate={activeCase.startDate} caseType={activeCase.type} benefitType={activeCase.benefitType} />
                    </div>

                    {/* ACTIONS SECTION (ADMIN ONLY) */}
                    {currentUser.role === 'ADMIN' && activeCase.status === 'ACTIVE' && (
                       <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                         <h4 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Ações do Processo</h4>
                         <div className="flex flex-col md:flex-row gap-4">
                           <button 
                             onClick={handleConcludeCase}
                             className="flex items-center justify-center px-4 py-3 border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold uppercase text-xs tracking-wider"
                           >
                             <CheckCheck className="w-4 h-4 mr-2" /> Concluir Processo
                           </button>

                           {activeCase.type === 'ADMINISTRATIVO_PREVIDENCIARIO' && (
                             <button 
                               onClick={handleTransformToJudicial}
                               className="flex items-center justify-center px-4 py-3 bg-red-950 text-white hover:bg-red-900 font-bold uppercase text-xs tracking-wider shadow-md"
                             >
                               <Gavel className="w-4 h-4 mr-2" /> Transformar em Processo Judicial
                             </button>
                           )}
                         </div>
                       </div>
                    )}

                    {/* CHATBOT (CLIENT ONLY) */}
                    {currentUser.role === 'CLIENT' && (
                      <CaseChatbot 
                        activeCase={activeCase} 
                        currentUser={currentUser} 
                        secretaryWhatsapp={users.find(u => u.role === 'ADMIN' && u.whatsapp)?.whatsapp || SECRETARY_WHATSAPP}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

              {/* ... (CLIENT MANAGER e TEMPLATE MANAGER mantidos igual ao original) ... */}
              {view === 'CLIENT_MANAGER' && (
                <div className="animate-fade-in">
                   {/* Conteúdo CLIENT MANAGER Mantido */}
                   <div className="flex items-center mb-6">
                     <button onClick={() => setView('DASHBOARD')} className="mr-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><ChevronLeft className="w-5 h-5"/></button>
                     <h2 className="text-2xl font-serif text-red-950 dark:text-red-100">Gerenciamento de Usuários</h2>
                  </div>
                  {/* ... Restante do Client Manager (Tabela, Filtros) ... */}
                   {/* Filter tabs */}
                  <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-2">
                     <button onClick={() => setUserFilter('ALL')} className={`px-4 py-2 font-bold text-sm ${userFilter === 'ALL' ? 'text-red-900 border-b-2 border-red-900' : 'text-slate-500'}`}>Todos</button>
                     <button onClick={() => setUserFilter('TEAM')} className={`px-4 py-2 font-bold text-sm ${userFilter === 'TEAM' ? 'text-red-900 border-b-2 border-red-900' : 'text-slate-500'}`}>Equipe</button>
                     <button onClick={() => setUserFilter('CLIENTS')} className={`px-4 py-2 font-bold text-sm ${userFilter === 'CLIENTS' ? 'text-red-900 border-b-2 border-red-900' : 'text-slate-500'}`}>Clientes</button>
                  </div>

                  <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden">
                     <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                       <thead className="bg-slate-50 dark:bg-slate-900">
                         <tr>
                           <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nome</th>
                           <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Função</th>
                           <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Acesso</th>
                           <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                         </tr>
                       </thead>
                       <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                         {currentUsers.map(user => (
                           <tr key={user.id}>
                             <td className="px-6 py-4 whitespace-nowrap">
                                {editingUser?.id === user.id ? (
                                   <input className="border p-1 rounded dark:bg-slate-700 dark:text-white" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                                ) : (
                                   <div className="flex flex-col">
                                      <span className="text-sm font-medium text-slate-900 dark:text-white">{formatName(user.name)}</span>
                                      {user.whatsapp && <span className="text-xs text-slate-500 flex items-center gap-1"><MessageCircle className="w-3 h-3"/> {user.whatsapp}</span>}
                                   </div>
                                )}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                {editingUser?.id === user.id && user.role === 'ADMIN' ? (
                                   <select className="border p-1 rounded dark:bg-slate-700 dark:text-white" value={editingUser.jobTitle} onChange={e => setEditingUser({...editingUser, jobTitle: e.target.value})}>
                                      <option value="Advogado(a)">Advogado(a)</option>
                                      <option value="Secretário(a)">Secretário(a)</option>
                                      <option value="Estagiário(a)">Estagiário(a)</option>
                                      <option value="Paralegal">Paralegal</option>
                                      <option value="Financeiro">Financeiro</option>
                                      <option value="Outro">Outro</option>
                                   </select>
                                ) : (
                                   user.role === 'ADMIN' ? (user.jobTitle || 'Advogado') : 'Cliente'
                                )}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap">
                                 {/* PIN editing logic */}
                                 {editingUser?.id === user.id ? (
                                    <input className="w-20 border p-1 rounded dark:bg-slate-700 dark:text-white" value={editingUser.pin} onChange={e => setEditingUser({...editingUser, pin: e.target.value})} />
                                 ) : (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">PIN: {user.pin}</span>
                                 )}
                                 {user.archived && <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Bloqueado</span>}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {editingUser?.id === user.id ? (
                                   <div className="flex justify-end gap-2">
                                      <button onClick={() => handleUpdateUser(editingUser)} className="text-green-600 hover:text-green-900"><CheckCheck className="w-5 h-5"/></button>
                                      <button onClick={() => setEditingUser(null)} className="text-red-600 hover:text-red-900"><X className="w-5 h-5"/></button>
                                   </div>
                                ) : (
                                   <div className="flex justify-end gap-2">
                                      {user.role === 'CLIENT' && (
                                        <button onClick={() => setSelectedQualificationUser(user)} className="text-blue-600 hover:text-blue-900" title="Ver Qualificação">
                                          <UserIcon className="w-4 h-4"/>
                                        </button>
                                      )}
                                      <button onClick={() => setEditingUser(user)} className="text-indigo-600 hover:text-indigo-900"><Edit className="w-4 h-4"/></button>
                                      <button onClick={() => toggleArchiveUser(user)} className={`${user.archived ? 'text-green-600' : 'text-amber-600'} hover:opacity-80`} title={user.archived ? 'Desbloquear' : 'Bloquear'}>
                                         {user.archived ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4"/>}
                                      </button>
                                      <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4"/></button>
                                   </div>
                                )}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                     {/* Pagination */}
                     {totalPages > 1 && (
                        <div className="flex justify-center p-4 gap-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded disabled:opacity-50 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-white"><ChevronLeft className="w-4 h-4"/></button>
                          <span className="text-sm py-1 dark:text-slate-300">Pág {currentPage} de {totalPages}</span>
                          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded disabled:opacity-50 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-white"><ChevronRight className="w-4 h-4"/></button>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* ... TEMPLATE MANAGER view (Mantida igual ao original) ... */}
              {view === 'TEMPLATE_MANAGER' && (
                <div className="animate-fade-in">
                  <div className="flex items-center mb-6">
                     <button onClick={() => setView('DASHBOARD')} className="mr-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><ChevronLeft className="w-5 h-5"/></button>
                     <h2 className="text-2xl font-serif text-red-950 dark:text-red-100">Gerenciador de Modelos</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {/* Sidebar List */}
                     <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4">
                        <div className="mb-4 flex gap-2">
                           <input className="w-full border p-2 text-sm rounded dark:bg-slate-700 dark:text-white" placeholder="Novo Modelo..." value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
                           <button onClick={handleCreateTemplate} className="bg-red-950 text-white p-2 rounded"><Plus className="w-5 h-5"/></button>
                        </div>
                        <ul className="space-y-2">
                           {templates.map(t => (
                              <li key={t.id} onClick={() => setSelectedTemplate(t)} className={`p-3 rounded cursor-pointer flex justify-between items-center ${selectedTemplate?.id === t.id ? 'bg-red-50 dark:bg-red-900/30 border border-red-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                 <span className="text-sm font-medium dark:text-slate-200">{t.label}</span>
                                 {!t.isSystem && <button onClick={(e) => {e.stopPropagation(); handleDeleteTemplate(t.id);}} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>}
                              </li>
                           ))}
                        </ul>
                     </div>

                     {/* Editor */}
                     <div className="md:col-span-2 bg-white dark:bg-slate-800 shadow rounded-lg p-6">
                        {selectedTemplate ? (
                           <>
                             <h3 className="text-lg font-bold text-red-950 dark:text-red-200 mb-4 pb-2 border-b">{selectedTemplate.label} <span className="text-xs font-normal text-slate-500 ml-2">{selectedTemplate.isSystem ? '(Sistema - Padrão)' : '(Personalizado)'}</span></h3>
                             
                             <div className="space-y-4 mb-8">
                                 {selectedTemplate.steps.map((step, idx) => (
                                    <div key={step.id} className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded border border-slate-100 dark:border-slate-700 group">
                                       <div className="flex items-center gap-3">
                                          <span className="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">{idx + 1}</span>
                                          <div className="flex-1">
                                             {editingTemplateStepId === step.id ? (
                                                <div className="flex flex-col md:flex-row gap-2">
                                                   <input 
                                                      className="flex-1 border p-1 text-sm rounded dark:bg-slate-800 dark:text-white"
                                                      value={tempTemplateStep.label}
                                                      onChange={e => setTempTemplateStep({...tempTemplateStep, label: e.target.value})}
                                                      autoFocus
                                                   />
                                                   <input 
                                                      type="number"
                                                      className="w-20 border p-1 text-sm rounded dark:bg-slate-800 dark:text-white"
                                                      value={tempTemplateStep.expectedDuration}
                                                      onChange={e => setTempTemplateStep({...tempTemplateStep, expectedDuration: Number(e.target.value)})}
                                                   />
                                                   <div className="flex gap-1">
                                                      <button onClick={saveTemplateStepEdit} className="p-1 text-green-600 hover:bg-green-100 rounded"><CheckCheck className="w-4 h-4"/></button>
                                                      <button onClick={() => setEditingTemplateStepId(null)} className="p-1 text-red-600 hover:bg-red-100 rounded"><X className="w-4 h-4"/></button>
                                                   </div>
                                                </div>
                                             ) : (
                                                <>
                                                   <p className="text-sm font-bold dark:text-slate-200">{step.label}</p>
                                                   <p className="text-xs text-slate-500">Prazo: {step.expectedDuration} dias</p>
                                                </>
                                             )}
                                          </div>
                                          {editingTemplateStepId !== step.id && (
                                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleMoveTemplateStep(selectedTemplate.id, step.id, 'UP')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-red-900 disabled:opacity-30"><ChevronLeft className="w-4 h-4 rotate-90"/></button>
                                                <button onClick={() => handleMoveTemplateStep(selectedTemplate.id, step.id, 'DOWN')} disabled={idx === selectedTemplate.steps.length - 1} className="p-1 text-slate-400 hover:text-red-900 disabled:opacity-30"><ChevronRight className="w-4 h-4 rotate-90"/></button>
                                                <button onClick={() => handleEditTemplateStep(step.id, step.label, step.expectedDuration)} className="p-1 text-blue-400 hover:text-blue-600"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteTemplateStep(step.id)} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4"/></button>
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                             </div>

                             <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded border border-dashed border-slate-300">
                                <h4 className="text-sm font-bold mb-3 dark:text-slate-300">Adicionar Etapa</h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                                   <div className="md:col-span-2">
                                      <label className="text-xs text-slate-500 block mb-1">Nome da Etapa</label>
                                      <input className="w-full border p-2 text-sm rounded dark:bg-slate-700 dark:text-white" value={newTemplateStepLabel} onChange={e => setNewTemplateStepLabel(e.target.value)} />
                                   </div>
                                   <div>
                                      <label className="text-xs text-slate-500 block mb-1">Prazo (Dias)</label>
                                      <input type="number" className="w-full border p-2 text-sm rounded dark:bg-slate-700 dark:text-white" value={newTemplateStepDuration} onChange={e => setNewTemplateStepDuration(Number(e.target.value))} />
                                   </div>
                                   <button onClick={handleAddTemplateStep} className="bg-red-950 text-white p-2 text-sm font-bold rounded uppercase">Adicionar</button>
                                </div>
                             </div>
                           </>
                        ) : (
                           <div className="h-full flex flex-col items-center justify-center text-slate-400">
                              <Settings className="w-12 h-12 mb-2 opacity-20"/>
                              <p>Selecione um modelo para editar</p>
                           </div>
                        )}
                     </div>
                  </div>
                </div>
              )}
              {view === 'TEAM_MANAGER' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">Gerenciar Equipe</h2>
                      <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie os membros que aparecem na página inicial.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleClearTeamDuplicates} className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl font-bold transition-all">
                        <Trash2 className="w-5 h-5" />
                        <span>Limpar Duplicados</span>
                      </button>
                      <button onClick={handleAddTeamMember} className="flex items-center gap-2 bg-bordo-900 hover:bg-bordo-950 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-bordo-900/20">
                        <PlusCircle className="w-5 h-5" />
                        <span>Adicionar Membro</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {team.map((member, idx) => (
                      <div key={member.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden group">
                        <div className="relative h-64 overflow-hidden">
                          <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                          {uploadingTeamImage === member.id && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <RefreshCw className="w-8 h-8 text-white animate-spin" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button onClick={() => { setEditingTeamMemberId(member.id); setTempTeamMember(member); }} className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 transition-transform">
                              <Edit className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleDeleteTeamMember(member.id)} className="p-3 bg-red-600 text-white rounded-full hover:scale-110 transition-transform">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="absolute top-4 right-4 flex flex-col gap-2">
                            <button onClick={() => handleMoveTeamMember(member.id, 'UP')} disabled={idx === 0} className="p-2 bg-white/90 dark:bg-slate-900/90 rounded-lg shadow-sm disabled:opacity-30">
                              <ChevronLeft className="w-4 h-4 rotate-90" />
                            </button>
                            <button onClick={() => handleMoveTeamMember(member.id, 'DOWN')} disabled={idx === team.length - 1} className="p-2 bg-white/90 dark:bg-slate-900/90 rounded-lg shadow-sm disabled:opacity-30">
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </button>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          {editingTeamMemberId === member.id ? (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Nome</label>
                                <input 
                                  className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white"
                                  value={tempTeamMember.name}
                                  onChange={(e) => setTempTeamMember({ ...tempTeamMember, name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Cargo</label>
                                <input 
                                  className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white"
                                  value={tempTeamMember.role}
                                  onChange={(e) => setTempTeamMember({ ...tempTeamMember, role: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Especialidade</label>
                                <input 
                                  className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white"
                                  value={tempTeamMember.specialty}
                                  onChange={(e) => setTempTeamMember({ ...tempTeamMember, specialty: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Descrição</label>
                                <textarea 
                                  className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white h-24 resize-none"
                                  value={tempTeamMember.description}
                                  onChange={(e) => setTempTeamMember({ ...tempTeamMember, description: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Foto do Membro</label>
                                <div className="flex items-center gap-4">
                                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700">
                                    <img src={tempTeamMember.image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                  <label className="flex-1 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex flex-col items-center justify-center gap-1">
                                    <Camera className="w-6 h-6 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500">Alterar Foto</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        setTempTeamImageFile(file);
                                        const previewUrl = URL.createObjectURL(file);
                                        setTempTeamMember(prev => ({ ...prev, image: previewUrl }));
                                      }
                                    }} />
                                  </label>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button disabled={uploadingTeamImage === member.id} onClick={handleSaveTeamMember} className="flex-1 bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                  {uploadingTeamImage === member.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                  {uploadingTeamImage === member.id ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button onClick={() => { setEditingTeamMemberId(null); setTempTeamImageFile(null); }} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-1">
                                <h3 className="text-xl font-bold dark:text-white">{member.name}</h3>
                                <p className="text-sm font-semibold text-bordo-900 dark:text-bordo-400">{member.role}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Especialidade</label>
                                <p className="text-sm dark:text-slate-300">{member.specialty}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Descrição</label>
                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{member.description}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </main>
            <FloatingSupport />
            <StepModal 
              step={activeStep} 
              isOpen={!!activeStep} 
              onClose={() => setActiveStep(null)} 
              isAdmin={currentUser.role === 'ADMIN'} 
              currentUser={currentUser} // Passando currentUser para auditoria
              activeCaseId={activeCase?.id}
              startDate={activeCase?.startDate}
              onUpdate={async (c, comp, d, appt) => { 
                if(activeCase && activeStep) { 
                  // Passar activeCase.id e activeStep.id corretamente
                  await api.updateStep(activeCase.id, activeStep.id, c, comp ? 'COMPLETE' : 'COMMENT_ONLY', undefined, d, undefined, appt);
                  
                  // Força atualização da interface
                  if (currentUser.role === 'ADMIN') {
                     const updatedCases = await api.getAllCases();
                     setCases(updatedCases);
                     // Atualiza também o caso ativo
                     const updatedActive = updatedCases.find(ca => ca.id === activeCase.id);
                     if (updatedActive) setActiveCase(updatedActive);
                  }
                  setRefreshKey(k => k+1); 
                }
              }}
              onReopen={async () => {
                 if(activeCase && activeStep) {
                    await api.updateStep(activeCase.id, activeStep.id, null, 'REOPEN');
                     // Força atualização da interface
                    if (currentUser.role === 'ADMIN') {
                       const updatedCases = await api.getAllCases();
                       setCases(updatedCases);
                       const updatedActive = updatedCases.find(ca => ca.id === activeCase.id);
                       if (updatedActive) setActiveCase(updatedActive);
                    }
                    setRefreshKey(k => k+1); 
                 }
              }}
              onDelete={async () => { if(activeCase && activeStep && (api as any).deleteStep) { await (api as any).deleteStep(activeStep.id); setActiveStep(null); setRefreshKey(k => k+1); }}}
              onRename={async (l, d) => { if(activeCase && activeStep) { await api.updateStep(activeCase.id, activeStep.id, null, 'UPDATE_LABEL', l, undefined, d); setRefreshKey(k => k+1); }}}
              onMove={async (direction) => { if(activeCase && activeStep) { await handleMoveCaseStep(activeCase.id, activeStep.id, direction); }}}
            />
            <StepModal step={{id: 'new', label: '', status: 'LOCKED', stepOrder: 0}} isOpen={isAddStepModalOpen} onClose={() => setIsAddStepModalOpen(false)} isAdmin={true} isAdding={true} stepsList={activeCase?.steps} 
              onAdd={async (l, p, d) => { if(activeCase && (api as any).addStep) { await (api as any).addStep(activeCase.id, l, p, d); setRefreshKey(k => k+1); } }}
            />
            {selectedQualificationUser && (
              <QualificationModal 
                user={selectedQualificationUser} 
                onClose={() => setSelectedQualificationUser(null)} 
                onUpdateQualification={async (qual) => {
                  await api.updateUser(selectedQualificationUser.id, { qualification: qual });
                  const updatedUser = { ...selectedQualificationUser, qualification: qual };
                  setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
                  if (currentUser?.id === updatedUser.id) {
                    setCurrentUser(updatedUser);
                  }
                  setSelectedQualificationUser(updatedUser);
                }}
              />
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
const capitalize = (str: string) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const formatName = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(capitalize).join(' ');
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
