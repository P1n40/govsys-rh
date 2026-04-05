import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context';
import { Card, Badge, Button } from '../components/ui';
import { Search, Filter, Plus, ChevronRight, AlertTriangle, Flame, ShieldAlert, Lock, UserCheck, Users, GitFork } from 'lucide-react';
import { RiskLevel, DemandaStatus } from '../types';

const DemandasList: React.FC = () => {
  const { demandas, currentUser } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // View Scope: 'MINE' (My Demands) or 'ALL' (Global View - Restricted to Admin/Supervisor)
  const [viewScope, setViewScope] = useState<'MINE' | 'ALL'>('MINE');
  
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Check for URL filter param on mount
  useEffect(() => {
      const urlFilter = searchParams.get('filter');
      if (urlFilter === 'OVERDUE') {
          setStatusFilter('OVERDUE');
      }
  }, [searchParams]);

  // Effect to default Admin/Supervisor to ALL, others to MINE
  useEffect(() => {
      if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR') {
          setViewScope('ALL');
      } else {
          setViewScope('MINE');
      }
  }, [currentUser.role]);

  const filteredDemandas = demandas.filter(d => {
    // 1. Text Search Filter
    const matchesText = d.title.toLowerCase().includes(filter.toLowerCase()) || 
                        d.protocol.toLowerCase().includes(filter.toLowerCase());
    
    // 2. Status/Condition Filter
    let matchesStatus = true;
    if (statusFilter === 'OVERDUE') {
        matchesStatus = new Date(d.deadline) < new Date() && d.status !== 'COMPLETED' && d.status !== 'CANCELED';
    } else if (statusFilter !== 'ALL') {
        matchesStatus = d.status === statusFilter;
    }

    // 3. CORE VISIBILITY LOGIC (Refactored for First-Class Derived Demands)
    // Rule: Derived demands (with parentProtocol) are treated EXACTLY like primary demands.
    // No hierarchy hiding is allowed.
    
    const isAssigned = d.responsibleId === currentUser.id || d.substituteId === currentUser.id;
    const isManager = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR';

    let isVisible = false;

    if (viewScope === 'MINE') {
        // Strict Responsibility: Show if I am responsible.
        // Derived demands are included here naturally if assigned to me.
        isVisible = isAssigned;
    } else if (viewScope === 'ALL') {
        // Global View: Managers see everything. Others only see assigned.
        isVisible = isManager ? true : isAssigned;
    }

    // --- FAIL-SAFE VISIBILITY CHECK ---
    // Requirement: "If a demand is linked to a user as responsible and is not returned by 'My Demands', log an error and surface the demand."
    // Requirement: "Silent invisibility is forbidden."
    
    if (isAssigned && !isVisible) {
         console.error(`[CRITICAL AUDIT] Silent Invisibility Detected! Demand ${d.protocol} (Parent: ${d.parentProtocol || 'None'}) is assigned to User ${currentUser.id} but was hidden by logic. Forcing visibility.`);
         isVisible = true; // FORCE SURFACE
    }

    // Debugging Derived Demands specifically
    if (d.parentProtocol && isAssigned) {
        // Ensure derived demands are never hidden if assigned
        if (!isVisible) {
             console.error(`[CRITICAL AUDIT] Derived Demand ${d.protocol} hidden incorrectly. Forcing visibility.`);
             isVisible = true;
        }
    }

    return matchesText && matchesStatus && isVisible;
  });

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'LEGAL': return <Badge type="danger">Jurídico</Badge>;
      case 'CONTRACTUAL': return <Badge type="warning">Contratual</Badge>;
      case 'OPERATIONAL': return <Badge type="info">Operacional</Badge>;
      case 'FINANCIAL': return <Badge type="danger">Financeiro</Badge>;
      default: return <Badge type="neutral">{risk}</Badge>;
    }
  };

  const getStatusBadge = (status: DemandaStatus) => {
    switch (status) {
      case 'OPEN': return <Badge type="info">Aberto</Badge>;
      case 'IN_PROGRESS': return <Badge type="warning">Em Andamento</Badge>;
      case 'BLOCKED': return <Badge type="neutral">Bloqueado</Badge>;
      case 'GOVERNANCE_BLOCKED': return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-red-800 text-white border-red-900"><Lock size={10}/> Gov. Block</span>;
      case 'CRITICAL_PENDING': return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-red-100 text-red-800 border-red-200"><ShieldAlert size={10}/> Pend. Crítica</span>;
      case 'WAITING_VALIDATION': return <Badge type="warning">Validação</Badge>;
      case 'COMPLETED': return <Badge type="success">Concluído</Badge>;
      case 'CANCELED': return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-slate-200 text-slate-700 border-slate-300">Cancelada</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gerenciamento de Demandas</h2>
          <p className="text-slate-500">Controle e rastreabilidade de solicitações.</p>
        </div>
        <Button onClick={() => navigate('/nova-demanda')} className="flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus size={18} />
          Nova Demanda
        </Button>
      </div>

      <Card className="p-4">
        {/* Scope Toggles */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 border-b border-slate-100 pb-4">
            <button 
                onClick={() => setViewScope('MINE')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewScope === 'MINE' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <UserCheck size={18} />
                Minhas Demandas
            </button>
            {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR') && (
                <button 
                    onClick={() => setViewScope('ALL')}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewScope === 'ALL' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Users size={18} />
                    Visão da Equipe (Todos)
                </button>
            )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por protocolo, título..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-slate-400" size={18} />
            <select 
              className="border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value="OVERDUE">🚨 SLA Estourado (Atrasados)</option>
              <option value="OPEN">Aberto</option>
              <option value="IN_PROGRESS">Em Andamento</option>
              <option value="BLOCKED">Bloqueado</option>
              <option value="GOVERNANCE_BLOCKED">Bloqueio Governança</option>
              <option value="CRITICAL_PENDING">Pendência Crítica</option>
              <option value="WAITING_VALIDATION">Validação</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELED">Cancelada</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold bg-slate-50">
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Risco</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDemandas.map((demanda) => {
                const isOverdue = new Date(demanda.deadline) < new Date() && demanda.status !== 'COMPLETED' && demanda.status !== 'CANCELED';
                const isHighRisk = demanda.risk === 'LEGAL' || demanda.risk === 'FINANCIAL';
                const isEscalated = isOverdue && isHighRisk;
                const isMyResponsibility = demanda.responsibleId === currentUser.id;

                return (
                  <tr key={demanda.protocol} className={`transition-colors ${isEscalated ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'} ${isMyResponsibility ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-3 font-mono text-sm font-medium text-slate-700">
                      {demanda.protocol}
                      {isEscalated && <Flame size={14} className="inline text-red-500 ml-2" />}
                      {demanda.parentProtocol && (
                        <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                            <GitFork size={10} className="rotate-180" /> Derivada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className={`text-sm font-medium ${isEscalated ? 'text-red-900' : 'text-slate-800'}`}>{demanda.title}</p>
                      <p className="text-xs text-slate-500">{demanda.type}</p>
                    </td>
                    <td className="px-4 py-3">{getRiskBadge(demanda.risk)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {isOverdue && <AlertTriangle size={14} className={isEscalated ? 'text-red-600' : 'text-amber-500'} />}
                        <span className={`text-sm ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                          {new Date(demanda.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(demanda.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => navigate(`/demandas/${demanda.protocol}`)}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredDemandas.length === 0 && (
             <div className="text-center py-12 text-slate-500">
                <p>Nenhuma demanda encontrada com os filtros atuais.</p>
                {viewScope === 'MINE' && <p className="text-sm mt-2">Você não possui pendências operacionais no momento.</p>}
             </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DemandasList;
