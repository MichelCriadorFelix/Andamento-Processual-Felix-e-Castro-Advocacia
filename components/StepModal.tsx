
import React, { useState, useEffect } from 'react';
import { Step } from '../types';
import { X, Save, CheckSquare, Trash2, Edit2, Calendar } from 'lucide-react';

interface StepModalProps {
  step: Step | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onUpdate?: (comment: string, complete: boolean, completionDate?: string) => void;
  onDelete?: () => void;
  onRename?: (newLabel: string, newDuration?: number) => void;
  isAdding?: boolean; // Novo modo: Adicionar Etapa
  stepsList?: Step[]; // Lista de etapas existentes para escolher posição
  onAdd?: (label: string, positionIndex: number, duration: number) => void;
}

export const StepModal: React.FC<StepModalProps> = ({ 
  step, isOpen, onClose, isAdmin, onUpdate, onDelete, onRename, 
  isAdding, stepsList, onAdd 
}) => {
  // States para Edição/Conclusão
  const [comment, setComment] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState('');
  const [editedDuration, setEditedDuration] = useState<number>(0);

  // States para Adição
  const [newStepLabel, setNewStepLabel] = useState('');
  const [newStepDuration, setNewStepDuration] = useState(15);
  const [insertPosition, setInsertPosition] = useState('end');

  useEffect(() => {
    if (step) {
      setComment(step.adminComment || '');
      setEditedLabel(step.label);
      setEditedDuration(step.expectedDuration || 0);
      setCompletionDate(new Date().toISOString().split('T')[0]); // Default to today
      setIsEditingLabel(false);
    }
    if (isAdding) {
      setNewStepLabel('');
      setNewStepDuration(15);
      setInsertPosition('end');
    }
  }, [step, isAdding, isOpen]);

  if (!isOpen) return null;

  // --- MODO ADICIONAR ETAPA ---
  if (isAdding && onAdd && stepsList) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-md animate-fade-in border border-red-900/20">
          <div className="bg-red-950 dark:bg-slate-950 px-6 py-4 border-b border-red-900 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-white font-serif font-medium text-lg">Adicionar Nova Etapa</h3>
            <button onClick={onClose} className="text-red-200 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">Nome da Etapa</label>
              <input 
                className="w-full border p-2 rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                value={newStepLabel}
                onChange={e => setNewStepLabel(e.target.value)}
                placeholder="Ex: Análise de Recurso"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">Prazo Previsto (Dias)</label>
              <input 
                type="number"
                className="w-full border p-2 rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                value={newStepDuration}
                onChange={e => setNewStepDuration(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">Inserir Onde?</label>
              <select 
                className="w-full border p-2 rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                value={insertPosition}
                onChange={e => setInsertPosition(e.target.value)}
              >
                <option value="end">No Final (Última Etapa)</option>
                {stepsList.map((s, idx) => (
                  <option key={s.id} value={idx}>Antes de: {s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300">Cancelar</button>
            <button 
              onClick={() => {
                const pos = insertPosition === 'end' ? stepsList.length : Number(insertPosition);
                onAdd(newStepLabel, pos, newStepDuration);
                onClose();
              }}
              className="px-4 py-2 bg-red-950 text-white rounded font-bold uppercase text-xs"
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MODO DETALHES / EDIÇÃO ---
  if (!step) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-red-900/20 dark:border-red-900/50">
        
        {/* Header */}
        <div className="bg-red-950 dark:bg-slate-950 px-6 py-4 flex justify-between items-center border-b border-red-900 dark:border-slate-800">
          {isEditingLabel ? (
            <div className="flex gap-2 w-full mr-4">
              <input 
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                className="bg-red-900 text-white px-2 py-1 rounded outline-none border border-red-700 w-2/3"
                autoFocus
              />
              <input 
                type="number"
                value={editedDuration}
                onChange={(e) => setEditedDuration(Number(e.target.value))}
                className="bg-red-900 text-white px-2 py-1 rounded outline-none border border-red-700 w-1/3 text-center"
                placeholder="Dias"
              />
            </div>
          ) : (
             <h3 className="text-white font-serif font-medium text-lg truncate pr-4">
               {step.label} 
               <span className="text-xs text-red-300 ml-2 font-sans border border-red-800 px-1 rounded">
                 {step.expectedDuration ? `${step.expectedDuration} dias` : 'S/P'}
               </span>
             </h3>
          )}

          <div className="flex items-center space-x-2">
            {isAdmin && !isEditingLabel && (
              <button onClick={() => setIsEditingLabel(true)} className="text-red-200 hover:text-white transition-colors" title="Editar Etapa">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {isAdmin && isEditingLabel && (
              <button 
                onClick={() => {
                  if (onRename) onRename(editedLabel, editedDuration);
                  setIsEditingLabel(false);
                }} 
                className="text-green-400 hover:text-green-200"
              >
                <Save className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-red-200 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-4 flex justify-between items-center">
             <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
              step.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
              step.status === 'CURRENT' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' :
              'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              {step.status === 'COMPLETED' ? 'CONCLUÍDO' : step.status === 'CURRENT' ? 'EM ANDAMENTO' : 'BLOQUEADO'}
            </span>

            {isAdmin && onDelete && (
              <button 
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir esta etapa?')) onDelete();
                  onClose();
                }}
                className="text-red-600 dark:text-red-400 text-xs hover:underline flex items-center"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Excluir
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-red-950 dark:text-red-200 mb-2">
                Comentários do Advogado
              </label>
              {isAdmin ? (
                <textarea
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-none p-3 text-sm focus:ring-2 focus:ring-red-900 focus:border-transparent outline-none bg-slate-50 dark:bg-slate-900 dark:text-slate-200"
                  rows={4}
                  placeholder="Descreva detalhes sobre o andamento desta fase..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              ) : (
                <div className="bg-slate-50 dark:bg-slate-700/30 border-l-4 border-red-900 dark:border-red-700 p-4 text-sm text-slate-800 dark:text-slate-300 italic min-h-[100px]">
                  {step.adminComment || "Nenhum comentário adicionado."}
                </div>
              )}
            </div>

            {isAdmin && step.status !== 'COMPLETED' && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800 rounded">
                <label className="block text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 uppercase flex items-center">
                  <Calendar className="w-4 h-4 mr-1"/> Data da Conclusão
                </label>
                <input 
                  type="date"
                  className="w-full border p-2 text-sm rounded bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={completionDate}
                  onChange={e => setCompletionDate(e.target.value)}
                />
                <p className="text-[10px] text-amber-700 dark:text-amber-500 mt-1">
                  Se este passo já foi feito antes, altere a data para corrigir a contagem de prazo do próximo passo.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 font-medium">Fechar</button>
          
          {isAdmin && (
            <>
              <button 
                onClick={() => {
                  if (onUpdate) onUpdate(comment, false);
                  onClose();
                }}
                className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-red-900 dark:border-slate-500 text-red-900 dark:text-slate-300 rounded-none text-sm font-bold uppercase tracking-wider"
              >
                <Save className="w-4 h-4 mr-2" /> Salvar
              </button>
              
              {step.status !== 'COMPLETED' && (
                <button 
                  onClick={() => {
                    if (onUpdate) onUpdate(comment, true, completionDate);
                    onClose();
                  }}
                  className="flex items-center px-4 py-2 bg-red-950 dark:bg-red-800 text-white rounded-none text-sm font-bold hover:bg-red-900 dark:hover:bg-red-700 shadow-lg uppercase tracking-wider"
                >
                  <CheckSquare className="w-4 h-4 mr-2" /> Concluir Etapa
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
