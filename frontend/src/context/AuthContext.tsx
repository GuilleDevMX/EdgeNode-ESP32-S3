// src/context/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  role: 'admin' | 'operator' | 'viewer' | null;
}

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: !!sessionStorage.getItem("esp32_token"),
    token: sessionStorage.getItem("esp32_token"),
    role: sessionStorage.getItem("esp32_role") as any || null,
  });

  const login = (token: string, role: string) => {
    sessionStorage.setItem("esp32_token", token);
    sessionStorage.setItem("esp32_role", role);
    setAuth({ isAuthenticated: true, token, role: role as any });
  };

  const logout = () => {
    sessionStorage.clear();
    setAuth({ isAuthenticated: false, token: null, role: null });
  };

  useEffect(() => {
    const handleAuthExpired = () => logout();
    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);