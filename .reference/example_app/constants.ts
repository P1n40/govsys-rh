import { Demanda, User, ProcessStep, ProcessType, RiskLevel } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u0', name: 'Administrador Global', role: 'ADMIN', avatar: 'https://picsum.photos/id/1050/50/50', sector: 'Administração de Pessoal (DP)' },
  { id: 'u1', name: 'Ana Silva', role: 'SUPERVISOR', avatar: 'https://picsum.photos/id/1011/50/50', sector: 'Administração de Pessoal (DP)' },
  { id: 'u2', name: 'Carlos Santos', role: 'RESPONSIBLE', avatar: 'https://picsum.photos/id/1005/50/50', sector: 'Recrutamento e Seleção (R&S)' },
  { id: 'u3', name: 'Beatriz Costa', role: 'ATTENDANT', avatar: 'https://picsum.photos/id/1027/50/50', sector: 'Benefícios Corporativos' },
  { id: 'u4', name: 'João Oliveira', role: 'SUBSTITUTE', avatar: 'https://picsum.photos/id/1012/50/50', sector: 'Segurança do Trabalho (SESMT)' },
  { id: 'u5', name: 'Mariana Jurídico', role: 'RESPONSIBLE', avatar: 'https://picsum.photos/id/1025/50/50', sector: 'Jurídico Trabalhista' },
];

interface Template {
  title: string;
  defaultRisk: RiskLevel;
  mandatoryImpacts: RiskLevel[]; // New: POP-based mandatory impacts
  slaHours: number; // SLA in hours
  steps: Omit<ProcessStep, 'completed' | 'completedBy' | 'completedAt'>[];
}

export const PROCESS_TEMPLATES: Record<ProcessType, Template> = {
  'FP01_ADMISSAO': {
    title: 'FP 01 - Admissão de Colaboradores',
    defaultRisk: 'LEGAL',
    mandatoryImpacts: ['LEGAL', 'OPERATIONAL'], // POP Rules
    slaHours: 24,
    steps: [
      { id: 's1', label: 'Coleta Kit Documental (RG, CPF, End., CTPS)', required: true, critical: true, documentRequired: true },
      { id: 's2', label: 'ASO Admissional (Bloqueante)', required: true, critical: true, documentRequired: true },
      { id: 's3', label: 'Qualificação Cadastral eSocial', required: true, critical: true, documentRequired: false },
      { id: 's4', label: 'Assinatura do Contrato de Trabalho', required: true, critical: true, documentRequired: true },
      { id: 's5', label: 'Assinatura da Ficha de Registro', required: true, critical: true, documentRequired: true },
      { id: 's6', label: 'Inclusão no Relógio de Ponto', required: true, critical: false, documentRequired: false },
    ]
  },
  'FP02_DEMISSAO': {
    title: 'FP 02 - Demissão / Desligamento',
    defaultRisk: 'LEGAL',
    mandatoryImpacts: ['LEGAL', 'FINANCIAL', 'CONTRACTUAL'], // POP Rules
    slaHours: 240, 
    steps: [
      { id: 's1', label: 'Análise da MP (Restrito Supervisor)', required: true, critical: true, documentRequired: true },
      { id: 's2', label: 'Emissão do TRCT e Guias', required: true, critical: true, documentRequired: true },
      { id: 's3', label: 'ASO Demissional (Obrigatório)', required: true, critical: true, documentRequired: true },
      { id: 's4', label: 'Cálculo de Verbas (Art. 477)', required: true, critical: true, documentRequired: false },
      { id: 's5', label: 'Comprovante de Pagamento', required: true, critical: true, documentRequired: true },
      { id: 's6', label: 'Envio do Evento S-2299 (eSocial)', required: true, critical: true, documentRequired: false },
    ]
  },
  'FP03_ATENDIMENTO': {
    title: 'FP 03 - Atendimento ao Colaborador',
    defaultRisk: 'OPERATIONAL',
    mandatoryImpacts: ['OPERATIONAL'], // POP Rules
    slaHours: 48,
    steps: [
      { id: 's1', label: 'Registro do Protocolo (Axioma de Registro)', required: true, critical: true, documentRequired: false },
      { id: 's2', label: 'Classificação de Risco e Prioridade', required: true, critical: false, documentRequired: false },
      { id: 's3', label: 'Tratativa / Resolução no Sistema', required: true, critical: true, documentRequired: false },
      { id: 's4', label: 'Confirmação / Ciência do Colaborador', required: true, critical: false, documentRequired: false },
    ]
  },
  'FP04_PONTO': {
    title: 'FP 04 - Ponto e Justificativas Médicas',
    defaultRisk: 'OPERATIONAL',
    mandatoryImpacts: ['OPERATIONAL', 'FINANCIAL'], // POP Rules
    slaHours: 48,
    steps: [
      { id: 's1', label: 'Recebimento do Original (Físico/Digital)', required: true, critical: false, documentRequired: true },
      { id: 's2', label: 'Validação (CID, Datas, Carimbo Médico)', required: true, critical: true, documentRequired: false },
      { id: 's3', label: 'Cálculo de Horas Abonadas vs Descobertas', required: true, critical: true, documentRequired: false },
      { id: 's4', label: 'Lançamento no Sistema de Ponto', required: true, critical: true, documentRequired: false },
      { id: 's5', label: 'Arquivamento na Pasta Digital', required: true, critical: false, documentRequired: false },
    ]
  },
  'FP05_FARDAMENTO': {
    title: 'FP 05 - Fardamento e Materiais',
    defaultRisk: 'CONTRACTUAL',
    mandatoryImpacts: ['CONTRACTUAL', 'FINANCIAL'], // POP Rules
    slaHours: 120,
    steps: [
      { id: 's1', label: 'Verificação de Estoque e Tamanhos', required: true, critical: false, documentRequired: false },
      { id: 's2', label: 'Separação e Montagem do Kit', required: true, critical: false, documentRequired: false },
      { id: 's3', label: 'Assinatura do Termo de Entrega', required: true, critical: true, documentRequired: true }, // Mandatory Receipt
      { id: 's4', label: 'Baixa no Controle de Estoque', required: true, critical: true, documentRequired: false },
    ]
  },
  'FP06_BENEFICIOS': {
    title: 'FP 06 - Benefícios e Sistemas',
    defaultRisk: 'FINANCIAL',
    mandatoryImpacts: ['FINANCIAL', 'OPERATIONAL'], // POP Rules
    slaHours: 72,
    steps: [
      { id: 's1', label: 'Diagnóstico (Causa Raiz)', required: true, critical: true, documentRequired: false },
      { id: 's2', label: 'Correção no Portal/Sistema', required: true, critical: true, documentRequired: false },
      { id: 's3', label: 'Validação do Ajuste (Conferência)', required: true, critical: true, documentRequired: false }, // Mandatory Validation
      { id: 's4', label: 'Comunicação ao Colaborador', required: true, critical: true, documentRequired: false }, // Mandatory Communication
    ]
  }
};

