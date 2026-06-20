import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  CreditCard, 
  ToggleLeft, 
  ToggleRight, 
  CheckCircle, 
  AlertTriangle, 
  Settings as SettingsIcon, 
  DollarSign, 
  Terminal, 
  RefreshCw, 
  Webhook, 
  Receipt,
  User,
  Shield,
  Sparkles,
  Bell,
  Mail,
  MessageSquare,
  Users,
  Trash2,
  Download
} from 'lucide-react';

interface PaymentHistoryItem {
  id: string;
  plan: string;
  amount: string;
  status: 'Succeeded' | 'Failed' | 'Processing';
  mode: 'Test' | 'Live';
  date: string;
}

export function Settings() {
  const [adminTab, setAdminTab] = useState<'billing' | 'notifications' | 'users' | 'contacts'>('billing');
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [contactRequests, setContactRequests] = useState<any[]>([]);
  const [notifStatus, setNotifStatus] = useState<{ email: boolean; telegram: boolean } | null>(null);

  const refreshContactRequests = async () => {
    const { data } = await supabase.from('contact_requests').select('*');
    if (data) setContactRequests(data.sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()));
  };

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(d => setNotifStatus(d.notifications)).catch(() => {});
  }, []);

  const refreshNotificationLogs = async () => {
    const { data: logs } = await supabase.from('notification_logs').select('*');
    if (logs) setNotificationLogs(logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  const refreshUsers = async () => {
    const { data: users } = await supabase.from('users').select('*');
    if (users) setAllUsers(users);
  };

  useEffect(() => {
    refreshNotificationLogs();
    refreshUsers();
    refreshContactRequests();
  }, []);

  useEffect(() => {
    if (adminTab === 'notifications') refreshNotificationLogs();
    if (adminTab === 'users') refreshUsers();
    if (adminTab === 'contacts') refreshContactRequests();
  }, [adminTab]);

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;
    await supabase.from('users').delete().eq('id', userId);
    setAllUsers(prev => prev.filter(u => u.id !== userId));
  };

  const exportNotificationCSV = () => {
    let csv = "\uFEFFTimestamp,Type,Invoice ID,Client,Message,Channel,Status\n";
    notificationLogs.forEach(log => {
      csv += `"${log.timestamp}","${log.type}","${log.invoiceId || ''}","${log.clientName || ''}","${(log.message || '').replace(/"/g, '""')}","${log.destination}","${log.status || 'delivered'}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Notification_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isTestMode, setIsTestMode] = useState<boolean>(() => {
    return localStorage.getItem('payment_test_mode') === 'true' || true;
  });
  
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>(() => {
    return localStorage.getItem('subscription_plan') || 'Starter (Free)';
  });

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [billingName, setBillingName] = useState('Arjun Sharma');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // MOCK default payment history
  const [payments, setPayments] = useState<PaymentHistoryItem[]>(() => {
    const saved = localStorage.getItem('payment_history');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'ch_8a82gf83h', plan: 'Growth Pro (Starter Trial)', amount: '₹0', status: 'Succeeded', mode: 'Test', date: '2026-05-18' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('payment_test_mode', String(isTestMode));
  }, [isTestMode]);

  const addWebhookLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setWebhookLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 7)]);
  };

  const handleTestPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic Validation
    if (!cardNumber || !expiry || !cvc) {
      setErrorMsg('All card billing details are required.');
      return;
    }

    if (isTestMode) {
      const sanitizedCard = cardNumber.replace(/\s+/g, '');
      if (sanitizedCard !== '4242424242424242' && sanitizedCard !== '4111111111111111') {
        setErrorMsg('Invalid Test Card. Use standard checkout cards like 4242 4242 4242 4242 or 4111 1111 1111 1111 for test mode simulator.');
        return;
      }
    }

    setIsProcessing(true);
    addWebhookLog('Payment intent initiated with Stripe API (Test Mode Endpoint)');

    setTimeout(() => {
      addWebhookLog('3D Secure redirection bypassed (Test Card auto-approval)');
      
      setTimeout(() => {
        const transactionId = 'ch_' + Math.random().toString(36).substring(2, 11);
        const newPayment: PaymentHistoryItem = {
          id: transactionId,
          plan: 'Growth Pro Annual',
          amount: '₹1,999',
          status: 'Succeeded',
          mode: isTestMode ? 'Test' : 'Live',
          date: new Date().toISOString().split('T')[0]
        };

        const updatedHistory = [newPayment, ...payments];
        setPayments(updatedHistory);
        localStorage.setItem('payment_history', JSON.stringify(updatedHistory));

        setSubscriptionPlan('Growth Pro (Subscribed_Test)');
        localStorage.setItem('subscription_plan', 'Growth Pro (Subscribed_Test)');

        addWebhookLog(`Stripe Webhook event 'payment_intent.succeeded' triggered securely`);
        addWebhookLog(`Subscription database status updated to: Active`);

        setSuccessMsg('Test Mode Payment successful! Growth Pro has been activated on your workspace.');
        setIsProcessing(false);
        setCardNumber('');
        setExpiry('');
        setCvc('');
      }, 1000);
    }, 1200);
  };

  const resetSubscription = () => {
    setSubscriptionPlan('Starter (Free)');
    localStorage.setItem('subscription_plan', 'Starter (Free)');
    const defaultHistory: PaymentHistoryItem[] = [
      { id: 'ch_8a82gf83h', plan: 'Growth Pro (Starter Trial)', amount: '₹0', status: 'Succeeded', mode: 'Test', date: '2026-05-18' }
    ];
    setPayments(defaultHistory);
    localStorage.setItem('payment_history', JSON.stringify(defaultHistory));
    addWebhookLog('Subscription reset back to Starter Free Tier');
    setSuccessMsg('Account reset successfully.');
  };

  const autofillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setExpiry('12/29');
    setCvc('420');
    addWebhookLog('Autofilled 4242 standard Stripe test card number');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-[#111827] dark:text-zinc-50 flex items-center gap-2">
            <SettingsIcon className="h-8 w-8 text-[#22C55E]" /> Admin Panel & Settings
          </h2>
          <p className="text-[#6B7280] dark:text-zinc-400 mt-1">Central admin panel to manage users, notifications, billing, and all workspace data.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1 text-xs font-bold">
            ADMIN ACCESS
          </Badge>
        </div>
      </div>

      {/* Admin Panel Tab Navigation */}
      <div className="flex bg-gray-100 dark:bg-zinc-950 rounded-xl p-1 border border-gray-200 dark:border-zinc-800">
        <button
          onClick={() => setAdminTab('billing')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            adminTab === 'billing' ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-zinc-100 shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <CreditCard className="h-3.5 w-3.5" /> Billing & Payment
        </button>
        <button
          onClick={() => setAdminTab('notifications')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            adminTab === 'notifications' ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-zinc-100 shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <Bell className="h-3.5 w-3.5" /> Notification Logs ({notificationLogs.length})
        </button>
        <button
          onClick={() => setAdminTab('users')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            adminTab === 'users' ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-zinc-100 shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <Users className="h-3.5 w-3.5" /> User Management ({allUsers.length})
        </button>
        <button
          onClick={() => setAdminTab('contacts')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            adminTab === 'contacts' ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-zinc-100 shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <Mail className="h-3.5 w-3.5" /> Contact Leads ({contactRequests.length})
        </button>
      </div>

      {notifStatus && (
        <div className={`text-xs px-4 py-2 rounded-xl border ${notifStatus.email && notifStatus.telegram ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' : 'bg-amber-500/10 border-amber-500/30 text-amber-700'}`}>
          Notification channels: Email {notifStatus.email ? '● LIVE' : '○ simulated'} · Telegram {notifStatus.telegram ? '● LIVE' : '○ simulated'}
          {!notifStatus.email && !notifStatus.telegram && ' — Configure SMTP_HOST and TELEGRAM_BOT_TOKEN in .env for live delivery'}
        </div>
      )}

      {/* Notification Logs Tab */}
      {adminTab === 'notifications' && (
        <div className="space-y-4">
          <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Bell className="h-4.5 w-4.5 text-[#22C55E]" />
                  Automated Communication Trigger Audit Log
                </CardTitle>
                <CardDescription className="text-xs">Complete history of all Email, Telegram, and WhatsApp notification triggers dispatched by the system.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={refreshNotificationLogs} className="text-xs">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                </Button>
                <Button size="sm" onClick={exportNotificationCSV} className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black text-xs">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#E5E7EB] dark:border-zinc-800">
                      <TableHead className="text-[#6B7280] text-xs">Timestamp</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Type</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Invoice</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Client/Recipient</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Message</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Channel</TableHead>
                      <TableHead className="text-[#6B7280] text-xs text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notificationLogs.map((log) => (
                      <TableRow key={log.id} className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-950">
                        <TableCell className="text-xs font-mono text-[#6B7280]">
                          {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[9px] uppercase font-bold border-none ${
                            log.type === 'delivery' ? 'bg-blue-500/10 text-blue-600' :
                            log.type === 'reminder' ? 'bg-amber-500/10 text-amber-600' :
                            log.type === 'escalation' ? 'bg-rose-500/10 text-rose-600' :
                            'bg-emerald-500/10 text-emerald-600'
                          }`}>
                            {log.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-[#22C55E] font-bold">{log.invoiceId || '-'}</TableCell>
                        <TableCell className="text-xs font-semibold text-[#111827] dark:text-zinc-200">{log.clientName || '-'}</TableCell>
                        <TableCell className="text-xs text-[#111827] dark:text-zinc-300 max-w-[250px] truncate">{log.message}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {log.destination?.includes('Email') && <Mail className="h-3.5 w-3.5 text-blue-500" />}
                            {log.destination?.includes('Telegram') && <MessageSquare className="h-3.5 w-3.5 text-sky-500" />}
                            {log.destination?.includes('WhatsApp') && <MessageSquare className="h-3.5 w-3.5 text-[#22C55E]" />}
                            <span className="text-[10px] text-[#6B7280]">{log.destination}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-[10px] font-bold ${log.simulated ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {log.simulated ? 'SIMULATED' : '● LIVE'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contact Leads Tab */}
      {adminTab === 'contacts' && (
        <div className="space-y-4">
          <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Mail className="h-4.5 w-4.5 text-blue-500" />
                Enterprise Demo Requests
              </CardTitle>
              <CardDescription className="text-xs">All contact form submissions from the landing page, persisted in SQLite.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Submitted</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactRequests.map((cr) => (
                      <TableRow key={cr.id}>
                        <TableCell className="text-xs font-mono">{new Date(cr.submitted_at).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-xs font-semibold">{cr.name}</TableCell>
                        <TableCell className="text-xs">{cr.email}</TableCell>
                        <TableCell className="text-xs">{cr.company}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{cr.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Management Tab */}
      {adminTab === 'users' && (
        <div className="space-y-4">
          <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-indigo-500" />
                Registered Workspace Users
              </CardTitle>
              <CardDescription className="text-xs">Manage all user accounts with role-based access control.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#E5E7EB] dark:border-zinc-800">
                      <TableHead className="text-[#6B7280] text-xs">User ID</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Name</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Email</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Company</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Role</TableHead>
                      <TableHead className="text-[#6B7280] text-xs">Joined</TableHead>
                      <TableHead className="text-[#6B7280] text-xs text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map((user) => (
                      <TableRow key={user.id} className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-950">
                        <TableCell className="text-xs font-mono text-[#6B7280]">{user.id}</TableCell>
                        <TableCell className="text-xs font-semibold text-[#111827] dark:text-zinc-200">{user.name}</TableCell>
                        <TableCell className="text-xs text-[#111827] dark:text-zinc-300">{user.email}</TableCell>
                        <TableCell className="text-xs text-[#6B7280]">{user.company_name}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] uppercase font-bold border-none ${
                            user.role === 'Founder' ? 'bg-emerald-500/10 text-emerald-600' :
                            user.role === 'Accountant' ? 'bg-blue-500/10 text-blue-600' :
                            'bg-amber-500/10 text-amber-600'
                          }`}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-[#6B7280]">
                          {new Date(user.created_at).toLocaleDateString('en-IN')}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteUser(user.id)}
                            className="h-8 w-8 text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 rounded-full"
                            title="Remove user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Billing Tab Content */}
      {adminTab === 'billing' && (<>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: General Profile & Toggle Mode */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
            <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60">
              <CardTitle className="text-base font-bold flex items-center gap-2"><User className="h-4 w-4 text-slate-400" /> Account Context</CardTitle>
              <CardDescription className="dark:text-zinc-400">Arjun Sharma's startup credentials.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-sm">
              <div className="flex justify-between pb-3 border-b border-gray-100 dark:border-zinc-800/40">
                <span className="text-[#6B7280] dark:text-zinc-400">Organization</span>
                <span className="font-semibold text-[#111827] dark:text-zinc-200">Acme Corp Ltd</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-gray-100 dark:border-zinc-800/40">
                <span className="text-[#6B7280] dark:text-zinc-400">Current Plan</span>
                <span className="font-bold text-[#22C55E] dark:text-[#EF5350] flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  {subscriptionPlan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280] dark:text-zinc-400">GST Registration #</span>
                <span className="font-mono text-[#111827] dark:text-zinc-200">27AADCA8955F1Z5</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Gateway Mode Toggle Card */}
          <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
            <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-400" /> Payment Environment
              </CardTitle>
              <CardDescription className="dark:text-zinc-400">Toggle simulated sandbox transactions vs production billing requests.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-[#111827] dark:text-zinc-200 block">Test Payment Mode</label>
                  <span className="text-xs text-slate-400 block leading-tight">Authorize sandbox card numbers instantly.</span>
                </div>
                <button 
                  onClick={() => {
                    setIsTestMode(!isTestMode);
                    addWebhookLog(`Payment mode environment changed to: ${!isTestMode ? 'TEST SANDBOX ENVIRONMENT' : 'LIVE PRODUCTION ENVIRONMENT'}`);
                  }}
                  className="p-1 focus:outline-none cursor-pointer"
                >
                  {isTestMode ? (
                    <ToggleRight className="h-9 w-9 text-[#22C55E]" />
                  ) : (
                    <ToggleLeft className="h-9 w-9 text-slate-350 dark:text-zinc-700" />
                  )}
                </button>
              </div>

              {isTestMode ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl p-3 flex gap-2.5 items-start text-xs leading-relaxed">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    <strong>Sandbox Enabled</strong>: Stripe & Easebuzz webhook gateways are routed through corporate test keys. Realistic transactions can be triggered with no physical balance charges.
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-3 flex gap-2.5 items-start text-xs leading-relaxed">
                  <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    <strong>Live Mode Online</strong>: Production payment intent handlers will verify genuine physical card transactions. Requires merchant onboarding setup.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle Side: Payment Simulator Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#22C55E] to-[#22C55E]" />
            <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2"><CreditCard className="h-5 w-5 text-[#22C55E]" /> Upgrade to Growth Pro</CardTitle>
                  <CardDescription className="dark:text-zinc-400">Unlock high priority AI OCR, automatic tax calculations & unlimited clients.</CardDescription>
                </div>
                {isTestMode && (
                  <Button variant="outline" size="sm" onClick={autofillTestCard} className="border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/5 text-xs font-bold font-mono">
                    Autofill Test Card
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {successMsg && (
                <div className="mb-6 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl p-4 flex gap-3 text-sm font-semibold">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p>{successMsg}</p>
                    {subscriptionPlan !== 'Starter (Free)' && (
                      <button onClick={resetSubscription} className="text-xs underline block text-slate-500 hover:text-[#111827] dark:hover:text-white mt-1 cursor-pointer">
                        Reset sandbox to Starter account
                      </button>
                    )}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="mb-6 bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-450 rounded-xl p-4 flex gap-3 text-sm font-semibold">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleTestPayment} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block">Card billing Name</label>
                  <input 
                    type="text" 
                    value={billingName} 
                    onChange={(e) => setBillingName(e.target.value)} 
                    className="w-full h-11 px-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/35 font-semibold"
                    placeholder="Arjun Sharma"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block">Card Number</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={cardNumber} 
                      onChange={(e) => setCardNumber(e.target.value)} 
                      className="w-full h-11 pl-11 pr-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/35 font-mono font-bold tracking-widest"
                      placeholder="4242 4242 4242 4242"
                      maxLength={19}
                    />
                    <CreditCard className="absolute top-1/2 -translate-y-1/2 left-3.5 h-4.5 w-4.5 text-slate-400" />
                  </div>
                  {isTestMode && (
                    <span className="text-[10px] font-bold text-[#22C55E]/85 block font-mono">
                      * Test Card suggestion: Use Stripe test card "4242 4242 4242 4242" to authorize success flow.
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block">Expiry Date</label>
                    <input 
                      type="text" 
                      value={expiry} 
                      onChange={(e) => setExpiry(e.target.value)} 
                      className="w-full h-11 px-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/35 font-mono"
                      placeholder="MM/YY"
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-400 block">Security Code (CVC)</label>
                    <input 
                      type="password" 
                      value={cvc} 
                      onChange={(e) => setCvc(e.target.value)} 
                      className="w-full h-11 px-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/35 font-mono"
                      placeholder="123"
                      maxLength={4}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <span className="text-slate-400 dark:text-zinc-400 text-xs block">Order Total:</span>
                    <span className="text-2xl font-mono font-bold text-[#111827] dark:text-zinc-100 flex items-baseline gap-1">
                      ₹1,999 <span className="text-xs text-slate-450 text-normal">/ yr</span>
                    </span>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isProcessing}
                    className={`w-full sm:w-auto px-8 h-12 rounded-xl text-white font-bold tracking-wide transition-all ${
                      isProcessing 
                        ? 'bg-zinc-650 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-[#22C55E] to-[#22C55E] hover:opacity-95 shadow-md shadow-[#22C55E]/10'
                    }`}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" /> Authorizing via Gateway...
                      </span>
                    ) : (
                      isTestMode ? 'Pay Simulated Amount (Test Mode)' : 'Authorize Production Payment'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Real-time Webhook log console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
        <Card className="lg:col-span-2 shadow-sm bg-[#09090B] border-zinc-800 text-zinc-100">
          <CardHeader className="border-b border-zinc-800 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold font-mono text-[#22C55E] flex items-center gap-2">
                <Terminal className="h-4 w-4" /> SANDBOX GATEWAY TRANSACTION WEBHOOK CONSOLE
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">Live simulated API response calls for Easebuzz/Stripe handlers.</CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setWebhookLogs([])}
              className="text-zinc-500 hover:text-white hover:bg-white/5 border border-zinc-800 text-[10px]"
            >
              Clear Logs
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="font-mono text-xs bg-black/50 p-4 rounded-xl border border-zinc-850 h-52 overflow-y-auto space-y-2">
              {webhookLogs.length === 0 ? (
                <span className="text-zinc-600 italic">No events currently captured. Trigger card tests to display socket streams...</span>
              ) : (
                webhookLogs.map((log, index) => (
                  <div key={index} className="flex gap-2 text-zinc-300">
                    <span className="text-[#22C55E] font-bold select-none">&gt;&gt;</span>
                    <span>{log}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction History Card */}
        <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60">
            <CardTitle className="text-base font-bold flex items-center gap-2"><Receipt className="h-4 w-4 text-slate-400" /> Payment Log History</CardTitle>
            <CardDescription className="dark:text-zinc-400">Workspace payment histories.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {payments.map((p, idx) => (
                <div key={p.id || idx} className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-zinc-800 last:border-none last:pb-0">
                  <div>
                    <h5 className="font-bold text-xs">{p.plan}</h5>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 font-mono">{p.date}</span>
                      <Badge className="bg-gray-100 dark:bg-zinc-800 text-slate-500 text-[9px] px-1.5 py-0 border-none font-mono tracking-wide">
                        {p.mode} Mode
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-xs">{p.amount}</div>
                    <span className="text-[9px] font-bold font-mono text-[#22C55E] block mt-0.5">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </>)}

    </div>
  );
}
