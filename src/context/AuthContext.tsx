import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  uid: string;
  email: string;
  name: string;
  companyName: string;
  role: 'Founder' | 'Accountant' | 'Viewer';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role?: string) => Promise<void>;
  signup: (email: string, name: string, companyName: string, role: 'Founder' | 'Accountant' | 'Viewer') => Promise<void>;
  logout: () => void;
  updateProfile: (updates: { name?: string; companyName?: string }) => Promise<void>;
  error: string | null;
  setError: (err: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('vriddhi_auth_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('vriddhi_auth_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, role?: string) => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
        options: role ? { data: { role } } : undefined
      } as any);

      if (err) {
        throw new Error(err.message);
      }

      if (!data?.user) {
        throw new Error("No account found with this email. Please sign up to create your workspace.");
      }

      const loggedUser: User = {
        uid: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || '',
        companyName: data.user.user_metadata?.company_name || '',
        role: data.user.user_metadata?.role as any,
      };

      if (data.session?.access_token) {
        localStorage.setItem('vriddhi_auth_token', data.session.access_token);
      }

      setUser(loggedUser);
      localStorage.setItem('vriddhi_auth_user', JSON.stringify(loggedUser));
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please try again.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, name: string, companyName: string, role: 'Founder' | 'Accountant' | 'Viewer') => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: "defaultPassword123!", // Dummy password as we don't collect one in UI
        options: {
          data: {
            name,
            company_name: companyName,
            role
          }
        }
      });

      if (err) {
        throw new Error(err.message);
      }

      if (!data?.user) {
        throw new Error("Failed to register user. Try again.");
      }

      const authenticatedUser: User = {
        uid: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || name,
        companyName: data.user.user_metadata?.company_name || companyName,
        role: data.user.user_metadata?.role as any || role,
      };

      if (data.session?.access_token) {
        localStorage.setItem('vriddhi_auth_token', data.session.access_token);
      }

      setUser(authenticatedUser);
      localStorage.setItem('vriddhi_auth_user', JSON.stringify(authenticatedUser));
    } catch (err: any) {
      setError(err.message || "Failed to register. Please check details.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: { name?: string; companyName?: string }) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('vriddhi_auth_user', JSON.stringify(updated));
    try {
      await supabase.from('users').update({
        name: updated.name,
        company_name: updated.companyName,
      }).eq('id', user.uid);
    } catch {}
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vriddhi_auth_user');
    localStorage.removeItem('vriddhi_auth_token');
    sessionStorage.removeItem('vriddhi_active_role');
    sessionStorage.removeItem('vriddhi_active_tab');
    supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
