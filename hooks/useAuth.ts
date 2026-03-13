
import { useState, useCallback } from 'react';
import { User } from '../types';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = sessionStorage.getItem('app_session_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.role) return parsed;
      }
      return null;
    } catch (e) { return null; }
  });

  const handleLogin = useCallback((user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('app_session_user', JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('app_session_user');
    setCurrentUser(null);
  }, []);

  return { currentUser, setCurrentUser, handleLogin, logout };
};
