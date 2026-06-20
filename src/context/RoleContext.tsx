import React, { createContext, useContext, useState, useCallback } from 'react';

export type UserRole = 'Founder' | 'Accountant' | 'Viewer';

export interface RoleContextType {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRoleState] = useState<UserRole>(() => {
    const saved = sessionStorage.getItem('vriddhi_active_role');
    return (saved as UserRole) || 'Founder';
  });
  const [activeTab, setActiveTabState] = useState<string>(() => {
    return sessionStorage.getItem('vriddhi_active_tab') || 'dashboard';
  });

  const setUserRole = useCallback((role: UserRole) => {
    setUserRoleState(role);
    sessionStorage.setItem('vriddhi_active_role', role);
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    sessionStorage.setItem('vriddhi_active_tab', tab);
  }, []);

  return (
    <RoleContext.Provider value={{ userRole, setUserRole, activeTab, setActiveTab }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
    const context = useContext(RoleContext);
    if (!context) {
        throw new Error("useRole must be used within a RoleProvider");
    }
    return context;
};
