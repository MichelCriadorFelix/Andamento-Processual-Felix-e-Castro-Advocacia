import React from 'react';
import { User, UserQualification } from '../types';
import { QualificationCard } from './QualificationCard';
import { X } from 'lucide-react';

interface QualificationModalProps {
  user: User;
  onClose: () => void;
  onUpdateQualification: (qualification: UserQualification) => Promise<void>;
}

import Markdown from 'react-markdown';

const formatName = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export const QualificationModal: React.FC<QualificationModalProps> = ({ user, onClose, onUpdateQualification }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white">Qualificação: {formatName(user.name)}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          <QualificationCard user={user} isAdmin={true} onUpdateQualification={onUpdateQualification} />
          
          {user.analysisResult && (
            <div className="mt-8">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Relatório da Análise</h4>
              <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700">
                <Markdown>{user.analysisResult}</Markdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
