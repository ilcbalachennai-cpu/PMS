
import { useState, useLayoutEffect, RefObject } from 'react';
import { View, User } from '../types';

export const useNavigation = (mainContentRef: RefObject<HTMLElement | null>, currentUser: User | null) => {
  const [activeView, setActiveView] = useState<View>(View.Dashboard);

  useLayoutEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeView, currentUser, mainContentRef]);

  return { activeView, setActiveView };
};
