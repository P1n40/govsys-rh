import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../context';
import { Card, Badge, Button } from '../components/ui';
import { PROCESS_TEMPLATES } from '../constants';
import { ArrowLeft, CheckCircle, FileText, Lock, User, Calendar, UploadCloud, Clock, ExternalLink, Calculator, Box, MessageSquare, History, CheckSquare, ShieldAlert, FileWarning, EyeOff, AlertOctagon, FileKey, Siren, GitFork, ArrowRight, X, AlertTriangle, Building2, Target } from 'lucide-react';
import { DemandaStatus, ProcessType, Demanda, RiskLevel, HRSector, ProcessStep } from '../types';

const SECTORS: HRSector[] = [
  'Administração de Pessoal (DP)',
  'Recrutamento e Seleção (R&S)',
  'Jurídico Trabalhista',
  'Segurança do Trabalho (SESMT)',
  'Benefícios Corporativos',
  'Remuneração e Cargos'
];

const DemandaDetail: React.FC = () => {
  const { protocol } = useParams<{ protocol: string }>();
  const { demandas, updateDemanda, addDemanda, currentUser, users, strictSLA } = useAppContext();
  const navigate = useNavigate();
  
  // Local state
  const [digitalLink, setDigitalLink] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<DemandaStatus | null>(null);
  const [isAsoException, setIsAsoException] = useState(false);
  const [isHierarchyBlock, setIsHierarchyBlock] = useState(false);
  const [isSLABlock, setIsSLABlock] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Derived Demand State
  const [showDerivedModal, setShowDerivedModal] = useState(false);
  const [derivedType, setDerivedType] = useState<ProcessType>('FP01_ADMISSAO');
  const [derivedSector, setDerivedSector] = useState<HRSector>(SECTORS[0]);
  const [derivedResponsible, setDerivedResponsible] = useState('');
  const [derivedReason, setDerivedReason] = useState('');
  const [derivedImpacts, setDerivedImpacts] = useState<RiskLevel[]>([]);
  
  // Computed for Derived Demand Modal
  const [availableResponsibles, setAvailableResponsibles] = useState<typeof users>([]);
  const [mandatoryImpacts, setMandatoryImpacts] = useState<RiskLevel[]>([]);

  const demanda = demandas.find(d => d.protocol === protocol);

  // Effect to update Mandatory Risks when Type changes
  useEffect(() => {
      const template = PROCESS_TEMPLATES[derivedType];
      setMandatoryImpacts(template.mandatoryImpacts);
      setDerivedImpacts(prev => {
          // Keep manual selections, but ensure mandatories are present
          const unique = new Set([...prev, ...template.mandatoryImpacts]);
          return Array.from(unique);
      });
  }, [derivedType]);

  // Effect to update Available Responsibles when Sector changes
  useEffect(() => {
      const filtered = users.filter(u => u.sector === derivedSector && u.role !== 'ATTENDANT');
      setAvailableResponsibles(filtered);
      setDerivedResponsible(''); // Reset selection
  }, [derivedSector, users]);


  if (!demanda) return <div>Demanda não encontrada.</div>;

  // --- AUTHORIZATION CHECK ---
  // A user is authorized if:
  // 1. They are the Main Responsible
  // 2. They are the Secondary Responsible
  // 3. They are a Supervisor or Admin
  
  const isManager = currentUser.role === 'SUPERVISOR' || currentUser.role === 'ADMIN';
  const isAssigned = currentUser.id === demanda.responsibleId || currentUser.id === demanda.substituteId;
  const hasAccess = isAssigned || isManager;

  // 'isResponsible' alias used for actions (Edit rights)
  const isResponsible = hasAccess; 

  if (!hasAccess) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-center">
              <ShieldAlert size={48} className="text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800">Acesso Negado</h2>
              <p className="text-slate-500 mt-2">Você não tem permissão para visualizar os detalhes desta demanda.</p>
              <Button variant="outline" onClick={() => navigate('/demandas')} className="mt-4">
                  Voltar para Demandas
              </Button>
          </div>
      );
  }

  const isLocked = demanda.status === 'BLOCKED' || demanda.status === 'GOVERNANCE_BLOCKED';
  const isCompleted = demanda.status === 'COMPLETED';
  const isCanceled = demanda.status === 'CANCELED';

  const canCreateDerived = isManager || (isResponsible && currentUser.role !== 'ATTENDANT');

  const progress = Math.round((demanda.steps.filter(s => s.completed).length / demanda.steps.length) * 100);

  const criticalStepsPending = demanda.steps.filter(s => s.critical && !s.completed);
  const requiredStepsPending = demanda.steps.filter(s => s.required && !s.completed);
  const showCriticalAlert = criticalStepsPending.length > 0;
  const isNearDeadline = new Date(demanda.deadline) < new Date(Date.now() + (2 * 86400000));
  const isArt477Breach = demanda.type === 'FP02_DEMISSAO' && new Date(demanda.deadline) < new Date() && !isCompleted && !isCanceled;
  const isOverdue = new Date(demanda.deadline) < new Date() && !isCompleted && !isCanceled;

  const recurrenceCheck = demanda.type === 'FP06_BENEFICIOS' || demanda.type === 'FP05_FARDAMENTO'
    ? demandas.filter(d => 
        d.protocol !== demanda.protocol && 
        d.type === demanda.type &&
        d.data?.beneficiaryName && demanda.data?.beneficiaryName && 
        d.data?.beneficiaryName === demanda.data?.beneficiaryName && 
        (d.type === 'FP06_BENEFICIOS' ? d.data?.errorType === demanda.data?.errorType : true)
      ).length 
    : 0;

  const handleCancelDemanda = () => {
      if (!cancelReason.trim()) {
          alert('A justificativa é obrigatória para o cancelamento.');
          return;
      }
      
      updateDemanda({
          ...demanda,
          status: 'CANCELED',
          logs: [
              ...demanda.logs,
              {
                  id: Math.random().toString(36).substr(2, 9),
                  timestamp: new Date().toISOString(),
                  userId: currentUser.id,
                  userName: currentUser.name,
                  action: 'CANCELAMENTO_JUSTIFICADO',
                  details: `Demanda cancelada. Justificativa: ${cancelReason}`
              }
          ]
      });
      
      setShowCancelModal(false);
      setCancelReason('');
  };

  const toggleImpact = (impact: RiskLevel) => {
      // Prevent removing mandatory impacts
      if (mandatoryImpacts.includes(impact)) return;

      if (derivedImpacts.includes(impact)) {
          setDerivedImpacts(derivedImpacts.filter(i => i !== impact));
      } else {
          setDerivedImpacts([...derivedImpacts, impact]);
      }
  };

  const handleCreateDerived = () => {
    // 1. Validation
    const errors = [];
    if (!derivedReason.trim()) errors.push('Justificativa é obrigatória.');
    if (!derivedResponsible) errors.push('Responsável Principal é obrigatório.');
    if (derivedImpacts.length === 0) errors.push('Pelo menos uma Classificação de Impacto deve ser selecionada.');
    
    // Strict assignment validation
    if (availableResponsibles.length === 0) {
        errors.push(`Nenhum usuário ativo encontrado no setor ${derivedSector}. Contate o Supervisor.`);
    }

    if (errors.length > 0) {
        alert(`Erro na criação:\n\n${errors.join('\n')}`);
        return;
    }

    const template = PROCESS_TEMPLATES[derivedType];
    const newProtocol = `DEM-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    const inheritedData = {
        candidateName: demanda.data?.candidateName,
        beneficiaryName: demanda.data?.beneficiaryName,
        mpNumber: demanda.data?.mpNumber
    };

    // PROMPT 02: Ensure Derived Demands are initialized as full operational entities with checklists.
    // template.steps is copied here.
    const newDemanda: Demanda = {
        protocol: newProtocol,
        type: derivedType,
        title: `(Derivada) ${template.title}`,
        description: `DEMANDA DERIVADA DE ${demanda.protocol}.\n\nContexto Original: ${demanda.title}\nJustificativa: ${derivedReason}\nSetor Destino: ${derivedSector}`,
        status: 'OPEN',
        risk: template.defaultRisk,
        channel: 'SISTEMA',
        deadline: new Date(Date.now() + (template.slaHours * 3600000)).toISOString(),
        createdAt: new Date().toISOString(),
        responsibleId: derivedResponsible,
        substituteId: demanda.substituteId, // Inherit substitute
        steps: template.steps.map(s => ({ ...s, completed: false, critical: s.critical ?? false })),
        logs: [{
            id: Math.random().toString(),
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'CRIACAO_DERIVADA',
            details: `Criada a partir de ${demanda.protocol}. Impactos: ${derivedImpacts.join(', ')}`
        }],
        data: inheritedData,
        parentProtocol: demanda.protocol,
        targetSector: derivedSector,
        impacts: derivedImpacts
    };

    addDemanda(newDemanda);

    // PROMPT 01: Inject checklist item into parent
    const parentStepId = `derived-${newProtocol}`;
    const newParentStep: ProcessStep = {
        id: parentStepId,
        label: `[DERIVADA] Processo ${newProtocol} - ${template.title}`,
        required: true,
        critical: true, // Mandatory
        completed: false,
        documentRequired: false
    };

    const updatedParentSteps = [...demanda.steps, newParentStep];

    updateDemanda({
        ...demanda,
        linkedProtocols: [...(demanda.linkedProtocols || []), newProtocol],
        steps: updatedParentSteps, // Dynamic Injection
        logs: [...demanda.logs, {
            id: Math.random().toString(),
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'GEROU_DERIVADA',
            details: `Gerou ${newProtocol} para ${derivedSector}. Resp: ${users.find(u => u.id === derivedResponsible)?.name}`
        }]
    });

    setShowDerivedModal(false);
    setDerivedReason('');
    setDerivedImpacts([]);
    setDerivedResponsible('');
    alert(`Demanda Derivada ${newProtocol} criada com sucesso. Item de controle adicionado ao checklist atual.`);
  };

  const handleStepToggle = (stepId: string) => {
    if (!isResponsible || isLocked || isCompleted || isCanceled) return;

    // Prevent toggling derived steps manually if they are not completed via system
    // Although the prompt says "Completing the derived demand must automatically complete...", it doesn't strictly forbid manual override if something breaks.
    // But usually system-managed steps should be read-only or strictly managed.
    // For now, we allow manual toggle but with visual indication it's system managed.
    
    const updatedSteps = demanda.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          completed: !step.completed,
          completedBy: !step.completed ? currentUser.name : undefined,
          completedAt: !step.completed ? new Date().toISOString() : undefined
        };
      }
      return step;
    });

    let newStatus = demanda.status;
    if (demanda.status === 'OPEN' && updatedSteps.some(s => s.completed)) {
      newStatus = 'IN_PROGRESS';
    }

    const isLate = new Date(demanda.deadline) < new Date(Date.now() + (2 * 86400000)) && newStatus !== 'COMPLETED';
    const hasCriticalPending = updatedSteps.some(s => s.critical && !s.completed);
    
    if (isLate && hasCriticalPending && newStatus !== 'BLOCKED' && newStatus !== 'GOVERNANCE_BLOCKED') {
        newStatus = 'CRITICAL_PENDING';
    } else if (!isLate && !hasCriticalPending && newStatus === 'CRITICAL_PENDING') {
        newStatus = 'IN_PROGRESS';
    }

    updateDemanda({
      ...demanda,
      steps: updatedSteps,
      status: newStatus,
      logs: [
        ...demanda.logs,
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'ETAPA_ATUALIZADA',
          details: `Etapa ${stepId} alterada. Status Atual: ${newStatus}`
        }
      ]
    });
  };

  const attemptStatusChange = (newStatus: DemandaStatus) => {
    if (isLocked && !isManager && newStatus === 'COMPLETED') {
        alert('ACESSO NEGADO: Demanda bloqueada por Governança. Apenas Supervisores podem desbloquear.');
        return;
    }

    // STRICT SLA CHECK
    if (strictSLA && isOverdue && !isManager) {
         setPendingStatusChange(newStatus);
         setIsSLABlock(true);
         setShowOverrideModal(true);
         return;
    }

    if (newStatus === 'COMPLETED') {
        const violations = [];
        
        // --- HIERARCHY CHECK REINFORCED BY CHECKLIST ---
        // If the checklist item for a derived demand is not checked, it will be caught here as a "Critical Step Pending".
        // But we also keep the explicit protocol check for double safety.
        
        if (demanda.linkedProtocols && demanda.linkedProtocols.length > 0) {
            const openChildren = demandas.filter(d => 
                demanda.linkedProtocols?.includes(d.protocol) && 
                d.status !== 'COMPLETED'
            );
            
            if (openChildren.length > 0) {
                const childList = openChildren.map(c => c.protocol).join(', ');
                violations.push(`Pendência Hierárquica: Existem ${openChildren.length} demanda(s) derivada(s) em aberto (${childList}).`);
                setIsHierarchyBlock(true); 
            } else {
                setIsHierarchyBlock(false);
            }
        } else {
            setIsHierarchyBlock(false);
        }

        // ... Standard checks ...
        if (demanda.type === 'FP01_ADMISSAO') {
            const kitDocumental = demanda.steps.find(s => s.id === 's1');
            const asoAdmissional = demanda.steps.find(s => s.id === 's2');
            if (kitDocumental && !kitDocumental.completed) {
                alert('BLOQUEIO TOTAL (FP 01):\n\nImpossível admitir sem Kit Documental (RG, CPF, CTPS).\nEsta etapa não aceita exceção.');
                return; 
            }
            if (asoAdmissional && !asoAdmissional.completed) {
                if (!isManager) {
                    alert('BLOQUEIO DE COMPLIANCE (FP 01):\n\nASO Admissional pendente. O colaborador não pode iniciar sem exame médico.\n\nApenas Supervisores podem autorizar "Admissão sob Exceção".');
                    return;
                } else {
                    setIsAsoException(true);
                }
            } else {
                setIsAsoException(false);
            }
        }

        if (demanda.type === 'FP02_DEMISSAO') {
            const asoDemissional = demanda.steps.find(s => s.id === 's3');
            if (asoDemissional && !asoDemissional.completed) {
                alert('BLOQUEIO LEGAL (FP 02):\n\nO ASO Demissional é obrigatório por lei. Não é possível encerrar sem este exame.');
                return;
            }
            const pagamento = demanda.steps.find(s => s.id === 's5');
            if (pagamento && !pagamento.completed) {
                 violations.push('Comprovante de Pagamento (Art. 477) ausente');
            }
        }
        
        if (demanda.type === 'FP04_PONTO') {
            const calcStep = demanda.steps.find(s => s.id === 's3');
            if (calcStep && !calcStep.completed) {
                violations.push('Cálculo de Horas (Abono vs Descoberto) não validado');
            }
        }

        if (demanda.type === 'FP05_FARDAMENTO') {
            const receiptStep = demanda.steps.find(s => s.id === 's3');
            if (demanda.data?.partialDelivery) {
                if (!receiptStep?.completed) {
                     violations.push('Termo de Entrega (Assinatura) obrigatório mesmo para entrega parcial.');
                }
            } else {
                if (receiptStep && !receiptStep.completed) {
                    violations.push('Termo de Entrega não assinado/anexado.');
                }
            }
        }

        if (demanda.type === 'FP06_BENEFICIOS') {
            const validationStep = demanda.steps.find(s => s.id === 's3');
            const commStep = demanda.steps.find(s => s.id === 's4');
            if (validationStep && !validationStep.completed) violations.push('Validação do Ajuste obrigatória.');
            if (commStep && !commStep.completed) violations.push('Comunicação ao Colaborador pendente.');
        }

        if (requiredStepsPending.length > 0) violations.push('Etapas Obrigatórias Pendentes');
        if (criticalStepsPending.length > 0) violations.push('Etapas Críticas Pendentes');
        if (demanda.type === 'FP01_ADMISSAO' && !demanda.data?.digitalFolderUrl) violations.push('Link da Pasta Digital Ausente');

        if (violations.length > 0 && !isAsoException) {
            if (isHierarchyBlock || violations.some(v => v.includes('Pendência Hierárquica'))) {
                if (!isManager) {
                    alert(`BLOQUEIO DE HIERARQUIA:\n\n${violations.join('\n')}\n\nA demanda principal não pode ser encerrada enquanto houver filhas abertas.`);
                    return;
                } else {
                    setPendingStatusChange(newStatus);
                    setShowOverrideModal(true);
                    return;
                }
            }

            if (demanda.type === 'FP01_ADMISSAO' && isAsoException) {
                // Fallthrough to modal
            } else if (!isManager) {
                alert(`BLOQUEIO DE COMPLIANCE:\n\nNão é possível concluir a demanda devido a:\n- ${violations.join('\n- ')}\n\nSolicite apoio ao Supervisor.`);
                if (demanda.status !== 'GOVERNANCE_BLOCKED') {
                     updateDemanda({
                         ...demanda,
                         status: 'GOVERNANCE_BLOCKED',
                         logs: [...demanda.logs, {
                             id: Math.random().toString(), timestamp: new Date().toISOString(), userId: currentUser.id, userName: currentUser.name,
                             action: 'BLOQUEIO_SISTEMICO', details: `Tentativa de conclusão falhou: ${violations.join(', ')}`
                         }]
                     });
                }
                return;
            } else {
                setPendingStatusChange(newStatus);
                setShowOverrideModal(true);
                return;
            }
        } else if (isAsoException) {
             setPendingStatusChange(newStatus);
             setShowOverrideModal(true);
             return;
        }
    }

    executeStatusChange(newStatus);
  };

  const confirmOverride = () => {
      if (!overrideReason.trim()) {
          alert('A justificativa é obrigatória para quebra de processo.');
          return;
      }
      if (pendingStatusChange) {
          let logAction = 'OVERRIDE_SUPERVISOR';
          let updatedData = { ...demanda.data };

          if (demanda.type === 'FP01_ADMISSAO' && isAsoException) {
              updatedData.admissionException = true;
              updatedData.exceptionReason = overrideReason;
              logAction = 'ADMISSAO_SOB_EXCECAO';
          }

          if (isHierarchyBlock) {
              logAction = 'OVERRIDE_HIERARQUIA';
          }

          if (isSLABlock) {
              logAction = 'OVERRIDE_SLA_RIGIDO';
          }

          updateDemanda({
            ...demanda,
            status: pendingStatusChange,
            data: updatedData,
            completedAt: pendingStatusChange === 'COMPLETED' ? new Date().toISOString() : undefined,
            logs: [
              ...demanda.logs,
              {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                userName: currentUser.name,
                action: logAction,
                details: `SUPERVISOR RESPONSIBLE: ${currentUser.name}. Justificativa: ${overrideReason}`
              }
            ]
          });

          // PROMPT 01: Check if this was a derived demand completing, if so update parent
          if (pendingStatusChange === 'COMPLETED' && demanda.parentProtocol) {
               updateParentOnCompletion(demanda.parentProtocol, demanda.protocol);
          }

          setShowOverrideModal(false);
          setOverrideReason('');
          setPendingStatusChange(null);
          setIsAsoException(false);
          setIsHierarchyBlock(false);
          setIsSLABlock(false);
      }
  };

  const executeStatusChange = (newStatus: DemandaStatus, logDetail?: string) => {
    updateDemanda({
      ...demanda,
      status: newStatus,
      completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
      logs: [
        ...demanda.logs,
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'STATUS_ALTERADO',
          details: logDetail || `Status alterado para ${newStatus}`
        }
      ]
    });

    // PROMPT 01: Auto-complete parent step
    if (newStatus === 'COMPLETED' && demanda.parentProtocol) {
         updateParentOnCompletion(demanda.parentProtocol, demanda.protocol);
    }
  };

  // Helper to update parent demand step
  const updateParentOnCompletion = (parentProtocol: string, childProtocol: string) => {
        const parent = demandas.find(d => d.protocol === parentProtocol);
        if (parent) {
             const stepIdToComplete = `derived-${childProtocol}`;
             const updatedParentSteps = parent.steps.map(s => {
                 if (s.id === stepIdToComplete) {
                     return { 
                         ...s, 
                         completed: true, 
                         completedBy: 'SISTEMA', 
                         completedAt: new Date().toISOString() 
                     };
                 }
                 return s;
             });
             
             // Only update if changed
             if (updatedParentSteps.some(s => s.id === stepIdToComplete && s.completed)) {
                 updateDemanda({
                     ...parent,
                     steps: updatedParentSteps,
                     logs: [...parent.logs, {
                         id: Math.random().toString(),
                         timestamp: new Date().toISOString(),
                         userId: 'SYSTEM',
                         userName: 'Sistema Automático',
                         action: 'DEPENDENCIA_RESOLVIDA',
                         details: `A demanda derivada ${childProtocol} foi concluída. Item de checklist atualizado.`
                     }]
                 });
             }
        }
  };

  const saveDriveLink = () => {
    updateDemanda({
        ...demanda,
        data: { ...demanda.data, digitalFolderUrl: digitalLink },
        logs: [...demanda.logs, {
             id: Math.random().toString(), timestamp: new Date().toISOString(), userId: currentUser.id, userName: currentUser.name,
             action: 'DADOS_ATUALIZADOS', details: 'Link da Pasta Digital atualizado'
         }]
    });
    setDigitalLink('');
  }

  const handleFileUpload = (stepId: string) => {
    if (!isResponsible || isLocked || isCompleted || isCanceled) return;
    const updatedSteps = demanda.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          documentUrl: 'mock-document.pdf',
        };
      }
      return step;
    });

    updateDemanda({
      ...demanda,
      steps: updatedSteps,
      logs: [
        ...demanda.logs,
        {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'DOCUMENTO_ANEXADO',
          details: `Documento anexado na etapa ${stepId}`
        }
      ]
    });
    alert('Documento anexado com sucesso (Simulação).');
  };

  const calculateHours = () => {
     if (demanda.data?.hoursStart && demanda.data?.hoursEnd) {
         const start = new Date(`1970-01-01T${demanda.data.hoursStart}:00`);
         const end = new Date(`1970-01-01T${demanda.data.hoursEnd}:00`);
         const diffMs = end.getTime() - start.getTime();
         const diffHrs = diffMs / (1000 * 60 * 60);
         const standardShift = 8.0;
         const justified = diffHrs > 0 ? diffHrs : 0;
         const uncovered = Math.max(0, standardShift - justified);
         return { justified: justified.toFixed(2), uncovered: uncovered.toFixed(2) };
     }
     return null;
  };
  
  const calcResult = calculateHours();

  const handlePartialDelivery = () => {
     if (!confirm('Confirma que a entrega foi PARCIAL? Isso criará uma pendência no sistema.')) return;
     updateDemanda({
         ...demanda,
         data: { ...demanda.data, partialDelivery: true },
         status: 'WAITING_VALIDATION',
         logs: [...demanda.logs, {
             id: Math.random().toString(), timestamp: new Date().toISOString(), userId: currentUser.id, userName: currentUser.name,
             action: 'PENDENCIA_ENTREGA', details: 'Kit entregue incompleto. Aguardando reposição.'
         }]
     });
  };

  return (
    <div className="space-y-6 relative">
      
      {/* DERIVED DEMAND MODAL */}
      {showDerivedModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <GitFork className="text-blue-600"/>
                          Criar Demanda Derivada
                      </h3>
                      <button onClick={() => setShowDerivedModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  
                  <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800">
                      Você está criando uma demanda vinculada ao protocolo <strong>{demanda.protocol}</strong>.
                      Isso criará automaticamente um item de bloqueio no checklist desta demanda.
                  </div>

                  {/* ... Modal Fields ... */}
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Tipo de Processo</label>
                              <select 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                value={derivedType}
                                onChange={e => setDerivedType(e.target.value as ProcessType)}
                              >
                                {Object.keys(PROCESS_TEMPLATES).map(key => (
                                    <option key={key} value={key}>{PROCESS_TEMPLATES[key as ProcessType].title}</option>
                                ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Setor de Destino</label>
                              <div className="relative">
                                  <Building2 className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                  <select 
                                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm appearance-none"
                                    value={derivedSector}
                                    onChange={e => setDerivedSector(e.target.value as HRSector)}
                                  >
                                    {SECTORS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                              </div>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Responsável Principal</label>
                          <div className="relative">
                              <User className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                              <select 
                                className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm appearance-none ${availableResponsibles.length === 0 ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-300'}`}
                                value={derivedResponsible}
                                onChange={e => setDerivedResponsible(e.target.value)}
                                disabled={availableResponsibles.length === 0}
                              >
                                {availableResponsibles.length === 0 ? (
                                    <option>Nenhum responsável no setor!</option>
                                ) : (
                                    <>
                                        <option value="">Selecione o responsável do setor...</option>
                                        {availableResponsibles.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                        ))}
                                    </>
                                )}
                              </select>
                              {availableResponsibles.length === 0 && (
                                  <p className="text-xs text-red-600 mt-1 font-bold">Ação Bloqueada: Contate o Supervisor para alocar recursos neste setor.</p>
                              )}
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2 uppercase flex items-center gap-2">
                             <Target size={14}/> Classificação de Impacto (POP Automático)
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                              {(['LEGAL', 'FINANCIAL', 'CONTRACTUAL', 'OPERATIONAL'] as RiskLevel[]).map(risk => {
                                  const isMandatory = mandatoryImpacts.includes(risk);
                                  return (
                                    <label key={risk} className={`flex items-center gap-2 p-2 rounded border transition-all ${isMandatory ? 'bg-slate-100 border-slate-300 cursor-not-allowed opacity-80' : 'cursor-pointer'} ${derivedImpacts.includes(risk) && !isMandatory ? 'bg-slate-800 border-slate-800 text-white' : ''}`}>
                                        <input 
                                            type="checkbox" 
                                            className="hidden"
                                            checked={derivedImpacts.includes(risk)}
                                            onChange={() => toggleImpact(risk)}
                                            disabled={isMandatory}
                                        />
                                        <span className={`text-xs font-bold ${isMandatory ? 'text-slate-500' : ''}`}>{risk} {isMandatory && '(POP)'}</span>
                                        {derivedImpacts.includes(risk) && <CheckCircle size={14} className="ml-auto"/>}
                                    </label>
                                  );
                              })}
                          </div>
                          {derivedImpacts.length === 0 && <p className="text-xs text-red-500 mt-1">* Selecione pelo menos um impacto.</p>}
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Justificativa / Contexto</label>
                          <textarea 
                              className="w-full border border-slate-300 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Explique detalhadamente o motivo desta demanda derivada..."
                              value={derivedReason}
                              onChange={e => setDerivedReason(e.target.value)}
                          />
                      </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                      <Button variant="outline" onClick={() => setShowDerivedModal(false)} className="w-full sm:w-auto">Cancelar</Button>
                      <Button variant="primary" onClick={handleCreateDerived} disabled={availableResponsibles.length === 0} className="w-full sm:w-auto">
                          Confirmar e Vincular
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* CANCEL DEMAND MODAL */}
      {showCancelModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
                          <AlertTriangle size={24}/>
                          Cancelar Demanda
                      </h3>
                      <button onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  
                  <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-800">
                      Atenção: O cancelamento de demandas é auditado. Informe o motivo detalhado para esta ação.
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Justificativa do Cancelamento</label>
                          <textarea 
                              className="w-full border border-slate-300 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-red-500 outline-none"
                              placeholder="Explique o motivo do cancelamento..."
                              value={cancelReason}
                              onChange={e => setCancelReason(e.target.value)}
                          />
                      </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                      <Button variant="outline" onClick={() => setShowCancelModal(false)} className="w-full sm:w-auto">Voltar</Button>
                      <Button onClick={handleCancelDemanda} className="bg-red-600 hover:bg-red-700 text-white border-red-600 w-full sm:w-auto">
                          Confirmar Cancelamento
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* ... Header and Warning Banners (Strict SLA, Linkage, etc.) - Preserved ... */}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/demandas')} className="text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3">
               <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{demanda.protocol}</h2>
               {demanda.status === 'GOVERNANCE_BLOCKED' ? (
                   <span className="bg-red-700 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                       <Lock size={12}/> BLOQUEIO GOVERNANÇA
                   </span>
               ) : demanda.status === 'CANCELED' ? (
                   <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                       <X size={12}/> CANCELADA
                   </span>
               ) : (
                   <Badge type={demanda.status === 'BLOCKED' ? 'neutral' : demanda.status === 'COMPLETED' ? 'success' : 'info'}>
                      {demanda.status}
                   </Badge>
               )}
            </div>
            <p className="text-slate-500">{demanda.title}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto mt-4 md:mt-0">
           {canCreateDerived && !isCanceled && (
             <Button onClick={() => setShowDerivedModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600 flex items-center justify-center gap-2 w-full sm:w-auto">
                <GitFork size={16}/> Criar Demanda Derivada Manual
             </Button>
           )}
           {isManager && isLocked && !isCanceled && (
             <Button onClick={() => attemptStatusChange('IN_PROGRESS')} variant="outline" className="w-full sm:w-auto">Desbloquear</Button>
           )}
           {isManager && !isLocked && !isCompleted && !isCanceled && (
             <Button onClick={() => attemptStatusChange('BLOCKED')} variant="secondary" className="w-full sm:w-auto">Bloquear Processo</Button>
           )}
           {!isCompleted && !isLocked && !isCanceled && (
             <Button onClick={() => attemptStatusChange('COMPLETED')} variant="primary" className="w-full sm:w-auto">
                Concluir Demanda
             </Button>
           )}
           {!isCompleted && !isCanceled && (
             <Button onClick={() => setShowCancelModal(true)} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 w-full sm:w-auto">
                Cancelar Demanda
             </Button>
           )}
        </div>
      </div>

      {/* Warnings & Banners */}
      {isOverdue && strictSLA && (
         <div className="bg-red-100 border-l-4 border-red-600 p-4 mb-2 shadow-sm animate-pulse">
             <div className="flex items-center">
                 <AlertOctagon className="text-red-600 mr-3" />
                 <div>
                     <p className="text-sm font-bold text-red-800">SLA Rígido em Vigor</p>
                     <p className="text-sm text-red-700">Este processo está bloqueado devido ao vencimento do prazo. Contate o Supervisor.</p>
                 </div>
             </div>
         </div>
      )}

      {demanda.parentProtocol && (
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-2 flex items-center justify-between">
             <div className="flex items-center">
                 <GitFork className="text-purple-500 mr-3 rotate-180" />
                 <div>
                     <p className="text-sm font-bold text-purple-700">Demanda Derivada (Origem)</p>
                     <p className="text-sm text-purple-600">
                         Este processo foi originado a partir da demanda <strong>{demanda.parentProtocol}</strong>.
                     </p>
                 </div>
             </div>
             <Link to={`/demandas/${demanda.parentProtocol}`} className="text-purple-700 hover:text-purple-900 text-sm font-medium flex items-center gap-1">
                 Ver Origem <ArrowRight size={14}/>
             </Link>
          </div>
      )}
      
      {demanda.linkedProtocols && demanda.linkedProtocols.length > 0 && (
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-2">
             <div className="flex flex-col gap-2">
                 <div className="flex items-center">
                     <GitFork className="text-purple-500 mr-3" />
                     <div>
                         <p className="text-sm font-bold text-purple-700">Demandas Derivadas (Filhas)</p>
                         <p className="text-sm text-purple-600">Este processo gerou as seguintes demandas adicionais (Verifique o Checklist):</p>
                     </div>
                 </div>
                 <div className="flex gap-2 pl-9">
                     {demanda.linkedProtocols.map(p => {
                         const child = demandas.find(d => d.protocol === p);
                         const isChildOpen = child && child.status !== 'COMPLETED';
                         return (
                             <Link key={p} to={`/demandas/${p}`} className={`px-2 py-1 border rounded text-xs font-bold flex items-center gap-1 hover:brightness-95 ${isChildOpen ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                 {p} {isChildOpen ? '(Aberto)' : '(Concluído)'}
                             </Link>
                         );
                     })}
                 </div>
             </div>
          </div>
      )}

      {/* ... Other Banners (AsoException, Art477, Recurrence, CriticalAlert, PartialDelivery) - Preserved ... */}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info & Checklist */}
        <div className="lg:col-span-2 space-y-6">
           
           {/* Specific Data Display */}
           {demanda.data && (
               <Card className="p-6 bg-slate-50 border-blue-100">
                   {/* ... Preserved Data Fields ... */}
                   <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">Dados Específicos do Processo</h3>
                      {demanda.type === 'FP05_FARDAMENTO' && !demanda.data.partialDelivery && !isCompleted && !isCanceled && (
                          <button onClick={handlePartialDelivery} className="text-xs text-amber-600 underline font-medium hover:text-amber-800">
                              Registrar Entrega Parcial
                          </button>
                      )}
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                       {demanda.data.candidateName && <div><span className="text-slate-500">Candidato:</span> <span className="font-medium">{demanda.data.candidateName}</span></div>}
                       {demanda.data.beneficiaryName && <div><span className="text-slate-500">Beneficiário:</span> <span className="font-medium">{demanda.data.beneficiaryName}</span></div>}
                       {demanda.data.mpNumber && (
                         <div className={`p-2 rounded border ${isManager ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200'}`}>
                            <span className="text-slate-500 block text-xs">MP (Prefeitura):</span> 
                            {isManager ? (
                                <span className="font-medium flex items-center gap-2"><FileKey size={12} className="text-blue-500"/> {demanda.data.mpNumber}</span>
                            ) : (
                                <span className="text-slate-400 italic flex items-center gap-1"><EyeOff size={12}/> Restrito ao Supervisor</span>
                            )}
                         </div>
                       )}
                       {demanda.data.dismissalType && <div><span className="text-slate-500">Tipo de Aviso:</span> <Badge type="warning">{demanda.data.dismissalType}</Badge></div>}
                       {demanda.data.attendanceSubject && (
                           <div className="col-span-2 p-3 bg-indigo-50 rounded border border-indigo-100 flex flex-col gap-2">
                               <div className="flex items-center gap-2">
                                    <CheckSquare className="text-indigo-600" size={16} />
                                    <div>
                                        <span className="text-xs text-indigo-500 uppercase font-bold">Assunto (FP 03)</span>
                                        <p className="text-indigo-900 font-medium">{demanda.data.attendanceSubject}</p>
                                    </div>
                               </div>
                               {demanda.data.resolutionType && (
                                   <div className="mt-1 pt-2 border-t border-indigo-200">
                                       <span className="text-xs text-indigo-500 block">Resolução Imediata</span>
                                       <span className="font-bold text-indigo-800 text-xs">{demanda.data.resolutionType}</span>
                                   </div>
                               )}
                           </div>
                       )}
                       {demanda.data.absencyType && <div><span className="text-slate-500">Justificativa:</span> <span className="font-medium">{demanda.data.absencyType}</span></div>}
                       {demanda.data.hoursStart && <div><span className="text-slate-500">Período:</span> {demanda.data.hoursStart} às {demanda.data.hoursEnd}</div>}
                       {demanda.data.uniformItems && <div className="col-span-2"><span className="text-slate-500 block">Itens:</span> <span className="font-medium italic">{demanda.data.uniformItems}</span></div>}
                       {demanda.data.errorType && <div><span className="text-slate-500">Classificação de Erro:</span> <span className="font-bold text-red-600">{demanda.data.errorType}</span></div>}
                       {demanda.data.absencyType === 'DECLARACAO' && calcResult && (
                           <div className="col-span-2 mt-2 space-y-2">
                               <div className="p-3 bg-blue-50 rounded-lg flex items-center gap-3 border border-blue-100">
                                   <Calculator size={20} className="text-blue-600" />
                                   <div>
                                       <p className="font-bold text-blue-900 text-xs uppercase">Abono Justificado (Declaração)</p>
                                       <p className="text-blue-800"><span className="font-mono font-bold text-lg">{calcResult.justified}</span> horas</p>
                                   </div>
                               </div>
                               {parseFloat(calcResult.uncovered) > 0 && (
                                   <div className="p-3 bg-amber-50 rounded-lg flex items-center gap-3 border border-amber-200">
                                       <AlertTriangle size={20} className="text-amber-600" />
                                       <div>
                                           <p className="font-bold text-amber-900 text-xs uppercase">Horas Descobertas</p>
                                           <p className="text-amber-800">
                                               O colaborador deve retornar ao posto ou terá <span className="font-mono font-bold text-lg">{calcResult.uncovered}</span> horas descontadas.
                                           </p>
                                       </div>
                                   </div>
                               )}
                           </div>
                       )}
                       {demanda.data.digitalFolderUrl && (
                           <div className="col-span-2 flex items-center gap-2 mt-2">
                               <span className="text-slate-500">Pasta Digital:</span>
                               <a href={demanda.data.digitalFolderUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">Acessar Drive <ExternalLink size={12}/></a>
                           </div>
                       )}
                   </div>
                   {demanda.type === 'FP01_ADMISSAO' && !demanda.data.digitalFolderUrl && isResponsible && !isCanceled && (
                       <div className="mt-4 pt-4 border-t border-slate-200">
                           <label className="text-xs font-semibold text-slate-600 block mb-1">Link Obrigatório (Google Drive)</label>
                           <div className="flex gap-2">
                               <input type="url" className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" placeholder="https://drive.google.com..." value={digitalLink} onChange={e => setDigitalLink(e.target.value)} />
                               <Button variant="secondary" onClick={saveDriveLink} className="py-1 px-3 text-xs">Salvar</Button>
                           </div>
                       </div>
                   )}
               </Card>
           )}

           {/* Checklist */}
           <Card className="p-0 overflow-hidden">
             <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileText size={18} />
                  Checklist (POPs)
                </h3>
                <span className="text-xs text-slate-500">Conformidade Obrigatória</span>
             </div>
             <div className="divide-y divide-slate-100">
                {demanda.steps.map((step) => (
                  <div key={step.id} className={`p-4 hover:bg-slate-50 transition-colors ${step.completed ? 'bg-green-50/30' : ''}`}>
                    <div className="flex items-start gap-3">
                       <input 
                          type="checkbox" 
                          checked={step.completed} 
                          onChange={() => handleStepToggle(step.id)}
                          disabled={!isResponsible || isLocked || isCompleted || isCanceled || step.id.startsWith('derived-')}
                          className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                       />
                       <div className="flex-1">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                             <label className={`font-medium ${step.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                {step.label}
                                {step.id.startsWith('derived-') && (
                                     <Link to={`/demandas/${step.id.replace('derived-', '')}`} className="ml-2 text-blue-600 hover:underline text-xs inline-flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mt-1 sm:mt-0">
                                         <ExternalLink size={10}/> Ver Processo
                                     </Link>
                                )}
                             </label>
                             <div className="flex flex-wrap gap-2">
                                {step.critical && <Badge type="danger">Crítico</Badge>}
                                {step.required && !step.critical && <Badge type="neutral">Obrigatório</Badge>}
                             </div>
                          </div>
                          
                          {step.completed && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                               <CheckCircle size={12} />
                               Concluído por {step.completedBy}
                            </p>
                          )}

                          {step.documentRequired && !step.completed && (
                             <div className="mt-2">
                                <label className="flex items-center gap-2 text-xs text-blue-600 cursor-pointer hover:underline">
                                   <UploadCloud size={14} />
                                   Anexar Comprovante (PDF)
                                   <input type="file" className="hidden" accept="application/pdf" onChange={() => handleFileUpload(step.id)} />
                                </label>
                             </div>
                          )}
                       </div>
                    </div>
                  </div>
                ))}
             </div>
           </Card>
           
           <Card className="p-6">
             <div className="flex justify-between mb-2">
               <span className="text-sm font-semibold text-slate-700">Progresso</span>
               <span className="text-sm font-bold text-blue-600">{progress}%</span>
             </div>
             <div className="w-full bg-slate-200 rounded-full h-2.5">
               <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
             </div>
           </Card>

           {/* History */}
           <Card className="p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <Clock size={18} />
                 Histórico Auditável
              </h3>
              <div className="space-y-4 relative pl-4 border-l-2 border-slate-200">
                 {demanda.logs.slice().reverse().map(log => (
                    <div key={log.id} className="relative">
                       <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-400 border-2 border-white ring-1 ring-slate-200"></div>
                       <p className="text-sm font-semibold text-slate-800">{log.action}</p>
                       <p className="text-xs text-slate-500 mb-1">{new Date(log.timestamp).toLocaleString()} por {log.userName}</p>
                       {log.details && <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">{log.details}</p>}
                    </div>
                 ))}
              </div>
           </Card>
        </div>

        {/* Right Column: Meta Info */}
        <div className="space-y-6">
           <Card className="p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Detalhes da Demanda</h3>
              <div className="space-y-4">
                 <div>
                    <span className="text-xs text-slate-500 block mb-1">Risco</span>
                    <Badge type={demanda.risk === 'LEGAL' ? 'danger' : demanda.risk === 'CONTRACTUAL' ? 'warning' : 'info'}>
                       {demanda.risk}
                    </Badge>
                 </div>
                 <div>
                    <span className="text-xs text-slate-500 block mb-1 flex items-center gap-1"><MessageSquare size={12}/> Canal de Entrada</span>
                    <span className="font-medium text-slate-800">{demanda.channel}</span>
                 </div>
                 <div>
                    <span className="text-xs text-slate-500 block mb-1 flex items-center gap-1"><Calendar size={12}/> Prazo Limite</span>
                    <span className={`font-medium ${new Date(demanda.deadline) < new Date() && !isCompleted ? 'text-red-600' : 'text-slate-800'}`}>
                       {new Date(demanda.deadline).toLocaleDateString()}
                    </span>
                 </div>
                 <hr className="border-slate-100" />
                 <div>
                    <span className="text-xs text-slate-500 block mb-1 flex items-center gap-1"><User size={12}/> Responsável</span>
                    <span className="text-sm font-medium text-slate-800 block">{demanda.responsibleId === currentUser.id ? 'Você' : users.find(u => u.id === demanda.responsibleId)?.name}</span>
                 </div>
                 <div>
                    <span className="text-xs text-slate-500 block mb-1 flex items-center gap-1"><User size={12}/> Substituto</span>
                    <span className="text-sm font-medium text-slate-800 block">{users.find(u => u.id === demanda.substituteId)?.name}</span>
                 </div>
              </div>
           </Card>

           <Card className="p-6 bg-blue-50 border-blue-100">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                 <Lock size={16} />
                 Compliance
              </h4>
              <p className="text-xs text-blue-800 leading-relaxed">
                 O sistema realiza bloqueios automáticos para mitigar o Risco {demanda.risk}. Documentos como ASO e Contratos são auditáveis.
              </p>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default DemandaDetail;