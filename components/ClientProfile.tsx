import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Mail, Phone, MapPin, Save, Loader2 } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';

interface ClientProfileProps {
  currentUser: User;
  onUpdate: (updatedUser: User) => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ currentUser, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: currentUser.email || '',
    whatsapp: currentUser.whatsapp || '',
    address: currentUser.address || ''
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await firebaseService.updateUser(currentUser.id, formData);
      onUpdate({ ...currentUser, ...formData });
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden border border-slate-100 dark:border-slate-800 mb-10">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <h3 className="font-serif text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-bordo-900" />
          Meus Dados
        </h3>
        {!isEditing ? (
          <button 
            onClick={() => setIsEditing(true)}
            className="text-sm font-bold text-bordo-900 dark:text-bordo-400 uppercase tracking-widest hover:underline"
          >
            Editar Dados
          </button>
        ) : (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsEditing(false)}
              className="text-sm font-bold text-slate-500 uppercase tracking-widest hover:underline"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 text-sm font-bold text-white bg-bordo-900 px-3 py-1.5 rounded hover:bg-bordo-950 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar
            </button>
          </div>
        )}
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" /> E-mail
            </label>
            {isEditing ? (
              <input 
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
                placeholder="seu@email.com"
              />
            ) : (
              <p className="text-slate-900 dark:text-white font-medium">{currentUser.email || 'Não informado'}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" /> WhatsApp
            </label>
            {isEditing ? (
              <input 
                type="tel"
                value={formData.whatsapp}
                onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
                placeholder="(00) 00000-0000"
              />
            ) : (
              <p className="text-slate-900 dark:text-white font-medium">{currentUser.whatsapp || 'Não informado'}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Endereço Completo
            </label>
            {isEditing ? (
              <input 
                type="text"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
                placeholder="Rua, Número, Bairro, Cidade - Estado, CEP"
              />
            ) : (
              <p className="text-slate-900 dark:text-white font-medium">{currentUser.address || 'Não informado'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
