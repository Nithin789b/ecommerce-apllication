import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearAccessToken, refreshSession, setAccessToken } from '../api/api.js';

const AuthContext = createContext(null);

function profilePathFor(role) {
  return role === 'ADMIN' ? '/api/admin/me' : '/api/users/me';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreUser() {
      const session = await refreshSession();

      if (!isMounted) return;

      if (!session?.accessToken || !session.role) {
        clearAccessToken();
        setUser(null);
        setIsLoading(false);
        return;
      }

      setAccessToken(session.accessToken);
      const profile = await api.get(profilePathFor(session.role));

      if (!isMounted) return;

      if (profile.data?.success && profile.data.user) {
        setUser(profile.data.user);
      } else {
        clearAccessToken();
        setUser(null);
      }
      setIsLoading(false);
    }

    restoreUser();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(email, password, asAdmin = false) {
    const path = asAdmin ? '/api/users/admin/login' : '/api/users/login';
    const result = await api.post(path, { email, password });

    if (result.error) return { success: false, error: result.error.message };

    setAccessToken(result.data.accessToken);
    setUser(result.data.user);
    return { success: true, user: result.data.user };
  }

  async function signup(userDetails) {
    const result = await api.post('/api/users/signup', userDetails);
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, user: result.data.user };
  }

  async function logout() {
    clearAccessToken();
    setUser(null);
    await api.post('/api/users/logout');
  }

  const value = useMemo(
    () => ({
      user,
      updateUser: setUser,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      signup,
      logout,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
