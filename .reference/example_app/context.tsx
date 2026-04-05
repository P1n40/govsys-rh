import { createContext, useContext } from 'react';
import { User, Demanda } from './types';

export interface AppContextType {
  currentUser: User;
  users: User[];
  demandas: Demanda[];
  strictSLA: boolean;
  setCurrentUser: (user: User) => void;
  addUser: (user: User) => void;
  addDemanda: (demanda: Demanda) => void;
  updateDemanda: (demanda: Demanda) => void;
  toggleStrictSLA: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
