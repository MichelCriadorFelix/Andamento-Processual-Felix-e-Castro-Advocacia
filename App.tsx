
import React, { useState, useEffect } from 'react';
import { User, LegalCase, Step, CaseType, BenefitType, CaseTemplate, TemplateStep } from './types';
import { mockService } from './services/mockService';
import { supabaseService } from './services/supabaseService';
import { isSupabaseConfigured } from './lib/supabase';
import { Timeline } from './components/Timeline';
import { StepModal } from './components/StepModal';
import { FloatingSupport } from './components/FloatingSupport';
import { Scale, LogOut, User as UserIcon, FileText, Briefcase, Users, PlusCircle, Moon, Sun, MessageCircle, Gavel, CheckCheck, ArrowRightLeft, Edit, Trash2, Archive, ChevronLeft, ChevronRight, Search, Lock, Unlock, Settings, List, Plus, X, MoreVertical, Wifi, WifiOff, RefreshCw, Globe } from 'lucide-react';
import { PREVIDENCIARIO_BENEFITS } from './constants';

const api = isSupabaseConfigured ? supabaseService : mockService;
const SESSION_KEY = 'fec_advocacia_session_v1';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  // View State
  const [view, setView] = useState<'DASHBOARD' | 'CASE_DETAIL' | 'CLIENT_MANAGER' | 'TEMPLATE_MANAGER'>('DASHBOARD');
  
  // Data State
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);

  const [activeCase, setActiveCase] = useState<LegalCase | null>(null);
  const [activeStep, setActiveStep] = useState<Step | null>(null);

  // Auth State
  const [isRegistering, setIsRegistering] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Dashboard Actions State
  const [newClientName, setNewClientName] = useState('');
  const [newClientPin, setNewClientPin] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState(''); 
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');

  const [selectedClientId, setSelectedClientId] = useState('');
  const [newCaseTemplateId, setNewCaseTemplateId] = useState<string>('');
  const [newBenefitType, setNewBenefitType] = useState<BenefitType | ''>(''); 
  const [newCaseTitle, setNewCaseTitle] = useState('');
  
  // Template Manager State
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CaseTemplate | null>(null);
  const [newTemplateStepLabel, setNewTemplateStepLabel] = useState('');
  const [newTemplateStepDuration, setNewTemplateStepDuration] = useState(15);
  const [newTemplateStepPosition, setNewTemplateStepPosition] = useState('END'); // 'END', 'START', or Index

  // Client Manager State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingClient, setEditingClient] = useState<User | null>(null);

  // Modals
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- PERSISTÊNCIA DE SESSÃO ---
  useEffect(() => {
    const storedSession = localStorage.getItem(SESSION_KEY);
    if (storedSession) {
      try {
        const user = JSON.parse(storedSession);
        setCurrentUser(user);
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;

      try {
        // Sempre carrega templates
        const allTemplates = await (api as any).getTemplates();
        setTemplates(allTemplates);
        if (allTemplates.length > 0 && !newCaseTemplateId) {
          setNewCaseTemplateId(allTemplates[0].id);
        }

        if (currentUser.role === 'ADMIN') {
          const allCases = await api.getAllCases();
          const allClients = await api.getAllClients();
          setCases(allCases);
          setClients(allClients);

          // SYNC ACTIVE CASE: Se houver um caso aberto, atualiza ele com os dados novos vindos do banco
          if (activeCase) {
            const updatedActiveCase = allCases.find(c => c.id === activeCase.id);
            if (updatedActiveCase) {
              setActiveCase(updatedActiveCase);
            }
          }

        } else {
          const myCases = await api.getCasesByClient(currentUser.id);
          setCases(myCases);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    loadData();
  }, [currentUser, refreshKey, view]); 

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const handleManualRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        // @ts-ignore
        const result = await api.register(identifier, pin);
        if (result.user) loginUser(result.user);
        else setError(result.error || 'Erro ao criar conta.');
      } else {
        const result = await api.login({ identifier, secret: pin });
        if (result.user) loginUser(result.user);
        else setError(result.error || 'Erro ao entrar. Verifique credenciais.');
      }
    } catch (err) { setError('Erro de conexão ou sistema.'); }
  };

  const loginUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setIdentifier(''); setPin(''); setView('DASHBOARD');
  };

  const handleLogout = () => {
    if (window.confirm("Tem certeza que deseja sair do sistema?")) {
      localStorage.removeItem(SESSION_KEY);
      setCurrentUser(null); setActiveCase(null); setCases([]); setIdentifier(''); setPin(''); setIsRegistering(false);
    }
  };

  // --- ACTIONS ---

  const handleCreateUser = async (name: string, userPin: string, role: 'CLIENT' | 'ADMIN') => {
    if (name && userPin) {
      try {
        await (api as any).createUser(name, userPin, role, role === 'CLIENT' ? newClientWhatsapp : undefined);
        if (role === 'CLIENT') {
            setNewClientName(''); setNewClientPin(''); setNewClientWhatsapp('');
            alert('Cliente adicionado!');
        } else {
            setNewAdminName(''); setNewAdminPin('');
            alert('Membro da equipe adicionado!');
        }
        setRefreshKey(k => k + 1);
      } catch (e: any) { alert(e.message || 'Erro ao adicionar usuário.'); }
    }
  };

  const handleAddCase = async () => {
    if (selectedClientId && newCaseTitle) {
      try {
        if (newCaseTemplateId === 'ADMINISTRATIVO_PREVIDENCIARIO' && !newBenefitType) {
          alert('Por favor, selecione o tipo de benefício.');
          return;
        }
        // @ts-ignore
        await api.addCase(selectedClientId, newCaseTemplateId, newCaseTitle, newBenefitType as BenefitType);
        setNewCaseTitle(''); setSelectedClientId(''); setNewBenefitType('');
        setRefreshKey(k => k + 1);
        alert('Processo criado!');
      } catch (e) { alert('Erro ao criar processo.'); }
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (confirm("Tem certeza que deseja excluir este processo permanentemente?")) {
      if ((api as any).deleteCase) {
        await (api as any).deleteCase(caseId);
        setRefreshKey(k => k + 1);
      }
    }
  };

  const handleArchiveCase = async (caseId: string) => {
    if (confirm("Deseja marcar este processo como CONCLUÍDO/ARQUIVADO?")) {
       await api.updateCaseStatus(caseId, 'CONCLUDED');
       setRefreshKey(k => k + 1);
    }
  };

  const handleEditCaseTitle = async (c: LegalCase) => {
    const newTitle = prompt("Novo título do processo:", c.title);
    if (newTitle && newTitle !== c.title) {
       if ((api as any).updateCaseTitle) {
         await (api as any).updateCaseTitle(c.id, newTitle);
         setRefreshKey(k => k + 1);
       }
    }
  };

  const handleWhatsAppContact = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client && client.whatsapp) {
      const num = client.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/55${num}?text=Olá ${client.name}, entrando em contato sobre seu processo.`, '_blank');
    } else {
      alert("Este cliente não possui WhatsApp cadastrado.");
    }
  };

  // --- Detail Actions ---
  const handleConcludeCase = async () => {
    if (!activeCase || !currentUser) return;
    if (!confirm('Deseja realmente marcar este processo como CONCLUÍDO?')) return;
    
    try {
      // @ts-ignore
      await api.updateCaseStatus(activeCase.id, 'CONCLUDED');
      
      // Atualiza o estado visual local imediatamente
      setActiveCase({ ...activeCase, status: 'CONCLUDED' });
      setRefreshKey(k => k + 1);
      alert("Processo concluído com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao concluir o processo. Tente novamente.");
    }
  };

  const handleTransformToJudicial = async () => {
    if (!activeCase || !currentUser) return;
    if (!confirm('Deseja transformar este processo em JUDICIAL?')) return;
    
    try {
      // @ts-ignore
      await api.transformToJudicial(activeCase);
      
      setView('DASHBOARD');
      setRefreshKey(k => k + 1);
      alert('Novo processo judicial criado com sucesso!');
    } catch (e) {
      console.error(e);
      alert("Erro ao transformar processo. Verifique se os modelos estão configurados.");
    }
  };

  // --- Template Manager Logic ---

  const handleCreateTemplate = async () => {
    if (!newTemplateName) return;
    try {
      await (api as any).createTemplate(newTemplateName);
      setNewTemplateName('');
      setRefreshKey(k => k + 1);
    } catch(e) { alert('Erro ao criar template'); }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm("Excluir este modelo? Isso não afetará processos já criados.")) {
       await (api as any).deleteTemplate(id);
       setSelectedTemplate(null);
       setRefreshKey(k => k + 1);
    }
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

  // --- Other Handlers (Existing) ---
  const handleUpdateClient = async (updatedUser: User) => {
    if ((api as any).updateUser) {
      await (api as any).updateUser(updatedUser.id, { name: updatedUser.name, pin: updatedUser.pin, whatsapp: updatedUser.whatsapp, archived: updatedUser.archived });
      setEditingClient(null); setRefreshKey(k => k + 1);
    }
  };
  const handleDeleteClient = async (id: string) => {
    if (confirm('Tem certeza?')) { if ((api as any).deleteUser) { await (api as any).deleteUser(id); setRefreshKey(k => k + 1); } }
  };
  const toggleArchiveClient = async (user: User) => {
     if (confirm(`Deseja ${user.archived ? 'desbloquear' : 'bloquear'} o acesso deste cliente?`)) await handleUpdateClient({ ...user, archived: !user.archived });
  };
  
  // Helpers
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Ativo</span>;
      case 'CONCLUDED': return <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">Concluído</span>;
      case 'MOVED_TO_JUDICIAL': return <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Judicializado</span>;
      default: return null;
    }
  };
  
  // Client Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentClients = clients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(clients.length / itemsPerPage);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen transition-colors duration-300 bg-slate-100 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100">
        
        <button onClick={toggleTheme} className="fixed top-4 right-4 z-50 p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-yellow-400 hover:scale-110 transition-transform shadow-lg">{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>

        {!currentUser ? (
          <div className="min-h-screen flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-800 p-8 rounded-none shadow-2xl max-w-md w-full border-t-8 border-red-950 dark:border-red-800 animate-fade-in transition-colors duration-300 relative">
              
              {/* STATUS INDICATOR (LOGIN SCREEN) */}
              <div className="absolute top-2 right-2">
                 {isSupabaseConfigured ? (
                    <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-[10px] font-bold border border-green-200" title="Banco de Dados Conectado">
                      <Wifi className="w-3 h-3" /> Online
                    </div>
                 ) : (
                    <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-[10px] font-bold border border-amber-200" title="Usando Memória Local (Não Sincronizado)">
                      <WifiOff className="w-3 h-3" /> Local
                    </div>
                 )}
              </div>

              <div className="flex justify-center mb-6"><div className="bg-red-950 dark:bg-red-900 p-4 rounded-full shadow-lg"><Scale className="text-white w-10 h-10" /></div></div>
              <h1 className="text-3xl font-serif text-center text-red-950 dark:text-red-100 mb-1">Felix e Castro</h1>
              <h2 className="text-xs font-bold text-center text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-8">{isRegistering ? 'Criar Nova Conta' : 'Acesso Restrito'}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <input type="text" placeholder="Nome Completo" className="w-full border-b-2 border-slate-300 dark:border-slate-600 bg-transparent p-2 dark:text-white outline-none focus:border-red-900" value={identifier} onChange={e => setIdentifier(e.target.value)} />
                <input type="password" placeholder="PIN" className="w-full border-b-2 border-slate-300 dark:border-slate-600 bg-transparent p-2 dark:text-white outline-none focus:border-red-900" value={pin} onChange={e => setPin(e.target.value)} maxLength={6} />
                {error && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded border border-red-200">{error}</p>}
                
                {!isSupabaseConfigured && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 text-center">
                    <p className="font-bold mb-1"><WifiOff className="w-3 h-3 inline mr-1"/> Modo Local Ativado</p>
                    <p>Você não está conectado ao banco de dados.</p>
                    <p className="mt-1">As contas que você criar agora <strong>não serão visíveis</strong> para os outros advogados.</p>
                  </div>
                )}

                <button className="w-full bg-red-950 dark:bg-red-900 text-white py-4 font-bold uppercase tracking-wider hover:bg-red-900 transition-all">{isRegistering ? 'Cadastrar' : 'Entrar'}</button>
              </form>
              <div className="mt-8 text-center pt-6 border-t dark:border-slate-700">
                 <button onClick={() => setIsRegistering(!isRegistering)} className="text-xs text-slate-500 hover:underline">{isRegistering ? 'Já tenho conta' : 'Criar conta'}</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-screen">
            <nav className="bg-red-950 dark:bg-slate-950 text-white sticky top-0 z-40 shadow-xl border-b border-red-900 dark:border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                  <div className="flex items-center space-x-4 cursor-pointer group" onClick={() => setView('DASHBOARD')}>
                     <div className="bg-white/10 p-2 rounded-full"><Scale className="text-white w-6 h-6" /></div>
                     <div className="flex flex-col">
                       <span className="font-serif text-xl tracking-wide">Felix e Castro</span>
                       <div className="flex items-center gap-2">
                         <span className="text-[10px] uppercase text-red-200">Advocacia</span>
                         {/* Status Indicator in Navbar */}
                         {isSupabaseConfigured ? (
                            <span className="flex items-center gap-0.5 bg-green-500/20 text-green-200 px-1.5 py-0.5 rounded text-[8px] font-bold border border-green-500/30 uppercase tracking-wide">
                              <Wifi className="w-2 h-2" /> Online
                            </span>
                         ) : (
                            <span className="flex items-center gap-0.5 bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded text-[8px] font-bold border border-amber-500/30 uppercase tracking-wide">
                              <WifiOff className="w-2 h-2" /> Local
                            </span>
                         )}
                       </div>
                     </div>
                  </div>
                  <div className="flex items-center space-x-4 md:space-x-6 mr-8">
                    {currentUser.role === 'ADMIN' && (
                       <>
                         <button onClick={handleManualRefresh} className="p-2 text-red-200 hover:text-white hover:bg-red-900 rounded-full" title="Atualizar Dados">
                            <RefreshCw className="w-4 h-4" />
                         </button>
                         <button onClick={() => setView('CLIENT_MANAGER')} className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-red-900/50 hover:bg-red-900 rounded text-sm border border-red-800">
                           <Users className="w-4 h-4" /><span>Clientes</span>
                         </button>
                         <button onClick={() => setView('TEMPLATE_MANAGER')} className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-red-900/50 hover:bg-red-900 rounded text-sm border border-red-800">
                           <Settings className="w-4 h-4" /><span>Modelos</span>
                         </button>
                       </>
                    )}
                    <button onClick={handleLogout} className="flex items-center space-x-2 px-3 py-1.5 bg-red-900/50 hover:bg-red-900 rounded text-sm border border-red-800"><LogOut className="w-4 h-4" /><span className="hidden md:inline">Sair</span></button>
                  </div>
                </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              {view === 'DASHBOARD' && (
                <div className="space-y-10 animate-fade-in">
                  
                  {!isSupabaseConfigured && currentUser.role === 'ADMIN' && (
                    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-6 mb-8 rounded-r shadow-md flex items-start gap-4">
                      <div className="bg-amber-200 p-3 rounded-full"><WifiOff className="w-8 h-8 text-amber-700" /></div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">Atenção: Acesso Universal Desativado</h3>
                        <p className="text-sm mb-2">
                          O aplicativo não conseguiu se conectar ao banco de dados (Supabase).
                          No momento, ele está salvando os dados <strong>apenas neste computador</strong>.
                        </p>
                        <p className="text-sm font-medium mb-3">
                          Isso explica por que o que o Michel cria não aparece para a Luana ou Fabrícia.
                        </p>
                        <div className="bg-white/50 p-3 rounded border border-amber-300 text-xs font-mono text-amber-800">
                          <p className="font-bold text-amber-900 mb-1">COMO RESOLVER:</p>
                          <p>1. Pegue a URL e a ANON_KEY no painel do Supabase.</p>
                          <p>2. Adicione-as nas "Environment Variables" da Vercel.</p>
                          <p>3. OU (Solução Rápida): Cole as chaves no arquivo <code>lib/supabase.ts</code> nas variáveis <code>MANUAL_SUPABASE...</code></p>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentUser.role === 'ADMIN' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Novo Cliente */}
                      <div className="bg-white dark:bg-slate-800 p-6 shadow-sm border-t-4 border-red-900">
                        <h3 className="text-lg font-bold text-red-950 dark:text-red-200 mb-6 flex items-center"><UserIcon className="w-5 h-5 mr-2" /> Novo Cliente</h3>
                        <div className="space-y-4">
                           <input className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white outline-none" placeholder="Nome Completo" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                           <input className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white outline-none" placeholder="Whatsapp" value={newClientWhatsapp} onChange={e => setNewClientWhatsapp(e.target.value)} />
                           <input className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white outline-none" placeholder="PIN" value={newClientPin} onChange={e => setNewClientPin(e.target.value)} maxLength={6} />
                           <button onClick={() => handleCreateUser(newClientName, newClientPin, 'CLIENT')} className="w-full bg-slate-800 text-white py-3 text-xs font-bold uppercase hover:bg-slate-900 mt-2">Cadastrar</button>
                        </div>
                      </div>

                      {/* Novo Processo */}
                      <div className="bg-white dark:bg-slate-800 p-6 shadow-sm border-t-4 border-red-900">
                        <h3 className="text-lg font-bold text-red-950 dark:text-red-200 mb-6 flex items-center"><FileText className="w-5 h-5 mr-2" /> Novo Processo</h3>
                        <div className="space-y-4">
                          <select className="w-full border-b bg-slate-50 dark:bg-slate-700/50 p-3 text-sm dark:text-white" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
                            <option value="">Selecione o Cliente</option>
                            {clients.filter(c => !c.archived).map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
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
                          <button onClick={handleAddCase} className="w-full bg-slate-800 text-white py-3 text-xs font-bold uppercase hover:bg-slate-900 mt-2">Iniciar Processo</button>
                        </div>
                      </div>
                      
                      {/* Equipe */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 shadow-inner border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-6 flex items-center"><Users className="w-5 h-5 mr-2" /> Equipe</h3>
                        <div className="space-y-4 opacity-75 hover:opacity-100">
                           <input className="w-full border p-2 text-sm rounded bg-white dark:bg-slate-700 dark:text-white" placeholder="Nome" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
                           <input className="w-full border p-2 text-sm rounded bg-white dark:bg-slate-700 dark:text-white" placeholder="PIN" value={newAdminPin} onChange={e => setNewAdminPin(e.target.value)} maxLength={6} />
                          <button onClick={() => handleCreateUser(newAdminName, newAdminPin, 'ADMIN')} className="w-full bg-slate-400 text-white py-2 text-xs font-bold uppercase hover:bg-slate-500 rounded">Criar Admin</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lista de Processos */}
                  <div>
                    <h2 className="text-3xl font-serif text-red-950 dark:text-red-100 mb-8 border-l-4 border-red-950 pl-4">Andamentos</h2>
                    <div className="bg-white dark:bg-slate-800 shadow-lg overflow-hidden border-t border-slate-200">
                       {cases.length === 0 ? <div className="p-12 text-center text-slate-500"><Briefcase className="w-12 h-12 mx-auto mb-4 text-slate-300" />Nenhum processo localizado.</div> : (
                         <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                           {cases.map(c => {
                             const template = templates.find(t => t.id === c.type);
                             return (
                               <li key={c.id} className="p-6 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors group">
                                 <div className="flex justify-between items-center">
                                   <div className="cursor-pointer flex-1" onClick={() => { setActiveCase(c); setView('CASE_DETAIL'); }}>
                                     <div className="flex items-center gap-2">
                                       <h4 className="text-xl font-medium text-slate-800 dark:text-slate-200 group-hover:text-red-900">{c.title}</h4>
                                       {renderStatusBadge(c.status || 'ACTIVE')}
                                     </div>
                                     <p className="text-sm text-slate-500 mt-2 flex items-center">
                                       {(c as any).clientName && <span className="font-bold mr-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{(c as any).clientName}</span>}
                                       <span className="text-xs uppercase tracking-wide">{template?.label || c.type}</span>
                                     </p>
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

              {/* --- TEMPLATE MANAGER VIEW --- */}
              {view === 'TEMPLATE_MANAGER' && currentUser.role === 'ADMIN' && (
                <div className="animate-fade-in pb-20">
                   <button onClick={() => setView('DASHBOARD')} className="mb-8 text-sm font-bold text-slate-500 hover:text-red-900 flex items-center uppercase tracking-wider"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</button>
                   
                   <div className="flex flex-col lg:flex-row gap-8">
                     {/* Lista de Templates */}
                     <div className="w-full lg:w-1/3 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 shadow border-t-4 border-purple-900">
                          <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Criar Nova Área/Modelo</h3>
                          <div className="flex gap-2">
                            <input className="flex-1 border p-2 text-sm rounded dark:bg-slate-700 dark:text-white" placeholder="Ex: Cível Genérico" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
                            <button onClick={handleCreateTemplate} className="bg-purple-900 text-white p-2 rounded hover:bg-purple-800"><Plus className="w-5 h-5"/></button>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700">
                          <h3 className="font-bold text-slate-700 dark:text-slate-200 p-4 border-b dark:border-slate-700 flex items-center"><List className="w-4 h-4 mr-2"/> Modelos Disponíveis</h3>
                          <ul>
                            {templates.map(t => (
                              <li 
                                key={t.id} 
                                onClick={() => setSelectedTemplate(t)}
                                className={`p-4 border-b dark:border-slate-700 cursor-pointer flex justify-between items-center ${selectedTemplate?.id === t.id ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-600' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                              >
                                <span className="text-sm font-medium dark:text-slate-200">{t.label}</span>
                                {!t.isSystem && <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>}
                              </li>
                            ))}
                          </ul>
                        </div>
                     </div>

                     {/* Editor de Passos */}
                     <div className="w-full lg:w-2/3">
                        {selectedTemplate ? (
                          <div className="bg-white dark:bg-slate-800 shadow-xl border-t-8 border-purple-900 p-6 relative">
                             <div className="flex justify-between items-start mb-6 border-b pb-4">
                               <div>
                                 <h2 className="text-2xl font-serif text-purple-900 dark:text-purple-200">{selectedTemplate.label}</h2>
                                 <p className="text-sm text-slate-500">Editando estrutura padrão para novos processos.</p>
                               </div>
                               {selectedTemplate.isSystem && <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded">Sistema (Somente Leitura parcial)</span>}
                             </div>

                             {/* Add Step */}
                             <div className="bg-slate-50 dark:bg-slate-700/50 p-4 mb-6 rounded border border-slate-200 dark:border-slate-600 flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 w-full">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Nome da Etapa</label>
                                  <input className="w-full border p-2 text-sm rounded dark:bg-slate-800 dark:text-white mt-1" placeholder="Ex: Audiência" value={newTemplateStepLabel} onChange={e => setNewTemplateStepLabel(e.target.value)} />
                                </div>
                                <div className="w-full md:w-24">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Dias</label>
                                  <input type="number" className="w-full border p-2 text-sm rounded dark:bg-slate-800 dark:text-white mt-1" value={newTemplateStepDuration} onChange={e => setNewTemplateStepDuration(Number(e.target.value))} />
                                </div>
                                <div className="w-full md:w-48">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Onde Inserir?</label>
                                  <select 
                                    className="w-full border p-2 text-sm rounded dark:bg-slate-800 dark:text-white mt-1"
                                    value={newTemplateStepPosition}
                                    onChange={e => setNewTemplateStepPosition(e.target.value)}
                                  >
                                    <option value="END">Ao Final</option>
                                    <option value="START">No Início</option>
                                    {selectedTemplate.steps.map((s, idx) => (
                                      <option key={s.id} value={idx + 1}>Após: {s.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <button onClick={handleAddTemplateStep} className="bg-purple-900 text-white px-4 py-2 rounded text-sm font-bold hover:bg-purple-800 h-10 w-full md:w-auto">Adicionar</button>
                             </div>

                             {/* Steps List */}
                             <div className="space-y-2">
                               {selectedTemplate.steps.length === 0 && <p className="text-center text-slate-400 py-8">Nenhuma etapa definida.</p>}
                               {selectedTemplate.steps.map((step, idx) => (
                                 <div key={step.id} className="flex items-center p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm rounded">
                                   <div className="bg-purple-100 text-purple-800 font-bold w-8 h-8 rounded-full flex items-center justify-center mr-4 text-xs">{idx + 1}</div>
                                   <div className="flex-1">
                                     <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{step.label}</p>
                                     <p className="text-xs text-slate-500">Prazo estimado: {step.expectedDuration} dias</p>
                                   </div>
                                   <button onClick={() => handleDeleteTemplateStep(step.id)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4"/></button>
                                 </div>
                               ))}
                             </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 rounded p-12">
                             Selecione um modelo à esquerda para editar.
                          </div>
                        )}
                     </div>
                   </div>
                </div>
              )}

              {/* ... (CLIENT MANAGER view) ... */}
               {view === 'CLIENT_MANAGER' && currentUser.role === 'ADMIN' && (
                <div className="animate-fade-in space-y-6">
                  <div className="flex justify-between items-center">
                    <button onClick={() => setView('DASHBOARD')} className="text-sm font-bold text-slate-500 hover:text-red-900 flex items-center uppercase tracking-wider"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</button>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 mb-4">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Dica para Admin:</strong> Para redefinir a senha de um cliente, basta editar o campo "PIN" e clicar no ícone de confirmação (<CheckCheck className="w-3 h-3 inline"/>). O cliente poderá acessar imediatamente com a nova senha.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 shadow-xl overflow-hidden rounded border-t-4 border-red-900">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                      <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Nome (Login)</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">PIN (Senha)</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Ações</th></tr></thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {currentClients.map(client => (
                          <tr key={client.id} className={client.archived ? 'bg-slate-50 dark:bg-slate-900 opacity-60' : ''}>
                             <td className="px-6 py-4 text-sm font-medium dark:text-slate-200">
                               {editingClient?.id === client.id ? (
                                <input 
                                  className="border p-1 rounded dark:bg-slate-700 w-full" 
                                  value={editingClient.name} 
                                  onChange={e => setEditingClient({...editingClient, name: e.target.value})} 
                                />
                              ) : client.name}
                             </td>
                             <td className="px-6 py-4 text-sm font-mono dark:text-slate-300">
                               {editingClient?.id === client.id ? (
                                <input 
                                  className="border p-1 rounded w-24 dark:bg-slate-700 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300" 
                                  value={editingClient.pin} 
                                  onChange={e => setEditingClient({...editingClient, pin: e.target.value})} 
                                  placeholder="Novo PIN"
                                />
                              ) : client.pin}
                             </td>
                             <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                               {editingClient?.id === client.id ? (
                                <button onClick={() => handleUpdateClient(editingClient)} className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded" title="Salvar Alterações"><CheckCheck className="w-4 h-4" /></button>
                               ) : (
                                <>
                                  <button onClick={() => setEditingClient(client)} className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded" title="Editar / Redefinir Senha"><Edit className="w-4 h-4" /></button>
                                  <button onClick={() => toggleArchiveClient(client)} className={`${client.archived ? 'text-green-600' : 'text-amber-600'} hover:opacity-80 p-1 hover:bg-slate-50 rounded`} title={client.archived ? "Desbloquear Acesso" : "Bloquear Acesso"}>{client.archived ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4"/>}</button>
                                  <button onClick={() => handleDeleteClient(client.id)} className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded" title="Excluir"><Trash2 className="w-4 h-4"/></button>
                                </>
                               )}
                             </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ... (CASE DETAIL view) ... */}
              {view === 'CASE_DETAIL' && activeCase && (
                <div className="animate-fade-in pb-20">
                  <button onClick={() => setView('DASHBOARD')} className="mb-8 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-red-900 flex items-center uppercase tracking-wider"><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</button>
                  <div className="bg-white dark:bg-slate-800 shadow-2xl border-t-8 border-red-950 dark:border-red-800 p-6 md:p-10 relative">
                    <div className="border-b border-slate-100 dark:border-slate-700 pb-8 mb-10">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                         <div>
                            <h1 className="text-3xl md:text-4xl font-serif text-red-950 dark:text-red-100 mb-2">{activeCase.title}</h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                              {/* Busca nome do template */}
                              {templates.find(t => t.id === activeCase.type)?.label || activeCase.type}
                              {activeCase.benefitType && ` - ${PREVIDENCIARIO_BENEFITS[activeCase.benefitType].label}`}
                            </p>
                         </div>
                         {renderStatusBadge(activeCase.status || 'ACTIVE')}
                       </div>
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
                  </div>
                </div>
              )}
            </main>
            <FloatingSupport />
            <StepModal 
              step={activeStep} isOpen={!!activeStep} onClose={() => setActiveStep(null)} isAdmin={currentUser.role === 'ADMIN'}
              onUpdate={async (c, comp, d) => { 
                if(activeCase && activeStep) { 
                  // Passar activeCase.id e activeStep.id corretamente
                  await api.updateStep(activeCase.id, activeStep.id, c, comp ? 'COMPLETE' : 'COMMENT_ONLY', undefined, d);
                  
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
              onDelete={async () => { if(activeCase && activeStep && (api as any).deleteStep) { await (api as any).deleteStep(activeStep.id); setActiveStep(null); setRefreshKey(k => k+1); }}}
              onRename={async (l, d) => { if(activeCase && activeStep) { await api.updateStep(activeCase.id, activeStep.id, null, 'UPDATE_LABEL', l, undefined, d); setRefreshKey(k => k+1); }}}
            />
            <StepModal step={{id: 'new', label: '', status: 'LOCKED', stepOrder: 0}} isOpen={isAddStepModalOpen} onClose={() => setIsAddStepModalOpen(false)} isAdmin={true} isAdding={true} stepsList={activeCase?.steps} 
              onAdd={async (l, p, d) => { if(activeCase && (api as any).addStep) { await (api as any).addStep(activeCase.id, l, p, d); setRefreshKey(k => k+1); } }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
export default App;