export const INITIAL_DEMANDAS: Demanda[] = [
  {
    protocol: 'DEM-2024-001',
    type: 'FP01_ADMISSAO',
    title: 'Admissão: Roberto Alves',
    description: 'Vaga de TI - Substituto.',
    status: 'IN_PROGRESS',
    risk: 'LEGAL',
    channel: 'SISTEMA',
    deadline: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    responsibleId: 'u2',
    substituteId: 'u4',
    data: { candidateName: 'Roberto Alves' },
    steps: PROCESS_TEMPLATES['FP01_ADMISSAO'].steps.map(s => ({ ...s, completed: s.id === 's1', critical: s.critical ?? false })),
    logs: [
      { id: 'l1', timestamp: new Date(Date.now() - 86400000).toISOString(), userId: 'u3', userName: 'Beatriz Costa', action: 'DEMANDA_CRIADA' }
    ],
    impacts: ['LEGAL', 'OPERATIONAL'] // Backfilled mandatory impacts
  },
  {
    protocol: 'DEM-2024-002',
    type: 'FP02_DEMISSAO',
    title: 'Desligamento: Juliana Lima',
    description: 'MP 5504 - Solicitação da Prefeitura.',
    status: 'BLOCKED',
    risk: 'LEGAL',
    channel: 'OFICIO',
    deadline: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    responsibleId: 'u2',
    substituteId: 'u4',
    data: { mpNumber: '5504', dismissalType: 'INDENIZADO' },
    steps: PROCESS_TEMPLATES['FP02_DEMISSAO'].steps.map(s => ({ ...s, completed: s.id === 's1', critical: s.critical ?? false })),
    logs: [
      { id: 'l1', timestamp: new Date(Date.now() - 86400000 * 10).toISOString(), userId: 'u3', userName: 'Beatriz Costa', action: 'DEMANDA_CRIADA' },
      { id: 'l2', timestamp: new Date(Date.now() - 86400000 * 9).toISOString(), userId: 'u1', userName: 'Ana Silva', action: 'BLOQUEIO', details: 'Falta ASO Demissional - Pendência Crítica.' }
    ],
    impacts: ['LEGAL', 'FINANCIAL', 'CONTRACTUAL'] // Backfilled mandatory impacts
  }
];
