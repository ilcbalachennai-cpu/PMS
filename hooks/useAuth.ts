
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

  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const handleAuthLogin = useCallback((user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('app_session_user', JSON.stringify(user));
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('app_session_user');
    setCurrentUser(null);
    setLogoutMessage('You have been signed out successfully.');
  }, []);

  return { 
    currentUser, setCurrentUser, 
    handleAuthLogin, handleLogout, 
    logoutMessage, setLogoutMessage 
  };
};
