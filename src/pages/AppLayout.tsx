import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LayoutDashboard, Receipt, Users, Wallet, FileText, Settings as SettingsIcon, Bell, Search, BarChart3, Menu, Sun, Moon, ShieldAlert, Key, LogOut, HandCoins, Pencil, Check, X as XIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dashboard } from '@/components/Dashboard';
import { Copilot } from '@/components/Copilot';
import { CashFlow } from '@/components/CashFlow';
import { DocumentsOCR } from '@/components/DocumentsOCR';
import { Transactions } from '@/components/Transactions';
import { Invoices } from '@/components/Invoices';
import { Clients } from '@/components/Clients';
import { Settings } from '@/components/Settings';
import { Receivables } from '@/components/Receivables';
import { useTheme } from '../context/ThemeContext';
import { useRole } from '../context/RoleContext';
import { UserRole } from '../context/RoleContext';
import { CandleStocksChart } from '../components/CandleStocksChart';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function App() {
  const { theme } = useTheme();
  const { user, logout, updateProfile } = useAuth();
  const { userRole, setUserRole, activeTab, setActiveTab } = useRole();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editCompany, setEditCompany] = useState(user?.companyName || '');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
  const [readNotifVersion, setReadNotifVersion] = useState(0);

  const READ_NOTIF_KEY = 'vriddhi_read_notification_ids';

  const getReadNotifIds = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(READ_NOTIF_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }, []);

  const markNotificationsRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const read = getReadNotifIds();
    ids.forEach((id) => read.add(id));
    localStorage.setItem(READ_NOTIF_KEY, JSON.stringify([...read]));
    setReadNotifVersion((v) => v + 1);
  }, [getReadNotifIds]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('notification_logs').select('*');
      if (data) {
        setNotificationLogs(
          data.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(fetchNotifications, 60000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [user, fetchNotifications]);

  const recentNotifications = useMemo(() => notificationLogs.slice(0, 8), [notificationLogs]);

  const hasUnreadNotifications = useMemo(() => {
    const read = getReadNotifIds();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return notificationLogs.some((log) => {
      const ts = new Date(log.timestamp).getTime();
      return ts >= cutoff && !read.has(log.id);
    });
  }, [notificationLogs, getReadNotifIds, readNotifVersion]);

  const toggleNotifPanel = () => {
    setIsUserMenuOpen(false);
    setIsNotifOpen((open) => {
      if (!open) {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const unreadIds = notificationLogs
          .filter((log) => new Date(log.timestamp).getTime() >= cutoff)
          .map((log) => log.id);
        markNotificationsRead(unreadIds);
      }
      return !open;
    });
  };

  const openAllNotifications = () => {
    setIsNotifOpen(false);
    sessionStorage.setItem('vriddhi_settings_admin_tab', 'notifications');
    setActiveTab('settings');
  };

  // Sync role with auth user's role only on initial login (not on every render)
  useEffect(() => {
    const savedRole = sessionStorage.getItem('vriddhi_active_role');
    if (!savedRole && user?.role) {
      setUserRole(user.role);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allNavigation = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, roles: ['Founder', 'Accountant', 'Viewer'] },
    { id: 'reports', name: 'Cash Flow Forecast', icon: BarChart3, roles: ['Founder', 'Accountant', 'Viewer'] },
    { id: 'documents', name: 'Documents OCR', icon: FileText, roles: ['Founder'] },
    { id: 'invoices', name: 'GST Invoices', icon: Receipt, roles: ['Founder', 'Accountant', 'Viewer'] },
    { id: 'transactions', name: 'Transactions', icon: Wallet, roles: ['Founder', 'Accountant'] },
    { id: 'receivables', name: 'Receivables/Payables', icon: HandCoins, roles: ['Founder', 'Accountant', 'Viewer'] },
    { id: 'clients', name: 'Clients', icon: Users, roles: ['Founder', 'Accountant'] },
  ];

  const navigation = allNavigation.filter(nav => nav.roles.includes(userRole));

  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [txRes, invRes] = await Promise.all([
          supabase.from('transactions').select('*'),
          supabase.from('invoices').select('*')
        ]);
        if (txRes.data) setTransactions(txRes.data);
        if (invRes.data) setInvoices(invRes.data);
      } catch {}
    };
    fetchData();
  }, [user?.uid]);

  const currentMetrics = useMemo(() => {
    const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
    const revenue = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const expensesRaw = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const expenses = Math.abs(expensesRaw);
    const profit = revenue - expenses;
    const receivables = invoices
      .filter(i => i.status !== 'Paid' && i.status !== 'Draft')
      .reduce((s, i) => s + (i.totalAmount || 0), 0);
    return {
      revenue: fmt(revenue),
      expenses: fmt(expenses),
      profit: fmt(profit),
      receivables: fmt(receivables)
    };
  }, [transactions, invoices]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950 text-[#111827] dark:text-zinc-50 font-sans overflow-hidden transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsMobileSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-900 border-r border-[#E5E7EB] dark:border-zinc-800 transform transition-transform duration-300 ease-in-out md:hidden ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 brand-gradient rounded-lg flex items-center justify-center font-bold text-white shadow-lg">V</div>
            <span className="font-heading font-bold text-lg text-[#111827] dark:text-zinc-50 tracking-tight">Vriddhi.Ai</span>
          </div>
          <button onClick={() => setIsMobileSidebarOpen(false)} className="text-[#6B7280] hover:text-[#111827] dark:hover:text-zinc-100 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-3">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === item.id 
                    ? 'bg-gray-100 dark:bg-zinc-800 text-[#111827] dark:text-zinc-100' 
                    : 'text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${activeTab === item.id ? 'opacity-100 text-[#111827] dark:text-zinc-100' : 'opacity-80 text-[#6B7280] dark:text-zinc-400'}`} />
                {item.name}
              </button>
            ))}
          </nav>
          {userRole === 'Founder' && (
            <div className="mt-10 px-3">
              <h3 className="text-xs font-semibold text-[#6B7280] dark:text-zinc-500 uppercase tracking-wider mb-2">Workspace</h3>
              <button 
                onClick={() => { setActiveTab('settings'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-gray-100 dark:bg-zinc-800 text-[#111827] dark:text-zinc-100'
                    : 'text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <SettingsIcon className={`mr-3 h-5 w-5 flex-shrink-0 ${activeTab === 'settings' ? 'opacity-100 text-[#111827] dark:text-zinc-100' : 'opacity-80 text-[#6B7280] dark:text-zinc-400'}`} />
                Admin Panel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden md:flex md:flex-col w-64 bg-white dark:bg-zinc-900 border-r border-[#E5E7EB] dark:border-zinc-800 transition-colors duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="h-8 w-8 brand-gradient rounded-lg flex items-center justify-center font-bold text-white shadow-lg">V</div>
          <span className="font-heading font-bold text-lg text-[#111827] dark:text-zinc-50 tracking-tight">Vriddhi.Ai</span>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-3">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === item.id 
                    ? 'bg-gray-100 dark:bg-zinc-800 text-[#111827] dark:text-zinc-100' 
                    : 'text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${activeTab === item.id ? 'opacity-100 text-[#111827] dark:text-zinc-100' : 'opacity-80 text-[#6B7280] dark:text-zinc-400'}`} />
                {item.name}
              </button>
            ))}
          </nav>

          {userRole === 'Founder' && (
            <div className="mt-10 px-3">
              <h3 className="text-xs font-semibold text-[#6B7280] dark:text-zinc-500 uppercase tracking-wider mb-2">Workspace</h3>
              <div className="space-y-1">
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-gray-100 dark:bg-zinc-800 text-[#111827] dark:text-zinc-100'
                      : 'text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <SettingsIcon className={`mr-3 h-5 w-5 flex-shrink-0 ${activeTab === 'settings' ? 'opacity-100 text-[#111827] dark:text-zinc-100' : 'opacity-80 text-[#6B7280] dark:text-zinc-400'}`} />
                  Admin Panel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-[#E5E7EB] dark:border-zinc-800 px-8 flex items-center justify-between flex-shrink-0 bg-white dark:bg-zinc-900 transition-colors duration-300">
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100">
              <Menu className="h-6 w-6" />
            </button>
            <span className="ml-3 font-heading font-bold text-lg text-[#111827] dark:text-zinc-50 tracking-tight">Vriddhi</span>
          </div>
          <div className="flex-1 flex justify-center px-2 lg:ml-6 lg:justify-start hidden md:flex">
            <div className="max-w-lg w-full lg:max-w-xs relative">
              <label htmlFor="search" className="sr-only">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-[#6B7280] dark:text-zinc-500" />
                </div>
                <input id="search" className="block w-full pl-10 pr-3 py-2 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl leading-5 bg-gray-50 dark:bg-zinc-800 text-[#111827] dark:text-zinc-100 placeholder-[#6B7280] dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/50 sm:text-sm transition-colors" placeholder="Search invoices, clients..." type="search" />
              </div>
            </div>
          </div>
          <div className="ml-4 flex items-center md:ml-6 space-x-4">
            <div className="relative">
              <button
                type="button"
                onClick={toggleNotifPanel}
                className="p-1.5 text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 transition-colors relative"
                aria-label="Notifications"
                aria-expanded={isNotifOpen}
              >
                {hasUnreadNotifications && (
                  <span className="absolute top-1 right-1.5 h-2 w-2 bg-[#22C55E] rounded-full border-2 border-white dark:border-zinc-900" />
                )}
                <Bell className="h-5 w-5" />
              </button>

              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl shadow-2xl z-50 animate-in fade-in-50 slide-in-from-top-3 duration-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800/60 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-[#111827] dark:text-zinc-100">Notifications</div>
                        <div className="text-[10px] text-[#6B7280] dark:text-zinc-400">Recent activity from the last 24 hours</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchNotifications()}
                        className="text-[10px] font-bold uppercase text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {recentNotifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-[#6B7280] dark:text-zinc-400">
                          No notifications yet
                        </div>
                      ) : (
                        recentNotifications.map((log) => (
                          <div
                            key={log.id}
                            className="px-4 py-3 border-b border-gray-50 dark:border-zinc-800/60 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                log.type === 'delivery' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                log.type === 'reminder' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                log.type === 'escalation' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {log.type}
                              </span>
                              <span className={`text-[10px] font-bold shrink-0 ${log.simulated ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {log.simulated ? 'SIMULATED' : '● LIVE'}
                              </span>
                            </div>
                            <p className="text-xs text-[#111827] dark:text-zinc-200 leading-relaxed line-clamp-2">
                              {log.message}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-[#6B7280] dark:text-zinc-500 truncate">
                                {log.clientName || log.destination || 'System'}
                              </span>
                              <span className="text-[10px] font-mono text-[#6B7280] dark:text-zinc-500 shrink-0">
                                {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {userRole === 'Founder' && (
                      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-zinc-800/60 bg-gray-50/50 dark:bg-zinc-950/50">
                        <button
                          type="button"
                          onClick={openAllNotifications}
                          className="w-full text-xs font-semibold text-[#22C55E] hover:text-[#16a34a] transition-colors text-center"
                        >
                          View all notifications →
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <div 
                onClick={() => { setIsNotifOpen(false); setIsUserMenuOpen(!isUserMenuOpen); }}
                className="flex items-center gap-3 cursor-pointer p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors select-none"
                title="Profile & settings"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-[#111827] dark:text-zinc-200">
                    {user?.name || 'User'}
                  </div>
                  <div className="text-xs font-mono font-bold text-[#22C55E] flex items-center justify-end gap-1">
                    <Key className="h-3 w-3" />
                    {userRole}
                  </div>
                </div>
                <Avatar className="h-9 w-9 border-2 border-zinc-200 dark:border-zinc-700">
                  <AvatarImage src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user?.name?.split(' ')[0]?.toLowerCase() || 'user'}`} alt="User Avatar" />
                  <AvatarFallback>{(user?.name || 'U').charAt(0)}</AvatarFallback>
                </Avatar>
              </div>

              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setIsUserMenuOpen(false); setIsEditingProfile(false); }} />
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-3 py-4 animate-in fade-in-50 slide-in-from-top-3 duration-200 text-left">
                    <div className="flex items-center gap-3 px-3 pb-3 border-b border-gray-100 dark:border-zinc-800/60 mb-3">
                      <Avatar className="h-10 w-10 border-2 border-[#22C55E]/30">
                        <AvatarImage src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user?.name?.split(' ')[0]?.toLowerCase() || 'user'}`} />
                        <AvatarFallback>{(user?.name || 'U').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#111827] dark:text-zinc-100 truncate">{user?.name || 'User'}</div>
                        <div className="text-[10px] text-[#6B7280] dark:text-zinc-400 truncate">{user?.email}</div>
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-bold text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded-full">
                          <Key className="h-2.5 w-2.5" /> {userRole}
                        </span>
                      </div>
                    </div>

                    {!isEditingProfile ? (
                      <div className="space-y-1">
                        <div className="px-3 py-2">
                          <span className="text-[10px] font-extrabold text-[#6B7280] uppercase tracking-widest block mb-1.5">Profile Details</span>
                          <div className="space-y-1.5 text-xs text-[#111827] dark:text-zinc-200">
                            <div className="flex justify-between"><span className="text-[#6B7280]">Name</span><span className="font-medium">{user?.name}</span></div>
                            <div className="flex justify-between"><span className="text-[#6B7280]">Company</span><span className="font-medium truncate ml-2">{user?.companyName}</span></div>
                            <div className="flex justify-between"><span className="text-[#6B7280]">Role</span><span className="font-medium">{userRole}</span></div>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            setEditName(user?.name || '');
                            setEditCompany(user?.companyName || '');
                            setIsEditingProfile(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs text-[#111827] dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#6B7280]" />
                          <span>Edit Profile</span>
                        </button>

                        <div className="border-t border-gray-100 dark:border-zinc-800/60 my-2 pt-2">
                          <button 
                            onClick={() => {
                              logout();
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/5 dark:hover:bg-red-500/10 rounded-xl transition-all font-semibold"
                          >
                            <LogOut className="h-4 w-4" />
                            <span>Sign Out Account</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 space-y-3">
                        <span className="text-[10px] font-extrabold text-[#6B7280] uppercase tracking-widest block">Edit Profile</span>
                        <div>
                          <label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block mb-1">Display Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-[#111827] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#22C55E]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block mb-1">Company Name</label>
                          <input
                            type="text"
                            value={editCompany}
                            onChange={(e) => setEditCompany(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-[#111827] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#22C55E]"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={async () => {
                              await updateProfile({ name: editName, companyName: editCompany });
                              setIsEditingProfile(false);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-[#22C55E] text-black font-bold py-2 rounded-lg text-xs hover:opacity-90 transition-all"
                          >
                            <Check className="h-3.5 w-3.5" /> Save
                          </button>
                          <button
                            onClick={() => setIsEditingProfile(false)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E5E7EB] dark:border-zinc-700 rounded-lg text-xs text-[#6B7280] hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
                          >
                            <XIcon className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 transition-colors duration-300 relative">
          {/* Subtle Dynamic Stock Market Candle Animation Background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.08] saturate-[1.2] z-0 overflow-hidden">
            <div className="w-[110%] h-[110%] -translate-x-[5%] -translate-y-[5%] blur-[0.4px]">
              <CandleStocksChart isBackground={true} />
            </div>
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            {activeTab === 'dashboard' && ['Founder', 'Accountant', 'Viewer'].includes(userRole) && <Dashboard />}
            {activeTab === 'reports' && ['Founder', 'Accountant', 'Viewer'].includes(userRole) && <CashFlow />}
            {activeTab === 'documents' && userRole === 'Founder' && <DocumentsOCR />}
            {activeTab === 'invoices' && ['Founder', 'Accountant', 'Viewer'].includes(userRole) && <Invoices />}
            {activeTab === 'transactions' && ['Founder', 'Accountant'].includes(userRole) && <Transactions />}
            {activeTab === 'receivables' && ['Founder', 'Accountant', 'Viewer'].includes(userRole) && <Receivables />}
            {activeTab === 'clients' && ['Founder', 'Accountant'].includes(userRole) && <Clients />}
            {activeTab === 'settings' && userRole === 'Founder' && <Settings />}
            {!['dashboard', 'reports', 'documents', 'invoices', 'transactions', 'receivables', 'clients', 'settings'].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="h-16 w-16 bg-gray-100 dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 className="h-8 w-8 text-[#6B7280] dark:text-zinc-400" />
                </div>
                <h3 className="text-xl font-medium text-[#111827] dark:text-zinc-100">Under Construction</h3>
                <p className="text-[#6B7280] dark:text-zinc-400 mt-2 max-w-sm">This module is part of Phase 2 MVP development. Configure backend Cloud SQL to complete integration.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <Copilot metrics={currentMetrics} />
    </div>
  );
}
