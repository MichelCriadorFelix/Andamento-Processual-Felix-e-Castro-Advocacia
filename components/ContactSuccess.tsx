import React, { useEffect } from 'react';
import { CheckCircle, ArrowLeft } from 'lucide-react';

export function ContactSuccess() {
  useEffect(() => {
    // Dispara o evento de conversão do Google Ads
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-16923485770/20SgCP-IsqAaEIrW4cw-'
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-premium max-w-lg w-full text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-4">
          Solicitação Recebida!
        </h1>
        
        <p className="text-lg text-gray-600 mb-8">
          Obrigado por entrar em contato. Nossa equipe já recebeu suas informações e o Dr. Michel ou a Dra. Fabrícia entrarão em contato em breve pelo WhatsApp.
        </p>
        
        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center justify-center gap-2 w-full py-4 px-6 bg-bordo-900 text-white rounded-xl font-medium hover:bg-bordo-950 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para o Início
        </button>
      </div>
    </div>
  );
}
