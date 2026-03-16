import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string } | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setupUser: (name: string) => Promise<boolean>;
  acceptInvite: (token: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);

  const login = async (username: string, password: string) => {
    // Mock login logic
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        if (username === 'test' && password === 'password') {
          setIsAuthenticated(true);
          setUser({ name: 'Test User' });
          resolve(true);
        } else {
          resolve(false);
        }
      }, 500);
    });
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  const setupUser = async (name: string) => {
    // Mock setup logic
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        if (name && name.trim() !== '') {
          setUser({ name });
          setIsAuthenticated(true); // Assume setup leads to authenticated state
          resolve(true);
        } else {
          resolve(false);
        }
      }, 500);
    });
  };

  const acceptInvite = async (token: string) => {
    // Mock invite logic
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        if (token === 'valid-token') {
          setUser({ name: 'Invited User' });
          setIsAuthenticated(true); // Assume invite acceptance leads to authenticated state
          resolve(true);
        } else {
          resolve(false);
        }
      }, 500);
    });
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, setupUser, acceptInvite }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
