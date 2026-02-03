
import React, { useState, useEffect, useRef } from 'react';
import { Step, LegalCase, CaseDocument, User } from '../types';
import { X, Save, CheckSquare, Trash2, Edit2, Calendar, Camera, FileText, Download, Plus, Loader2, Image as ImageIcon, AlertTriangle, RotateCw, RotateCcw, Scissors, UploadCloud, UserCheck } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import Compressor from 'compressorjs';
// @ts-ignore
import Cropper from 'cropperjs';

// Lista atualizada conforme pedido
const DOC_TYPES = [
  "Identidade",
  "CPF",
  "Comprovante de residência",
  "Laudos",
  "Exames/Documentos médicos",
  "Carteira de Trabalho",
  "Perfil Profissiográfico (PPP)",
  "Contra-cheques",
  "Prints de Conversa no Whatsapp",
  "Termo de Rescisão",
  "Certidão de Nascimento",
  "Certidão de Casamento",
  "Certidão de Óbito",
  "Certidão União Estável",
  "Fotos ambiente de trabalho",
  "Declaração Escolar",
  "Demais provas 1",
  "Demais provas 2",
  "Demais provas 3",
  "Demais provas 4",
  "Demais provas 5",
  "Outro Documento"
];

interface StepModalProps {
  step: Step | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  currentUser?: User | null; // Adicionado para auditoria
  onUpdate?: (comment: string, complete: boolean, completionDate?: string) => void;
  onDelete?: () => void;
  onRename?: (newLabel: string, newDuration?: number) => void;
  isAdding?: boolean; 
  stepsList?: Step[]; 
  onAdd?: (label: string, positionIndex: number, duration: number) => void;
  activeCaseId?: string; 
}

