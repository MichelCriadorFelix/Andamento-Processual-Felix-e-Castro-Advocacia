import React, { useState } from 'react';
import { Calculator, ArrowRight, CheckCircle2, Loader2, AlertCircle, User } from 'lucide-react';
import { PREVIDENCIARIO_BENEFITS } from '../constants';
import { getGeminiClient, handleGeminiError } from '../lib/gemini';
import Markdown from 'react-markdown';

interface BenefitsAnalyzerProps {
  onLoginClick?: () => void;
  isLoggedIn?: boolean;
  onAnalysisComplete?: (result: string, data: any) => void;
}

export const BenefitsAnalyzer: React.FC<BenefitsAnalyzerProps> = ({ onLoginClick, isLoggedIn, onAnalysisComplete }) => {
  const [selectedBenefit, setSelectedBenefit] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [result, setResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAnalyze = async () => {
    if (!selectedBenefit) {
      setError('Por favor, selecione um benefício para análise.');
      return;
    }
    
    // Basic validation
    if (!formData.age || !formData.sex) {
      setError('Por favor, preencha a idade e o sexo.');
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setResult(null);

    try {
      const benefitLabel = PREVIDENCIARIO_BENEFITS[selectedBenefit as keyof typeof PREVIDENCIARIO_BENEFITS]?.label || selectedBenefit;

      const fieldLabels: Record<string, string> = {
        sex: 'Sexo',
        age: 'Idade',
        contribYears: 'Tempo de Contribuição (Anos)',
        contribMonths: 'Tempo de Contribuição (Meses)',
        contribDays: 'Tempo de Contribuição (Dias)',
        lastContribution: 'Última contribuição ao INSS',
        hasMedicalReport: 'Possui laudo médico?',
        illness: 'Doença/Deficiência',
        hasCadUnico: 'Inscrito no Cadastro Único (CadÚnico)?',
        receivesBolsaFamilia: 'Recebe Bolsa Família?',
        familyIncome: 'Renda familiar total (R$)',
        familyMembers: 'Quantas pessoas moram na casa?',
        dateOfDeath: 'Data do óbito',
        relationship: 'Parentesco com o falecido',
        deceasedWasContributing: 'O falecido estava contribuindo para o INSS ou recebia benefício?',
        maternityDate: 'Data do parto/adoção',
        workStatus: 'Situação de trabalho atual',
        prisonDate: 'Data da prisão',
        prisonRegime: 'Regime de prisão',
        inssDenied: 'Já pediu este benefício no INSS e foi negado?',
        courtDenied: 'Já entrou na justiça para este benefício e foi negado?',
        hasPPP: 'Possui PPP ou formulários antigos de insalubridade?'
      };

      const prompt = `
Você é um advogado especialista em Direito Previdenciário Brasileiro.
Analise o caso do cliente de forma **muito clara, objetiva e curta** para o benefício: ${benefitLabel}.

Dados do cliente:
${Object.entries(formData).map(([key, value]) => `- ${fieldLabels[key] || key}: ${value}`).join('\n')}

Sua tarefa:
1. Responda em poucas palavras se o cliente possivelmente tem direito ao benefício atualmente ou não.
2. Se não tiver, diga brevemente se há outro benefício próximo ou outra possibilidade.
3. **NÃO DÊ UMA AULA DE DIREITO.** Não cite leis, não explique profundamente. O público é leigo.
4. O objetivo principal é **esclarecer rapidamente e chamar para um atendimento**.
5. **OBRIGATÓRIO**: Termine a resposta direcionando o cliente para criar uma conta no nosso site para que possa entrar em contato com a secretária e pedir a análise do caso por um advogado especialista do escritório.

Formate a resposta em Markdown, sendo muito direto e empático.
`;

      const responseText = await handleGeminiError(async () => {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt
        });
        return response.text;
      });

      setResult(responseText || 'Não foi possível gerar a análise.');
      
      // Save to localStorage for later retrieval after login/signup
      if (responseText) {
        const analysisData = {
          benefit: selectedBenefit,
          formData,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('pending_analysis_result', responseText);
        localStorage.setItem('pending_analysis_data', JSON.stringify(analysisData));
        
        if (onAnalysisComplete) {
          onAnalysisComplete(responseText, analysisData);
        }
      }
    } catch (err: any) {
      console.error('Erro ao analisar:', err);
      setError(err.message || 'Ocorreu um erro ao realizar a análise. Tente novamente mais tarde.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderDynamicFields = () => {
    if (!selectedBenefit) return null;

    const isDisability = ['AUXILIO_DOENCA', 'APOSENTADORIA_INVALIDEZ', 'AUXILIO_ACIDENTE', 'APOSENTADORIA_DEFICIENCIA'].includes(selectedBenefit);
    const isBPC = ['BPC_IDOSO', 'BPC_DEFICIENTE'].includes(selectedBenefit);
    const isRetirement = ['APOSENTADORIA_IDADE', 'APOSENTADORIA_CONTRIBUICAO', 'APOSENTADORIA_ESPECIAL'].includes(selectedBenefit);
    const isDeath = selectedBenefit === 'PENSAO_MORTE';
    const isMaternity = selectedBenefit === 'AUXILIO_MATERNIDADE';
    const isPrison = selectedBenefit === 'AUXILIO_RECLUSAO';

    const needsMedicalReport = isDisability || selectedBenefit === 'BPC_DEFICIENTE';

    return (
      <div className="space-y-4 mt-6 animate-fade-in">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-bordo-900 mt-6">
          Informações Específicas
        </h3>
        
        {/* Common Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sexo</label>
            <select 
              value={formData.sex || ''} 
              onChange={(e) => handleInputChange('sex', e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
            >
              <option value="">Selecione...</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Idade</label>
            <input 
              type="number" 
              value={formData.age || ''} 
              onChange={(e) => handleInputChange('age', e.target.value)}
              placeholder="Ex: 60"
              className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Já pediu no INSS e foi negado?</label>
            <select 
              value={formData.inssDenied || ''} 
              onChange={(e) => handleInputChange('inssDenied', e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
            >
              <option value="">Selecione...</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Já entrou na justiça e foi negado?</label>
            <select 
              value={formData.courtDenied || ''} 
              onChange={(e) => handleInputChange('courtDenied', e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
            >
              <option value="">Selecione...</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>
        </div>

        {/* Retirement & General Contribution */}
        {(isRetirement || isDisability || isMaternity) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tempo de Contribuição</label>
              <div className="grid grid-cols-3 gap-2">
                <input 
                  type="number" 
                  value={formData.contribYears || ''} 
                  onChange={(e) => handleInputChange('contribYears', e.target.value)}
                  placeholder="Anos"
                  className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
                />
                <input 
                  type="number" 
                  value={formData.contribMonths || ''} 
                  onChange={(e) => handleInputChange('contribMonths', e.target.value)}
                  placeholder="Meses"
                  className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
                />
                <input 
                  type="number" 
                  value={formData.contribDays || ''} 
                  onChange={(e) => handleInputChange('contribDays', e.target.value)}
                  placeholder="Dias"
                  className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Última contribuição ao INSS</label>
              <input 
                type="month" 
                value={formData.lastContribution || ''} 
                onChange={(e) => handleInputChange('lastContribution', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              />
            </div>
          </div>
        )}

        {/* Special Retirement Specifics */}
        {selectedBenefit === 'APOSENTADORIA_ESPECIAL' && (
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Possui PPP (Perfil Profissiográfico Previdenciário) ou formulários antigos?</label>
              <select 
                value={formData.hasPPP || ''} 
                onChange={(e) => handleInputChange('hasPPP', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="Sim, tenho todos">Sim, tenho todos</option>
                <option value="Sim, mas faltam alguns">Sim, mas faltam alguns</option>
                <option value="Não tenho">Não tenho</option>
                <option value="Não sei o que é">Não sei o que é</option>
              </select>
            </div>
          </div>
        )}

        {/* Disability Specifics */}
        {needsMedicalReport && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Possui laudo médico?</label>
              <select 
                value={formData.hasMedicalReport || ''} 
                onChange={(e) => handleInputChange('hasMedicalReport', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="Sim, atualizado (menos de 6 meses)">Sim, atualizado (menos de 6 meses)</option>
                <option value="Sim, antigo">Sim, antigo</option>
                <option value="Não possuo laudo">Não possuo laudo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qual a doença/deficiência?</label>
              <input 
                type="text" 
                value={formData.illness || ''} 
                onChange={(e) => handleInputChange('illness', e.target.value)}
                placeholder="Ex: Hérnia de disco"
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              />
            </div>
          </div>
        )}

        {/* BPC Specifics */}
        {isBPC && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inscrito no Cadastro Único (CadÚnico)?</label>
              <select 
                value={formData.hasCadUnico || ''} 
                onChange={(e) => handleInputChange('hasCadUnico', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recebe Bolsa Família?</label>
              <select 
                value={formData.receivesBolsaFamilia || ''} 
                onChange={(e) => handleInputChange('receivesBolsaFamilia', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Renda familiar total (R$)</label>
              <input 
                type="number" 
                value={formData.familyIncome || ''} 
                onChange={(e) => handleInputChange('familyIncome', e.target.value)}
                placeholder="Ex: 1412"
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantas pessoas moram na casa?</label>
              <input 
                type="number" 
                value={formData.familyMembers || ''} 
                onChange={(e) => handleInputChange('familyMembers', e.target.value)}
                placeholder="Ex: 4"
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              />
            </div>
          </div>
        )}

        {/* Death Specifics */}
        {isDeath && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data do óbito</label>
              <input 
                type="date" 
                value={formData.dateOfDeath || ''} 
                onChange={(e) => handleInputChange('dateOfDeath', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qual seu parentesco com o falecido?</label>
              <select 
                value={formData.relationship || ''} 
                onChange={(e) => handleInputChange('relationship', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="Cônjuge/Companheiro(a)">Cônjuge/Companheiro(a)</option>
                <option value="Filho(a) menor de 21 anos">Filho(a) menor de 21 anos</option>
                <option value="Filho(a) inválido(a)">Filho(a) inválido(a)</option>
                <option value="Pai/Mãe">Pai/Mãe</option>
                <option value="Irmão/Irmã">Irmão/Irmã</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">O falecido estava contribuindo para o INSS ou recebia benefício?</label>
              <select 
                value={formData.deceasedWasContributing || ''} 
                onChange={(e) => handleInputChange('deceasedWasContributing', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="Sim, contribuía">Sim, contribuía</option>
                <option value="Sim, recebia benefício">Sim, recebia benefício</option>
                <option value="Não">Não</option>
                <option value="Não sei">Não sei</option>
              </select>
            </div>
          </div>
        )}

        {/* Maternity Specifics */}
        {isMaternity && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data do parto/adoção (ou previsão)</label>
              <input 
                type="date" 
                value={formData.maternityDate || ''} 
                onChange={(e) => handleInputChange('maternityDate', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Situação de trabalho atual</label>
              <select 
                value={formData.workStatus || ''} 
                onChange={(e) => handleInputChange('workStatus', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="Empregada (CLT)">Empregada (CLT)</option>
                <option value="Desempregada">Desempregada</option>
                <option value="Autônoma/MEI">Autônoma/MEI</option>
                <option value="Trabalhadora Rural">Trabalhadora Rural</option>
              </select>
            </div>
          </div>
        )}

        {/* Prison Specifics */}
        {isPrison && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data da prisão</label>
              <input 
                type="date" 
                value={formData.prisonDate || ''} 
                onChange={(e) => handleInputChange('prisonDate', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Regime de prisão</label>
              <select 
                value={formData.prisonRegime || ''} 
                onChange={(e) => handleInputChange('prisonRegime', e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
              >
                <option value="">Selecione...</option>
                <option value="Fechado">Fechado</option>
                <option value="Semiaberto">Semiaberto</option>
                <option value="Aberto">Aberto</option>
              </select>
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quais documentos você já possui? (Opcional)</label>
          <textarea 
            value={formData.documents || ''} 
            onChange={(e) => handleInputChange('documents', e.target.value)}
            placeholder="Ex: RG, CPF, Carteira de Trabalho, Laudos médicos, PPP..."
            className="w-full p-2.5 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none min-h-[80px]"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-bordo-950 rounded-xl shadow-xl p-6 md:p-8 border border-gray-100 dark:border-bordo-900">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-bordo-900 text-white rounded-lg">
          <Calculator size={24} />
        </div>
        <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">Analisador Inteligente de Benefícios</h2>
      </div>
      
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        Nossa inteligência artificial, alimentada com dados atualizados do INSS, analisará seu caso para verificar seus direitos.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Qual benefício você deseja analisar?</label>
        <select 
          value={selectedBenefit} 
          onChange={(e) => {
            setSelectedBenefit(e.target.value);
            setFormData({}); // Reset form when changing benefit
            setResult(null);
            setError(null);
          }}
          className="w-full p-3 border border-gray-300 dark:border-bordo-900 rounded-lg bg-gray-50 dark:bg-bordo-900 dark:text-white focus:ring-2 focus:ring-bordo-900 outline-none"
        >
          <option value="">Selecione o benefício...</option>
          {Object.entries(PREVIDENCIARIO_BENEFITS).map(([key, value]) => (
            <option key={key} value={key}>{value.label}</option>
          ))}
        </select>
      </div>

      {renderDynamicFields()}

      {error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {selectedBenefit && (
        <button 
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full mt-8 bg-bordo-900 hover:bg-bordo-950 disabled:bg-bordo-900/70 text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="animate-spin" size={20} /> Analisando seu caso com IA...
            </>
          ) : (
            <>
              Analisar Meu Caso <ArrowRight size={20} />
            </>
          )}
        </button>
      )}

      {result && (
        <div className="mt-8 p-6 bg-gray-50 dark:bg-bordo-900/30 rounded-lg border border-gray-200 dark:border-bordo-900 animate-fade-in">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-green-600 dark:text-green-400" /> Resultado da Análise
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
            <Markdown>{result}</Markdown>
          </div>

          {onLoginClick && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-bordo-800 flex flex-col items-center text-center">
              <p className="text-gray-800 dark:text-gray-200 font-medium mb-4">
                {isLoggedIn ? 'Acesse o seu painel para acompanhar ou iniciar seu processo.' : 'Gostaria de uma análise detalhada com um advogado especialista?'}
              </p>
              <button 
                onClick={onLoginClick}
                className="bg-bordo-900 hover:bg-bordo-950 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <User size={20} />
                {isLoggedIn ? 'Ir para o Painel' : 'Crie aqui a sua conta'}
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-bordo-800 text-sm text-gray-500 dark:text-gray-400 italic">
            * Esta é uma análise preliminar gerada por inteligência artificial. Para garantir seus direitos, crie sua conta e fale com nossa equipe.
          </div>
        </div>
      )}
    </div>
  );
};

