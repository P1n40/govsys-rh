import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  LogOut, 
  ShieldCheck,
  UserCircle,
  BarChart3,
  Users,
  Menu,
  X
} from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  currentUser: User;
  onLogout: () => void;
  onSwitchUser: () => void;
}

const Layout: React.FC<LayoutProps> = ({ currentUser, onLogout, onSwitchUser }) => {
  const isAdminOrSupervisor = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-slate-900 text-slate-200 flex flex-col shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between lg:justify-start space-x-3">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldCheck size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">HR GovSys</h1>
              <p className="text-xs text-slate-400">Governança Operacional</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={closeMobileMenu}>
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {isAdminOrSupervisor && (
            <NavLink 
              to="/" 
              onClick={closeMobileMenu}
              className={({ isActive }) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </NavLink>
          )}

          <NavLink 
            to="/demandas" 
            onClick={closeMobileMenu}
            className={({ isActive }) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <FileText size={20} />
            <span className="font-medium">Demandas</span>
          </NavLink>

          <NavLink 
            to="/nova-demanda" 
            onClick={closeMobileMenu}
            className={({ isActive }) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <PlusCircle size={20} />
            <span className="font-medium">Nova Demanda</span>
          </NavLink>

          {isAdminOrSupervisor && (
            <>
              <NavLink 
                to="/relatorios" 
                onClick={closeMobileMenu}
                className={({ isActive }) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
              >
                <BarChart3 size={20} />
                <span className="font-medium">Relatórios</span>
              </NavLink>

              <NavLink 
                to="/equipe" 
                onClick={closeMobileMenu}
                className={({ isActive }) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}`}
              >
                <Users size={20} />
                <span className="font-medium">Gestão de Equipe</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center space-x-3 mb-4">
            <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full border-2 border-blue-500" />
            <div>
              <p className="text-sm font-semibold text-white truncate max-w-[150px]">{currentUser.name}</p>
              <p className="text-xs text-blue-400 font-medium">{currentUser.role}</p>
            </div>
          </div>
          <button 
            onClick={() => { onSwitchUser(); closeMobileMenu(); }}
            className="w-full flex items-center justify-center space-x-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-md mb-2 transition-colors"
          >
            <UserCircle size={14} />
            <span>Trocar Perfil (Demo)</span>
          </button>
          <button 
            onClick={() => { onLogout(); closeMobileMenu(); }}
            className="w-full flex items-center justify-center space-x-2 text-xs text-red-400 hover:text-red-300 py-2 transition-colors"
          >
            <LogOut size={14} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative w-full">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden text-slate-500 hover:text-slate-800 p-1"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="hidden sm:flex items-center text-slate-500 text-sm">
               <span className="font-medium text-slate-800">Ambiente Crítico</span>
               <span className="mx-2">•</span>
               <span className="truncate">Todas as ações são monitoradas e auditadas.</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold flex items-center whitespace-nowrap">
              <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 animate-pulse"></span>
              <span className="hidden sm:inline">Sistema Operacional</span>
              <span className="sm:hidden">Online</span>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
