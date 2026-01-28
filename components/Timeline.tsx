
import React, { useRef, useEffect } from 'react';
import { CheckCircle, Lock, Clock, AlertTriangle, Scale, AlertCircle, Phone } from 'lucide-react';
import { Step, CaseType, BenefitType } from '../types';
import { PREVIDENCIARIO_BENEFITS } from '../constants';

interface TimelineProps {
  steps: Step[];
  onStepClick: (step: Step) => void;
  isAdmin: boolean;
  startDate: string;
  caseType: CaseType;
  benefitType?: BenefitType;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, onStepClick, isAdmin, startDate, caseType, benefitType }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const currentStep = document.getElementById('current-step');
      if (currentStep) {
        currentStep.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [steps]);

  // --- Helper: Calcula diferença de dias ---
  const getDaysDiff = (start: string, end: string = new Date().toISOString()) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // --- Lógica Mandado de Segurança (Previdenciário) ---
  const checkMandadoSeguranca = () => {
    // Verifica se o TIPO é Previdenciário (mesmo que venha de um template customizado com esse ID ou string)
    const isPrev = caseType === 'ADMINISTRATIVO_PREVIDENCIARIO';
    
    if (!isPrev) return false;
    
    // Default: Se não tiver tipo específico, usa lógica genérica de 90 dias do início
    if (!benefitType) return getDaysDiff(startDate) > 90;

    const benefitInfo = PREVIDENCIARIO_BENEFITS[benefitType];
    const hasExam = benefitInfo?.hasExam;

    let referenceDate = startDate; // Fallback
    
    if (hasExam) {
      // Regra: A partir da última perícia realizada
      const completedExams = steps.filter(s => 
        (s.label.toLowerCase().includes('perícia') || s.label.toLowerCase().includes('social')) 
        && s.status === 'COMPLETED'
      );
      
      if (completedExams.length > 0) {
        const lastExam = completedExams[completedExams.length - 1];
        if (lastExam.completedDate) referenceDate = lastExam.completedDate;
      } else {
        const entradaStep = steps.find(s => s.label.toLowerCase().includes('entrada') && s.status === 'COMPLETED');
        if (entradaStep?.completedDate) referenceDate = entradaStep.completedDate;
      }
    } else {
      // Regra: Sem perícia -> A partir da entrada (Protocolo)
      const entradaStep = steps.find(s => s.label.toLowerCase().includes('entrada') && s.status === 'COMPLETED');
      if (entradaStep?.completedDate) referenceDate = entradaStep.completedDate;
    }

    return getDaysDiff(referenceDate) > 90;
  };

  const showMandadoSegurancaAlert = checkMandadoSeguranca();

  return (
    <div className="w-full space-y-8">
      {showMandadoSegurancaAlert && (
         <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-600 dark:border-red-500 p-4 shadow-sm flex items-start animate-fade-in">
            <Scale className="text-red-600 dark:text-red-500 w-6 h-6 mr-3 mt-1 flex-shrink-0" />
            <div>
              <p className="text-red-900 dark:text-red-200 text-sm font-bold uppercase tracking-wide mb-1">
                Atenção: Prazo de Mandado de Segurança
              </p>
              <p className="text-red-800 dark:text-red-300 text-sm">
                O prazo de 90 dias após {benefitType && PREVIDENCIARIO_BENEFITS[benefitType].hasExam ? 'a última perícia' : 'a entrada do requerimento'} foi ultrapassado. Preparar MS.
              </p>
            </div>
         </div>
      )}

      <div 
        ref={scrollRef}
        className="flex overflow-x-auto pb-12 pt-4 px-2 snap-x hide-scrollbar space-x-4 md:space-x-8"
        style={{ scrollbarWidth: 'thin' }}
      >
        {steps.map((step, index) => {
          const isCurrent = step.status === 'CURRENT';
          const isCompleted = step.status === 'COMPLETED';
          const isLocked = step.status === 'LOCKED';

          // --- Lógica do Contador de Dias ---
          let daysCount = 0;
          let showCounter = false;
          let isDelayed = false;

          const previousStep = index > 0 ? steps[index - 1] : null;
          const countStartDate = index === 0 ? startDate : previousStep?.completedDate;

          if (isCurrent && countStartDate) {
            showCounter = true;
            daysCount = getDaysDiff(countStartDate);
            if (step.expectedDuration && daysCount > step.expectedDuration) {
              isDelayed = true;
            }
          }

          return (
            <div 
              key={step.id} 
              id={isCurrent ? 'current-step' : undefined}
              className={`flex-shrink-0 relative flex flex-col items-center w-40 md:w-48 snap-center group ${!isLocked || isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => (!isLocked || isAdmin) && onStepClick(step)}
            >
              {/* Connector Line */}
              {index !== 0 && (
                <div className={`absolute top-6 -left-[50%] right-[50%] h-0.5 ${
                  isCompleted ? 'bg-red-900 dark:bg-red-700' : 'bg-slate-200 dark:bg-slate-700'
                } -z-10`} />
              )}

              {/* Icon Bubble */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-md relative
                ${isCompleted ? 'bg-red-950 dark:bg-red-900 border-red-950 dark:border-red-800 text-white' : ''}
                ${isCurrent ? 'bg-white dark:bg-slate-800 border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 ring-4 ring-red-50 dark:ring-red-900/30 scale-110' : ''}
                ${isLocked ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500' : ''}
              `}>
                {isCompleted && <CheckCircle className="w-6 h-6" />}
                {isCurrent && <Clock className="w-6 h-6 animate-pulse" />}
                {isLocked && <Lock className="w-5 h-5" />}
                
                {isDelayed && isCurrent && (
                  <div className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-1 animate-bounce">
                    <AlertCircle className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="mt-4 text-center px-1 w-full">
                <p className={`text-xs md:text-sm font-bold uppercase tracking-wide leading-tight ${
                  isLocked ? 'text-slate-400 dark:text-slate-500' : 'text-red-950 dark:text-red-200'
                }`}>
                  {step.label}
                </p>
                
                {step.expectedDuration !== undefined && step.expectedDuration > 0 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Prazo previsto: {step.expectedDuration} dias
                  </p>
                )}

                {showCounter && (
                   <div className={`mt-2 text-[10px] font-bold border rounded px-2 py-0.5 inline-flex items-center
                     ${isDelayed 
                       ? 'text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' 
                       : 'text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'}
                   `}>
                     <Clock className="w-3 h-3 mr-1" />
                     {daysCount} dias corridos
                   </div>
                )}

                {step.completedDate && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium bg-slate-100 dark:bg-slate-700 inline-block px-2 py-0.5 rounded-full">
                    {new Date(step.completedDate).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              
              {(!isLocked || isAdmin) && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-8 bg-red-950 dark:bg-slate-800 text-white dark:text-slate-200 text-[10px] uppercase font-bold py-1 px-3 rounded shadow-lg z-10">
                  {isAdmin ? 'Editar' : 'Detalhes'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- AVISO AO CLIENTE --- */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-6 rounded-lg shadow-inner">
         <div className="flex items-start gap-4">
           <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
             <Phone className="w-6 h-6 text-red-800 dark:text-red-300" />
           </div>
           <div>
             <h4 className="font-bold text-red-950 dark:text-red-200 mb-2">Dúvidas sobre o andamento?</h4>
             <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
               Caso algum prazo tenha sido ultrapassado ou você não tenha entendido a última movimentação, 
               não hesite em entrar em contato com nossa secretaria. Estamos à disposição para esclarecer 
               cada etapa do seu processo.
             </p>
             <p className="text-xs text-slate-500 mt-2 font-medium">
               Clique no botão do WhatsApp no canto inferior da tela para falar conosco.
             </p>
           </div>
         </div>
      </div>
    </div>
  );
};
