import React, { useState, useEffect } from 'react';
import { Scale, LogIn, Shield, Clock, Gavel, User, Mail, Phone, Award, CheckCircle2, Users } from 'lucide-react';
import { BenefitsAnalyzer } from './BenefitsAnalyzer';
import { firebaseService } from '../services/firebaseService';
import { TeamMember } from '../types';

interface LandingPageProps {
  onLoginClick: () => void;
  isLoggedIn?: boolean;
  onAnalysisComplete?: (result: string, data: any) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, isLoggedIn, onAnalysisComplete }) => {
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    const fetchTeam = async () => {
      const members = await firebaseService.getTeamMembers();
      if (members.length > 0) {
        setTeam(members);
      } else {
        // Fallback or seed if needed
        await firebaseService.seedTeamMembers();
        const seededMembers = await firebaseService.getTeamMembers();
        setTeam(seededMembers);
      }
    };
    fetchTeam();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-bordo-900 selection:text-white">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-bordo-900 text-white rounded-xl shadow-lg shadow-bordo-900/20">
              <Scale size={24} />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-slate-900 dark:text-white tracking-tight leading-none">Felix e Castro</h1>
              <p className="text-[10px] text-bordo-900 dark:text-bordo-400 font-bold tracking-[0.2em] uppercase mt-1">Advocacia Especializada</p>
            </div>
          </div>
          <button 
            onClick={onLoginClick}
            className="group flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2.5 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/10"
          >
            <LogIn size={18} className="group-hover:translate-x-0.5 transition-transform" />
            <span>{isLoggedIn ? 'Acessar Painel' : 'Área do Cliente'}</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-5 dark:opacity-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(#450a0a_1px,transparent_1px)] [background-size:40px_40px]"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bordo-50 dark:bg-bordo-900/20 border border-bordo-100 dark:border-bordo-900/30 text-bordo-900 dark:text-bordo-400 text-xs font-bold uppercase tracking-widest mb-8 animate-fade-in">
              <Award size={14} />
              <span>Referência em Direito Previdenciário</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl font-serif font-bold text-slate-900 dark:text-white mb-8 leading-[1.1] tracking-tight">
              Justiça e dignidade para o seu <span className="text-bordo-900 italic">futuro.</span>
            </h2>
            
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-12 leading-relaxed max-w-2xl mx-auto">
              Unimos excelência jurídica e tecnologia para garantir que seus direitos sejam respeitados. Acompanhe cada passo do seu processo com total transparência.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <a href="#analyzer" className="w-full sm:w-auto bg-bordo-900 hover:bg-bordo-950 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all shadow-2xl shadow-bordo-900/30 hover:-translate-y-1 active:translate-y-0">
                Analisar meu benefício
              </a>
              <button onClick={onLoginClick} className="w-full sm:w-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 px-10 py-5 rounded-2xl font-bold text-lg transition-all">
                Acompanhar processo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-32 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 dark:text-white mb-4">Nossa Equipe</h2>
            <div className="w-20 h-1 bg-bordo-900 mx-auto mb-6"></div>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Profissionais altamente qualificados e comprometidos com a excelência no atendimento previdenciário.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {team.map((member, idx) => (
              <div key={idx} className="group relative">
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl mb-6 shadow-2xl grayscale hover:grayscale-0 transition-all duration-700">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bordo-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                    <p className="text-white/90 text-sm leading-relaxed">{member.description}</p>
                  </div>
                </div>
                <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-1">{member.name}</h3>
                <p className="text-bordo-900 dark:text-bordo-400 font-bold text-xs uppercase tracking-widest mb-2">{member.role}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{member.specialty}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <div className="relative">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 text-bordo-900 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-slate-200 dark:shadow-none">
                <Shield size={32} />
              </div>
              <h3 className="text-2xl font-serif font-bold mb-4">Segurança Jurídica</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Atuamos com ética inabalável e transparência total, garantindo que cada decisão seja fundamentada na melhor estratégia para o seu benefício.</p>
            </div>
            <div className="relative">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 text-bordo-900 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-slate-200 dark:shadow-none">
                <Clock size={32} />
              </div>
              <h3 className="text-2xl font-serif font-bold mb-4">Acompanhamento Digital</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Inovamos com um painel exclusivo onde você acompanha cada andamento do seu processo em tempo real, sem burocracia ou esperas desnecessárias.</p>
            </div>
            <div className="relative">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 text-bordo-900 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-slate-200 dark:shadow-none">
                <Gavel size={32} />
              </div>
              <h3 className="text-2xl font-serif font-bold mb-4">Foco Especializado</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Nossa dedicação exclusiva ao Direito Previdenciário nos permite dominar as nuances do INSS, maximizando as chances de êxito em cada pedido.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Analyzer Section */}
      <section id="analyzer" className="py-32 bg-white dark:bg-slate-950 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-bordo-900/5 rounded-full blur-3xl -z-10"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 dark:text-white mb-4">Análise Inteligente</h2>
            <p className="text-slate-600 dark:text-slate-400">Descubra em poucos minutos suas chances de obter o benefício desejado.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <BenefitsAnalyzer onLoginClick={onLoginClick} isLoggedIn={isLoggedIn} onAnalysisComplete={onAnalysisComplete} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-2 bg-bordo-900 text-white rounded-lg">
                  <Scale size={24} />
                </div>
                <h2 className="text-2xl font-serif font-bold">Felix e Castro</h2>
              </div>
              <p className="text-slate-400 max-w-sm leading-relaxed">
                Escritório de advocacia especializado em Direito Previdenciário, comprometido com a justiça social e a proteção dos direitos dos trabalhadores e segurados.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest mb-8 text-bordo-400">Contato</h4>
              <ul className="space-y-4 text-slate-400">
                <li className="flex items-center gap-3">
                  <Phone size={16} className="text-bordo-400" />
                  <span>(21) 99126-7020</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail size={16} className="text-bordo-400" />
                  <span>contato@felixecastro.adv.br</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest mb-8 text-bordo-400">Localização</h4>
              <p className="text-slate-400 leading-relaxed">
                Av. Presidente Lincoln, n. 500, Sala 204<br />
                Jardim Meriti, São João de Meriti - RJ<br />
                CEP: 25555-201
              </p>
            </div>
          </div>
          <div className="pt-12 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} Felix e Castro Advocacia. Todos os direitos reservados.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
