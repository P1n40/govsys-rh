import React, { useState } from 'react';
import { useAppContext } from '../context';
import { Card, Button, Badge } from '../components/ui';
import { User, UserRole, HRSector } from '../types';
import { Plus, Settings, Shield, UserPlus, X, AlertTriangle, CheckCircle } from 'lucide-react';

const SECTORS: HRSector[] = [
  'Administração de Pessoal (DP)',
  'Recrutamento e Seleção (R&S)',
  'Jurídico Trabalhista',
  'Segurança do Trabalho (SESMT)',
  'Benefícios Corporativos',
  'Remuneração e Cargos'
];

const TeamManagement: React.FC = () => {
  const { users, currentUser, addUser, strictSLA, toggleStrictSLA } = useAppContext();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newUser, setNewUser] = useState<{name: string, role: UserRole, sector: string}>({
      name: '',
      role: 'ATTENDANT',
      sector: SECTORS[0]
  });

  const isAdmin = currentUser.role === 'ADMIN';

  const handleAddUser = () => {
      if (!newUser.name) return alert('Nome é obrigatório');
      
      addUser({
          id: `u${Date.now()}`,
          name: newUser.name,
          role: newUser.role,
          avatar: `https://ui-avatars.com/api/?name=${newUser.name}&background=random`,
          sector: newUser.sector as HRSector
      });
      setShowAddModal(false);
      setNewUser({ name: '', role: 'ATTENDANT', sector: SECTORS[0] });
      alert('Usuário criado com sucesso.');
  };

  return (
    <div className="space-y-6">
      {/* Global Config Modal */}
      {showConfigModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <Settings size={20} className="text-slate-600"/> Configurações Globais
                      </h3>
                      <button onClick={() => setShowConfigModal(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="p-4 border border-slate-200 rounded-lg flex items-start gap-4">
                          <div className={`p-2 rounded-full ${strictSLA ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                              <AlertTriangle size={24} />
                          </div>
                          <div className="flex-1">
                              <h4 className="font-bold text-slate-800">SLA Rígido (Strict Mode)</h4>
                              <p className="text-xs text-slate-500 mt-1 mb-3">
                                  Quando ativo, impede qualquer alteração de status em demandas atrasadas, exceto por Supervisores.
                              </p>
                              <Button 
                                onClick={toggleStrictSLA} 
                                variant={strictSLA ? 'danger' : 'outline'}
                                className="w-full text-xs"
                              >
                                  {strictSLA ? 'Desativar Modo Rígido' : 'Ativar Modo Rígido'}
                              </Button>
                          </div>
                      </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row justify-end">
                      <Button onClick={() => setShowConfigModal(false)} className="w-full sm:w-auto">Fechar</Button>
                  </div>
               </div>
          </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <UserPlus size={20} className="text-blue-600"/> Novo Usuário
                      </h3>
                      <button onClick={() => setShowAddModal(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                          <input 
                            type="text" 
                            className="w-full border border-slate-300 rounded px-3 py-2"
                            value={newUser.name}
                            onChange={e => setNewUser({...newUser, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de Acesso</label>
                          <select 
                            className="w-full border border-slate-300 rounded px-3 py-2"
                            value={newUser.role}
                            onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                          >
                              <option value="ATTENDANT">Atendente (Operacional)</option>
                              <option value="RESPONSIBLE">Responsável (Técnico)</option>
                              <option value="SUBSTITUTE">Substituto</option>
                              <option value="SUPERVISOR">Supervisor</option>
                              {isAdmin && <option value="ADMIN">Administrador</option>}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Setor / Domínio</label>
                          <select 
                             className="w-full border border-slate-300 rounded px-3 py-2"
                             value={newUser.sector}
                             onChange={e => setNewUser({...newUser, sector: e.target.value})}
                          >
                              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                  </div>
                  <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddModal(false)} className="w-full sm:w-auto">Cancelar</Button>
                      <Button onClick={handleAddUser} className="w-full sm:w-auto">Criar Usuário</Button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestão de Equipe</h2>
          <p className="text-slate-500">Controle de acessos e alocação de setores.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {isAdmin && (
                <Button variant="secondary" onClick={() => setShowConfigModal(true)} className="flex items-center justify-center gap-2 w-full sm:w-auto">
                    <Settings size={18} /> Configurações Globais
                </Button>
            )}
            <Button onClick={() => setShowAddModal(true)} className="flex items-center justify-center gap-2 w-full sm:w-auto">
                <Plus size={18} /> Adicionar Usuário
            </Button>
        </div>
      </div>

      <Card>
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                      <tr>
                          <th className="px-6 py-4">Usuário</th>
                          <th className="px-6 py-4">Função</th>
                          <th className="px-6 py-4">Setor Alocado</th>
                          <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {users.map(user => (
                          <tr key={user.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 flex items-center gap-3">
                                  <img src={user.avatar} alt="" className="w-8 h-8 rounded-full border border-slate-200"/>
                                  <div>
                                      <p className="font-medium text-slate-800">{user.name}</p>
                                      <p className="text-xs text-slate-500">ID: {user.id}</p>
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                      user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                      user.role === 'SUPERVISOR' ? 'bg-blue-100 text-blue-700' :
                                      'bg-slate-100 text-slate-600'
                                  }`}>
                                      {user.role === 'ADMIN' && <Shield size={10}/>}
                                      {user.role}
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                  {user.sector || <span className="text-slate-400 italic">Não alocado</span>}
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <Badge type="success">Ativo</Badge>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </Card>
    </div>
  );
};

export default TeamManagement;
