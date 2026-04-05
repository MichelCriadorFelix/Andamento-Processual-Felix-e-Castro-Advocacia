import React, { useState } from 'react';
import { UserQualification, User } from '../types';
import { Edit, CheckCheck, X, User as UserIcon, Activity, Calendar, FileText, Download } from 'lucide-react';

interface QualificationCardProps {
  user: User;
  isAdmin: boolean;
  onUpdateQualification?: (qualification: UserQualification) => Promise<void>;
}

const formatName = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export const QualificationCard: React.FC<QualificationCardProps> = ({ user, isAdmin, onUpdateQualification }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedQual, setEditedQual] = useState<UserQualification>(user.qualification || {});

  const handleSave = async () => {
    if (onUpdateQualification) {
      await onUpdateQualification(editedQual);
    }
    setIsEditing(false);
  };

  const handleDownload = () => {
    if (!user.analysisData || !user.analysisData.formData) return;
    
    const dataStr = JSON.stringify(user.analysisData.formData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_analise_${formatName(user.name).replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user.qualification && !isAdmin) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-bordo-900" />
          Qualificação do Cliente
        </h3>
        <div className="flex items-center gap-4">
          {isAdmin && user.analysisData && (
            <button onClick={handleDownload} className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1" title="Baixar Relatório Completo">
              <Download className="w-4 h-4" /> Baixar Relatório
            </button>
          )}
          {isAdmin && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1">
              <Edit className="w-4 h-4" /> Editar
            </button>
          )}
          {isAdmin && isEditing && (
            <div className="flex gap-2">
              <button onClick={handleSave} className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1">
                <CheckCheck className="w-4 h-4" /> Salvar
              </button>
              <button onClick={() => { setIsEditing(false); setEditedQual(user.qualification || {}); }} className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
                <X className="w-4 h-4" /> Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sexo</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.gender || ''} onChange={e => setEditedQual({...editedQual, gender: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Idade</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.age || ''} onChange={e => setEditedQual({...editedQual, age: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tempo de Contribuição</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.contributionTime || ''} onChange={e => setEditedQual({...editedQual, contributionTime: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Última Contribuição</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.lastContributionDate || ''} onChange={e => setEditedQual({...editedQual, lastContributionDate: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CID / Doença</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.cid || ''} onChange={e => setEditedQual({...editedQual, cid: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deficiência</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.disabilityType || ''} onChange={e => setEditedQual({...editedQual, disabilityType: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Possui Laudo?</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.hasMedicalReport?.toString() || ''} onChange={e => setEditedQual({...editedQual, hasMedicalReport: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Possui PPP?</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.ppp || ''} onChange={e => setEditedQual({...editedQual, ppp: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">INSS Negado?</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.inssDenied || ''} onChange={e => setEditedQual({...editedQual, inssDenied: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Justiça Negada?</label>
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.courtDenied || ''} onChange={e => setEditedQual({...editedQual, courtDenied: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Documentos</label>
            <textarea className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={editedQual.documents || ''} onChange={e => setEditedQual({...editedQual, documents: e.target.value})} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(user.email || user.whatsapp || user.address) && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Dados de Contato</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {user.email && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">E-mail</p>
                    <p className="text-sm font-medium dark:text-slate-300">{user.email}</p>
                  </div>
                )}
                {user.whatsapp && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">WhatsApp</p>
                    <p className="text-sm font-medium dark:text-slate-300">{user.whatsapp}</p>
                  </div>
                )}
                {user.address && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Endereço</p>
                    <p className="text-sm font-medium dark:text-slate-300">{user.address}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Idade / Sexo</p>
            <p className="text-sm font-medium dark:text-white">{user.qualification?.age || '--'} anos • {user.qualification?.gender || '--'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Tempo Contrib.</p>
            <p className="text-sm font-medium dark:text-white">{user.qualification?.contributionTime || '--'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> CID / Doença</p>
            <p className="text-sm font-medium dark:text-white">{user.qualification?.cid || user.qualification?.disabilityType || '--'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/> Laudo</p>
            <p className="text-sm font-medium dark:text-white">{user.qualification?.hasMedicalReport ? 'Sim' : 'Não / Não Informado'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/> PPP</p>
            <p className="text-sm font-medium dark:text-white">{user.qualification?.ppp || '--'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/> INSS Negado</p>
            <p className="text-sm font-medium dark:text-white">{user.qualification?.inssDenied || '--'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/> Justiça Negada</p>
            <p className="text-sm font-medium dark:text-white">{user.qualification?.courtDenied || '--'}</p>
          </div>
          {user.qualification?.documents && (
            <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-xl md:col-span-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/> Documentos Mencionados</p>
              <p className="text-sm font-medium dark:text-white whitespace-pre-wrap">{user.qualification.documents}</p>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
};
