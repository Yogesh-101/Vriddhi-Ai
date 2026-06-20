import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, Wallet, Receipt, IndianRupee, TrendingUp, AlertCircle, 
  Sparkles, ArrowRight, ShieldCheck, Calendar, RefreshCw, BarChart2, Filter, Layers, HelpCircle,
  Download, TableProperties, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useRole } from '../context/RoleContext';

const CHART_COLORS = ['#22C55E', '#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981'];

export function Dashboard() {
  const { userRole } = useRole();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clientsVendors, setClientsVendors] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase.from('transactions').select('*');
      if (tx) setTransactions(tx);
      const { data: inv } = await supabase.from('invoices').select('*');
      if (inv) setInvoices(inv);
      const { data: cl } = await supabase.from('clients').select('*');
      if (cl) setClientsVendors(cl);
      const { data: bu } = await supabase.from('budgets').select('*');
      if (bu) setBudgets(bu);
    }
    load();
  }, []);

  const updateBudget = async (category: string, allocated: number) => {
    const b = budgets.find(b => b.category === category);
    if(b) {
      await supabase.from('budgets').update({ allocated }).eq('category', category);
      setBudgets(prev => prev.map(item => item.category === category ? { ...item, allocated } : item));
    }
  };
  
  const resetAllData = async () => {
    if (!window.confirm('This will re-seed all demo data. Proceed?')) return;
    try {
      const res = await fetch('/api/reseed', { method: 'POST' });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };
  
  const currentPlan = 'Starter (Free)';
  const isPremium = false;

  // Filter states
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'this-month' | 'last-30' | 'last-90' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('2026-01-01');
  const [customEndDate, setCustomEndDate] = useState('2026-12-31');

  // Helper date parsing
  const isWithinPeriod = (dateStr: string) => {
    if (!dateStr) return true;
    const targetDate = new Date(dateStr);
    const now = new Date('2026-06-19'); // Consistent with additional metadata

    if (filterPeriod === 'all') return true;
    if (filterPeriod === 'this-month') {
      return targetDate.getFullYear() === now.getFullYear() && targetDate.getMonth() === now.getMonth();
    }
    if (filterPeriod === 'last-30') {
      const diffTime = Math.abs(now.getTime() - targetDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    }
    if (filterPeriod === 'last-90') {
      const diffTime = Math.abs(now.getTime() - targetDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 90;
    }
    if (filterPeriod === 'custom') {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      return targetDate >= start && targetDate <= end;
    }
    return true;
  };

  // Filtered lists
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => isWithinPeriod(t.date));
  }, [transactions, filterPeriod, customStartDate, customEndDate]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => isWithinPeriod(inv.date));
  }, [invoices, filterPeriod, customStartDate, customEndDate]);

  // Financial KPI calculations
  const metrics = useMemo(() => {
    let revenue = 0;
    let expenses = 0;
    let paidCashPosition = 0;

    // From transactions
    filteredTransactions.forEach(t => {
      if (t.type === 'income') {
        revenue += t.amount;
        if (t.status === 'paid') {
          paidCashPosition += t.amount;
        }
      } else {
        expenses += Math.abs(t.amount);
        if (t.status === 'paid') {
          paidCashPosition -= Math.abs(t.amount);
        }
      }
    });

    // Outstanding Receivables from invoices (Pending/Overdue/Sent status)
    let outstandingReceivables = 0;
    let overdueCount = 0;
    invoices.forEach(inv => {
      if (inv.status !== 'Paid' && inv.status !== 'Draft') {
        outstandingReceivables += inv.totalAmount;
        if (inv.status === 'Overdue') {
          overdueCount++;
        }
      }
    });

    // Active payables from transactions/expenses that are pending
    let outstandingPayables = 0;
    transactions.forEach(t => {
      if (t.type === 'expense' && t.status === 'pending') {
        outstandingPayables += Math.abs(t.amount);
      }
    });

    return {
      revenue,
      expenses,
      netProfit: revenue - expenses,
      outstandingReceivables,
      outstandingPayables,
      overdueCount,
      cashPosition: 1540000 + paidCashPosition // Base standard cash position simulation + adjustments
    };
  }, [filteredTransactions, invoices, transactions]);

  // Dynamic charts aggregation — Spend by Category
  const expenseBreakdown = useMemo(() => {
    const categories: { [key: string]: number } = {};
    filteredTransactions.forEach(t => {
      if (t.type === 'expense') {
        const cat = t.category || 'Other Expenses';
        categories[cat] = (categories[cat] || 0) + Math.abs(t.amount);
      }
    });

    const parsed = Object.keys(categories).map(cat => ({
      name: cat,
      value: categories[cat]
    }));

    return parsed.length > 0 ? parsed : [
      { name: 'Rent', value: 50000 },
      { name: 'Salary', value: 150000 },
      { name: 'Marketing', value: 40000 },
      { name: 'Software', value: 25000 }
    ];
  }, [filteredTransactions]);

  // Dynamic charts aggregation — Revenue monthly trends
  const monthlyRevenueData = useMemo(() => {
    const monthlyMap: { [key: string]: number } = {
      'Jan': 120000,
      'Feb': 180000,
      'Mar': 150000,
      'Apr': 210000,
      'May': 260000,
      'Jun': 270000,
    };

    // Integrate live transactions
    transactions.forEach(t => {
      if (t.type === 'income' && t.status === 'paid') {
        const dateObj = new Date(t.date);
        const monthStr = dateObj.toLocaleString('en-US', { month: 'short' });
        if (monthlyMap[monthStr] !== undefined) {
          monthlyMap[monthStr] += t.amount;
        } else {
          monthlyMap[monthStr] = t.amount;
        }
      }
    });

    return Object.keys(monthlyMap).map(m => ({
      name: m,
      value: monthlyMap[m]
    }));
  }, [transactions]);

  // Dynamic Budget VS Actual tracking per category calculations
  const spendVsBudget = useMemo(() => {
    return (budgets || []).map(b => {
      const actualSpent = filteredTransactions
        .filter(t => t.type === 'expense' && t.category?.toLowerCase() === b.category.toLowerCase())
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const percent = b.allocated > 0 ? (actualSpent / b.allocated) * 100 : 0;
      return {
        category: b.category,
        allocated: b.allocated,
        actual: actualSpent,
        percent: Math.min(Math.round(percent), 100),
        rawPercent: Math.round(percent),
        isOverBudget: actualSpent > b.allocated
      };
    });
  }, [budgets, filteredTransactions]);

  // Year-on-year Growth (simulated Q1-Q4 comparing FY25 vs FY26)
  const yoyGrowthData = useMemo(() => {
    return [
      { quarter: 'Q1', FY25: 450000, FY26: 580000, growth: 28 },
      { quarter: 'Q2', FY25: 510000, FY26: 620000, growth: 21 },
      { quarter: 'Q3', FY25: 480000, FY26: 710000, growth: 47 },
      { quarter: 'Q4', FY25: 600000, FY26: 840000, growth: 40 }
    ];
  }, []);

  // Month-on-month Growth comparative details
  const momGrowthData = useMemo(() => {
    return [
      { month: 'March', Revenue: 150000, Expenses: 80000, Margin: 46.6 },
      { month: 'April', Revenue: 210000, Expenses: 120000, Margin: 42.8 },
      { month: 'May', Revenue: 260000, Expenses: 145000, Margin: 44.2 },
      { month: 'June', Revenue: 270000, Expenses: 180000, Margin: 33.3 }
    ];
  }, []);

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newAllocatedValue, setNewAllocatedValue] = useState<number>(0);

  const handleUpdateBudgetSubmit = (cat: string) => {
    updateBudget(cat, newAllocatedValue);
    setEditingCategory(null);
  };

  const downloadTallyCSV = () => {
    let csvContent = "\uFEFFDate,Voucher Type,Particulars,Debit (Outflow),Credit (Inflow),Narration\n";
    transactions.forEach(t => {
      const isDr = t.type === 'expense';
      const drNo = isDr ? Math.abs(t.amount) : "";
      const crNo = !isDr ? t.amount : "";
      const particulars = isDr ? t.category || "Sundry Creditors" : "Sundry Debtors";
      const voucherType = isDr ? "Payment" : "Receipt";
      csvContent += `"${t.date}","${voucherType}","${particulars}",${drNo},${crNo},"${t.description.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Tally_ERP_Ledger_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExcelCSV = () => {
    let csvContent = "\uFEFFTransaction ID,Date,Description,Category,Type,Status,Amount (INR),Outstanding (INR)\n";
    transactions.forEach(t => {
      csvContent += `"${t.id}","${t.date}","${t.description.replace(/"/g, '""')}","${t.category}","${t.type}","${t.status}",${t.amount},${t.status !== 'paid' ? Math.abs(t.amount) : 0}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Excel_Bookkeeping_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Upper Panel row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-[#111827] dark:text-zinc-50">Company Overview</h2>
          <p className="text-[#6B7280] dark:text-zinc-400 mt-1">Unified dynamic ledger metrics with automated GST breakdowns.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {isPremium ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full px-4 py-1.5 text-xs font-bold font-mono tracking-wide">
              <ShieldCheck className="h-4 w-4 text-emerald-500 animate-pulse" />
              GROWTH PRO ACTIVE
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full px-4 py-1.5 text-xs font-bold font-mono tracking-wide">
              <Sparkles className="h-4 w-4 text-amber-500" />
              OFFLINE PREVIEW TIER
            </div>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetAllData} 
            className="text-xs bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-red-500 border-[#E5E7EB] dark:border-zinc-800 transition-all font-mono"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" /> RE-SEED DEMO DATA
          </Button>
        </div>
      </div>

      {/* Date Range & Period Selection Filters Panel */}
      <Card className="border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm rounded-2xl overflow-hidden p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#22C55E]" />
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Date Period Filter</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {(['all', 'this-month', 'last-30', 'last-90', 'custom'] as const).map((period) => (
              <Button
                key={period}
                size="sm"
                variant={filterPeriod === period ? 'default' : 'outline'}
                onClick={() => setFilterPeriod(period)}
                className={`text-xs capitalize py-1 px-3.5 h-8 rounded-xl ${
                  filterPeriod === period 
                    ? 'bg-[#111827] text-white hover:bg-gray-800 dark:bg-zinc-100 dark:text-[#111827]' 
                    : 'bg-white border-[#E5E7EB] dark:bg-zinc-900 dark:border-zinc-800 text-[#111827] dark:text-zinc-200'
                }`}
              >
                {period.replace('-', ' ')}
              </Button>
            ))}
          </div>

          {filterPeriod === 'custom' && (
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-[#E5E7EB] dark:border-zinc-800 w-full lg:w-auto justify-between animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-zinc-400">Start</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-xs text-[#111827] dark:text-zinc-100 focus:outline-none"
                />
              </div>
              <div className="h-3 w-[1px] bg-[#E5E7EB] dark:bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-zinc-400">End</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-xs text-[#111827] dark:text-zinc-100 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Accountant Export Vault (Feature 10) */}
      <Card className="border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-[#22C55E]" />
            <h4 className="text-sm font-bold text-[#111827] dark:text-zinc-50 flex items-center gap-2">
              Accountant Ledger Export Vault
              <Badge className="bg-green-500/10 text-emerald-600 dark:text-emerald-400 capitalize text-[9px] h-4 leading-none border-0">Audit-Ready</Badge>
            </h4>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-zinc-400">Download beautifully formatted general ledger CSV tables designed for seamless feed injection straight into standard Tally ERP, Sage, and Excel.</p>
        </div>
        <div className="flex gap-2.5 w-full md:w-auto">
          <Button
            size="sm"
            onClick={downloadTallyCSV}
            className="flex-1 md:flex-none text-xs bg-[#22C55E] hover:bg-[#c62828] text-white border-0 font-mono flex items-center justify-center gap-1.5 h-9"
          >
            <TableProperties className="h-3.5 w-3.5" />
            TALLY CSV EXPORT
          </Button>
          <Button
            size="sm"
            onClick={downloadExcelCSV}
            className="flex-1 md:flex-none text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-mono flex items-center justify-center gap-1.5 h-9"
          >
            <Download className="h-3.5 w-3.5" />
            EXCEL STANDARD CSV
          </Button>
        </div>
      </Card>

      {/* Primary KPI Boards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="border-l-4 border-l-[#22C55E] border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 w-full shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-[#22C55E]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-[#111827] dark:text-zinc-50">₹{metrics.revenue.toLocaleString()}</div>
            <p className="text-[10px] text-[#22C55E] flex items-center mt-2 font-medium">
              <ArrowUpRight className="h-3 w-3 mr-1" /> Dynamic matching entries
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#22C55E] border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 w-full shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Total Expenses</CardTitle>
            <Wallet className="h-4 w-4 text-[#22C55E]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-[#111827] dark:text-zinc-50">₹{metrics.expenses.toLocaleString()}</div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center mt-2 font-medium">
              Pending payables: &nbsp;<span className="text-rose-500 font-bold">₹{metrics.outstandingPayables.toLocaleString()}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#22C55E] border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 w-full shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#22C55E]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-mono font-bold ${metrics.netProfit >= 0 ? 'text-[#22C55E]' : 'text-rose-500'}`}>
              {metrics.netProfit < 0 ? '-' : ''}₹{Math.abs(metrics.netProfit).toLocaleString()}
            </div>
            <p className="text-[10px] text-[#22C55E] flex items-center mt-2 font-medium">
              Margin percentage: &nbsp;<span className="font-bold">{metrics.revenue > 0 ? ((metrics.netProfit / metrics.revenue) * 100).toFixed(1) : 0}%</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 w-full shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Receivables</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-amber-500">₹{metrics.outstandingReceivables.toLocaleString()}</div>
            <p className="text-[10px] text-[#6B7280] dark:text-zinc-400 mt-2 font-medium">
              {metrics.overdueCount} overdue invoices
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 w-full shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Cash Position</CardTitle>
            <Wallet className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-indigo-500">₹{metrics.cashPosition.toLocaleString()}</div>
            <p className="text-[10px] text-[#6B7280] dark:text-zinc-400 mt-2 font-medium">
              Available working capital
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Profit & Loss Statement generated from active ledger entries */}
      <Card className="border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-[#E5E7EB] dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-[#22C55E]" />
              Filterable Profit & Loss (P&L) Statement
            </CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">Generated instantly from matching receipts and invoices.</CardDescription>
          </div>
          <Badge className="bg-[#111827] text-white select-none capitalize">
            {filterPeriod.replace('-', ' ')} Statement
          </Badge>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 flex items-center gap-1.5 border-b pb-2">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                Operating Income / Revenues
              </h5>
              <div className="space-y-2.5 text-sm max-h-[160px] overflow-y-auto pr-1">
                {filteredTransactions.filter(t => t.type === 'income').length === 0 ? (
                  <div className="text-xs text-gray-500 italic py-2">No income logged in this period.</div>
                ) : (
                  filteredTransactions.filter(t => t.type === 'income').map(t => (
                    <div className="flex justify-between items-center text-xs" key={t.id}>
                      <span className="text-[#111827] dark:text-zinc-200 font-medium truncate max-w-[200px]" title={t.description}>{t.description}</span>
                      <span className="font-mono text-green-600 font-semibold">+₹{t.amount.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t pt-2 flex justify-between items-center font-bold text-xs bg-gray-50/50 dark:bg-zinc-800/40 p-2 rounded-lg">
                <span className="text-[#111827] dark:text-zinc-100">Total Operating Revenues (A)</span>
                <span className="font-mono text-green-600">₹{metrics.revenue.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5 border-b pb-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Operating Expenditures
              </h5>
              <div className="space-y-2.5 text-sm max-h-[160px] overflow-y-auto pr-1">
                {filteredTransactions.filter(t => t.type === 'expense').length === 0 ? (
                  <div className="text-xs text-gray-500 italic py-2">No expenses logged in this period.</div>
                ) : (
                  filteredTransactions.filter(t => t.type === 'expense').map(t => (
                    <div className="flex justify-between items-center text-xs" key={t.id}>
                      <span className="text-[#111827] dark:text-zinc-200 font-medium truncate max-w-[200px]" title={t.description}>{t.description}</span>
                      <span className="font-mono text-rose-500 font-semibold">-₹{Math.abs(t.amount).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t pt-2 flex justify-between items-center font-bold text-xs bg-gray-50/50 dark:bg-zinc-800/40 p-2 rounded-lg">
                <span className="text-[#111827] dark:text-zinc-100">Total Expenses (B)</span>
                <span className="font-mono text-rose-500">₹{metrics.expenses.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[#E5E7EB] dark:border-zinc-800 pt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">NET EARNINGS FOR SELECTED PERIOD (A - B)</div>
              <div className="text-xs text-[#6B7280]">Includes all category tax declarations and consultant pay-out structures.</div>
            </div>
            <div className={`text-2xl font-mono font-black ${metrics.netProfit >= 0 ? 'text-[#22C55E]' : 'text-rose-500'}`}>
              {metrics.netProfit < 0 ? '-' : ''}₹{Math.abs(metrics.netProfit).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic analytics charts based on matching calculations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
          <CardHeader>
            <CardTitle>Revenue & Consulting Trend</CardTitle>
            <CardDescription className="text-[#6B7280]">Aggregate billing collections grouped by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="opacity-40" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} tickFormatter={(val) => `₹${val/1000}k`} />
                  <RechartsTooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#111827'}} />
                  <Bar dataKey="value" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category breakdown reports with Charts */}
        <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
          <CardHeader>
            <CardTitle>Expenditure Breakdown</CardTitle>
            <CardDescription className="text-[#6B7280]">Real-time spending by category tags</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#111827'}} formatter={(val) => `₹${val}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-2 mt-4 text-[10px] text-[#6B7280] dark:text-zinc-400 overflow-y-auto max-h-[60px] w-full">
                {expenseBreakdown.map((entry, index) => (
                  <div key={entry.name} className="flex items-center bg-gray-50 dark:bg-zinc-950 px-2 py-0.5 rounded border">
                    <div className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                    {entry.name}: <span className="font-bold ml-1 text-[#111827] dark:text-white">₹{entry.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spend vs. Budget Tracker Section (Feature 5) */}
      <Card className="border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-[#E5E7EB] dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-[#22C55E]" />
              Real-Time Category Budget vs. Actual Spend
            </CardTitle>
            <CardDescription className="text-[#6B7280] text-xs">
              Monitor active fiscal constraints. Click any underlined ceiling sum to dynamically adjust your category thresholds.
            </CardDescription>
          </div>
          <Badge className="bg-rose-500/10 text-[#22C55E] hover:bg-rose-500/20 border-0 font-medium font-mono text-[10px]">
            ALERTS INSTANT
          </Badge>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spendVsBudget.map((b) => (
              <div 
                key={b.category} 
                className={`p-4 rounded-xl border transition-all ${
                  b.isOverBudget 
                    ? 'border-red-300 bg-red-50/25 dark:border-red-900/40 dark:bg-red-950/25 shadow-sm' 
                    : 'border-gray-100 bg-gray-50/40 dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-[#111827] dark:text-zinc-100">{b.category}</h4>
                    <p className="text-[10px] text-gray-400">Ledger Outflow Matches</p>
                  </div>
                  {b.isOverBudget && (
                    <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-0 text-[10px] font-bold px-1.5 py-0.5 animate-bounce leading-none">
                      OVER LIMIT
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6B7280]">Spent to-date:</span>
                    <span className="font-mono font-bold text-[#111827] dark:text-zinc-200">
                      ₹{b.actual.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs items-center h-6">
                    <span className="text-[#6B7280]">Limit ceiling:</span>
                    {editingCategory === b.category ? (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-mono">₹</span>
                        <input
                          type="number"
                          value={newAllocatedValue}
                          onChange={(e) => setNewAllocatedValue(Number(e.target.value))}
                          className="w-18 font-mono font-bold text-xs bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded py-0.5 px-1 text-[#111827] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateBudgetSubmit(b.category)}
                          className="bg-green-600 text-white pb-0.5 rounded text-xs h-5 w-5 hover:bg-green-700 flex items-center justify-center font-bold"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="bg-rose-600 text-white pb-0.5 rounded text-xs h-5 w-5 hover:bg-rose-700 flex items-center justify-center font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span 
                        onClick={() => {
                          setEditingCategory(b.category);
                          setNewAllocatedValue(b.allocated);
                        }}
                        className="font-mono font-bold text-[#111827] dark:text-zinc-200 underline decoration-dashed decoration-rose-500 cursor-pointer hover:text-[#22C55E]"
                        title="Click to redefine category budget limit"
                      >
                        ₹{b.allocated.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        b.isOverBudget ? 'bg-rose-500' : 'bg-[#22C55E]'
                      }`}
                      style={{ width: `${b.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1 text-gray-500 font-medium">
                    <span>Usage: {b.rawPercent}%</span>
                    <span>Remaining: ₹{Math.max(0, b.allocated - b.actual).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparative Growth Center (Feature 9) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Year-on-Year Quarterly Growth Comparison Area Chart */}
        <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-[#22C55E]" />
                Year-on-Year (YoY) Growth Metrics
              </CardTitle>
              <CardDescription className="text-[#6B7280] text-xs">
                Quarterly billing volumes comparing current period (FY26) vs historical base (FY25)
              </CardDescription>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs border-0 font-mono font-bold">+28.5% YoY Mean</Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[250px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yoyGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="opacity-40" />
                  <XAxis dataKey="quarter" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} tickFormatter={(val) => `₹${val/1000}k`} />
                  <RechartsTooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#111827'}} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: 11}} />
                  <Bar name="FY25 Historical base" dataKey="FY25" fill="#9CA3AF" radius={[4, 4, 0, 0]} maxBarSize={25} />
                  <Bar name="FY26 Active expansion (Current)" dataKey="FY26" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Month-on-Month Trends & Margin Analysis Area Chart */}
        <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-[#F59E0B]" />
                Month-on-Month (MoM) Operating Margins
              </CardTitle>
              <CardDescription className="text-[#6B7280] text-xs">
                Monthly revenue collections paired alongside logged operating expenditures
              </CardDescription>
            </div>
            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs border-0 font-mono font-bold">FY26 Q1 Target Met</Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[250px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={momGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="opacity-40" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} tickFormatter={(val) => `₹${val/1000}k`} />
                  <RechartsTooltip contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#111827'}} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: 11}} />
                  <Area name="Incoming Bookings" type="monotone" dataKey="Revenue" stroke="#22C55E" fillOpacity={1} fill="url(#colorRev)" />
                  <Area name="Operating Expenditures" type="monotone" dataKey="Expenses" stroke="#F43F5E" fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription className="text-[#6B7280]">Latest dynamic updates in workspace ledger</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const txTab = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.includes('Transactions'));
                if (txTab) txTab.click();
              }}
              className="border-[#E5E7EB] bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#111827] dark:text-zinc-200"
            >
              View Ledger
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50">
                    <TableHead className="text-[#6B7280]">Description</TableHead>
                    <TableHead className="text-[#6B7280]">Date</TableHead>
                    <TableHead className="text-right text-[#6B7280]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.slice(0, 5).map((txn) => (
                    <TableRow key={txn.id} className="border-[#E5E7EB] dark:border-zinc-800">
                      <TableCell className="font-medium text-[#111827] dark:text-zinc-200 truncate max-w-[180px]">{txn.description}</TableCell>
                      <TableCell className="text-[#6B7280]">{txn.date}</TableCell>
                      <TableCell className={`text-right font-mono font-medium ${txn.type === 'income' ? 'text-[#22C55E]' : 'text-rose-500'}`}>
                        {txn.type === 'income' ? '+' : '-'}₹{Math.abs(txn.amount).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Open GST Invoices</CardTitle>
              <CardDescription className="text-[#6B7280]">Pending and overdue client invoices</CardDescription>
            </div>
            <Button 
              size="sm" 
              onClick={() => {
                const invTab = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.includes('GST Invoices'));
                if (invTab) invTab.click();
              }}
              className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black border-0"
            >
              Raise Invoice
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50">
                    <TableHead className="text-[#6B7280]">Invoice</TableHead>
                    <TableHead className="text-[#6B7280]">Client</TableHead>
                    <TableHead className="text-[#6B7280]">Status</TableHead>
                    <TableHead className="text-right text-[#6B7280]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.slice(0, 5).map((inv) => {
                    const client = clientsVendors.find(c => c.id === inv.clientId);
                    return (
                      <TableRow key={inv.id} className="border-[#E5E7EB] dark:border-zinc-800">
                        <TableCell className="font-medium"><span className="text-[#22C55E] font-mono">{inv.id}</span></TableCell>
                        <TableCell className="text-[#111827] dark:text-zinc-200">{client?.name || 'Zomato Ltd'}</TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              inv.status === 'Paid' ? 'bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/15 border-none' : 
                              inv.status === 'Overdue' ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/15 border-none animate-pulse' : 
                              'bg-amber-100 text-amber-700 hover:bg-amber-150 border-none'
                            }>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-[#111827] dark:text-white">₹{inv.totalAmount.toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
