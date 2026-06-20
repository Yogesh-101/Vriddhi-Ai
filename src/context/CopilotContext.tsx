import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 'Founder' | 'Accountant' | 'Viewer';

export interface ClientVendor {
  id: string;
  name: string;
  type: 'Client' | 'Vendor';
  gstin: string;
  phone: string;
  email: string;
  billingAddress: string;
  state: string; // state name or code for GST calculation (e.g. Maharashtra, Karnataka)
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number; // positive for income, negative for expense
  type: 'income' | 'expense';
  status: 'paid' | 'pending' | 'partially';
  entityId?: string; // Links to ClientVendor id
  dueDate?: string; // For tracking receivables/payables
  attachmentUrl?: string; // BASE64 or file name for attached expense receipts
  attachmentName?: string;
}

export interface InvoiceItem {
  description: string;
  hsnSac: string;
  qty: number;
  rate: number;
  gstRate: number; // e.g. 18, 12, 5
}

export interface GSTInvoice {
  id: string;
  clientId: string; // Master record linkage
  date: string;
  dueDate: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  items: InvoiceItem[];
  placeOfSupply: string; // e.g. Maharashtra, Karnataka, Delhi
  isRecurring: boolean;
  recurringInterval: 'Monthly' | 'Weekly' | 'Quarterly';
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  exchangeRate?: number; // exchange rate to INR
  irn?: string; // Simulated 64-character Invoice Reference Number
  ackNumber?: string; // Simulated 15-digit Ack No
  ackDate?: string; // Simulated Ack Date
}

export interface BudgetCategory {
  category: string;
  allocated: number; // Allocated monthly budget in INR
}

export interface TriggerLog {
  id: string;
  timestamp: string;
  type: 'delivery' | 'reminder';
  invoiceId: string;
  destination: string; // email, whatsapp, telegram
  status: 'success' | 'failed';
  channel: 'Email' | 'WhatsApp' | 'Telegram';
  message: string;
}

