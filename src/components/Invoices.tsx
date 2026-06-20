import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Download, Mail, ArrowRight, Printer, Sparkles, Building, Briefcase, Calendar, Phone, Copy, Eye, Trash2, MessageSquare, AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { CustomSelect } from './ui/Select';
import { useAuth } from '../context/AuthContext';

export interface InvoiceItem {
  description: string;
  hsnSac: string;
  qty: number;
  rate: number;
  gstRate: number;
}

export interface GSTInvoice {
  id: string;
  clientId: string;
  date: string;
  dueDate: string;
  status: string;
  items: InvoiceItem[];
  placeOfSupply: string;
  isRecurring: boolean;
  recurringInterval: string;
  currency: string;
  exchangeRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  irn?: string;
  ackNumber?: string;
  ackDate?: string;
}

const gstState = {
  sellerName: 'Vriddhi.Ai',
  sellerGSTIN: '27AABCV1234D1Z5',
  sellerAddress: '123 Main St, Mumbai',
  sellerState: 'Maharashtra'
};

function generateInvoiceNumber(existingInvoices: { id?: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const nums = existingInvoices
    .map((inv) => inv.id)
    .filter((id): id is string => !!id && id.startsWith(prefix))
    .map((id) => parseInt(id.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function recurringIntervalDays(interval: string): number {
  if (interval === 'Weekly') return 7;
  if (interval === 'Quarterly') return 90;
  return 30;
}

function generateIRN(): string {
  return Array.from({ length: 64 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
}

const ESCALATION_MESSAGES: Record<1 | 2 | 3, string> = {
  1: 'Friendly payment prompt — please settle your outstanding invoice at earliest convenience.',
  2: 'URGENT: Invoice overdue. 1.5% daily late penalty may apply per contract terms.',
  3: 'STATUTORY NOTICE: Legal escalation initiated. Immediate settlement required.',
};

export function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clientsVendors, setClientsVendors] = useState<any[]>([]); // Need to fetch these too
  const [triggerLogs, setTriggerLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('invoices').select('*').order('date', { ascending: false });
      if (data) setInvoices(data);
    }
    load();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    async function loadLogs() {
      const { data } = await supabase.from('notification_logs').select('*');
      if (data) setTriggerLogs(data);
    }
    loadLogs();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('clients').select('*');
      if (data) setClientsVendors(data);
    }
    load();
  }, [user?.uid]);

  // Auto-mark Sent invoices as Overdue when past due date
  useEffect(() => {
    if (invoices.length === 0) return;
    const now = new Date();
    invoices.forEach((inv) => {
      if (
        inv.status === 'Sent' &&
        inv.dueDate &&
        new Date(inv.dueDate) < now
      ) {
        updateInvoice(inv.id, { status: 'Overdue' });
      }
    });
  }, [invoices.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect overdue invoices and generate reminder notifications
  useEffect(() => {
    if (invoices.length === 0 || clientsVendors.length === 0) return;
    const now = new Date();
    invoices.forEach((inv) => {
      const isOverdue =
        inv.status === 'Overdue' ||
        (inv.status === 'Sent' && inv.dueDate && new Date(inv.dueDate) < now);
      if (!isOverdue) return;

      const alreadySent = triggerLogs.some(
        (log) =>
          log.invoiceId === inv.id &&
          log.type === 'reminder' &&
          new Date(log.timestamp).toDateString() === now.toDateString()
      );
      if (!alreadySent) {
        const client = clientsVendors.find((c) => c.id === inv.clientId);
        dispatchNotification({
          type: 'reminder',
          invoiceId: inv.id,
          clientName: client?.name || 'Client',
          message: `Auto-triggered: Payment overdue for Invoice ${inv.id} (Due: ${inv.dueDate}). Amount: ₹${(inv.totalAmount || 0).toLocaleString()}`,
          channels: ['Email', 'WhatsApp', 'Telegram'],
          recipientEmail: client?.email,
          recipientPhone: client?.phone,
        }).catch(() => {});
      }
    });
  }, [invoices, clientsVendors, triggerLogs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Process recurring invoice schedules on load
  useEffect(() => {
    if (!user || invoices.length === 0) return;
    const today = new Date();
    const runRecurring = async () => {
      for (const inv of invoices) {
        if (!inv.isRecurring || inv.status === 'Draft') continue;
        const lastRun = new Date(inv.lastRecurringGenerated || inv.date);
        const daysSince = Math.floor((today.getTime() - lastRun.getTime()) / 86400000);
        if (daysSince < recurringIntervalDays(inv.recurringInterval || 'Monthly')) continue;

        const newId = generateInvoiceNumber(invoices);
        const dueDays = inv.dueDate
          ? Math.max(1, Math.ceil((new Date(inv.dueDate).getTime() - new Date(inv.date).getTime()) / 86400000))
          : 15;
        const newDue = new Date(today);
        newDue.setDate(newDue.getDate() + dueDays);

        const irn = generateIRN();
        const clone = {
          ...inv,
          id: newId,
          date: today.toISOString().split('T')[0],
          dueDate: newDue.toISOString().split('T')[0],
          status: 'Sent',
          isRecurring: false,
          irn,
          ackNumber: `ACK-${Math.floor(100000000 + Math.random() * 900000000)}`,
          ackDate: today.toISOString(),
          recurringParentId: inv.id,
        };
        delete clone.lastRecurringGenerated;
        delete clone.created_at;

        await addInvoice(clone);
        await updateInvoice(inv.id, { lastRecurringGenerated: today.toISOString() });

        const client = clientsVendors.find((c) => c.id === inv.clientId);
        dispatchNotification({
          type: 'delivery',
          invoiceId: newId,
          clientName: client?.name || 'Client',
          message: `Recurring invoice ${newId} auto-generated from schedule (${inv.recurringInterval}). Amount: ₹${(inv.totalAmount || 0).toLocaleString()}`,
          channels: ['Email', 'WhatsApp'],
          recipientEmail: client?.email,
          recipientPhone: client?.phone,
        }).catch(() => {});
      }
    };
    runRecurring();
  }, [user?.uid, invoices.length, clientsVendors.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('Monthly');

  // Multi-currency Support (Feature 6)
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR' | 'GBP' | 'SGD'>('INR');
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const curSymbol = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : (currency === 'SGD' ? 'S$' : currency))));


  const handleCurrencyChange = (curr: 'INR' | 'USD' | 'EUR' | 'GBP' | 'SGD') => {
    setCurrency(curr);
    switch (curr) {
      case 'USD': setExchangeRate(83.50); break;
      case 'EUR': setExchangeRate(89.80); break;
      case 'GBP': setExchangeRate(106.20); break;
      case 'SGD': setExchangeRate(62.10); break;
      default: setExchangeRate(1.0);
    }
  };

  // Multi-item form builder
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: 'Software Architecture Consulting', hsnSac: '998311', qty: 1, rate: 100000, gstRate: 18 }
  ]);

  const [placeOfSupply, setPlaceOfSupply] = useState('Maharashtra');
  const [clientGSTIN, setClientGSTIN] = useState('');

  // Temporary row builders
  const [itemDesc, setItemDesc] = useState('');
  const [itemHsn, setItemHsn] = useState('998311');
  const [itemQty, setItemQty] = useState(1);
  const [itemRate, setItemRate] = useState(0);
  const [itemGst, setItemGst] = useState(18);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Sync client details whenever a master record in selected
  const handleClientChange = (cId: string) => {
    setClientId(cId);
    const target = clientsVendors.find(c => c.id === cId);
    if (target) {
      setClientGSTIN(target.gstin);
      setPlaceOfSupply(target.state);
    }
  };

  const addInvoice = async (invoice: any) => {
    const withId = invoice.id ? invoice : { ...invoice, id: generateInvoiceNumber(invoices) };
    const { data } = await supabase.from('invoices').insert(withId).select();
    if (data && data[0]) {
      setInvoices(prev => [data[0], ...prev]);
      return data[0];
    }
    const fallback = { id: generateInvoiceNumber(invoices), ...withId };
    setInvoices(prev => [fallback, ...prev]);
    return fallback;
  };

  const updateInvoice = async (id: string, updates: any) => {
    await supabase.from('invoices').update(updates).eq('id', id);
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
  };

  const deleteInvoice = async (id: string) => {
    await supabase.from('invoices').delete().eq('id', id);
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const dispatchNotification = async (payload: {
    type: 'delivery' | 'reminder' | 'escalation';
    invoiceId: string;
    clientName: string;
    message: string;
    channels: ('Email' | 'Telegram' | 'WhatsApp')[];
    recipientEmail?: string;
    recipientPhone?: string;
  }) => {
    try {
      const json = await sendNotification(payload);
      if (json.data?.length) {
        setTriggerLogs(prev => [...json.data, ...prev]);
      }
      const results = json.results || [];
      const live = results.filter((r: { status: string }) => r.status === 'delivered').length;
      const failed = results.filter((r: { status: string }) => r.status === 'failed').length;
      if (failed > 0) {
        showToast(`Notification partially failed (${live} live, ${failed} failed). Check Admin → Notification Logs.`);
      } else if (live > 0) {
        showToast(`Notifications sent ● LIVE (${live} channel${live > 1 ? 's' : ''}).`);
      } else {
        showToast('Notifications logged as SIMULATED — restart server after updating .env, or use http://localhost:3000');
      }
      return json;
    } catch (e: any) {
      showToast(`Notification failed: ${e.message}. Log out and log back in, then retry.`);
      throw e;
    }
  };

  const triggerInvoiceDelivery = async (id: string, methods: ('Email' | 'Telegram' | 'WhatsApp')[]) => {
    const inv = invoices.find(i => i.id === id);
    const client = clientsVendors.find(c => c.id === inv?.clientId);
    await dispatchNotification({
      type: 'delivery',
      invoiceId: id,
      clientName: client?.name || 'Client',
      message: `Invoice ${id} delivered to ${client?.email || 'client'}`,
      channels: methods,
      recipientEmail: client?.email,
      recipientPhone: client?.phone,
    });
  };

  const triggerPaymentReminder = async (id: string, methods: ('Email' | 'Telegram' | 'WhatsApp')[]) => {
    const inv = invoices.find(i => i.id === id);
    const client = clientsVendors.find(c => c.id === inv?.clientId);
    await dispatchNotification({
      type: 'reminder',
      invoiceId: id,
      clientName: client?.name || 'Client',
      message: `Payment reminder sent - Invoice ${id} overdue`,
      channels: methods,
      recipientEmail: client?.email,
      recipientPhone: client?.phone,
    });
  };

  const triggerEscalatedReminder = async (id: string, methods: ('Email' | 'Telegram' | 'WhatsApp')[]) => {
    const inv = invoices.find(i => i.id === id);
    const client = clientsVendors.find(c => c.id === inv?.clientId);
    const priorEscalations = triggerLogs.filter(
      (log) => log.invoiceId === id && log.type === 'escalation'
    ).length;
    const level = Math.min(priorEscalations + 1, 3) as 1 | 2 | 3;

    await dispatchNotification({
      type: 'escalation',
      invoiceId: id,
      clientName: client?.name || 'Client',
      message: `Level ${level} escalation — Invoice ${id}: ${ESCALATION_MESSAGES[level]}`,
      channels: methods.length ? methods : ['Email', 'WhatsApp', 'Telegram'],
      recipientEmail: client?.email,
      recipientPhone: client?.phone,
    });
    showToast(`Escalation L${level} dispatched for invoice ${id}`);
  };

  const handleAddItem = () => {
    if (!itemDesc) return;
    setItems(prev => [...prev, {
      description: itemDesc,
      hsnSac: itemHsn,
      qty: itemQty,
      rate: itemRate,
      gstRate: itemGst
    }]);
    // Reset inputs
    setItemDesc('');
    setItemRate(0);
    setItemQty(1);
    showToast('Item added to invoice checklist.');
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    showToast('Item removed.');
  };

  // Perform multi-item dynamic tax calculations (CGST, SGST, IGST split based on state)
  const totals = useMemo(() => {
    let taxableAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    items.forEach(itm => {
      const lineTotal = itm.qty * itm.rate;
      taxableAmount += lineTotal;

      const taxAmount = lineTotal * (itm.gstRate / 100);
      const isIntrastate = placeOfSupply.toLowerCase() === gstState.sellerState.toLowerCase();

      if (isIntrastate) {
        cgst += taxAmount / 2;
        sgst += taxAmount / 2;
      } else {
        igst += taxAmount;
      }
    });

    return {
      taxableAmount,
      cgst,
      sgst,
      igst,
      totalAmount: taxableAmount + cgst + sgst + igst
    };
  }, [items, placeOfSupply, gstState.sellerState]);

  const handleCreateAndSave = (status: 'Draft' | 'Sent' | 'Paid') => {
    if (!clientId) {
      alert("Please select a master client record to bill.");
      return;
    }
    if (items.length === 0) {
      alert("At least one line item is required to raise invoices.");
      return;
    }

    const irn = status !== 'Draft' ? generateIRN() : undefined;
    const ackNumber = irn ? `ACK-${Math.floor(100000000 + Math.random() * 900000000)}` : undefined;
    const ackDate = irn ? new Date().toISOString() : undefined;

    const newInvoice = {
      id: generateInvoiceNumber(invoices),
      clientId,
      date,
      dueDate,
      status,
      items,
      placeOfSupply,
      isRecurring,
      recurringInterval,
      currency,
      exchangeRate,
      irn,
      ackNumber,
      ackDate,
      ...totals
    };

    addInvoice(newInvoice);

    if (status === 'Sent') {
      const client = clientsVendors.find(c => c.id === clientId);
      dispatchNotification({
        type: 'delivery',
        invoiceId: newInvoice.id,
        clientName: client?.name || 'Client',
        message: `New invoice ${newInvoice.id} generated and delivered to ${client?.email || 'client'}. Amount: ₹${totals.totalAmount.toLocaleString()}`,
        channels: ['Email', 'WhatsApp', 'Telegram'],
        recipientEmail: client?.email,
        recipientPhone: client?.phone,
      }).catch(() => {});
    }

    // Reset states
    setIsModalOpen(false);
    setClientId('');
    setCurrency('INR');
    setExchangeRate(1.0);
    setItems([{ description: 'Software Architecture Consulting', hsnSac: '998311', qty: 1, rate: 100000, gstRate: 18 }]);
    showToast(`Invoice generated successfully and notifications dispatched.`);
  };

  // Interactive PDF printing system
  const handlePrintDownload = (invoice: GSTInvoice) => {
    const client = clientsVendors.find(c => c.id === invoice.clientId);
    const isIntrastate = invoice.placeOfSupply.toLowerCase() === gstState.sellerState.toLowerCase();
    const invCurrency = invoice.currency || 'INR';
    const invRate = invoice.exchangeRate || 1.0;
    const symbol = invCurrency === 'INR' ? '₹' : (invCurrency === 'USD' ? '$' : (invCurrency === 'EUR' ? '€' : (invCurrency === 'GBP' ? '£' : (invCurrency === 'SGD' ? 'S$' : invCurrency))));

    const bstStateLabel = (st: string) => {
      return st === 'Maharashtra' ? 'Maharashtra (27)' : st;
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast("Blocked by pop-up blocker. Change browser permissions to download PDF.");
      return;
    }

    const htmlContent = `
      <html>
      <head>
        <title>Invoice GST-${invoice.id}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
          .hdr-container { display: flex; justify-content: space-between; border-b: 1px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 28px; font-weight: 800; color: #111827; margin: 0; }
          .badge { background: #22C55E; color: white; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: bold; width: fit-content; text-transform: uppercase; }
          .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; font-size: 13px; }
          .section-title { font-size: 11px; text-transform: uppercase; color: #888; font-weight: bold; padding-bottom: 5px; border-bottom: 1px solid #eee; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 13px; }
          th { background: #f9fafb; padding: 12px; border-bottom: 2px solid #e5e7eb; font-weight: bold; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #f3f4f6; }
          .right { text-align: right; }
          .totals-grid { display: flex; flex-direction: column; align-items: flex-end; font-size: 13px; margin-top: 20px; }
          .totals-row { display: grid; grid-template-cols: 155px 115px; gap: 10px; margin-bottom: 6px; text-align: right; }
          .grand-total { font-size: 18px; font-weight: 800; border-top: 1px solid #111; padding-top: 10px; margin-top: 10px; }
          .footer { margin-top: 60px; font-size: 11px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="hdr-container">
          <div>
            <h1 class="title">GST-${invoice.id}</h1>
            <p style="margin: 4px 0; color:#888;">GST-Compliant Tax Invoice</p>
            <div class="badge">${invoice.status}</div>
          </div>
          <div style="text-align: right; font-size:13px;">
            <strong style="color: #E21C26;">${gstState.sellerName}</strong><br/>
            GSTIN: <strong>${gstState.sellerGSTIN}</strong><br/>
            ${gstState.sellerAddress}<br/>
            Place of Supply: ${bstStateLabel(gstState.sellerState)}
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <div class="section-title">Bill To client</div>
            <strong>${client?.name || 'Zomato Ltd'}</strong><br/>
            GSTIN: ${client?.gstin || '27AADCA8955F1Z5'}<br/>
            Address: ${client?.billingAddress || 'Hitech City, Hyderabad'}<br/>
            Phone: ${client?.phone || '+91 9876543210'}<br/>
            Email: ${client?.email || 'billing@domain.com'}
          </div>
          <div>
            <div class="section-title">Invoice Information</div>
            Date raised: <strong>${invoice.date}</strong><br/>
            Due date: <strong style="color:#E21C26;">${invoice.dueDate}</strong><br/>
            Place of supply: <strong>${invoice.placeOfSupply}</strong> (${isIntrastate ? 'Intra-state CGST+SGST applied' : 'Inter-state IGST applied'})<br/>
            Recurring Schedule: <strong>${invoice.isRecurring ? `Recurring (${invoice.recurringInterval})` : 'One-time bill'}</strong>
          </div>
        </div>

        ${invoice.irn ? `
        <div style="background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 25px; font-size: 11.5px; font-family: monospace; color: #334155; line-height: 1.4;">
          <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 6px; color: #22C55E; font-size: 10px; letter-spacing: 0.5px;">Simulated Government E-Invoicing Registry / IRN Record</div>
          <div style="word-break: break-all; margin-bottom: 5px;"><strong>IRN Base Code:</strong> ${invoice.irn}</div>
          <div style="display: flex; gap: 40px;">
            <div><strong>Ack Receipt No:</strong> ${invoice.ackNumber}</div>
            <div><strong>Ack Timestamp:</strong> ${invoice.ackDate}</div>
          </div>
        </div>
        ` : ''}

        ${invCurrency !== 'INR' ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 25px; font-size: 12.5px; color: #1e3a8a;">
          <strong>International Billing Terms:</strong> Invoiced in native buyer tender <strong>${invCurrency}</strong>.<br/>
          Original bill amount total: <strong>${symbol}${invoice.totalAmount.toLocaleString()}</strong> 
          @ conversion rate: <strong>1 ${invCurrency} = ₹${invRate} INR</strong>.<br/>
          Converted accounting sum: <strong>₹${Math.round(invoice.totalAmount * invRate).toLocaleString()} INR equivalent</strong>.
        </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th class="right">Qty</th>
              <th class="right">Rate (${symbol})</th>
              <th class="right">GST %</th>
              <th class="right">Amount (${symbol})</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(itm => `
              <tr>
                <td>${itm.description}</td>
                <td><font color="#888">${itm.hsnSac}</font></td>
                <td class="right">${itm.qty}</td>
                <td class="right">${symbol}${itm.rate.toLocaleString()}</td>
                <td class="right">${itm.gstRate}%</td>
                <td class="right">${symbol}${(itm.qty * itm.rate).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-grid">
          <div class="totals-row">
            <span>Taxable Amount:</span>
            <strong>${symbol}${invoice.taxableAmount.toLocaleString()}</strong>
          </div>
          ${isIntrastate ? `
            <div class="totals-row">
              <span>CGST (9%):</span>
              <strong>${symbol}${invoice.cgst.toLocaleString()}</strong>
            </div>
            <div class="totals-row">
              <span>SGST (9%):</span>
              <strong>${symbol}${invoice.sgst.toLocaleString()}</strong>
            </div>
          ` : `
            <div class="totals-row">
              <span>IGST (18%):</span>
              <strong>${symbol}${invoice.igst.toLocaleString()}</strong>
            </div>
          `}
          <div class="totals-row grand-total">
            <span>Grand Total:</span>
            <span style="color:#22C55E;">${symbol}${invoice.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <div class="footer">
          * This is a certified GST digital tax invoice secure-logged via the Vriddhi.Ai co-pilot platform.<br/>
          For billing inquiries, email finance@vriddhicapital.com
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast(`PDF compilation requested for invoice ${invoice.id}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-[#111827] dark:text-zinc-50">GST Compliance Invoicing</h2>
          <p className="text-[#6B7280] dark:text-zinc-400 mt-1">Generate, audit, and track secure CGST/SGST/IGST invoices with client communication logs.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black">
          <Plus className="mr-2 h-4 w-4" /> Raise Tax Invoice
        </Button>
      </div>

      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#22C55E]/90 backdrop-blur border border-green-500 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold tracking-wide animate-in slide-in-from-top-2">
          {toastMsg}
        </div>
      )}

      {/* Invoice History Grid */}
      <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-50">
        <CardHeader className="py-4">
          <CardTitle>GST Invoices Database</CardTitle>
          <CardDescription className="text-xs text-[#6B7280] dark:text-zinc-400">Fully compliant automatic IGST/SGST split logs with instant digital receipt dispatch toggles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-950">
                  <TableHead className="text-[#6B7280] dark:text-zinc-400">Invoice #</TableHead>
                  <TableHead className="text-[#6B7280] dark:text-zinc-400">Client Entity</TableHead>
                  <TableHead className="text-[#6B7280] dark:text-zinc-400">Place of Supply</TableHead>
                  <TableHead className="text-[#6B7280] dark:text-zinc-400">Date / Due</TableHead>
                  <TableHead className="text-[#6B7280] dark:text-zinc-400">Status</TableHead>
                  <TableHead className="text-right text-[#6B7280] dark:text-zinc-400">Total Amount</TableHead>
                  <TableHead className="text-[#6B7280] dark:text-zinc-400 text-center">Inward Actions / Dispatches</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const client = clientsVendors.find(c => c.id === inv.clientId);
                  const isIntrastate = inv.placeOfSupply.toLowerCase() === gstState.sellerState.toLowerCase();
                  return (
                    <TableRow key={inv.id} className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-950">
                      <TableCell className="font-bold text-[#22C55E] font-mono tracking-tight">{inv.id}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="font-bold text-[#111827] dark:text-white">{client?.name || 'Zomato Ltd'}</div>
                          <div className="text-[10px] text-gray-500 dark:text-zinc-500 font-mono">GSTIN: {client?.gstin || '27AADCA8955F1Z5'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium">{inv.placeOfSupply}</span>
                        <div className="text-[9px] text-[#6B7280]">
                          {isIntrastate ? 'Intra-state (CGST+SGST)' : 'Inter-state (IGST)'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-[#111827] dark:text-zinc-300 font-mono font-medium">{inv.date}</div>
                        <div className="text-[10px] text-[#22C55E] font-mono font-bold flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" /> Due: {inv.dueDate}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CustomSelect
                          value={inv.status}
                          onChange={(newStatus) => {
                            updateInvoice(inv.id, { status: newStatus });
                            showToast(`Invoice ${inv.id} status updated to ${newStatus}`);
                            const client = clientsVendors.find(c => c.id === inv.clientId);
                            if (newStatus === 'Sent' || newStatus === 'Overdue' || newStatus === 'Paid') {
                              dispatchNotification({
                                type: newStatus === 'Paid' ? 'delivery' : newStatus === 'Overdue' ? 'escalation' : 'reminder',
                                invoiceId: inv.id,
                                clientName: client?.name || 'Client',
                                message: `Invoice ${inv.id} status changed to ${newStatus}`,
                                channels: ['Email', 'WhatsApp'],
                                recipientEmail: client?.email,
                                recipientPhone: client?.phone,
                              }).catch(() => {});
                            }
                          }}
                          options={[
                            { value: 'Paid', label: 'PAID' },
                            { value: 'Partially Paid', label: 'PARTIAL' },
                            { value: 'Sent', label: 'SENT' },
                            { value: 'Overdue', label: 'OVERDUE' },
                            { value: 'Draft', label: 'DRAFT' }
                          ]}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-[#111827] dark:text-white">
                         ₹{inv.totalAmount.toLocaleString()}
                         <div className="text-[9px] text-gray-500 dark:text-zinc-500 font-normal">Tax: ₹{Math.max(inv.cgst + inv.sgst, inv.igst).toLocaleString()}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                           <Button 
                             variant="outline" 
                             size="icon" 
                             className="h-8 w-8 text-[#6B7280] hover:text-[#111827] dark:hover:text-zinc-100 border-[#E5E7EB] dark:border-zinc-700 rounded-full" 
                             title="Download PDF print"
                             onClick={() => handlePrintDownload(inv)}
                           >
                              <Download className="h-4 w-4" />
                           </Button>

                           <Button 
                             variant="outline"
                             size="icon" 
                             className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-slate-50 dark:hover:bg-zinc-800 border-[#E5E7EB] dark:border-zinc-700 rounded-full" 
                             title="Trigger manual dispatch (Email/WhatsApp)"
                             onClick={async () => {
                               await triggerInvoiceDelivery(inv.id, ['Email', 'WhatsApp']);
                             }}
                           >
                              <Mail className="h-4 w-4" />
                           </Button>

                           {inv.status === 'Overdue' && (
                             <>
                             <Button 
                               variant="outline" 
                               size="icon" 
                               className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 border-[#E5E7EB] dark:border-zinc-700 rounded-full animate-pulse" 
                               title="Send Gentle WhatsApp Payment Reminder"
                               onClick={async () => {
                                 await triggerPaymentReminder(inv.id, ['Email', 'WhatsApp']);
                               }}
                             >
                                <Phone className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 ml-1 text-white bg-amber-600 hover:bg-amber-700 border-none rounded-full animate-pulse" 
                                title="TRIGGER ESCALATING REMINDER (Sequence L1 -> L3)"
                                onClick={async () => {
                                  await triggerEscalatedReminder(inv.id, ['Email', 'WhatsApp']);
                                }}
                              >
                                <AlertTriangle className="h-4 w-4" />
                             </Button>
                             </>
                           )}

                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 text-[#6B7280] hover:text-[#22C55E] rounded-full"
                             title="Administrative Delete Override"
                             onClick={() => deleteInvoice(inv.id)}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Trigger Notification Broadcast Logs (Specifications Feature 11 and 12) */}
      <Card className="shadow-sm bg-[#111827] text-white border-0 overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-[#09090B] py-3.5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-rose-500" />
              Automated Twilio & SendGrid Notification Trigger Service Logs
            </CardTitle>
            <CardDescription className="text-[11px] text-white/50">Dispatched system telemetry alerts demonstrating secure delivery and overdue alerts.</CardDescription>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">ACTIVE INTEGRATION</Badge>
        </CardHeader>
        <CardContent className="p-4 space-y-2 mt-2">
          {triggerLogs.length === 0 ? (
            <p className="text-xs text-white/40 italic">Queue is currently idle. Generated invoices will trace deliveries here.</p>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {triggerLogs.slice(0, 20).map((log) => {
                const ts = log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '';
                return (
                  <div key={log.id} className="text-[10px] font-mono flex items-start gap-2 bg-white/5 p-2 rounded border border-white/5 justify-between">
                    <div>
                      <span className="text-[#22C55E] font-bold">[{ts}]</span> &nbsp;
                      <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[8px] tracking-wider ${
                        log.type === 'delivery' ? 'bg-blue-500/20 text-blue-300' :
                        log.type === 'reminder' ? 'bg-amber-500/20 text-amber-300' :
                        log.type === 'escalation' ? 'bg-rose-500/20 text-rose-300' :
                        'bg-emerald-500/20 text-emerald-300'
                      }`}>{log.type}</span> &nbsp;
                      {log.clientName && <span className="text-indigo-300 font-semibold">[{log.clientName}]</span>} &nbsp;
                      <span className="text-white/90">{log.message}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-green-400">● {log.status?.toUpperCase() || 'DELIVERED'}</span>
                      <span className="text-white/40">via {log.destination}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Generator Multi-Page Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-[90vh]">
            <div className="p-5 border-b border-[#E5E7EB] dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50 rounded-t-2xl">
               <h3 className="text-lg font-bold text-[#111827] dark:text-zinc-50">Generate Tax Invoice (GST-Compliant)</h3>
               <div className="flex items-center gap-2">
                 <Badge className="bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 font-mono tracking-tight text-xs uppercase">AUTO-SCHEDULING ACTIVE</Badge>
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bill To */}
                  <div className="space-y-3.5 bg-gray-50 dark:bg-zinc-800/30 p-4 rounded-xl border dark:border-zinc-700">
                     <h4 className="text-xs font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-wider border-b dark:border-zinc-700 pb-1.5">Master Bill-To Client Selection</h4>
                     <div className="space-y-2.5">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400">Client entity *</label>
                          <CustomSelect 
                            value={clientId}
                            onChange={(val) => handleClientChange(val)}
                            options={[
                              { value: '', label: 'Choose matching buyer...' },
                              ...clientsVendors.filter(c => c.type === 'Client').map(cv => ({ value: cv.id, label: cv.name }))
                            ]}
                            className="w-full mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <div>
                             <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400">Place of Supply *</label>
                             <CustomSelect 
                               value={placeOfSupply}
                               onChange={(val) => setPlaceOfSupply(val)}
                               options={[
                                 { value: 'Maharashtra', label: 'Maharashtra (27)' },
                                 { value: 'Tamil Nadu', label: 'Tamil Nadu (33)' },
                                 { value: 'Karnataka', label: 'Karnataka (29)' },
                                 { value: 'Delhi', label: 'Delhi (07)' }
                               ]}
                               className="w-full mt-1"
                             />
                           </div>
                           <div>
                              <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400">Client GSTIN</label>
                              <input 
                                type="text" 
                                readOnly
                                value={clientGSTIN}
                                placeholder="Auto-populated"
                                className="w-full h-10 px-3 mt-1 rounded-md bg-gray-100 dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-700 text-gray-700 dark:text-zinc-100 text-xs font-mono focus:outline-none" 
                              />
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3.5 bg-gray-50 dark:bg-zinc-800/30 p-4 rounded-xl border dark:border-zinc-700">
                     <h4 className="text-xs font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-wider border-b dark:border-zinc-700 pb-1.5">Invoice Parameters</h4>
                      <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400">Invoice Date</label>
                            <input 
                              type="date" 
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              className="w-full h-10 px-3 mt-1 rounded-md bg-white dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-700 text-[#111827] dark:text-zinc-100 text-xs focus:outline-none" 
                            />
                         </div>
                         <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400">Due Date</label>
                            <input 
                              type="date" 
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className="w-full h-10 px-3 mt-1 rounded-md bg-white dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-700 text-[#111827] dark:text-zinc-100 text-xs focus:outline-none" 
                            />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3">
                         <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400">Billing Currency *</label>
                            <CustomSelect 
                              value={currency}
                              onChange={(val) => handleCurrencyChange(val as any)}
                              options={[
                                { value: 'INR', label: 'Indian Rupee (INR)' },
                                { value: 'USD', label: 'US Dollar (USD)' },
                                { value: 'EUR', label: 'Euro (EUR)' },
                                { value: 'GBP', label: 'British Pound (GBP)' },
                                { value: 'SGD', label: 'Singapore Dollar (SGD)' }
                              ]}
                              className="w-full mt-1"
                            />
                         </div>
                         <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400">Exchange Rate (vs INR)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              disabled={currency === 'INR'}
                              value={exchangeRate}
                              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1.0)}
                              className="w-full h-10 px-3 mt-1 rounded-md bg-white dark:bg-zinc-800 disabled:bg-gray-100 dark:disabled:bg-zinc-800/50 border border-[#E5E7EB] dark:border-zinc-700 text-[#111827] dark:text-zinc-100 text-xs font-mono focus:outline-none" 
                            />
                         </div>
                      </div>

                      <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-indigo-100 dark:border-zinc-700 flex flex-col gap-2 mt-1">
                         <div className="flex items-center gap-2">
                           <input 
                             type="checkbox" 
                             id="isRec"
                             checked={isRecurring}
                             onChange={(e) => setIsRecurring(e.target.checked)}
                             className="rounded bg-gray-50 border-[#E5E7EB] accent-[#111827]" 
                           />
                           <label htmlFor="isRec" className="text-xs text-[#111827] dark:text-zinc-100 font-bold select-none cursor-pointer">Make this a Recurring Invoice</label>
                         </div>
                         {isRecurring && (
                           <div className="flex items-center gap-2 animate-in slide-in-from-top-1">
                             <span className="text-[9px] uppercase text-[#6B7280] font-bold">Schedule Interval:</span>
                             <CustomSelect
                               value={recurringInterval}
                               onChange={(val) => setRecurringInterval(val)}
                               options={[
                                 { value: 'Monthly', label: 'Monthly' },
                                 { value: 'Weekly', label: 'Weekly' },
                                 { value: 'Quarterly', label: 'Quarterly' }
                               ]}
                               className="w-24"
                             />
                           </div>
                         )}
                      </div>
                  </div>
               </div>

               {/* Line Items checklist */}
               <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-wider">Line Items Ledger Details</h4>
                  
                  <div className="border dark:border-zinc-700 rounded-xl spill-container divide-y dark:divide-zinc-700">
                    <Table>
                       <TableHeader>
                          <TableRow className="bg-gray-50/80 dark:bg-zinc-800/50">
                             <TableHead className="text-xs dark:text-zinc-400">Item Description</TableHead>
                             <TableHead className="text-xs dark:text-zinc-400">HSN/SAC</TableHead>
                             <TableHead className="text-xs dark:text-zinc-400 text-right">Qty</TableHead>
                             <TableHead className="text-xs dark:text-zinc-400 text-right">Rate ({curSymbol})</TableHead>
                             <TableHead className="text-xs dark:text-zinc-400 text-right">GST %</TableHead>
                             <TableHead className="text-xs dark:text-zinc-400 text-right">Line Total ({curSymbol})</TableHead>
                             <TableHead className="text-xs dark:text-zinc-400 text-center">Actions</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {items.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-xs italic text-gray-400 dark:text-zinc-500 text-center py-4">No line items added yet.</TableCell>
                            </TableRow>
                          ) : (
                            items.map((itm, i) => (
                              <TableRow key={i}>
                                <td className="text-xs font-medium py-2.5 px-3 dark:text-zinc-100">{itm.description}</td>
                                <td className="text-xs font-mono py-2.5 px-3 text-gray-500 dark:text-zinc-400">{itm.hsnSac}</td>
                                <td className="text-xs text-right py-2.5 px-3 dark:text-zinc-100">{itm.qty}</td>
                                <td className="text-xs text-right py-2.5 px-3 dark:text-zinc-100">{curSymbol}{itm.rate.toLocaleString()}</td>
                                <td className="text-xs text-right py-2.5 px-3 dark:text-zinc-100">{itm.gstRate}%</td>
                                <td className="text-xs text-right font-bold py-2.5 px-3 dark:text-zinc-100">{curSymbol}{(itm.qty * itm.rate).toLocaleString()}</td>
                                <td className="text-center py-1 px-3">
                                  <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleRemoveItem(i)}
                                    className="h-7 w-7 text-rose-500 hover:text-white hover:bg-rose-500 rounded-full"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </td>
                              </TableRow>
                            ))
                          )}
                       </TableBody>
                    </Table>

                    {/* Dynamic Addition Row Row */}
                    <div className="p-3 bg-gray-50/50 dark:bg-zinc-800/30 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-4">
                        <input 
                          type="text" 
                          placeholder="consulting, server setup..." 
                          value={itemDesc}
                          onChange={(e) => setItemDesc(e.target.value)}
                          className="w-full text-xs h-9 px-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded dark:text-zinc-100 focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input 
                          type="text" 
                          placeholder="HSN Code" 
                          value={itemHsn}
                          onChange={(e) => setItemHsn(e.target.value)}
                          className="w-full text-xs h-9 px-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded font-mono dark:text-zinc-100 focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <input 
                          type="number" 
                          placeholder="Qty" 
                          value={itemQty}
                          onChange={(e) => setItemQty(parseInt(e.target.value) || 1)}
                          className="w-full text-xs h-9 px-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded text-right dark:text-zinc-100 focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input 
                          type="number" 
                          placeholder="Rate" 
                          value={itemRate}
                          onChange={(e) => setItemRate(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs h-9 px-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded text-right dark:text-zinc-100 focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <CustomSelect
                          value={String(itemGst)}
                          onChange={(val) => setItemGst(parseInt(val) || 18)}
                          options={[
                            { value: '18', label: 'GST 18%' },
                            { value: '12', label: 'GST 12%' },
                            { value: '5', label: 'GST 5%' },
                            { value: '0', label: 'GST Exempt' }
                          ]}
                          className="w-full"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Button 
                          type="button" 
                          size="sm" 
                          className="w-full bg-[#111827] text-white hover:bg-gray-800 dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black h-9"
                          onClick={handleAddItem}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Dyn Tax Split summary presentation */}
               <div className="flex justify-end pt-2 border-t dark:border-zinc-700 text-sm">
                  <div className="w-80 space-y-2 bg-[#111827] text-white p-4 rounded-xl font-mono">
                     <div className="flex justify-between text-white/50 text-[11px] uppercase tracking-wider">
                        <span>Taxable Amount:</span>
                        <span>{curSymbol}{totals.taxableAmount.toLocaleString()}</span>
                     </div>
                     {placeOfSupply.toLowerCase() === gstState.sellerState.toLowerCase() ? (
                       <>
                         <div className="flex justify-between text-[#22C55E] text-xs">
                            <span>CGST (9% split):</span>
                            <span>{curSymbol}{totals.cgst.toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between text-[#22C55E] text-xs pb-2 border-b border-white/10">
                            <span>SGST (9% split):</span>
                            <span>{curSymbol}{totals.sgst.toLocaleString()}</span>
                         </div>
                       </>
                     ) : (
                       <div className="flex justify-between text-indigo-300 text-xs pb-2 border-b border-white/10">
                          <span>IGST (18% Flat):</span>
                          <span>{curSymbol}{totals.igst.toLocaleString()}</span>
                       </div>
                     )}
                     <div className="flex justify-between font-bold text-base text-white pt-1">
                        <span>GRAND TOTAL:</span>
                        <span className="text-[#22C55E]">{curSymbol}{totals.totalAmount.toLocaleString()}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-4 border-t border-gray-150 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex flex-col sm:flex-row justify-between items-center rounded-b-2xl gap-3">
               <div className="text-[10px] text-gray-500 dark:text-zinc-400 italic max-w-sm">
                 * GST breakdown generated based on location constraints. Dispatches trigger automated email and Twilio alerts straight to the master ledger.
               </div>
               <div className="flex gap-2 w-full sm:w-auto justify-end">
                 <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black dark:hover:text-white">Cancel</Button>
                 
                 <Button 
                   className="bg-gray-200 text-gray-800 hover:bg-gray-300 text-xs font-bold" 
                   onClick={() => handleCreateAndSave('Draft')}
                 >
                    Save Draft
                 </Button>

                 <Button 
                   className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black gap-1.5 text-xs font-bold" 
                   onClick={() => handleCreateAndSave('Sent')}
                 >
                    <Send className="h-4 w-4" /> Issue and Dispatch
                 </Button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
