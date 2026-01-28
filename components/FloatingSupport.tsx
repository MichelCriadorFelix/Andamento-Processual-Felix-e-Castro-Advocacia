import React from 'react';
import { MessageCircle } from 'lucide-react';

export const FloatingSupport: React.FC = () => {
  const phoneNumber = '5521991267020';
  const message = encodeURIComponent('Olá, gostaria de informações sobre meu processo.');

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 bg-green-600 hover:bg-green-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 z-50 flex items-center justify-center"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="w-6 h-6" />
    </a>
  );
};