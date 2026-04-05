import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context';
import { Card, Button } from '../components/ui';
import { PROCESS_TEMPLATES, MOCK_USERS } from '../constants';
import { Demanda, RiskLevel, ProcessType, OriginChannel } from '../types';
import { ArrowLeft, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const NewDemanda: React.FC = () => {
  const { addDemanda, currentUser, users } = useAppContext();
  const navigate = useNavigate();

  const [type, setType] = useState<ProcessType>('FP01_ADMISSAO');
  
  // Base State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [substituteId, setSubstituteId] = useState('');
  const [channel, setChannel] = useState<OriginChannel>('SISTEMA');
  
  // Dynamic Fields State
  const [candidateName, setCandidateName] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState(''); // New: FP05/06
  const [mpNumber, setMpNumber] = useState('');
  const [dismissalType, setDismissalType] = useState('TRABALHADO');
  const [absencyType, setAbsencyType] = useState('ATESTADO');
  const [hoursStart, setHoursStart] = useState('');
  const [hoursEnd, setHoursEnd] = useState('');
  const [uniformItems, setUniformItems] = useState('');
  const [errorType, setErrorType] = useState('ERRO_SISTEMA');

  // FP03 Specific
  const [attendanceSubject, setAttendanceSubject] = useState('ORIENTACAO');
  const [immediateResolution, setImmediateResolution] = useState(false);
  const [resolutionType, setResolutionType] = useState<'INFORMACAO' | 'CORRECAO' | 'ENCAMINHAMENTO'>('INFORMACAO');

  // Auto-set deadline based on SLA
  const [deadline, setDeadline] = useState('');
  const [impacts, setImpacts] = useState<RiskLevel[]>([]);

  useEffect(() => {
    const template = PROCESS_TEMPLATES[type];
    const slaDate = new Date();
    slaDate.setHours(slaDate.getHours() + template.slaHours);
    setDeadline(slaDate.toISOString().split('T')[0]);
    setImpacts(template.mandatoryImpacts); // Enforce mandatory impacts on type change
    
    // Auto title suggestion
    if (!title) {
        setTitle(`${template.title.split(' - ')[1]}: `);
    }
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for FP04
    if (type === 'FP04_PONTO' && absencyType === 'DECLARACAO' && (!hoursStart || !hoursEnd)) {
        alert('Para Declaração de Comparecimento, os horários de início e fim são obrigatórios.');
        return;
    }

    // Validation for FP05/FP06 Beneficiary
    if ((type === 'FP05_FARDAMENTO' || type === 'FP06_BENEFICIOS') && !beneficiaryName) {
        alert('O nome do Colaborador/Beneficiário é obrigatório para rastreio de recorrência.');
        return;
    }
    
    const protocol = `DEM-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const template = PROCESS_TEMPLATES[type];
    
    // Build specific data object
    const specificData: any = {};
    if (type === 'FP01_ADMISSAO') specificData.candidateName = candidateName;
    
    // FP05 & FP06 Beneficiary Name
    if (type === 'FP05_FARDAMENTO' || type === 'FP06_BENEFICIOS') {
        specificData.beneficiaryName = beneficiaryName;
    }

    if (type === 'FP02_DEMISSAO') {
        specificData.mpNumber = mpNumber;
        specificData.dismissalType = dismissalType;
    }
    if (type === 'FP03_ATENDIMENTO') {
        specificData.attendanceSubject = attendanceSubject;
        if (immediateResolution) {
            specificData.resolutionType = resolutionType;
        }
    }
    if (type === 'FP04_PONTO') {
        specificData.absencyType = absencyType;
        if (absencyType === 'DECLARACAO') {
            specificData.hoursStart = hoursStart;
            specificData.hoursEnd = hoursEnd;
        }
    }
    if (type === 'FP05_FARDAMENTO') specificData.uniformItems = uniformItems;
    if (type === 'FP06_BENEFICIOS') specificData.errorType = errorType;

    let steps = template.steps.map(s => ({ ...s, completed: false, critical: s.critical ?? false }));
    let status: Demanda['status'] = 'OPEN';
    let logs = [
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'DEMANDA_CRIADA',
          details: `Iniciado via ${channel} com SLA de ${template.slaHours}h. Impactos: ${impacts.join(', ')}`
        }
    ];

    // Handle Immediate Resolution for FP03
    if (type === 'FP03_ATENDIMENTO' && immediateResolution) {
        status = 'COMPLETED';
        steps = steps.map(s => ({
            ...s,
            completed: true,
            completedBy: currentUser.name,
            completedAt: new Date().toISOString()
        }));
        logs.push({
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'RESOLUCAO_IMEDIATA',
            details: `Demanda resolvida e encerrada no ato do atendimento (Balcão). Tipo: ${resolutionType}`
        });
    }

    const newDemanda: Demanda = {
      protocol,
      type,
      title,
      description,
      status,
      risk: template.defaultRisk,
      channel,
      deadline: new Date(deadline).toISOString(),
      createdAt: new Date().toISOString(),
      completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined,
      responsibleId,
      substituteId,
      data: specificData,
      steps,
      logs,
      impacts
    };

    addDemanda(newDemanda);
    navigate('/demandas');
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-slate-900">Nova Demanda (Compliance)</h2>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
             <AlertCircle className="text-blue-600 mt-1 flex-shrink-0" size={20} />
             <div className="text-sm text-blue-800">
                <p className="font-bold">Axioma de Registro (FP 03):</p>
                <p>"O que não está no sistema, não existe". Registre a origem real da demanda para controle de canais (WhatsApp/Presencial).</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Processo (Ficha de Procedimento)</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  value={type}
                  onChange={e => setType(e.target.value as ProcessType)}
                  required
                >
                  {Object.keys(PROCESS_TEMPLATES).map(key => (
                    <option key={key} value={key}>{PROCESS_TEMPLATES[key as ProcessType].title}</option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap gap-2">
                    {impacts.map(i => (
                        <span key={i} className="text-xs font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded border border-slate-300">
                            {i} (POP)
                        </span>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Canal de Origem (Rastreabilidade)</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={channel}
                  onChange={e => setChannel(e.target.value as OriginChannel)}
                  required
                >
                  <option value="SISTEMA">Plataforma (Direto)</option>
                  <option value="WHATSAPP">WhatsApp (Importado)</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="PRESENCIAL">Presencial (Balcão)</option>
                  <option value="OFICIO">Ofício / Documento Físico</option>
                  <option value="TELEFONE">Telefone</option>
                </select>
            </div>
          </div>

          {/* DYNAMIC FIELDS BASED ON TYPE */}
          {type === 'FP01_ADMISSAO' && (
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Candidato</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2" required value={candidateName} onChange={e => setCandidateName(e.target.value)} />
             </div>
          )}

          {type === 'FP02_DEMISSAO' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Número da MP (Prefeitura)</label>
                   <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Ex: MP 1234" required value={mpNumber} onChange={e => setMpNumber(e.target.value)} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Aviso</label>
                   <select className="w-full border border-slate-300 rounded-lg px-3 py-2" required value={dismissalType} onChange={e => setDismissalType(e.target.value)}>
                      <option value="TRABALHADO">Aviso Trabalhado</option>
                      <option value="INDENIZADO">Aviso Indenizado (Restrito)</option>
                      <option value="ANTECIPADO">Término Antecipado</option>
                      <option value="JUSTA_CAUSA">Justa Causa (Jurídico)</option>
                   </select>
                </div>
             </div>
          )}

          {type === 'FP03_ATENDIMENTO' && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Assunto do Atendimento</label>
                   <select className="w-full border border-slate-300 rounded-lg px-3 py-2" value={attendanceSubject} onChange={e => setAttendanceSubject(e.target.value)}>
                      <option value="ORIENTACAO">Orientação Geral</option>
                      <option value="SLRH">Suporte SLRH (Cadastro)</option>
                      <option value="MENTORY">Acesso Banco Mentory</option>
                      <option value="PONTO_DIGITAL">Acesso Ponto Digital</option>
                      <option value="EVENTO_ATIPICO">Registro Evento Atípico</option>
                   </select>
                </div>
                
                <div className={`p-3 rounded-lg border transition-colors ${immediateResolution ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${immediateResolution ? 'bg-green-600 border-green-600' : 'border-slate-300 bg-white'}`}>
                            {immediateResolution && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={immediateResolution} 
                            onChange={e => setImmediateResolution(e.target.checked)} 
                        />
                        <div>
                            <span className="block text-sm font-bold text-slate-800">Resolução Imediata (Balcão)</span>
                            <span className="block text-xs text-slate-500">Marque se a solicitação foi resolvida durante o atendimento. O protocolo será encerrado automaticamente.</span>
                        </div>
                    </label>

                    {immediateResolution && (
                        <div className="mt-3 pl-8">
                             <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Tipo de Resolução</label>
                             <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white" required value={resolutionType} onChange={e => setResolutionType(e.target.value as any)}>
                                <option value="INFORMACAO">Prestação de Informação</option>
                                <option value="CORRECAO">Correção Simples em Sistema</option>
                                <option value="ENCAMINHAMENTO">Encaminhamento Externo</option>
                             </select>
                        </div>
                    )}
                </div>
            </div>
          )}

          {type === 'FP04_PONTO' && (
             <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Documento</label>
                   <div className="flex flex-col sm:flex-row gap-4">
                      <label className="flex items-center gap-2">
                         <input type="radio" name="absency" value="ATESTADO" checked={absencyType === 'ATESTADO'} onChange={e => setAbsencyType(e.target.value)} />
                         Atestado (Abono de Dias)
                      </label>
                      <label className="flex items-center gap-2">
                         <input type="radio" name="absency" value="DECLARACAO" checked={absencyType === 'DECLARACAO'} onChange={e => setAbsencyType(e.target.value)} />
                         Declaração (Abono de Horas)
                      </label>
                   </div>
                </div>
                {absencyType === 'DECLARACAO' && (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">Hora Início <span className="text-red-500">*</span></label>
                         <input type="time" className="w-full border border-slate-300 rounded-lg px-3 py-2" required value={hoursStart} onChange={e => setHoursStart(e.target.value)} />
                      </div>
                      <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">Hora Fim <span className="text-red-500">*</span></label>
                         <input type="time" className="w-full border border-slate-300 rounded-lg px-3 py-2" required value={hoursEnd} onChange={e => setHoursEnd(e.target.value)} />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                         <Clock size={14}/>
                         <span>O sistema calculará automaticamente as horas não cobertas.</span>
                      </div>
                   </div>
                )}
             </div>
          )}

          {/* FP05 & FP06 Common Field */}
          {(type === 'FP05_FARDAMENTO' || type === 'FP06_BENEFICIOS') && (
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Colaborador (Beneficiário)</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2" required value={beneficiaryName} onChange={e => setBeneficiaryName(e.target.value)} placeholder="Nome completo para rastreio" />
             </div>
          )}

          {type === 'FP05_FARDAMENTO' && (
             <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Itens Solicitados</label>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 h-20" placeholder="Ex: 2 Camisas G, 1 Calça 42..." required value={uniformItems} onChange={e => setUniformItems(e.target.value)} />
             </div>
          )}

          {type === 'FP06_BENEFICIOS' && (
             <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Classificação do Erro (Mandatório)</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2" value={errorType} onChange={e => setErrorType(e.target.value as any)}>
                   <option value="ERRO_CADASTRO">Erro de Cadastro (Dados Incorretos)</option>
                   <option value="ERRO_SISTEMA">Erro Sistêmico (Software/Integração)</option>
                   <option value="ERRO_INFORMACAO">Erro de Informação (Usuário/RH)</option>
                   <option value="AJUSTE_BENEFICIO">Ajuste de Benefício (Valor/Tipo)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Essencial para análise de reincidência e auditoria.</p>
             </div>
          )}
          {/* END DYNAMIC FIELDS */}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Título da Demanda</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição / Detalhes</label>
            <textarea 
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-24"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prazo (SLA Automático)</label>
              <input 
                type="date" 
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-100 cursor-not-allowed"
                value={deadline}
                readOnly
              />
              <p className="text-xs text-slate-500 mt-1">Baseado no SLA da FP selecionada.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
              <select 
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={responsibleId}
                onChange={e => setResponsibleId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Substituto (Obrigatório)</label>
              <select 
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={substituteId}
                onChange={e => setSubstituteId(e.target.value)}
                required
              >
                 <option value="">Selecione...</option>
                {users.filter(u => u.id !== responsibleId).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
            <Button variant="outline" onClick={() => navigate('/demandas')} className="w-full sm:w-auto">Cancelar</Button>
            <Button type="submit" className="w-full sm:w-auto">Registrar Demanda</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default NewDemanda;
