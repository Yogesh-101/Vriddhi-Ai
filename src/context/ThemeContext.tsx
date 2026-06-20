import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always lock theme to 'dark'
  const theme: Theme = 'dark';

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    localStorage.setItem('theme', 'dark');
  }, []);

  const toggleTheme = () => {
    // No-op to remove toggle functionality
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
