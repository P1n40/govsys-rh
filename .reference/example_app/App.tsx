import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DemandasList from './pages/DemandasList';
import DemandaDetail from './pages/DemandaDetail';
import NewDemanda from './pages/NewDemanda';
import Reports from './pages/Reports';
import TeamManagement from './pages/TeamManagement';
import { MOCK_USERS, INITIAL_DEMANDAS } from './constants';
import { User, Demanda } from './types';
import { AppContext } from './context';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]); // Default to ADMIN
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [demandas, setDemandas] = useState<Demanda[]>(INITIAL_DEMANDAS);
  const [strictSLA, setStrictSLA] = useState(false);

  const addDemanda = (demanda: Demanda) => {
    setDemandas(prev => [...prev, demanda]);
  };

  const updateDemanda = (updatedDemanda: Demanda) => {
    setDemandas(prev => prev.map(d => d.protocol === updatedDemanda.protocol ? updatedDemanda : d));
  };
  
  const addUser = (user: User) => {
      setUsers(prev => [...prev, user]);
  }

  const handleSwitchUser = () => {
    const currentIndex = users.findIndex(u => u.id === currentUser.id);
    const nextIndex = (currentIndex + 1) % users.length;
    setCurrentUser(users[nextIndex]);
  };

  const toggleStrictSLA = () => {
      setStrictSLA(prev => !prev);
  };

  const contextValue = { 
      currentUser, users, demandas, strictSLA,
      setCurrentUser, addUser, addDemanda, updateDemanda, toggleStrictSLA 
  };

  return (
    <AppContext.Provider value={contextValue}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout currentUser={currentUser} onLogout={() => alert('Logout clicked')} onSwitchUser={handleSwitchUser} />}>
            <Route index element={(currentUser.role === 'SUPERVISOR' || currentUser.role === 'ADMIN') ? <Dashboard /> : <Navigate to="/demandas" />} />
            <Route path="demandas" element={<DemandasList />} />
            <Route path="demandas/:protocol" element={<DemandaDetail />} />
            <Route path="nova-demanda" element={<NewDemanda />} />
            <Route path="relatorios" element={(currentUser.role === 'SUPERVISOR' || currentUser.role === 'ADMIN') ? <Reports /> : <Navigate to="/demandas" />} />
            <Route path="equipe" element={(currentUser.role === 'SUPERVISOR' || currentUser.role === 'ADMIN') ? <TeamManagement /> : <Navigate to="/demandas" />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
};

export default App;