interface CopilotContextType {
  clientsVendors: ClientVendor[];
  transactions: Transaction[];
  invoices: GSTInvoice[];
  triggerLogs: TriggerLog[];
  budgets: BudgetCategory[];
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  gstState: {
    sellerState: string;
    sellerGSTIN: string;
    sellerName: string;
    sellerAddress: string;
  };
  activeTab: string;
  setActiveTab: (tab: string) => void;
  addClientVendor: (entity: Omit<ClientVendor, 'id'>) => Promise<ClientVendor>;
  updateClientVendor: (id: string, entity: Partial<ClientVendor>) => Promise<void>;
  deleteClientVendor: (id: string) => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<Transaction>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  importTransactions: (txs: Omit<Transaction, 'id'>[]) => Promise<void>;
  addInvoice: (inv: Omit<GSTInvoice, 'id'>) => Promise<GSTInvoice>;
  updateInvoice: (id: string, inv: Partial<GSTInvoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  triggerInvoiceDelivery: (invoiceId: string, channels: ('Email' | 'WhatsApp' | 'Telegram')[]) => Promise<void>;
  triggerPaymentReminder: (invoiceId: string, channels: ('Email' | 'WhatsApp' | 'Telegram')[]) => Promise<void>;
  triggerEscalatedReminder: (invoiceId: string, level: 1 | 2 | 3, channels: ('Email' | 'WhatsApp' | 'Telegram')[]) => Promise<void>;
  updateBudget: (category: string, allocated: number) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

const SELLER_STATE = 'Maharashtra';

// Realistic Dummy Data
const INITIAL_CLIENTS: ClientVendor[] = [
  { id: 'cv-1', name: 'Stark Industries Pvt Ltd', type: 'Client', gstin: '27AADCS5678R1Z8', phone: '+91 98765 43210', email: 'finance@starkindustries.in', billingAddress: 'Stark Tower, Level 42, BKC, Mumbai', state: 'Maharashtra' },
  { id: 'cv-2', name: 'Wayne Enterprises India', type: 'Client', gstin: '07AADCW1234P1Z5', phone: '+91 98123 45678', email: 'ap@wayneenterprises.in', billingAddress: 'Wayne Manor, Connaught Place, New Delhi', state: 'Delhi' },
  { id: 'cv-3', name: 'Freshworks Technologies', type: 'Client', gstin: '33AADCF9012K1Z3', phone: '+91 94321 56789', email: 'billing@freshworks.com', billingAddress: 'Tidel Park, Taramani, Chennai', state: 'Tamil Nadu' },
  { id: 'cv-4', name: 'CloudNine Hosting Solutions', type: 'Vendor', gstin: '29AADCC7890M1Z1', phone: '+91 99876 12345', email: 'invoices@cloudnine.io', billingAddress: 'HSR Layout, Sector 4, Bangalore', state: 'Karnataka' },
  { id: 'cv-5', name: 'PixelCraft Design Studio', type: 'Vendor', gstin: '36AADCP4567N1Z9', phone: '+91 90123 67890', email: 'accounts@pixelcraft.co', billingAddress: 'Jubilee Hills, Hyderabad', state: 'Telangana' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', date: '2026-06-01', description: 'Annual SaaS License — Stark Industries', category: 'Product Sales', amount: 450000, type: 'income', status: 'paid' },
  { id: 'tx-2', date: '2026-06-03', description: 'Consulting Retainer — Wayne Enterprises Q2', category: 'Consulting', amount: 180000, type: 'income', status: 'paid' },
  { id: 'tx-3', date: '2026-06-05', description: 'API Integration Services — Freshworks', category: 'Services', amount: 95000, type: 'income', status: 'pending', dueDate: '2026-06-25' },
  { id: 'tx-4', date: '2026-06-02', description: 'AWS Cloud Infrastructure — June Billing', category: 'Software', amount: -42000, type: 'expense', status: 'paid' },
  { id: 'tx-5', date: '2026-06-04', description: 'Monthly Office Rent — WeWork BKC', category: 'Rent', amount: -65000, type: 'expense', status: 'paid' },
  { id: 'tx-6', date: '2026-06-07', description: 'Staff Salary — Sanjana Iyer (Accountant)', category: 'Salaries', amount: -55000, type: 'expense', status: 'paid' },
  { id: 'tx-7', date: '2026-06-13', description: 'PixelCraft Design Studio — UI Redesign', category: 'Vendor Payments', amount: -35000, type: 'expense', status: 'pending', dueDate: '2026-06-30' },
];

const INITIAL_INVOICES: GSTInvoice[] = [
  {
    id: 'VRI-2026-001',
    clientId: 'cv-1',
    date: '2026-06-01',
    dueDate: '2026-06-30',
    status: 'Paid',
    items: [
      { description: 'Annual SaaS Enterprise License', hsnSac: '998314', qty: 1, rate: 381356, gstRate: 18 }
    ],
    taxableAmount: 381356,
    cgst: 34322,
    sgst: 34322,
    igst: 0,
    totalAmount: 450000,
    placeOfSupply: 'Maharashtra',
    isRecurring: false,
    recurringInterval: 'Monthly',
    currency: 'INR',
    exchangeRate: 1.0,
    irn: 'A8F2E91B4C7D3E5F6A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F',
    ackNumber: 'ACK-2026-06-0001',
    ackDate: '2026-06-01 10:30:00'
  },
  {
    id: 'VRI-2026-002',
    clientId: 'cv-2',
    date: '2026-06-03',
    dueDate: '2026-07-03',
    status: 'Sent',
    items: [
      { description: 'Q2 Consulting Retainer Fee', hsnSac: '998311', qty: 1, rate: 152542, gstRate: 18 }
    ],
    taxableAmount: 152542,
    cgst: 0,
    sgst: 0,
    igst: 27458,
    totalAmount: 180000,
    placeOfSupply: 'Delhi',
    isRecurring: true,
    recurringInterval: 'Quarterly',
    currency: 'INR',
    exchangeRate: 1.0,
    irn: 'B9C3D41E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C',
    ackNumber: 'ACK-2026-06-0002',
    ackDate: '2026-06-03 14:15:00'
  },
  {
    id: 'VRI-2026-003',
    clientId: 'cv-3',
    date: '2026-06-05',
    dueDate: '2026-06-25',
    status: 'Overdue',
    items: [
      { description: 'API Integration Development', hsnSac: '998314', qty: 1, rate: 60000, gstRate: 18 },
      { description: 'QA Testing & Deployment', hsnSac: '998314', qty: 1, rate: 20508, gstRate: 18 }
    ],
    taxableAmount: 80508,
    cgst: 0,
    sgst: 0,
    igst: 14492,
    totalAmount: 95000,
    placeOfSupply: 'Tamil Nadu',
    isRecurring: false,
    recurringInterval: 'Monthly',
    currency: 'INR',
    exchangeRate: 1.0,
    irn: 'C0D4E52F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D',
    ackNumber: 'ACK-2026-06-0003',
    ackDate: '2026-06-05 16:45:00'
  }
];

const INITIAL_LOGS: TriggerLog[] = [
  { id: 'log-1', timestamp: '2026-06-01 10:30', type: 'delivery', invoiceId: 'VRI-2026-001', destination: 'finance@starkindustries.in', status: 'success', channel: 'Email', message: 'Invoice VRI-2026-001 delivered to finance@starkindustries.in' },
  { id: 'log-2', timestamp: '2026-06-03 14:15', type: 'delivery', invoiceId: 'VRI-2026-002', destination: '+91 98123 45678', status: 'success', channel: 'WhatsApp', message: 'Invoice VRI-2026-002 sent via WhatsApp to +91 98123 45678' },
  { id: 'log-3', timestamp: '2026-06-18 09:00', type: 'reminder', invoiceId: 'VRI-2026-003', destination: 'billing@freshworks.com', status: 'success', channel: 'Email', message: 'L1 Payment reminder sent for overdue invoice VRI-2026-003 (₹95,000)' },
];

const INITIAL_BUDGETS: BudgetCategory[] = [
  { category: 'Software', allocated: 50000 },
  { category: 'Rent', allocated: 80000 },
  { category: 'Marketing', allocated: 40000 },
  { category: 'Salaries', allocated: 250000 },
  { category: 'Services', allocated: 20000 },
  { category: 'Vendor Payments', allocated: 60000 },
];

export const CopilotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clientsVendors, setClientsVendors] = useState<ClientVendor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<GSTInvoice[]>([]);
  const [triggerLogs, setTriggerLogs] = useState<TriggerLog[]>([]);
  const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
  const [userRole, setUserRole] = useState<UserRole>('Founder');
  const [activeTab, setActiveTabState] = useState<string>('dashboard');

  const gstState = {
    sellerState: SELLER_STATE,
    sellerGSTIN: '27AAACV4905K1Z8',
    sellerName: 'Vriddhi.Ai Private Limited',
    sellerAddress: 'Level 18, BKC Financial Tower, Bandra Kurla Complex, Mumbai, Maharashtra-400051',
  };

  // 1. Fetch & Auto-Seed Collections on Load
  useEffect(() => {
    async function loadData() {
      try {
        // Clients
        const { data: clientsData, error: clientsErr } = await supabase.from('clients').select('*');
        let finalClients: ClientVendor[] = [];
        if (clientsErr || !clientsData || clientsData.length === 0) {
          await supabase.from('clients').insert(INITIAL_CLIENTS);
          finalClients = INITIAL_CLIENTS;
        } else {
          finalClients = clientsData as ClientVendor[];
        }
        setClientsVendors(finalClients);

        // Transactions
        const { data: txData, error: txErr } = await supabase.from('transactions').select('*');
        let finalTx: Transaction[] = [];
        if (txErr || !txData || txData.length === 0) {
          await supabase.from('transactions').insert(INITIAL_TRANSACTIONS);
          finalTx = INITIAL_TRANSACTIONS;
        } else {
          finalTx = txData as Transaction[];
        }
        setTransactions(finalTx);

        // Invoices
        const { data: invoicesData, error: invoicesErr } = await supabase.from('invoices').select('*');
        let finalInvoices: GSTInvoice[] = [];
        if (invoicesErr || !invoicesData || invoicesData.length === 0) {
          await supabase.from('invoices').insert(INITIAL_INVOICES);
          finalInvoices = INITIAL_INVOICES;
        } else {
          finalInvoices = invoicesData as GSTInvoice[];
        }
        setInvoices(finalInvoices);

        // Trigger Logs
        const { data: logsData, error: logsErr } = await supabase.from('trigger_logs').select('*');
        let finalLogs: TriggerLog[] = [];
        if (logsErr || !logsData || logsData.length === 0) {
          await supabase.from('trigger_logs').insert(INITIAL_LOGS);
          finalLogs = INITIAL_LOGS;
        } else {
          finalLogs = logsData as TriggerLog[];
        }
        setTriggerLogs(finalLogs);

        // Budgets
        const { data: budgetsData, error: budgetsErr } = await supabase.from('budgets').select('*');
        let finalBudgets: BudgetCategory[] = [];
        if (budgetsErr || !budgetsData || budgetsData.length === 0) {
          await supabase.from('budgets').insert(INITIAL_BUDGETS);
          finalBudgets = INITIAL_BUDGETS;
        } else {
          finalBudgets = budgetsData as BudgetCategory[];
        }
        setBudgets(finalBudgets);

      } catch (err) {
        console.error("Supabase initialization failed, falling back to Local Storage / In-memory:", err);
        // Resilient Fallback to LocalStorage
        const savedCV = localStorage.getItem('vc_clients_vendors');
        setClientsVendors(savedCV ? JSON.parse(savedCV) : INITIAL_CLIENTS);

        const savedTx = localStorage.getItem('vc_transactions');
        setTransactions(savedTx ? JSON.parse(savedTx) : INITIAL_TRANSACTIONS);

        const savedInv = localStorage.getItem('vc_invoices');
        setInvoices(savedInv ? JSON.parse(savedInv) : INITIAL_INVOICES);

        const savedLogs = localStorage.getItem('vc_trigger_logs');
        setTriggerLogs(savedLogs ? JSON.parse(savedLogs) : INITIAL_LOGS);

        const savedBudgets = localStorage.getItem('vc_budgets');
        setBudgets(savedBudgets ? JSON.parse(savedBudgets) : INITIAL_BUDGETS);
      }
    }
    loadData();
  }, []);

  // Sync role & tab
  useEffect(() => {
    const savedRole = localStorage.getItem('vc_user_role');
    if (savedRole) setUserRole(savedRole as UserRole);

    const savedTab = localStorage.getItem('vc_active_tab');
    if (savedTab) setActiveTabState(savedTab);
  }, []);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('vc_active_tab', tab);
  };

