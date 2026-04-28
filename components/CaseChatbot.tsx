
import React, { useState, useEffect, useRef } from 'react';
import { getGeminiClient, handleGeminiError } from '../lib/gemini';
import { MessageCircle, Send, X, Bot, User as UserIcon, MessageSquare, Phone, Gavel } from 'lucide-react';
import { LegalCase, User } from '../types';
import Markdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface CaseChatbotProps {
  activeCase: LegalCase;
  currentUser: User;
  secretaryWhatsapp?: string;
}

export const CaseChatbot: React.FC<CaseChatbotProps> = ({ activeCase, currentUser, secretaryWhatsapp }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const MAX_MESSAGES = 10; 

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-chatbot', handleOpen);
    return () => window.removeEventListener('open-chatbot', handleOpen);
  }, []);

  const isLuana = activeCase.responsibleLawyer?.toLowerCase().includes('luana');
  const lawyerName = activeCase.responsibleLawyer || 'Dr. Michel';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (overrideMessage?: string) => {
    const messageToSend = overrideMessage || input.trim();
    if (!messageToSend || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: messageToSend }]);
    setMessageCount(prev => prev + 1);
    setIsLoading(true);

    try {
      const caseContext = `
        PROCESSO ATUAL:
        Título: ${activeCase.title}
        Advogado Responsável: ${lawyerName}
        Status: ${activeCase.status}
        Número: ${activeCase.caseNumber || 'Não informado'}
        Orientações: ${activeCase.orientations || 'Nenhuma'}
        Alertas: ${activeCase.alerts || 'Nenhum'}
        Perícias: ${activeCase.expertises?.map(e => `${e.name} em ${e.date} às ${e.time}`).join(', ') || 'Nenhuma agendada'}
        
        ETAPAS (ANDAMENTOS):
        ${activeCase.steps.map(s => `- ${s.label}: ${s.status === 'COMPLETED' ? 'Concluído' : s.status === 'CURRENT' ? 'Em andamento' : 'Aguardando'}. Comentário: ${s.adminComment || 'Sem comentário'}`).join('\n')}
      `;

      const systemInstruction = `
        Você é o assistente virtual do(a) ${lawyerName} do escritório Felix e Castro Advocacia.
        Seu objetivo é ajudar o cliente ${currentUser.name} a entender o andamento do seu processo: "${activeCase.title}".
        
        REGRAS DE CONDUTA:
        1. Seja OBJETIVO, CLARO e DIDÁTICO. O cliente é leigo.
        2. Use linguagem simples, evite termos jurídicos complexos.
        3. Não escreva textos longos. Seja direto ao ponto.
        4. Baseie suas respostas estritamente no contexto do processo fornecido.
        
        FOCO NO TÓPICO:
        5. Responda APENAS sobre o assunto perguntado. Não misture temas.
        6. Se perguntar sobre PERÍCIA: foque em documentos (laudos e exames em ordem cronológica), como se vestir e como agir.
        7. Se perguntar sobre ANDAMENTO/STATUS: foque na fase atual e o que ela significa.
        8. Se perguntar sobre PRÓXIMO PASSO: foque no que deve acontecer em seguida com base na timeline.
        9. Se perguntar sobre SENTENÇA: explique se foi favorável ou não e os próximos passos.
        
        DICAS DE PERÍCIA E DOCUMENTOS:
        - Enfatize que os LAUDOS são os documentos principais.
        - Organize EXAMES e LAUDOS em ORDEM CRONOLÓGICA (do mais antigo para o mais recente).
        - Dicas: roupas discretas, falar a verdade, focar nas limitações.
        
        10. Se a conversa passar de ${MAX_MESSAGES} mensagens, sugira falar com a secretária no WhatsApp.
        
        CONTEXTO DO PROCESSO:
        ${caseContext}
      `;

      const aiText = await handleGeminiError(async () => {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
            { role: 'user', parts: [{ text: messageToSend }] }
          ],
          config: {
            systemInstruction: systemInstruction,
          }
        });
        return response.text || "Desculpe, tive um problema. Tente novamente ou fale com nossa secretária.";
      });

      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
      
      if (messageCount + 1 >= MAX_MESSAGES) {
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: "Para uma análise mais profunda, recomendo falar agora com nossa secretária pelo WhatsApp clicando no botão abaixo." 
        }]);
      }

    } catch (error) {
      console.error("Erro no Chatbot:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Estou em manutenção. Fale com nossa secretária pelo WhatsApp." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    { label: '🔍 Como está meu processo?', value: 'Como está meu processo?' },
    { label: '🩺 Dicas para a perícia', value: 'Dicas para a perícia médica e documentos' },
    { label: '⏭️ Qual o próximo passo?', value: 'Qual o próximo passo do meu processo e o que deve acontecer?' },
    { label: '⚖️ Dúvida sobre a sentença', value: 'O que significa a sentença no meu caso?' },
    { label: '📂 Organizar documentos', value: 'Como devo organizar meus documentos médicos?' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="w-[90vw] md:w-[450px] h-[70vh] md:h-[650px] shadow-premium bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col mb-4 animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-red-950 text-white flex justify-between items-center relative">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="bg-white/20 p-2 rounded-full border border-white/30">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-red-950"></div>
              </div>
              <div>
                <h3 className="font-bold text-base">Assistente do(a) {lawyerName}</h3>
                <p className="text-[10px] text-red-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  Especialista Previdenciário
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-4">
                <div className="relative inline-block">
                  <div className="bg-red-50 dark:bg-red-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-red-100 dark:border-red-900/50">
                    <Bot className={`w-10 h-10 ${isLuana ? 'text-pink-600 dark:text-pink-400' : 'text-red-900 dark:text-red-400'}`} />
                  </div>
                  <div className="absolute bottom-0 right-0 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-md border border-slate-100 dark:border-slate-700">
                    <Gavel className="w-4 h-4 text-red-900 dark:text-red-400" />
                  </div>
                </div>
                <div>
                  <p className="text-base font-bold text-slate-700 dark:text-slate-300">Olá, {currentUser.name}!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 px-6 mt-2 leading-relaxed">
                    Sou o assistente virtual do(a) <strong>{lawyerName}</strong>. 
                    Escolha uma opção abaixo ou digite sua dúvida.
                  </p>
                </div>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-lg text-base shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-red-900 text-white rounded-tr-none' 
                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-600 rounded-tl-none'
                }`}>
                  <Markdown>{m.text}</Markdown>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-700 p-4 rounded-2xl text-lg rounded-tl-none shadow-sm border border-slate-100 dark:border-slate-600">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-red-900 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-red-900 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-red-900 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}

            {!isLoading && messageCount < MAX_MESSAGES && (
              <div className="flex flex-wrap gap-2 pt-2">
                {suggestions.map((s, i) => (
                  <button 
                    key={i}
                    onClick={() => handleSendMessage(s.value)}
                    className="text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {messageCount >= MAX_MESSAGES && secretaryWhatsapp && (
              <div className="pt-4">
                <a 
                  href={`https://wa.me/${secretaryWhatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-lg shadow-green-600/20 hover:scale-[1.02]"
                >
                  <Phone className="w-4 h-4" /> FALAR COM A SECRETÁRIA
                </a>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex gap-2">
              <input 
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Digite sua dúvida..."
                disabled={messageCount >= MAX_MESSAGES + 1}
                className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-red-900 dark:text-white outline-none disabled:opacity-50"
              />
              <button 
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isLoading || messageCount >= MAX_MESSAGES + 1}
                className="bg-red-950 hover:bg-red-900 text-white p-3 rounded-xl transition-all disabled:opacity-50 shadow-md active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <div className="flex items-center gap-3">
        {!isOpen && (
          <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-xl border border-slate-100 dark:border-slate-700 animate-bounce">
            <p className="text-[10px] font-bold text-red-950 dark:text-red-400 uppercase tracking-wider">Dúvidas? Fale comigo!</p>
          </div>
        )}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`p-4 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center relative group
            ${isOpen ? 'bg-slate-200 dark:bg-slate-700 text-slate-600' : 'bg-red-950 text-white'}
          `}
        >
          {isOpen ? <X className="w-6 h-6" /> : (
            <>
              <Bot className={`w-7 h-7 ${isLuana ? 'text-pink-300' : 'text-white'}`} />
              <div className="absolute -top-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-red-950 group-hover:scale-125 transition-transform"></div>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
