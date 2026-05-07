import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from './types';
import { getMe } from './api';

type AuthState = {
  user: User | null;
  loading: boolean;
  refresh: () => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