  const addClientVendor = async (entity: Omit<ClientVendor, 'id'>) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return INITIAL_CLIENTS[0];
    }
    const newId = `cv-${Math.random().toString(36).substr(2, 9)}`;
    const newEntity: ClientVendor = { ...entity, id: newId };
    
    // UI Update immediately
    setClientsVendors((prev) => [newEntity, ...prev]);

    try {
      await supabase.from('clients').insert(newEntity);
    } catch (e) {
      console.warn("Client addition failed to hit Supabase, updated local state:", e);
    }
    return newEntity;
  };

  const updateClientVendor = async (id: string, entity: Partial<ClientVendor>) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    setClientsVendors((prev) => prev.map((item) => (item.id === id ? { ...item, ...entity } : item)));

    try {
      await supabase.from('clients').update(entity).eq('id', id);
    } catch (e) {
      console.warn("Client update failed to hit Supabase, updated local state:", e);
    }
  };

  const deleteClientVendor = async (id: string) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    setClientsVendors((prev) => prev.filter((item) => item.id !== id));

    try {
      await supabase.from('clients').delete().eq('id', id);
    } catch (e) {
      console.warn("Client deletion failed to hit Supabase:", e);
    }
  };

  const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return { id: '', ...tx };
    }
    const newId = `tx-${Math.random().toString(36).substr(2, 9)}`;
    const newTx: Transaction = { ...tx, id: newId };
    
    setTransactions((prev) => [newTx, ...prev]);

    try {
      await supabase.from('transactions').insert(newTx);
    } catch (e) {
      console.warn("Transaction creation failed to hit Supabase:", e);
    }
    return newTx;
  };

  const updateTransaction = async (id: string, tx: Partial<Transaction>) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    setTransactions((prev) => prev.map((item) => (item.id === id ? { ...item, ...tx } : item)));

    try {
      await supabase.from('transactions').update(tx).eq('id', id);
    } catch (e) {
      console.warn("Transaction update failed to hit Supabase:", e);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    setTransactions((prev) => prev.filter((item) => item.id !== id));

    try {
      await supabase.from('transactions').delete().eq('id', id);
    } catch (e) {
      console.warn("Transaction deletion failed to hit Supabase:", e);
    }
  };

  const importTransactions = async (txs: Omit<Transaction, 'id'>[]) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    const prepared = txs.map((t) => ({
      ...t,
      id: `tx-${Math.random().toString(36).substr(2, 9)}`,
    }));
    setTransactions((prev) => [...prepared, ...prev]);

    try {
      await supabase.from('transactions').insert(prepared);
    } catch (e) {
      console.warn("Batch import transaction failed to hit Supabase:", e);
    }
  };

  const addInvoice = async (inv: Omit<GSTInvoice, 'id'>) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return { id: '', ...inv };
    }
    const num = String(invoices.length + 1).padStart(3, '0');
    const generatedIRN = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
    const generatedAckNo = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10).toString()).join('');
    const generatedAckDate = new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString();

    const newInv: GSTInvoice = {
      currency: 'INR',
      exchangeRate: 1.0,
      ...inv,
      id: `INV-2026-${num}`,
      irn: inv.irn || generatedIRN,
      ackNumber: inv.ackNumber || generatedAckNo,
      ackDate: inv.ackDate || generatedAckDate
    };

    setInvoices((prev) => [newInv, ...prev]);

    // Create associated receivables transaction
    const client = clientsVendors.find((c) => c.id === inv.clientId);
    const inrAmount = Math.round(newInv.totalAmount * (newInv.exchangeRate || 1.0));
    const newTx: Transaction = {
      date: inv.date,
      description: `Invoice ${newInv.id} to ${client?.name || 'Client'}${newInv.currency && newInv.currency !== 'INR' ? ` (${newInv.currency} ${newInv.totalAmount.toLocaleString()} @ ${newInv.exchangeRate})` : ''}`,
      category: 'Product Sales',
      amount: inrAmount,
      type: 'income',
      status: inv.status === 'Paid' ? 'paid' : 'pending',
      entityId: inv.clientId,
      dueDate: inv.dueDate,
      id: `tx-${Math.random().toString(36).substr(2, 9)}`,
    };
    setTransactions((prev) => [newTx, ...prev]);

    try {
      await supabase.from('invoices').insert(newInv);
      await supabase.from('transactions').insert(newTx);
    } catch (e) {
      console.warn("Invoice creation failed to hit Supabase:", e);
    }

    await triggerInvoiceDelivery(newInv.id, ['Email', 'WhatsApp']);
    return newInv;
  };

  const updateInvoice = async (id: string, inv: Partial<GSTInvoice>) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    setInvoices((prev) => prev.map((item) => (item.id === id ? { ...item, ...inv } : item)));

    try {
      await supabase.from('invoices').update(inv).eq('id', id);
    } catch (e) {
      console.warn("Invoice update failed to hit Supabase:", e);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    setInvoices((prev) => prev.filter((item) => item.id !== id));

    try {
      await supabase.from('invoices').delete().eq('id', id);
    } catch (e) {
      console.warn("Invoice deletion failed to hit Supabase:", e);
    }
  };

  const triggerInvoiceDelivery = async (invoiceId: string, channels: ('Email' | 'WhatsApp' | 'Telegram')[]) => {
    const targetInv = invoices.find((inv) => inv.id === invoiceId);
    const client = clientsVendors.find((c) => c?.id === targetInv?.clientId);
    const emailTo = client ? client.email : 'finance@agency.in';
    const phoneTo = client ? client.phone : '+91 99999 88888';

    const cleanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDate = new Date().toISOString().split('T')[0];

    const newLogs: TriggerLog[] = channels.map((chan) => {
      let dest = emailTo;
      let msg = `Invoice ${invoiceId} dispatched securely to ${emailTo}`;
      if (chan === 'WhatsApp') {
        dest = phoneTo;
        msg = `WhatsApp PDF dispatched successfully to mobile ${phoneTo}`;
      } else if (chan === 'Telegram') {
        dest = `@${client ? client.name.toLowerCase().replace(/\s+/g, '') : 'client'}Bot`;
        msg = `Telegram notification broadcast sent to client channel ${dest}`;
      }
      return {
        id: `log-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: `${fullDate} ${cleanTime}`,
        type: 'delivery',
        invoiceId,
        destination: dest,
        status: 'success',
        channel: chan,
        message: msg,
      };
    });

    setTriggerLogs((prev) => [...newLogs, ...prev]);

    try {
      await supabase.from('trigger_logs').insert(newLogs);
    } catch (e) {
      console.warn("Trigger log failed to save to Supabase:", e);
    }
  };

  const triggerPaymentReminder = async (invoiceId: string, channels: ('Email' | 'WhatsApp' | 'Telegram')[]) => {
    const targetInv = invoices.find((inv) => inv.id === invoiceId);
    const client = clientsVendors.find((c) => c?.id === targetInv?.clientId);
    const emailTo = client ? client.email : 'finance@client.com';
    const phoneTo = client ? client.phone : '+91 99999 88888';

    const cleanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDate = new Date().toISOString().split('T')[0];

    const newLogs: TriggerLog[] = channels.map((chan) => {
      let dest = emailTo;
      let msg = `Automatic friendly payment overdue reminder sent to ${emailTo}`;
      if (chan === 'WhatsApp') {
        dest = phoneTo;
        msg = `WhatsApp friendly payment overdue alert pushed to ${phoneTo}`;
      } else if (chan === 'Telegram') {
        dest = `@${client ? client.name.toLowerCase().replace(/\s+/g, '') : 'client'}Bot`;
        msg = `Telegram friendly reminder pushed to client chat ${dest}`;
      }
      return {
        id: `log-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: `${fullDate} ${cleanTime}`,
        type: 'reminder',
        invoiceId,
        destination: dest,
        status: 'success',
        channel: chan,
        message: msg,
      };
    });

    setTriggerLogs((prev) => [...newLogs, ...prev]);

    try {
      await supabase.from('trigger_logs').insert(newLogs);
    } catch (e) {
      console.warn("Reminder log failed to save to Supabase:", e);
    }
  };

  const triggerEscalatedReminder = async (invoiceId: string, level: 1 | 2 | 3, channels: ('Email' | 'WhatsApp' | 'Telegram')[]) => {
    const targetInv = invoices.find((inv) => inv.id === invoiceId);
    const client = clientsVendors.find((c) => c?.id === targetInv?.clientId);
    const emailTo = client ? client.email : 'finance@client.com';
    const phoneTo = client ? client.phone : '+91 99999 88888';

    const cleanTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDate = new Date().toISOString().split('T')[0];

    const levelDescriptions = {
      1: {
        title: "Level 1: Friendly Overdue Notice",
        text: `Friendly payment prompt sent to client billing desk for outstanding invoice ${invoiceId}. Please wire payment today.`
      },
      2: {
        title: "Level 2: Strict Compliance Advisory",
        text: `Warning: Urgent notice for Invoice ${invoiceId} sent. Account suspended advisory active. 1.5% daily late penalty generated by Vriddhi ledger.`
      },
      3: {
        title: "Level 3: Legal Red-Alert Escalation",
        text: `STATUTORY NOTICE: Preparing formal legal litigation file on behalf of Vriddhi.Ai advising contract violation on overdue invoice ${invoiceId}. SENT.`
      }
    };

    const newLogs: TriggerLog[] = channels.map((chan) => {
      let dest = emailTo;
      let msg = levelDescriptions[level].text;
      if (chan === 'WhatsApp') {
        dest = phoneTo;
        msg = `[${levelDescriptions[level].title}] ${levelDescriptions[level].text}`;
      } else if (chan === 'Telegram') {
        dest = `@${client ? client.name.toLowerCase().replace(/\s+/g, '') : 'client'}Bot`;
        msg = `Telegram [${levelDescriptions[level].title}] pushed: ${levelDescriptions[level].text}`;
      }
      return {
        id: `log-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: `${fullDate} ${cleanTime}`,
        type: 'reminder',
        invoiceId,
        destination: dest,
        status: 'success',
        channel: chan,
        message: msg,
      };
    });

    setTriggerLogs((prev) => [...newLogs, ...prev]);

    try {
      await supabase.from('trigger_logs').insert(newLogs);
    } catch (e) {
      console.warn("Escalated reminder log failed to save to Supabase:", e);
    }
  };

  const updateBudget = async (category: string, allocated: number) => {
    if (userRole === 'Viewer') {
      alert("Permission Denied: Viewer role is Read-Only.");
      return;
    }
    setBudgets((prev) => prev.map((b) => (b.category === category ? { ...b, allocated } : b)));

    try {
      await supabase.from('budgets').update({ allocated }).eq('category', category);
    } catch (e) {
      console.warn("Budget update failed to hit Supabase:", e);
    }
  };

  const resetAllData = async () => {
    setClientsVendors(INITIAL_CLIENTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setInvoices(INITIAL_INVOICES);
    setTriggerLogs(INITIAL_LOGS);
    setBudgets(INITIAL_BUDGETS);
    setUserRole('Founder');
    setActiveTabState('dashboard');
    localStorage.removeItem('vc_user_role');
    localStorage.removeItem('vc_active_tab');
  };

  return (
    <CopilotContext.Provider
      value={{
        clientsVendors,
        transactions,
        invoices,
        triggerLogs,
        budgets,
        userRole,
        setUserRole,
        gstState,
        activeTab,
        setActiveTab,
        addClientVendor,
        updateClientVendor,
        deleteClientVendor,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        importTransactions,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        triggerInvoiceDelivery,
        triggerPaymentReminder,
        triggerEscalatedReminder,
        updateBudget,
        resetAllData,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
};

export const useCopilot = () => {
  const context = useContext(CopilotContext);
  if (context === undefined) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
};
