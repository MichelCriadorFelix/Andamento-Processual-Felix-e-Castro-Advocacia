
import React, { useState, useEffect, useRef } from 'react';
import { Step, LegalCase, CaseDocument } from '../types';
import { X, Save, CheckSquare, Trash2, Edit2, Calendar, Camera, FileText, Download, Plus, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import Compressor from 'compressorjs';

interface StepModalProps {
  step: Step | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onUpdate?: (comment: string, complete: boolean, completionDate?: string) => void;
  onDelete?: () => void;
  onRename?: (newLabel: string, newDuration?: number) => void;
  isAdding?: boolean; 
  stepsList?: Step[]; 
  onAdd?: (label: string, positionIndex: number, duration: number) => void;
  activeCaseId?: string; // ID do caso para vincular documentos
}

export const StepModal: React.FC<StepModalProps> = ({ 
  step, isOpen, onClose, isAdmin, onUpdate, onDelete, onRename, 
  isAdding, stepsList, onAdd, activeCaseId
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

  // States para Documentos
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [docName, setDocName] = useState('');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step) {
      setComment(step.adminComment || '');
      setEditedLabel(step.label);
      setEditedDuration(step.expectedDuration || 0);
      setCompletionDate(new Date().toISOString().split('T')[0]); 
      setIsEditingLabel(false);
      
      // Reset doc states
      setIsScanning(false);
      setCapturedImages([]);
      setDocName('');

      // Carregar documentos se for a etapa correta e tivermos caseId
      if (activeCaseId && isSupabaseConfigured && step.label.includes('Envio da Documentação')) {
         loadDocuments();
      }
    }
    if (isAdding) {
      setNewStepLabel('');
      setNewStepDuration(15);
      setInsertPosition('end');
    }
  }, [step, isAdding, isOpen, activeCaseId]);

  const loadDocuments = async () => {
    if (!activeCaseId) return;
    try {
      const docs = await supabaseService.getDocuments(activeCaseId);
      setDocuments(docs);
    } catch (e) { console.error("Erro ao carregar docs", e); }
  };

  // --- LÓGICA DE SCANNER / PDF ---

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    let processedCount = 0;

    Array.from(files).forEach(file => {
      new Compressor(file, {
        quality: 0.6,
        maxWidth: 1600,
        maxHeight: 1600,
        success(result) {
          const reader = new FileReader();
          reader.readAsDataURL(result);
          reader.onloadend = () => {
            setCapturedImages(prev => [...prev, reader.result as string]);
            processedCount++;
            if (processedCount === files.length) setIsProcessing(false);
          };
        },
        error(err) {
          console.error(err);
          setIsProcessing(false);
        },
      });
    });
  };

  const handleSaveDocument = async () => {
    if (!docName || capturedImages.length === 0 || !activeCaseId) {
      alert("Preencha o nome do documento e tire pelo menos uma foto.");
      return;
    }

    setIsProcessing(true);
    try {
      const pdf = new jsPDF();
      
      capturedImages.forEach((imgData, index) => {
        if (index > 0) pdf.addPage();
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      });

      const pdfBlob = pdf.output('blob');
      
      // Upload
      await supabaseService.uploadDocument(activeCaseId, docName, pdfBlob);
      
      alert("Documento salvo e comprimido com sucesso!");
      setIsScanning(false);
      setCapturedImages([]);
      setDocName('');
      loadDocuments(); // Reload list
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar documento.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneralSave = () => {
    if (onRename && step && (editedLabel !== step.label || editedDuration !== step.expectedDuration)) {
      onRename(editedLabel, editedDuration);
    }
    if (onUpdate) {
      onUpdate(comment, false);
    }
    onClose();
  };

  if (!isOpen) return null;

  // --- MODO ADICIONAR ETAPA ---
  if (isAdding && onAdd && stepsList) {
    return (
       // ... (Manter código existente de Adicionar Etapa - inalterado neste xml se possível, ou repeti-lo)
       // Repetindo para garantir consistência já que é XML replace
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
  const isDocumentStep = step.label.includes('Envio da Documentação');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-red-900/20 dark:border-red-900/50 my-8">
        
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
                title="Salvar Nome"
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
          </div>

          {/* --- ÁREA DE DOCUMENTOS (SCANNER) --- */}
          {isDocumentStep && isSupabaseConfigured && (
            <div className="mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
              {!isScanning ? (
                <div className="space-y-3">
                   <div className="flex justify-between items-center mb-2">
                     <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><FileText className="w-4 h-4"/> Documentos Digitais</h4>
                     <button 
                       onClick={() => setIsScanning(true)} 
                       className="text-xs bg-red-950 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-red-900"
                     >
                       <Camera className="w-3 h-3"/> Digitalizar Novo
                     </button>
                   </div>

                   {documents.length === 0 ? (
                     <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-500">
                       Nenhum documento digitalizado ainda.
                     </div>
                   ) : (
                     <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                       {documents.map((doc, idx) => (
                         <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                           <div className="flex items-center gap-2 overflow-hidden">
                             <div className="bg-red-100 dark:bg-red-900/50 p-1.5 rounded text-red-800 dark:text-red-300"><FileText className="w-4 h-4"/></div>
                             <div className="flex flex-col truncate">
                               <span className="text-sm font-medium truncate dark:text-slate-200">{doc.name}</span>
                               <span className="text-[10px] text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</span>
                             </div>
                           </div>
                           <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Baixar PDF">
                             <Download className="w-4 h-4"/>
                           </a>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded border border-red-200 dark:border-red-900/30">
                  <h4 className="font-bold text-red-900 dark:text-red-300 mb-3 text-sm">Nova Digitalização</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Documento</label>
                      <select 
                         className="w-full border p-2 text-sm rounded dark:bg-slate-700 dark:text-white"
                         value={docName}
                         onChange={(e) => setDocName(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        <option value="RG e CPF">RG e CPF</option>
                        <option value="Comprovante de Residência">Comprovante de Residência</option>
                        <option value="Carteira de Trabalho">Carteira de Trabalho</option>
                        <option value="Extrato CNIS">Extrato CNIS</option>
                        <option value="Laudos Médicos">Laudos Médicos</option>
                        <option value="Contrato de Honorários">Contrato de Honorários</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        disabled={isProcessing}
                      >
                         <Camera className="w-6 h-6 text-slate-400 mb-1"/>
                         <span className="text-xs font-bold text-slate-500">Tirar Fotos</span>
                         <input 
                           type="file" 
                           ref={fileInputRef} 
                           className="hidden" 
                           accept="image/*" 
                           capture="environment" 
                           multiple 
                           onChange={handleCapture}
                         />
                      </button>
                      
                      <div className="bg-white dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600 overflow-y-auto max-h-32">
                         <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Páginas ({capturedImages.length})</p>
                         <div className="grid grid-cols-3 gap-1">
                           {capturedImages.map((img, i) => (
                             <img key={i} src={img} className="w-full h-10 object-cover rounded border" alt="pag" />
                           ))}
                           {isProcessing && <div className="flex items-center justify-center h-10"><Loader2 className="w-4 h-4 animate-spin text-red-900"/></div>}
                         </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        onClick={() => setIsScanning(false)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded"
                      >
                        Cancelar
                      </button>
                      <button 
                         onClick={handleSaveDocument}
                         disabled={isProcessing || capturedImages.length === 0}
                         className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded flex items-center gap-1 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>} 
                        Salvar PDF
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                onClick={handleGeneralSave}
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