export const StepModal: React.FC<StepModalProps> = ({ 
  step, isOpen, onClose, isAdmin, currentUser, onUpdate, onDelete, onRename, 
  isAdding, stepsList, onAdd, activeCaseId
}) => {
  const [comment, setComment] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState('');
  const [editedDuration, setEditedDuration] = useState<number>(0);

  const [newStepLabel, setNewStepLabel] = useState('');
  const [newStepDuration, setNewStepDuration] = useState(15);
  const [insertPosition, setInsertPosition] = useState('end');

  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [docName, setDocName] = useState('');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null); // Ref para upload direto

  // States para Crop
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<any>(null); // Instância do Cropper

  useEffect(() => {
    if (step) {
      setComment(step.adminComment || '');
      setEditedLabel(step.label);
      setEditedDuration(step.expectedDuration || 0);
      setCompletionDate(new Date().toISOString().split('T')[0]); 
      setIsEditingLabel(false);
      
      setIsScanning(false);
      setCapturedImages([]);
      setDocName('');
      setCropIndex(null); // Reset crop

      const isDocStep = step.label.toLowerCase().includes('documenta') || step.label.toLowerCase().includes('doc.');
      if (activeCaseId && isSupabaseConfigured && isDocStep) {
         loadDocuments();
      }
    }
    if (isAdding) {
      setNewStepLabel('');
      setNewStepDuration(15);
      setInsertPosition('end');
    }
  }, [step, isAdding, isOpen, activeCaseId]);

  // Inicializar Cropper quando cropIndex for definido
  useEffect(() => {
    if (cropIndex !== null && imageRef.current) {
      setTimeout(() => {
          if (imageRef.current) {
              cropperRef.current = new Cropper(imageRef.current, {
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.9,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
              } as any);
          }
      }, 100);
    }

    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
    };
  }, [cropIndex]);

  const loadDocuments = async () => {
    if (!activeCaseId) return;
    try {
      const docs = await supabaseService.getDocuments(activeCaseId);
      setDocuments(docs);
    } catch (e) { console.error("Erro ao carregar docs", e); }
  };

  // --- HANDLER: Upload Direto (PDF/Imagem do PC) ---
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeCaseId) return;

    // Prompt simples para nome
    const nameInput = prompt("Digite o nome deste documento (ex: Identidade, Procuração):");
    if (!nameInput) {
      alert("Upload cancelado: Nome do documento é obrigatório.");
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    try {
      const file = files[0];
      // Validação de segurança básica no frontend
      if (file.type !== 'application/pdf' && !file.type.match('image.*')) {
        alert("Apenas arquivos PDF ou Imagens (JPG/PNG) são permitidos por segurança.");
        return;
      }

      await supabaseService.uploadDocument(
        activeCaseId, 
        nameInput, 
        file,
        currentUser?.name, // Auditoria
        currentUser?.role // Auditoria
      );
      
      alert("Arquivo enviado com sucesso!");
      loadDocuments();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao enviar arquivo: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsProcessing(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  // --- HANDLER: Câmera (Scanner) ---
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    let processedCount = 0;
    let hasInvalidFile = false;

    Array.from(files).forEach(file => {
      // SEGURANÇA: Validação de Tipo de Arquivo
      if (!file.type.match('image.*')) {
        hasInvalidFile = true;
        processedCount++; 
        if (processedCount === files.length) setIsProcessing(false);
        return;
      }

      new Compressor(file, {
        quality: 0.7,
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

    if (hasInvalidFile) {
      alert("Atenção: Alguns arquivos foram ignorados pois não são imagens. Por segurança, apenas fotos são permitidas.");
    }
  };

  const rotateImage = (index: number, direction: 'left' | 'right') => {
    const imgData = capturedImages[index];
    const img = new Image();
    img.src = imgData;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(direction === 'right' ? 90 * Math.PI / 180 : -90 * Math.PI / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const newBase64 = canvas.toDataURL('image/jpeg');
        
        setCapturedImages(prev => {
          const newArr = [...prev];
          newArr[index] = newBase64;
          return newArr;
        });
      }
    };
  };

  const confirmCrop = () => {
    if (cropperRef.current && cropIndex !== null) {
      const canvas = cropperRef.current.getCroppedCanvas();
      if (canvas) {
        const croppedBase64 = canvas.toDataURL('image/jpeg');
        setCapturedImages(prev => {
          const newArr = [...prev];
          newArr[cropIndex] = croppedBase64;
          return newArr;
        });
        setCropIndex(null); 
      }
    }
  };

  const removeImage = (index: number) => {
    if(confirm("Remover esta foto?")) {
      setCapturedImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSaveScannedDocument = async () => {
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
      
      await supabaseService.uploadDocument(
        activeCaseId, 
        docName, 
        pdfBlob,
        currentUser?.name, // Auditoria
        currentUser?.role // Auditoria
      );
      
      alert("Documento salvo com sucesso!");
      setIsScanning(false);
      setCapturedImages([]);
      setDocName('');
      loadDocuments(); 
    } catch (e: any) {
      console.error("Erro completo:", e);
      let errorMsg = "Erro desconhecido.";
      if (typeof e === 'string') errorMsg = e;
      else if (e?.message) errorMsg = e.message;
      
      if (errorMsg.toLowerCase().includes("security") || errorMsg.toLowerCase().includes("policy")) {
         errorMsg = "ERRO DE PERMISSÃO NO SUPABASE (RLS). Execute o script SQL de correção.";
      }
      alert(`FALHA NO UPLOAD:\n\n${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDeleteDocument = async (doc: CaseDocument) => {
    if (!activeCaseId) return;
    if (confirm(`Tem certeza que deseja excluir o documento "${doc.name}"?`)) {
       try {
         await supabaseService.deleteDocument(activeCaseId, doc.name);
         loadDocuments();
       } catch(e) {
         console.error(e);
         alert("Erro ao excluir documento.");
       }
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

  if (isAdding && onAdd && stepsList) {
    // ... (Mantive o código do modal de adicionar etapa igual, sem alterações)
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

  if (!step) return null;
  
  const isDocumentStep = step.label.toLowerCase().includes('documenta') || step.label.toLowerCase().includes('doc.');
  const canManageDocs = isAdmin || step.status !== 'COMPLETED';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-red-900/20 dark:border-red-900/50 my-8">
        
        {/* HEADER */}
        <div className="bg-red-950 dark:bg-slate-950 px-6 py-4 flex justify-between items-center border-b border-red-900 dark:border-slate-800">
           {/* ... Header content mantido ... */}
           <h3 className="text-white font-serif font-medium text-lg truncate pr-4">
             {step.label} 
             <span className="text-xs text-red-300 ml-2 font-sans border border-red-800 px-1 rounded">
               {step.expectedDuration ? `${step.expectedDuration} dias` : 'S/P'}
             </span>
           </h3>
           <button onClick={onClose} className="text-red-200 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
        </div>
        
        <div className="p-6 relative">
          {/* EDITOR DE CROP (OVERLAY) - Mantido */}
          {cropIndex !== null && (
            <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col">
              <div className="flex-1 overflow-hidden bg-black flex items-center justify-center p-4">
                <img 
                   ref={imageRef}
                   src={capturedImages[cropIndex]} 
                   alt="Crop target" 
                   className="max-h-full max-w-full"
                   style={{ display: 'block', maxWidth: '100%' }}
                />
              </div>
              <div className="p-4 bg-slate-800 flex justify-between items-center border-t border-slate-700">
                 <button onClick={() => setCropIndex(null)} className="text-white font-bold text-sm px-4 py-2 hover:bg-slate-700 rounded">Cancelar</button>
                 <button 
                   onClick={confirmCrop}
                   className="bg-green-600 text-white font-bold text-sm px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700"
                 >
                   <CheckSquare className="w-4 h-4"/> Confirmar Recorte
                 </button>
              </div>
            </div>
          )}

          <div className="mb-4 flex justify-between items-center">
             <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
              step.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
              step.status === 'CURRENT' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' :
              'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              {step.status === 'COMPLETED' ? 'CONCLUÍDO' : step.status === 'CURRENT' ? 'EM ANDAMENTO' : 'BLOQUEADO'}
            </span>
          </div>

          {isDocumentStep && (
            <div className="mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
              {!isSupabaseConfigured ? (
                 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded flex items-start gap-2">
                   <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                   <div>
                     <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">Scanner Indisponível</h4>
                     <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                       O sistema não detectou a conexão com o banco de dados (Supabase).
                     </p>
                   </div>
                 </div>
              ) : (
                <>
                  {!isScanning ? (
                    <div className="space-y-3">
                       <div className="flex justify-between items-center mb-2">
                         <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><FileText className="w-4 h-4"/> Documentos Digitais</h4>
                         
                         {canManageDocs && (
                           <div className="flex gap-2">
                              {/* INPUT DE UPLOAD DIRETO */}
                              <input 
                                type="file" 
                                className="hidden" 
                                ref={uploadInputRef}
                                accept="application/pdf,image/*"
                                onChange={handleDirectUpload}
                              />
                              <button 
                                onClick={() => uploadInputRef.current?.click()}
                                className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-slate-300 border border-slate-300"
                                title="Upload de Arquivo (PDF ou Imagem)"
                              >
                                <UploadCloud className="w-3 h-3"/> Upload
                              </button>

                              <button 
                                onClick={() => setIsScanning(true)} 
                                className="text-xs bg-red-950 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-red-900"
                                title="Digitalizar com Câmera"
                              >
                                <Camera className="w-3 h-3"/> Digitalizar
                              </button>
                           </div>
                         )}
                       </div>

                       {documents.length === 0 ? (
                         <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-500">
                           Nenhum documento digitalizado ainda.
                         </div>
                       ) : (
                         <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                           {documents.map((doc, idx) => (
                             <div key={idx} className="flex flex-col p-2 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                               <div className="flex justify-between items-center">
                                 <div className="flex items-center gap-2 overflow-hidden">
                                   <div className="bg-red-100 dark:bg-red-900/50 p-1.5 rounded text-red-800 dark:text-red-300"><FileText className="w-4 h-4"/></div>
                                   <div className="flex flex-col truncate">
                                     <span className="text-sm font-medium truncate dark:text-slate-200">{doc.name}</span>
                                     <span className="text-[10px] text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</span>
                                   </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-1">
                                   <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-600 rounded" title="Baixar Arquivo">
                                     <Download className="w-4 h-4"/>
                                   </a>
                                   {canManageDocs && (
                                     <button 
                                       onClick={() => handleDeleteDocument(doc)}
                                       className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                       title="Excluir Documento"
                                     >
                                       <Trash2 className="w-4 h-4" />
                                     </button>
                                   )}
                                 </div>
                               </div>
                               
                               {/* AUDITORIA (SÓ ADMIN VÊ) */}
                               {isAdmin && doc.uploadedBy && (
                                 <div className="mt-1 ml-9 text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    Enviado por: <span className="font-bold">{doc.uploadedBy}</span> 
                                    {doc.uploaderRole && <span className="opacity-75">({doc.uploaderRole === 'ADMIN' ? 'Equipe' : 'Cliente'})</span>}
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                  ) : (
                    // ... (TELA DE DIGITALIZAÇÃO MANTIDA - Sem alterações profundas, apenas lógica de retorno)
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
                            {DOC_TYPES.map((type, idx) => (
                              <option key={idx} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        {/* ... Input de Foto e Lista de Fotos (Mantidos) ... */}
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
                          
                          <div className="bg-white dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600 overflow-y-auto max-h-64">
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Páginas ({capturedImages.length})</p>
                             <div className="grid grid-cols-1 gap-4">
                               {capturedImages.map((img, i) => (
                                 <div key={i} className="flex flex-col bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="relative h-40 bg-black/5 flex items-center justify-center">
                                       <img src={img} className="max-w-full max-h-full object-contain" alt={`Página ${i+1}`} />
                                    </div>
                                    <div className="flex items-center justify-between p-1 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                                       <button onClick={() => rotateImage(i, 'left')} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded"><RotateCcw className="w-4 h-4"/></button>
                                       <button onClick={() => setCropIndex(i)} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase hover:bg-blue-100"><Scissors className="w-3 h-3"/> Cortar</button>
                                       <button onClick={() => removeImage(i)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                                       <button onClick={() => rotateImage(i, 'right')} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded"><RotateCw className="w-4 h-4"/></button>
                                    </div>
                                 </div>
                               ))}
                               {isProcessing && <div className="flex items-center justify-center h-10"><Loader2 className="w-4 h-4 animate-spin text-red-900"/></div>}
                             </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button onClick={() => setIsScanning(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded">Cancelar</button>
                          <button onClick={handleSaveScannedDocument} disabled={isProcessing || capturedImages.length === 0} className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded flex items-center gap-1 disabled:opacity-50">
                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>} Gerar PDF e Salvar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ... Restante do Modal (Comentários, Datas) Mantido ... */}
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
