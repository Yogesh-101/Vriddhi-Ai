import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import {
  ArrowDownLeft, ArrowUpRight, Calendar, CheckCircle, Clock, AlertTriangle,
  Search, Filter, Download, IndianRupee, Users, TrendingUp, Eye
} from 'lucide-react';
import { CustomSelect } from './ui/Select';

export function Receivables() {
  const { userRole } = useRole();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'receivables' | 'payables'>('receivables');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partially_paid' | 'paid' | 'overdue'>('all');

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [txRes, invRes, clRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('invoices').select('*').order('date', { ascending: false }),
        supabase.from('clients').select('*'),
      ]);
      if (txRes.data) setTransactions(txRes.data);
      if (invRes.data) setInvoices(invRes.data);
      if (clRes.data) setClients(clRes.data);
    }
    load();
  }, [user?.uid]);

  const receivableItems = useMemo(() => {
    const items: any[] = [];

    invoices
      .filter(inv => inv.status !== 'Paid' && inv.status !== 'Draft')
      .forEach(inv => {
        const client = clients.find(c => c.id === inv.clientId);
        const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date();
        items.push({
          id: inv.id,
          type: 'invoice',
          clientName: client?.name || 'Unknown Client',
          clientGstin: client?.gstin || '',
          description: `Invoice ${inv.id}`,
          amount: inv.totalAmount || 0,
          date: inv.date,
          dueDate: inv.dueDate || '',
          status: isOverdue ? 'overdue' : inv.status === 'Partially Paid' ? 'partially_paid' : 'pending',
          source: 'Invoice',
        });
      });

    transactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .forEach(t => {
        const client = clients.find(c => c.id === t.entityId);
        const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
        items.push({
          id: t.id,
          type: 'transaction',
          clientName: client?.name || 'Unlinked',
          clientGstin: client?.gstin || '',
          description: t.description,
          amount: Math.abs(t.amount),
          date: t.date,
          dueDate: t.dueDate || '',
          status: isOverdue ? 'overdue' : 'pending',
          source: 'Ledger Entry',
        });
      });

    return items;
  }, [invoices, transactions, clients]);

  const payableItems = useMemo(() => {
    const items: any[] = [];

    transactions
      .filter(t => t.type === 'expense' && t.status === 'pending')
      .forEach(t => {
        const vendor = clients.find(c => c.id === t.entityId);
        const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
        items.push({
          id: t.id,
          type: 'transaction',
          vendorName: vendor?.name || 'Unlinked Vendor',
          vendorGstin: vendor?.gstin || '',
          description: t.description,
          amount: Math.abs(t.amount),
          date: t.date,
          dueDate: t.dueDate || '',
          status: isOverdue ? 'overdue' : 'pending',
          source: 'Ledger Entry',
        });
      });

    return items;
  }, [transactions, clients]);

  const currentItems = activeView === 'receivables' ? receivableItems : payableItems;

  const filteredItems = useMemo(() => {
    return currentItems.filter(item => {
      const matchesSearch =
        (item.clientName || item.vendorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [currentItems, searchQuery, statusFilter]);

  const totalOutstanding = filteredItems.reduce((sum, i) => sum + i.amount, 0);
  const overdueTotal = filteredItems.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);
  const pendingCount = filteredItems.filter(i => i.status === 'pending').length;
  const overdueCount = filteredItems.filter(i => i.status === 'overdue').length;

  const markAsPaid = async (item: any) => {
    if (userRole === 'Viewer') return;
    if (item.type === 'invoice') {
      await supabase.from('invoices').update({ status: 'Paid' }).eq('id', item.id);
      setInvoices(prev => prev.map(inv => inv.id === item.id ? { ...inv, status: 'Paid' } : inv));
    } else {
      await supabase.from('transactions').update({ status: 'paid' }).eq('id', item.id);
      setTransactions(prev => prev.map(t => t.id === item.id ? { ...t, status: 'paid' } : t));
    }
  };

  const exportCSV = () => {
    const header = activeView === 'receivables'
      ? 'ID,Client,Description,Amount,Date,Due Date,Status,Source'
      : 'ID,Vendor,Description,Amount,Date,Due Date,Status,Source';
    const rows = filteredItems.map(item => {
      const name = activeView === 'receivables' ? item.clientName : item.vendorName;
      return `${item.id},"${name}","${item.description}",${item.amount},${item.date},${item.dueDate},${item.status},${item.source}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeView}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[10px] uppercase font-bold">Paid</Badge>;
      case 'pending': return <Badge className="bg-amber-500/10 text-amber-600 border-none text-[10px] uppercase font-bold">Pending</Badge>;
      case 'partially_paid': return <Badge className="bg-blue-500/10 text-blue-600 border-none text-[10px] uppercase font-bold">Partially Paid</Badge>;
      case 'overdue': return <Badge className="bg-rose-500/10 text-rose-600 border-none text-[10px] uppercase font-bold">Overdue</Badge>;
      default: return <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-none text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-[#111827] dark:text-zinc-50 flex items-center gap-2">
            <IndianRupee className="h-8 w-8 text-[#22C55E]" />
            {activeView === 'receivables' ? 'Receivables Tracker' : 'Payables Tracker'}
          </h2>
          <p className="text-[#6B7280] dark:text-zinc-400 mt-1">
            {activeView === 'receivables'
              ? 'Outstanding amounts owed by clients with due dates and settlement status.'
              : 'Outstanding amounts owed to vendors with payment schedules.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={exportCSV} className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Toggle Receivables / Payables */}
      <div className="flex bg-gray-100 dark:bg-zinc-950 rounded-xl p-1 border border-gray-200 dark:border-zinc-800">
        <button
          onClick={() => { setActiveView('receivables'); setStatusFilter('all'); }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeView === 'receivables' ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-zinc-100 shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <ArrowDownLeft className="h-4 w-4 text-emerald-500" /> Receivables (Owed to You)
        </button>
        <button
          onClick={() => { setActiveView('payables'); setStatusFilter('all'); }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeView === 'payables' ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-zinc-100 shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <ArrowUpRight className="h-4 w-4 text-rose-500" /> Payables (You Owe)
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Total Outstanding</p>
            <p className="text-xl font-mono font-bold text-[#111827] dark:text-zinc-100 mt-1">₹{totalOutstanding.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Overdue Amount</p>
            <p className="text-xl font-mono font-bold text-rose-500 mt-1">₹{overdueTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Pending Items</p>
            <p className="text-xl font-mono font-bold text-amber-500 mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Overdue Items</p>
            <p className="text-xl font-mono font-bold text-rose-500 mt-1">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeView === 'receivables' ? 'Search clients...' : 'Search vendors...'}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-gray-50 dark:bg-zinc-950 border border-[#E5E7EB] dark:border-zinc-800 text-sm text-[#111827] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30"
              />
            </div>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as typeof statusFilter)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'partially_paid', label: 'Partially Paid' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'paid', label: 'Paid' }
              ]}
              className=""
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 shadow-sm">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            {activeView === 'receivables' ? (
              <><ArrowDownLeft className="h-4.5 w-4.5 text-emerald-500" /> Client Receivables ({filteredItems.length})</>
            ) : (
              <><ArrowUpRight className="h-4.5 w-4.5 text-rose-500" /> Vendor Payables ({filteredItems.length})</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5E7EB] dark:border-zinc-800">
                  <TableHead className="text-[#6B7280] text-xs">{activeView === 'receivables' ? 'Client' : 'Vendor'}</TableHead>
                  <TableHead className="text-[#6B7280] text-xs">Description</TableHead>
                  <TableHead className="text-[#6B7280] text-xs">Date</TableHead>
                  <TableHead className="text-[#6B7280] text-xs">Due Date</TableHead>
                  <TableHead className="text-[#6B7280] text-xs">Status</TableHead>
                  <TableHead className="text-[#6B7280] text-xs text-right">Amount (₹)</TableHead>
                  <TableHead className="text-[#6B7280] text-xs">Source</TableHead>
                  {userRole !== 'Viewer' && <TableHead className="text-[#6B7280] text-xs text-center">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-[#6B7280]">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                        <p className="font-semibold">All clear! No outstanding {activeView}.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-950">
                      <TableCell>
                        <div className="text-xs">
                          <div className="font-semibold text-[#111827] dark:text-zinc-200">{item.clientName || item.vendorName}</div>
                          {(item.clientGstin || item.vendorGstin) && (
                            <div className="text-[10px] font-mono text-[#6B7280]">{item.clientGstin || item.vendorGstin}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-[#111827] dark:text-zinc-200 max-w-[200px] truncate">{item.description}</TableCell>
                      <TableCell className="text-xs font-mono text-[#6B7280]">{item.date}</TableCell>
                      <TableCell>
                        {item.dueDate ? (
                          <span className={`text-xs font-mono flex items-center gap-1 ${item.status === 'overdue' ? 'text-rose-500 font-bold' : 'text-[#6B7280]'}`}>
                            <Calendar className="h-3 w-3" />
                            {item.dueDate}
                          </span>
                        ) : (
                          <span className="text-xs text-[#6B7280] italic">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className={`text-right font-mono font-bold text-sm ${activeView === 'receivables' ? 'text-emerald-600' : 'text-rose-500'}`}>
                        ₹{item.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gray-100 dark:bg-zinc-800 text-[#6B7280] border-none text-[9px] font-mono">{item.source}</Badge>
                      </TableCell>
                      {userRole !== 'Viewer' && (
                        <TableCell className="text-center">
                          {item.status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markAsPaid(item)}
                              className="text-[10px] h-7 px-2 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
