import React, { useState } from 'react';
import { useAppContext } from '../context';
import { Card, Button, Badge } from '../components/ui';
import { Download, Filter, FileSpreadsheet, FileText, Server, AlertOctagon } from 'lucide-react';
import { PROCESS_TEMPLATES } from '../constants';

const Reports: React.FC = () => {
  const { demandas } = useAppContext();
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'LOGS'>('REPORTS');
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    risk: 'ALL',
    status: 'ALL',
    type: 'ALL'
  });

  const [logFilter, setLogFilter] = useState<'ALL' | 'CRITICAL'>('ALL');

  const filteredDemandas = demandas.filter(d => {
    const dDate = new Date(d.createdAt);
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;
    
    if (start && dDate < start) return false;
    if (end && dDate > end) return false;
    if (filters.risk !== 'ALL' && d.risk !== filters.risk) return false;
    if (filters.status !== 'ALL' && d.status !== filters.status) return false;
    if (filters.type !== 'ALL' && d.type !== filters.type) return false;
    
    return true;
  });

  // Mock Logs Data
  const mockLogs = [
      { id: 1, type: 'CRITICAL', msg: 'System SLA Override - User u1', time: '10 min ago' },
      { id: 2, type: 'INFO', msg: 'Backup completed successfully', time: '1 hour ago' },
      { id: 3, type: 'CRITICAL', msg: 'Failed login attempt - IP 192.168.1.5', time: '2 hours ago' },
      { id: 4, type: 'INFO', msg: 'New user created - Carlos', time: '3 hours ago' },
      { id: 5, type: 'CRITICAL', msg: 'Compliance Rule #42 Triggered', time: '5 hours ago' },
  ];

  const filteredLogs = logFilter === 'ALL' ? mockLogs : mockLogs.filter(l => l.type === 'CRITICAL');

  const handleExport = (format: 'PDF' | 'EXCEL') => {
    alert(`Exportando relatório em ${format} com ${filteredDemandas.length} registros... (Simulação)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900">Relatórios & Auditoria</h2>
           <p className="text-slate-500">Centro de inteligência e logs do sistema.</p>
        </div>
        {activeTab === 'REPORTS' && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => handleExport('PDF')} className="flex items-center justify-center gap-2 w-full sm:w-auto">
                    <FileText size={16} /> Exportar PDF
                </Button>
                <Button variant="outline" onClick={() => handleExport('EXCEL')} className="flex items-center justify-center gap-2 w-full sm:w-auto">
                    <FileSpreadsheet size={16} /> Exportar Excel
                </Button>
            </div>
        )}
      </div>

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto whitespace-nowrap pb-1">
          <button 
            className={`pb-2 px-4 font-medium text-sm transition-colors border-b-2 ${activeTab === 'REPORTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('REPORTS')}
          >
              Relatórios de Performance
          </button>
          <button 
            className={`pb-2 px-4 font-medium text-sm transition-colors border-b-2 ${activeTab === 'LOGS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('LOGS')}
          >
              Logs do Sistema
          </button>
      </div>

      {activeTab === 'REPORTS' ? (
          <>
            <Card className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                    <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Data Início</label>
                    <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
                    </div>
                    <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Data Fim</label>
                    <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
                    </div>
                    <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Risco</label>
                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={filters.risk} onChange={e => setFilters({...filters, risk: e.target.value})}>
                        <option value="ALL">Todos</option>
                        <option value="LEGAL">Jurídico</option>
                        <option value="CONTRACTUAL">Contratual</option>
                        <option value="OPERATIONAL">Operacional</option>
                        <option value="FINANCIAL">Financeiro</option>
                    </select>
                    </div>
                    <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Status</label>
                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                        <option value="ALL">Todos</option>
                        <option value="OPEN">Aberto</option>
                        <option value="IN_PROGRESS">Em Andamento</option>
                        <option value="BLOCKED">Bloqueado</option>
                        <option value="COMPLETED">Concluído</option>
                        <option value="CANCELED">Cancelada</option>
                    </select>
                    </div>
                    <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Tipo de Processo</label>
                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
                        <option value="ALL">Todos</option>
                        {Object.keys(PROCESS_TEMPLATES).map(key => (
                            <option key={key} value={key}>{key}</option>
                        ))}
                    </select>
                    </div>
                    <div>
                        <Button variant="secondary" className="w-full" onClick={() => setFilters({ startDate: '', endDate: '', risk: 'ALL', status: 'ALL', type: 'ALL' })}>
                            Limpar Filtros
                        </Button>
                    </div>
                </div>
            </Card>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-600">Protocolo</th>
                                <th className="px-6 py-4 font-semibold text-slate-600">Data</th>
                                <th className="px-6 py-4 font-semibold text-slate-600">Tipo</th>
                                <th className="px-6 py-4 font-semibold text-slate-600">Risco</th>
                                <th className="px-6 py-4 font-semibold text-slate-600">Responsável</th>
                                <th className="px-6 py-4 font-semibold text-slate-600">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDemandas.map(d => (
                                <tr key={d.protocol} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-mono font-medium">{d.protocol}</td>
                                    <td className="px-6 py-4 text-slate-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">{d.type}</td>
                                    <td className="px-6 py-4">
                                        <Badge type={d.risk === 'LEGAL' ? 'danger' : d.risk === 'CONTRACTUAL' ? 'warning' : 'info'}>
                                        {d.risk}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{d.responsibleId}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                            d.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                            d.status === 'BLOCKED' ? 'bg-red-100 text-red-800' :
                                            d.status === 'CANCELED' ? 'bg-slate-200 text-slate-700' :
                                            'bg-slate-100 text-slate-800'
                                        }`}>
                                            {d.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredDemandas.length === 0 && (
                        <div className="p-8 text-center text-slate-500">Nenhum registro encontrado para os filtros selecionados.</div>
                    )}
                </div>
                <div className="bg-slate-50 p-4 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
                    <span>Mostrando {filteredDemandas.length} registros</span>
                    <span>Relatório gerado em {new Date().toLocaleString()}</span>
                </div>
            </Card>
          </>
      ) : (
          <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Server size={20} className="text-slate-500"/> System Activity Logs
                  </h3>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setLogFilter('ALL')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${logFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'}`}
                      >
                          All Events
                      </button>
                      <button 
                        onClick={() => setLogFilter('CRITICAL')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${logFilter === 'CRITICAL' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200'}`}
                      >
                          Critical Only
                      </button>
                  </div>
              </div>

              <div className="space-y-2">
                  {filteredLogs.map(log => (
                      <div key={log.id} className="p-3 bg-slate-50 rounded border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                              {log.type === 'CRITICAL' ? (
                                  <AlertOctagon size={16} className="text-red-500" />
                              ) : (
                                  <div className="w-4 h-4 rounded-full bg-blue-400"></div>
                              )}
                              <span className={`text-sm font-mono ${log.type === 'CRITICAL' ? 'text-red-700 font-bold' : 'text-slate-700'}`}>
                                  {log.msg}
                              </span>
                          </div>
                          <span className="text-xs text-slate-400 font-mono">{log.time}</span>
                      </div>
                  ))}
              </div>
          </Card>
      )}
    </div>
  );
};

export default Reports;
