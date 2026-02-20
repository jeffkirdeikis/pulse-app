import { createContext, useContext } from 'react';
import { useUserData } from '../hooks/useUserData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const userData = useUserData();
  return <AuthContext.Provider value={userData}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
