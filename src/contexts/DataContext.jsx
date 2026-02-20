import { createContext, useContext } from 'react';
import { useAppData } from '../hooks/useAppData';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const appData = useAppData();
  return <DataContext.Provider value={appData}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
