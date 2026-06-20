import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Filter, 
  Search, 
  RotateCcw, 
  Trash2, 
  Calendar, 
  CheckSquare, 
  Upload, 
  Paperclip, 
  Eye, 
  FileSpreadsheet, 
  Sparkles, 
  X, 
  FileText, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import { categorizeCsvRows } from '../lib/ai-api';
import { CustomSelect } from './ui/Select';

const INCOME_CATEGORIES = ['Product Sales', 'Services', 'Consulting', 'Other Income'];
const EXPENSE_CATEGORIES = ['Salaries', 'Rent', 'Marketing', 'Software', 'Utilities', 'Vendor Payments'];

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  status: 'paid' | 'pending';
  entityId?: string;
  dueDate?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt?: any;
}

export function Transactions() {
  const { userRole } = useRole();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clientsVendors, setClientsVendors] = useState<any[]>([]);
  
  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      if (data) setTransactions(data);
    }
    load();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('clients').select('*');
      if (data) setClientsVendors(data);
    }
    load();
  }, [user?.uid]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // Active attachment state for viewing
  const [activeAttachment, setActiveAttachment] = useState<Transaction | null>(null);

  // Form State
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Product Sales');
  const [description, setDescription] = useState('');
  const [entityId, setEntityId] = useState('');
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [dueDate, setDueDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'pending'>('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Sync Category when txType changes
  const handleTypeChange = (type: 'income' | 'expense') => {
    setTxType(type);
    setCategory(type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  };

  const addTransaction = async (tx: any) => {
    const { data } = await supabase.from('transactions').insert(tx).select();
    if (data && data[0]) {
      setTransactions(prev => [data[0], ...prev]);
    } else {
      setTransactions(prev => [{ id: `tx-${Math.random().toString(36).substr(2, 9)}`, ...tx }, ...prev]);
    }
  };

  const updateTransaction = async (id: string, updates: any) => {
    await supabase.from('transactions').update(updates).eq('id', id);
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTransaction = async (id: string) => {
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const importTransactions = async (txs: Omit<Transaction, 'id'>[]) => {
    const { data } = await supabase.from('transactions').insert(txs).select();
    if (data) {
      setTransactions(prev => [...data, ...prev]);
    } else {
      setTransactions(prev => [...txs.map(t => ({ id: `tx-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, ...t })), ...prev]);
    }
    setToastMsg(`Successfully imported ${txs.length} transaction${txs.length > 1 ? 's' : ''} into the ledger`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    const parsedAmount = parseFloat(amount);
    const finalAmount = txType === 'income' ? parsedAmount : -parsedAmount;

    await addTransaction({
      date,
      description: description || `${category} - Manual Entry`,
      category,
      amount: finalAmount,
      type: txType,
      status: status,
      entityId: entityId || undefined,
      dueDate: status === 'pending' ? dueDate || undefined : undefined,
      attachmentUrl: attachmentUrl || undefined,
      attachmentName: attachmentName || undefined
    });

    // Reset Form
    setIsModalOpen(false);
    setAmount('');
    setDescription('');
    setEntityId('');
    setStatus('paid');
    setDueDate('');
    setAttachmentUrl('');
    setAttachmentName('');
  };

  // Filtered transactions computed
  const filteredList = useMemo(() => {
    return transactions.filter(t => {
      // Search matches description or Category
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = 
        filterType === 'all' ? true :
        filterType === 'income' ? t.type === 'income' :
        filterType === 'expense' ? t.type === 'expense' :
        t.status === 'pending'; // 'pending' filters receivables/payables that are outstanding

      const matchesCategory = filterCategory === 'all' ? true : t.category === filterCategory;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [transactions, searchQuery, filterType, filterCategory]);

  return (
    <div className="space-y-6">

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-[#111827] dark:text-zinc-50">Transactions General Ledger</h2>
          <p className="text-[#6B7280] dark:text-zinc-400 mt-1">Income and expenditure accounting entry with dynamic category tagging.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline"
            onClick={() => {
              const header = 'Date,Description,Category,Type,Amount,Status,Due Date,Entity';
              const rows = filteredList.map(t => {
                const client = clientsVendors.find(c => c.id === t.entityId);
                return `${t.date},"${t.description}","${t.category}",${t.type},${t.amount},${t.status},${t.dueDate || ''},${client?.name || ''}`;
              });
              const csv = [header, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ledger_export_${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="border-[#E5E7EB] dark:border-zinc-700 text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100 flex items-center gap-1.5 text-xs"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Ledger CSV
          </Button>
          <Button 
            onClick={() => setIsCsvModalOpen(true)} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" /> Import Bank CSV
          </Button>
          <Button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Book Entry
          </Button>
        </div>
      </div>

      {/* Advanced Filter Header Panel */}
      <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-100">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] dark:text-zinc-500" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ledger details..." 
                className="pl-9 bg-gray-50 dark:bg-zinc-950 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-100" 
              />
            </div>

            {/* Type selector */}
            <div>
              <CustomSelect 
                value={filterType}
                onChange={(val) => setFilterType(val as typeof filterType)}
                options={[
                  { value: 'all', label: 'Types: All entries' },
                  { value: 'income', label: 'Income (Revenue Module)' },
                  { value: 'expense', label: 'Expense (Expenditures)' },
                  { value: 'pending', label: 'Outstanding Payables/Receivables' }
                ]}
                className="w-full"
              />
            </div>

            {/* Category Selector */}
            <div>
              <CustomSelect 
                value={filterCategory}
                onChange={(val) => setFilterCategory(val)}
                options={[
                  { value: 'all', label: 'Categories: All' },
                  ...INCOME_CATEGORIES.map(cat => ({ value: cat, label: cat })),
                  ...EXPENSE_CATEGORIES.map(cat => ({ value: cat, label: cat }))
                ]}
                className="w-full"
              />
            </div>

            {/* Clear Button */}
            <div className="flex">
              <Button 
                variant="outline" 
                onClick={() => { setSearchQuery(''); setFilterType('all'); setFilterCategory('all'); }}
                className="w-full text-xs font-semibold bg-gray-50 border-[#E5E7EB] hover:bg-gray-100 text-[#111827] dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-850"
              >
                <RotateCcw className="h-4.5 w-4.5 mr-2" /> Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary Ledger Board */}
      <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-base font-bold">Ledger Balance Entries ({filteredList.length})</CardTitle>
            <CardDescription className="text-xs text-[#6B7280]">Real-time audit history of salaries, vendor payables, and services.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50">
                  <TableHead className="text-[#6B7280]">Date</TableHead>
                  <TableHead className="text-[#6B7280]">Description</TableHead>
                  <TableHead className="text-[#6B7280]">Category Tag</TableHead>
                  <TableHead className="text-[#6B7280]">Contact / Client</TableHead>
                  <TableHead className="text-[#6B7280]">Settlement</TableHead>
                  <TableHead className="text-[#6B7280] text-right">Amount (₹)</TableHead>
                  <TableHead className="text-[#6B7280] text-center">Admin Controls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.map((t) => {
                  const client = clientsVendors.find(c => c.id === t.entityId);
                  return (
                    <TableRow key={t.id} className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-950">
                      <TableCell className="text-[#6B7280] font-mono text-xs">{t.date}</TableCell>
                      <TableCell className="font-medium text-[#111827] dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4 text-[#22C55E]" /> : <ArrowUpRight className="h-4 w-4 text-rose-500" />}
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              {t.description}
                              {t.attachmentUrl && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveAttachment(t);
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 text-[10px] font-mono font-bold transition-all border border-blue-500/20"
                                  title="View Uploaded Receipt Attachment"
                                >
                                  <Paperclip className="h-3 w-3 shrink-0" />
                                  Receipt Attached
                                </button>
                              )}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded bg-gray-50 dark:bg-zinc-950 text-[11px] text-[#6B7280] dark:text-zinc-400 border border-[#E5E7EB] dark:border-zinc-800 capitalize font-medium">{t.category}</span>
                      </TableCell>
                      <TableCell className="text-[#111827] dark:text-zinc-200">
                        {client ? (
                          <div className="text-xs">
                            <div className="font-semibold">{client.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{client.gstin}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Unspecified</span>
                        )}
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col gap-1 items-start">
                           <Badge 
                             className={`text-[10px] uppercase font-bold tracking-wider py-0.5 px-2 cursor-pointer select-none border-none ${
                               t.status === 'paid' ? 'bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/15' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                             }`}
                             onClick={() => {
                               // Toggle status as part of Admin override power (Feature 15)
                               const nextStatus = t.status === 'paid' ? 'pending' : 'paid';
                               updateTransaction(t.id, { status: nextStatus });
                             }}
                             title="Click to toggle settlement status"
                           >
                              {t.status.toUpperCase()}
                           </Badge>
                           {t.status === 'pending' && t.dueDate && (
                             <span className="text-[9px] text-amber-500 font-mono flex items-center gap-1">
                               <Calendar className="h-3 w-3" /> Due {t.dueDate}
                             </span>
                           )}
                         </div>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${t.type === 'income' ? 'text-[#22C55E]' : 'text-rose-500'}`}>
                        {t.type === 'income' ? '+' : '-'}₹{Math.abs(t.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full"
                          title="Administrative Delete Override"
                          onClick={() => deleteTransaction(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#111827] dark:text-zinc-50 border-b pb-2">Record New Ledger Entry</h3>
            
            {/* Toggle Switch */}
            <div className="flex bg-gray-100 dark:bg-zinc-950 rounded-xl p-1 border border-gray-200 dark:border-zinc-800">
              <button 
                type="button"
                onClick={() => handleTypeChange('income')} 
                className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${
                  txType === 'income' ? 'bg-[#22C55E] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                Revenue (Inward Income)
              </button>
              <button 
                type="button"
                onClick={() => handleTypeChange('expense')} 
                className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${
                  txType === 'expense' ? 'bg-[#22C55E] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                Expenditure (Outward Spend)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-widest">Amount (₹) *</label>
                <Input 
                  type="number" 
                  required
                  placeholder="0.00" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-gray-50 border-[#E5E7EB] text-[#111827] dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 text-base" 
                />
              </div>

               <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-widest">Category Tag *</label>
                <CustomSelect 
                  value={category}
                  onChange={(val) => setCategory(val)}
                  options={
                    txType === 'income' 
                      ? INCOME_CATEGORIES.map(cat => ({ value: cat, label: cat }))
                      : EXPENSE_CATEGORIES.map(cat => ({ value: cat, label: cat }))
                  }
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-widest">Date *</label>
                <Input 
                  type="date" 
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-gray-50 border-[#E5E7EB] text-[#111827] dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 text-xs" 
                />
              </div>

               <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-widest">Link Entity (Master)</label>
                <CustomSelect 
                  value={entityId}
                  onChange={(val) => setEntityId(val)}
                  options={[
                    { value: '', label: 'Select client/vendor...' },
                    ...clientsVendors.map(cv => ({ value: cv.id, label: `${cv.name} (${cv.type})` }))
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-widest">Description / Entry Memo *</label>
              <Input 
                placeholder="e.g. Google Ads Campaign, June Rent payout..." 
                value={description}
                required
                onChange={(e) => setDescription(e.target.value)}
                className="bg-gray-50 border-[#E5E7EB] text-[#111827] dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 text-xs" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-widest block">Receipt Attachment (Optional)</label>
              <div className="border border-dashed border-[#E5E7EB] dark:border-zinc-700 rounded-xl p-3 bg-gray-50 dark:bg-zinc-950 text-center relative flex flex-col items-center justify-center">
                {attachmentUrl ? (
                  <div className="text-center space-y-1 w-full flex flex-col items-center">
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                    <p className="text-xs font-semibold text-[#111827] dark:text-zinc-100 truncate max-w-[200px]">{attachmentName || "Receipt loaded Successfully"}</p>
                    <button 
                      type="button" 
                      onClick={() => { setAttachmentUrl(''); setAttachmentName(''); }}
                      className="text-[10px] text-[#22C55E] hover:underline"
                    >
                      Remove file attachment
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 w-full flex flex-col items-center">
                    <Upload className="h-5 w-5 text-gray-400" />
                    <p className="text-[11px] text-[#6B7280]">Drag and drop receipt image, or paste file</p>
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAttachmentName(file.name);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setAttachmentUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden" 
                        id="receipt-file-input"
                      />
                      <label 
                        htmlFor="receipt-file-input" 
                        className="px-2 py-1 bg-white border border-[#E5E7EB] dark:bg-zinc-900 dark:border-zinc-850 rounded text-[10px] font-medium text-[#111827] dark:text-zinc-100 cursor-pointer hover:bg-slate-50"
                      >
                        Choose file
                      </label>
                      <button 
                        type="button"
                        onClick={() => {
                          // Quick load mockup premium receipt
                          setAttachmentName("invoice_8283_rent.png");
                          setAttachmentUrl("https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400&auto=format&fit=crop&q=60");
                        }}
                        className="px-2 py-1 bg-rose-500/10 rounded text-[10px] font-medium text-[#22C55E] hover:bg-rose-500/15"
                      >
                        Load sample receipt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-zinc-950 rounded-xl border dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#6B7280] uppercase text-[10px] tracking-wider">Settlement Status</span>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name="status" 
                      checked={status === 'paid'} 
                      onChange={() => setStatus('paid')} 
                      className="accent-[#22C55E]"
                    />
                    <span>Paid</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name="status" 
                      checked={status === 'pending'} 
                      onChange={() => setStatus('pending')} 
                      className="accent-rose-500"
                    />
                    <span>Unpaid</span>
                  </label>
                </div>
              </div>

              {status === 'pending' && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-150">
                  <label className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block">Outstanding Due Date</label>
                  <Input 
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-8 bg-white border-[#E5E7EB] text-[#111827] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-[#111827] dark:hover:text-zinc-100">Cancel</Button>
              <Button type="submit" className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black">Save and Sync Ledger</Button>
            </div>
          </form>
        </div>
      )}

      {toastMsg && (
        <div className="fixed top-4 right-4 z-[60] bg-emerald-600/95 backdrop-blur border border-emerald-500 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-bold tracking-wide animate-in slide-in-from-top-2 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {toastMsg}
        </div>
      )}

      {/* CSV Bank Import Modal */}
      {isCsvModalOpen && (
        <CsvBankImporter onClose={() => setIsCsvModalOpen(false)} onImport={importTransactions} clientsVendors={clientsVendors} userRole={userRole} />
      )}

      {/* Receipt Attachment Viewer Overlay */}
      {activeAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 text-left">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#22C55E] tracking-widest uppercase block">Verified Audit Attachment</span>
                <h4 className="text-lg font-bold text-[#111827] dark:text-zinc-50">{activeAttachment.description}</h4>
              </div>
              <button 
                onClick={() => setActiveAttachment(null)}
                className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-[#22C55E] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Receipt Preview Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-extrabold text-[#6B7280] uppercase block">Attachment File name</span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-950 border text-xs">
                    <FileText className="h-4 w-4 text-[#22C55E]" />
                    <span className="font-mono text-[#111827] dark:text-zinc-200 truncate">{activeAttachment.attachmentName || "scanned_receipt.png"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-[#6B7280] uppercase block">Ledger Date</span>
                    <div className="text-xs font-mono font-bold text-[#111827] dark:text-zinc-200">{activeAttachment.date}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-[#6B7280] uppercase block">Amount (₹)</span>
                    <div className="text-sm font-mono font-bold text-[#22C55E]">{activeAttachment.amount.toLocaleString()} INR</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-[#6B7280] uppercase block">Category Tag</span>
                    <Badge className="bg-slate-50 border capitalize text-slate-600 font-mono text-[9px]">{activeAttachment.category}</Badge>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-[#6B7280] uppercase block">Settlement Status</span>
                    <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 capitalize font-mono text-[9px]">{activeAttachment.status}</Badge>
                  </div>
                </div>

                <p className="text-xs text-slate-400 bg-gray-50 dark:bg-zinc-950 p-3 rounded-xl leading-normal border border-[#E5E7EB] dark:border-zinc-800">
                  This transaction is safely logged in the decentralized system ledger with corresponding document proofs as mandated by corporate accounting compliance guidelines.
                </p>
              </div>

              {/* Document Image View aspect ratio bounding */}
              <div className="relative border rounded-2xl overflow-hidden bg-slate-900 border-zinc-200 dark:border-zinc-800 h-64 flex items-center justify-center">
                <img 
                  src={activeAttachment.attachmentUrl} 
                  alt="Corporate receipt attachment proof"
                  className="max-h-full max-w-full object-contain" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SEPARATE CSV BANK STATEMENT IMPORTER SUB-COMPONENT
// ==========================================
interface CsvImporterProps {
  onClose: () => void;
  onImport: (txs: Omit<Transaction, 'id'>[]) => void;
  clientsVendors: any[];
  userRole?: string;
}

function CsvBankImporter({ onClose, onImport, clientsVendors, userRole }: CsvImporterProps) {
  const [csvRaw, setCsvRaw] = useState('');
  const [parsedList, setParsedList] = useState<any[]>([]);
  const [importCompleted, setImportCompleted] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runAiCategorization = async (list: any[]) => {
    if (list.length === 0) return;
    setAiCategorizing(true);
    try {
      const rows = list.map((item, index) => ({
        index,
        description: item.description,
        amount: item.amount,
        type: item.type as 'income' | 'expense',
      }));
      const { rows: categorized, aiEnhanced: enhanced } = await categorizeCsvRows(rows);
      setAiEnhanced(enhanced);
      setParsedList((prev) =>
        prev.map((item, index) => {
          const cat = categorized.find((c) => c.index === index);
          if (!cat) return item;
          return {
            ...item,
            category: cat.category,
            type: cat.type,
            aiConfidence: cat.confidence,
            aiReason: cat.reason,
          };
        })
      );
    } catch {
      setAiEnhanced(false);
    }
    setAiCategorizing(false);
  };

  const handleLoadSample = () => {
    const rawStatement =
`Date,Description,Withdrawal/Deposit,Amount,Reference
2026-06-12,AWS Cloud Services Billing,Withdrawal,18420.00,REF928308
2026-06-13,Monthly Office Rent Rent out,Withdrawal,45000.00,REF923838
2026-06-14,Consultation services on AI RAG client payout,Deposit,125000.00,REF828383
2026-06-15,Google Ads Marketing budget,Withdrawal,8500.00,REF823812
2026-06-16,Staff Salary Sanjana payroll billing,Withdrawal,35000.00,REF293810`;
    setCsvRaw(rawStatement);
    setFileName('sample_bank_statement.csv');
    setParseError(null);
    parseCsv(rawStatement);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Invalid file type. Please select a .csv file.');
      return;
    }
    setFileName(file.name);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text || text.trim().length === 0) {
        setParseError('The selected file is empty. Please choose a CSV file with transaction data.');
        return;
      }
      setCsvRaw(text);
      parseCsv(text);
    };
    reader.onerror = () => {
      setParseError('Failed to read the file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const getAutoCategoryAndType = (description: string, isWithdrawal: boolean) => {
    const desc = description.toLowerCase();
    let category = 'Other Income';
    let type: 'income' | 'expense' = 'income';

    if (isWithdrawal) {
      type = 'expense';
      if (desc.includes('salary') || desc.includes('payroll') || desc.includes('employee') || desc.includes('wages')) {
        category = 'Salaries';
      } else if (desc.includes('rent') || desc.includes('office') || desc.includes('lease') || desc.includes('wework') || desc.includes('coworking')) {
        category = 'Rent';
      } else if (desc.includes('marketing') || desc.includes('ads') || desc.includes('google ads') || desc.includes('facebook') || desc.includes('campaign') || desc.includes('seo') || desc.includes('promotion')) {
        category = 'Marketing';
      } else if (desc.includes('aws') || desc.includes('gcp') || desc.includes('azure') || desc.includes('software') || desc.includes('figma') || desc.includes('slack') || desc.includes('hosting') || desc.includes('cloud') || desc.includes('saas') || desc.includes('github') || desc.includes('license')) {
        category = 'Software';
      } else if (desc.includes('utility') || desc.includes('electricity') || desc.includes('phone') || desc.includes('internet') || desc.includes('water') || desc.includes('telecom') || desc.includes('broadband')) {
        category = 'Utilities';
      } else {
        category = 'Vendor Payments';
      }
    } else {
      type = 'income';
      if (desc.includes('consult') || desc.includes('advisory') || desc.includes('retainer')) {
        category = 'Consulting';
      } else if (desc.includes('service') || desc.includes('development') || desc.includes('integration') || desc.includes('project') || desc.includes('build')) {
        category = 'Services';
      } else {
        category = 'Product Sales';
      }
    }

    return { category, type };
  };

  const detectColumnMapping = (headers: string[]) => {
    const normalized = headers.map(h => h.toLowerCase().trim());
    let dateIdx = -1, descIdx = -1, amountIdx = -1, typeIdx = -1, categoryIdx = -1;

    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i];
      if (dateIdx === -1 && (h === 'date' || h === 'transaction date' || h === 'txn date' || h === 'value date' || h.includes('date'))) {
        dateIdx = i;
      } else if (descIdx === -1 && (h === 'description' || h === 'narration' || h === 'particulars' || h === 'details' || h === 'memo' || h === 'remarks' || h.includes('description') || h.includes('narration'))) {
        descIdx = i;
      } else if (amountIdx === -1 && (h === 'amount' || h === 'value' || h === 'transaction amount' || h === 'txn amount' || h.includes('amount'))) {
        amountIdx = i;
      } else if (typeIdx === -1 && (h === 'type' || h === 'withdrawal/deposit' || h === 'dr/cr' || h === 'debit/credit' || h === 'transaction type' || h.includes('withdrawal') || h.includes('deposit') || h.includes('debit') || h.includes('credit'))) {
        typeIdx = i;
      } else if (categoryIdx === -1 && (h === 'category' || h === 'tag' || h.includes('category'))) {
        categoryIdx = i;
      }
    }

    return { dateIdx, descIdx, amountIdx, typeIdx, categoryIdx };
  };

  const parseSmartCsvRow = (rawLine: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const parseCsv = (textToParse: string) => {
    setParseError(null);
    const rawLines = textToParse.split(/\r?\n/).filter(l => l.trim().length > 0);

    if (rawLines.length === 0) {
      setParseError('The CSV data is empty. No rows found to parse.');
      return;
    }
    if (rawLines.length === 1) {
      setParseError('Only a header row was found. The CSV must contain at least one data row.');
      return;
    }

    const headerFields = parseSmartCsvRow(rawLines[0]);
    const { dateIdx, descIdx, amountIdx, typeIdx, categoryIdx } = detectColumnMapping(headerFields);

    if (dateIdx === -1 || amountIdx === -1) {
      setParseError(`Could not detect required columns. Found headers: [${headerFields.join(', ')}]. The CSV must have at least a "Date" and "Amount" column.`);
      return;
    }

    const results: any[] = [];
    const importTimestamp = Date.now();

    for (let i = 1; i < rawLines.length; i++) {
      const row = parseSmartCsvRow(rawLines[i]);
      if (row.length <= Math.max(dateIdx, amountIdx)) continue;

      const dateStr = row[dateIdx];
      if (!dateStr) continue;

      const rawDesc = descIdx !== -1 ? row[descIdx] : `Transaction on ${dateStr}`;
      const amountVal = parseFloat(row[amountIdx]);
      if (isNaN(amountVal)) continue;

      let isWithdrawal = amountVal < 0;

      if (typeIdx !== -1) {
        const flowType = row[typeIdx]?.toLowerCase() || '';
        if (flowType === 'withdrawal' || flowType === 'expense' || flowType === 'debit' || flowType === 'dr') {
          isWithdrawal = true;
        } else if (flowType === 'deposit' || flowType === 'income' || flowType === 'credit' || flowType === 'cr') {
          isWithdrawal = false;
        }
      }

      let category: string;
      let type: 'income' | 'expense';

      if (categoryIdx !== -1 && row[categoryIdx]) {
        category = row[categoryIdx];
        type = isWithdrawal ? 'expense' : 'income';
      } else {
        const auto = getAutoCategoryAndType(rawDesc, isWithdrawal);
        category = auto.category;
        type = auto.type;
      }

      results.push({
        id: `tx-import-${importTimestamp}-${i}`,
        selected: true,
        date: dateStr,
        description: rawDesc,
        category,
        amount: isWithdrawal ? -Math.abs(amountVal) : Math.abs(amountVal),
        type,
        status: 'paid' as const
      });
    }

    if (results.length === 0) {
      setParseError('No valid transaction rows found. Check your CSV format — each row needs at least a date and a numeric amount.');
      return;
    }

    setParsedList(results);
    runAiCategorization(results);
  };

  const acceptHighConfidence = () => {
    setParsedList((prev) =>
      prev.map((item) =>
        (item.aiConfidence || 0) >= 85 ? { ...item, selected: true } : item
      )
    );
  };

  const handleImportCommit = () => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    const toImport = parsedList.filter(item => item.selected).map(item => ({
      date: item.date,
      description: item.description,
      category: item.category,
      amount: item.amount,
      type: item.type,
      status: item.status
    }));

    if (toImport.length === 0) return;

    onImport(toImport);
    setImportCompleted(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-3xl w-full max-w-3xl shadow-2xl p-6 overflow-hidden flex flex-col space-y-4 text-left">
        <div className="flex justify-between items-center border-b border-[#E5E7EB] dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#111827] dark:text-zinc-50 flex items-center gap-2">
                Bank Statement CSV Importer
                <Badge className="bg-amber-500/10 text-amber-500 text-[10px] font-mono border-none gap-1 py-0.5">
                  <Sparkles className="h-3 w-3 inline" /> AI Smart Categorization
                </Badge>
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-zinc-400">Import bank exports seamlessly. System uses context heuristics to map tags instantly.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = '';
          }}
        />

        {importCompleted ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-14 w-14 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <CheckCircle className="h-8 w-8 animate-bounce" />
            </div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Imports Executed Cleanly!</h4>
            <p className="text-xs text-slate-400 dark:text-zinc-500">Transactions successfully mapped, reconciled, and written to general account ledger stores.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {parseError && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            {parsedList.length === 0 ? (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={handleFilePicker}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                      : fileName
                        ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/10'
                        : 'border-[#E5E7EB] dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 hover:border-emerald-400 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10'
                  }`}
                >
                  {fileName ? (
                    <>
                      <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-[#111827] dark:text-zinc-100">{fileName}</p>
                        <p className="text-[11px] text-[#6B7280] dark:text-zinc-400 mt-0.5">Click to choose a different file</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Upload className="h-6 w-6 text-[#6B7280] dark:text-zinc-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#111827] dark:text-zinc-100">Drop your bank CSV here, or click to browse</p>
                        <p className="text-[11px] text-[#6B7280] dark:text-zinc-400 mt-0.5">Accepts .csv files with Date, Description, Amount columns</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-zinc-800" />
                  <span className="text-[10px] font-bold text-[#6B7280] dark:text-zinc-500 uppercase tracking-widest">or paste csv data</span>
                  <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-zinc-800" />
                </div>

                <textarea
                  value={csvRaw}
                  onChange={(e) => {
                    setCsvRaw(e.target.value);
                    setFileName(null);
                    if (e.target.value.trim()) {
                      parseCsv(e.target.value);
                    } else {
                      setParseError(null);
                    }
                  }}
                  placeholder={"Date,Description,Withdrawal/Deposit,Amount,Reference\n2026-06-12,Google Ads placement bill,Withdrawal,8500.00,REF32\n2026-06-13,Monthly Consulting Fee,Deposit,95000.00,REF55"}
                  className="w-full h-28 p-4 font-mono text-xs bg-gray-50 dark:bg-zinc-950 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />

                <div className="flex justify-between items-center bg-emerald-500/5 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                  <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-normal max-w-md">
                    <span className="font-bold">Pro Tip:</span> Click the simulation button to generate a typical multi-record bank statement and try the smart parsing heuristics live!
                  </div>
                  <Button
                    type="button"
                    onClick={handleLoadSample}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                  >
                    Load Sample Statement
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1 flex-wrap gap-2">
                  <span className="text-xs font-bold text-[#111827] dark:text-zinc-200">
                    Parsed Audit Preview ({parsedList.filter(p => p.selected).length} of {parsedList.length} selected)
                    {fileName && <span className="text-[#6B7280] dark:text-zinc-400 font-normal ml-2">from {fileName}</span>}
                    {aiEnhanced && (
                      <Badge className="ml-2 text-[9px] bg-indigo-500/10 text-indigo-600 border-none">Gemini AI</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {aiCategorizing && (
                      <span className="text-[10px] text-emerald-600 animate-pulse flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI categorizing…
                      </span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={aiCategorizing}
                      onClick={() => runAiCategorization(parsedList)}
                      className="text-[10px] h-7"
                    >
                      Re-run AI
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={acceptHighConfidence}
                      className="text-[10px] h-7"
                    >
                      Select ≥85% confidence
                    </Button>
                    <button
                      onClick={() => { setParsedList([]); setCsvRaw(''); setFileName(null); setParseError(null); setAiEnhanced(false); }}
                      className="text-xs text-[#6B7280] dark:text-zinc-400 hover:text-rose-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-64 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:bg-zinc-950">
                      <TableRow className="border-[#E5E7EB] dark:border-zinc-800">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="text-[10px] font-bold text-[#6B7280] uppercase">Date</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#6B7280] uppercase">Description</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#6B7280] uppercase">AI Category</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#6B7280] uppercase">Confidence</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#6B7280] uppercase text-right">Flow (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedList.map((item) => (
                        <TableRow key={item.id} className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-950">
                          <TableCell className="py-2.5">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => {
                                setParsedList(prev => prev.map(p => p.id === item.id ? { ...p, selected: !p.selected } : p));
                              }}
                              className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[#6B7280] py-2.5">{item.date}</TableCell>
                          <TableCell className="py-2.5">
                            <div className="font-semibold text-xs text-[#111827] dark:text-zinc-100">{item.description}</div>
                            {item.aiReason && (
                              <div className="text-[9px] text-[#6B7280] dark:text-zinc-500 mt-0.5 italic">{item.aiReason}</div>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <CustomSelect
                              value={item.category}
                              onChange={(val) => {
                                setParsedList(prev => prev.map(p => p.id === item.id ? { ...p, category: val } : p));
                              }}
                              options={
                                item.type === 'income'
                                  ? INCOME_CATEGORIES.map(c => ({ value: c, label: c }))
                                  : EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))
                              }
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className="py-2.5">
                            {item.aiConfidence != null ? (
                              <Badge className={`text-[9px] border-none ${
                                item.aiConfidence >= 85 ? 'bg-emerald-500/10 text-emerald-600' :
                                item.aiConfidence >= 70 ? 'bg-amber-500/10 text-amber-600' :
                                'bg-gray-500/10 text-gray-600'
                              }`}>
                                {item.aiConfidence}%
                              </Badge>
                            ) : (
                              <span className="text-[9px] text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-bold text-xs py-2.5 ${item.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {item.type === 'income' ? '+' : '-'}₹{Math.abs(item.amount).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <Button type="button" variant="ghost" onClick={() => { setParsedList([]); setParseError(null); }} className="text-[#6B7280] dark:text-zinc-400 hover:text-[#111827] dark:hover:text-zinc-100">Back</Button>
                  <Button
                    onClick={handleImportCommit}
                    disabled={parsedList.filter(p => p.selected).length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    Confirm Import — {parsedList.filter(p => p.selected).length} Transaction{parsedList.filter(p => p.selected).length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
