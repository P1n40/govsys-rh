import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context';
import { Card, Badge } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { AlertCircle, Clock, CheckCircle, Lock, Siren, TrendingUp, Users, GitFork, AlertTriangle } from 'lucide-react';
import { MOCK_USERS } from '../constants';

const Dashboard: React.FC = () => {
  const { demandas } = useAppContext();
  const navigate = useNavigate();

  // 1. KPI Stats
  const stats = {
    open: demandas.filter(d => d.status === 'OPEN').length,
    inProgress: demandas.filter(d => d.status === 'IN_PROGRESS').length,
    blocked: demandas.filter(d => d.status === 'BLOCKED').length,
    overdue: demandas.filter(d => new Date(d.deadline) < new Date() && d.status !== 'COMPLETED' && d.status !== 'CANCELED').length,
    critical: demandas.filter(d => d.risk === 'LEGAL' || d.risk === 'CONTRACTUAL').length,
    completed: demandas.filter(d => d.status === 'COMPLETED').length,
    canceled: demandas.filter(d => d.status === 'CANCELED').length,
  };

  // 2. SLA Data
  const slaData = [
    { name: 'No Prazo', value: stats.completed + stats.open + stats.inProgress - stats.overdue, color: '#10B981' },
    { name: 'Atrasado (Escalonado)', value: stats.overdue, color: '#EF4444' },
  ];

  // 3. Risk Heatmap Data Generation (User vs Risk)
  const heatmapData = MOCK_USERS.map(user => {
    const userDemandas = demandas.filter(d => (d.responsibleId === user.id || d.substituteId === user.id) && d.status !== 'COMPLETED' && d.status !== 'CANCELED');
    return {
      id: user.id,
      name: user.name,
      LEGAL: userDemandas.filter(d => d.risk === 'LEGAL').length,
      CONTRACTUAL: userDemandas.filter(d => d.risk === 'CONTRACTUAL').length,
      FINANCIAL: userDemandas.filter(d => d.risk === 'FINANCIAL').length,
      OPERATIONAL: userDemandas.filter(d => d.risk === 'OPERATIONAL').length,
      total: userDemandas.length
    };
  }).sort((a, b) => b.total - a.total); // Sort by busiest user

  // 4. Manual Derived Demand Analytics
  const manualDerived = demandas.filter(d => !!d.parentProtocol);
  const totalManualDerived = manualDerived.length;
  
  // Group derived demands by Creator (Responsible)
  const derivedCreators = MOCK_USERS.map(u => {
      // Find demand logs where action is CRIACAO_DERIVADA and user is this user
      const createdCount = manualDerived.filter(d => 
          d.logs.some(l => l.action === 'CRIACAO_DERIVADA' && l.userId === u.id)
      ).length;
      return { name: u.name, count: createdCount };
  }).filter(u => u.count > 0).sort((a,b) => b.count - a.count);

  // Find Parents Blocked by Children
  const parentsBlockedByChildren = demandas.filter(d => 
      d.status !== 'COMPLETED' && 
      d.status !== 'CANCELED' &&
      d.linkedProtocols && 
      d.linkedProtocols.length > 0 &&
      d.linkedProtocols.some(childProtocol => {
          const child = demandas.find(c => c.protocol === childProtocol);
          return child && child.status !== 'COMPLETED' && child.status !== 'CANCELED';
      })
  );

  // Helper for Heatmap Intensity
  const getIntensityColor = (count: number, risk: string) => {
    if (count === 0) return 'bg-slate-50 text-slate-300';
    if (risk === 'LEGAL' || risk === 'FINANCIAL') {
       return count > 2 ? 'bg-red-500 text-white font-bold' : 'bg-red-100 text-red-800';
    }
    return count > 4 ? 'bg-blue-500 text-white font-bold' : 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Torre de Controle (SLA)</h2>
          <p className="text-slate-500">Monitoramento de Compliance e Riscos Operacionais.</p>
        </div>
        <div className="text-sm text-slate-500">
          <span className="flex items-center gap-1"><Siren size={14} className="text-red-500"/> Escalonamento Automático Ativo</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Backlog Ativo</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.open + stats.inProgress}</h3>
              <p className="text-xs text-blue-600 mt-1">{stats.blocked} bloqueados</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Clock size={20} />
            </div>
          </div>
        </Card>

        <Card 
            className="p-4 border-l-4 border-l-red-500 cursor-pointer hover:bg-red-50 transition-colors"
            onClick={() => navigate('/demandas?filter=OVERDUE')}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">SLA Estourado</p>
              <h3 className="text-2xl font-bold text-red-600">{stats.overdue}</h3>
              <p className="text-xs text-red-500 mt-1">Requer Ação Imediata (Clique)</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertCircle size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Risco Legal/Fin</p>
              <h3 className="text-2xl font-bold text-amber-600">{stats.critical}</h3>
              <p className="text-xs text-amber-600 mt-1">Exposição Alta</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <CheckCircle size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Concluídos</p>
              <h3 className="text-2xl font-bold text-emerald-600">{stats.completed}</h3>
              <p className="text-xs text-emerald-600 mt-1">Total acumulado</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* MANUAL DERIVED DEMANDS ANALYTICS - NEW SECTION */}
      <Card className="p-6 border border-purple-200 bg-purple-50/30">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                  <GitFork size={20} className="text-purple-600"/>
                  Análise de Derivações Manuais
              </h3>
              <Badge type="info">Foco em Automação</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100">
                  <p className="text-xs font-bold text-purple-500 uppercase mb-1">Total de Derivações</p>
                  <p className="text-3xl font-bold text-slate-800">{totalManualDerived}</p>
                  <p className="text-xs text-slate-500 mt-2">Processos criados manualmente a partir de outro.</p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100">
                  <p className="text-xs font-bold text-purple-500 uppercase mb-1">Top Criadores (Automação)</p>
                  <ul className="text-sm space-y-2 mt-2">
                      {derivedCreators.length > 0 ? derivedCreators.slice(0, 3).map((c, i) => (
                          <li key={i} className="flex justify-between items-center">
                              <span className="text-slate-700">{c.name}</span>
                              <span className="font-bold text-purple-700 bg-purple-100 px-2 rounded-full text-xs">{c.count}</span>
                          </li>
                      )) : <p className="text-xs text-slate-400 italic">Sem dados registrados.</p>}
                  </ul>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-100">
                   <p className="text-xs font-bold text-purple-500 uppercase mb-1">Gargalos Hierárquicos</p>
                   {parentsBlockedByChildren.length > 0 ? (
                       <div className="mt-2 space-y-2">
                           <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                               <AlertTriangle size={12}/> {parentsBlockedByChildren.length} Processos Travados
                           </p>
                           <ul className="text-xs space-y-1">
                               {parentsBlockedByChildren.slice(0,3).map(p => (
                                   <li key={p.protocol} className="text-slate-600 truncate">• {p.protocol} (Aguardando filhas)</li>
                               ))}
                           </ul>
                       </div>
                   ) : (
                       <p className="text-sm text-green-600 font-medium flex items-center gap-2 mt-2">
                           <CheckCircle size={16}/> Fluxo Fluido
                       </p>
                   )}
              </div>
          </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* HEATMAP */}
        <div className="lg:col-span-2">
            <Card className="p-6 h-full">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-slate-500" />
                        Mapa de Calor: Risco x Responsável
                    </h3>
                    <Badge type="neutral">Tempo Real</Badge>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-center">
                        <thead>
                            <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3 text-left">Colaborador</th>
                                <th className="px-4 py-3 text-red-600">Legal</th>
                                <th className="px-4 py-3 text-amber-600">Contratual</th>
                                <th className="px-4 py-3 text-orange-600">Financeiro</th>
                                <th className="px-4 py-3 text-blue-600">Operacional</th>
                                <th className="px-4 py-3 text-slate-800">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {heatmapData.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-left font-medium text-slate-700">{u.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${getIntensityColor(u.LEGAL, 'LEGAL')}`}>
                                            {u.LEGAL}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${getIntensityColor(u.CONTRACTUAL, 'CONTRACTUAL')}`}>
                                            {u.CONTRACTUAL}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${getIntensityColor(u.FINANCIAL, 'FINANCIAL')}`}>
                                            {u.FINANCIAL}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${getIntensityColor(u.OPERATIONAL, 'OPERATIONAL')}`}>
                                            {u.OPERATIONAL}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-800">{u.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 text-xs text-slate-400 text-right">
                    * Células vermelhas indicam alta concentração de risco crítico.
                </div>
            </Card>
        </div>

        {/* SLA PIE CHART */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Saúde do SLA</h3>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slaData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {slaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-100 text-xs text-slate-600">
             <strong>Nota de Governança:</strong> O SLA é calculado com base nas Fichas de Procedimento (POPs). Atrasos em processos Legais (Vermelho) geram escalonamento automático.
          </div>
        </Card>
      </div>

      {/* Critical Escalation List */}
      <Card className="p-6 border-t-4 border-t-red-600">
         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            Radar de Escalonamento (Urgência Máxima)
         </h3>
         <div className="space-y-3">
            {demandas.filter(d => (new Date(d.deadline) < new Date() && d.status !== 'COMPLETED') || d.status === 'BLOCKED').slice(0, 5).map(demanda => {
               const isLegalRisk = demanda.risk === 'LEGAL' || demanda.risk === 'FINANCIAL';
               return (
               <div key={demanda.protocol} className={`flex items-center justify-between p-4 rounded-lg border ${isLegalRisk ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center space-x-4">
                     <div className={`p-2 rounded-full ${isLegalRisk ? 'bg-red-200 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                        {demanda.status === 'BLOCKED' ? <Lock size={16}/> : <Clock size={16}/>}
                     </div>
                     <div>
                        <p className="text-sm font-bold text-slate-800">{demanda.title}</p>
                        <p className="text-xs text-slate-500">
                           {demanda.protocol} • Responsável: {MOCK_USERS.find(u => u.id === demanda.responsibleId)?.name}
                        </p>
                     </div>
                  </div>
                  <div className="text-right">
                     <span className={`text-xs font-bold block ${isLegalRisk ? 'text-red-700' : 'text-slate-600'}`}>
                        {demanda.status === 'BLOCKED' ? 'BLOQUEADO' : 'SLA EXPIRADO'}
                     </span>
                     {isLegalRisk && <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Risco Legal</span>}
                  </div>
               </div>
               );
            })}
            {demandas.filter(d => (new Date(d.deadline) < new Date() && d.status !== 'COMPLETED') || d.status === 'BLOCKED').length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                 <CheckCircle size={32} className="mb-2 text-emerald-400" />
                 <p className="text-sm">Operação 100% dentro do SLA.</p>
              </div>
            )}
         </div>
      </Card>
    </div>
  );
};

export default Dashboard;
