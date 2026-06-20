import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Trash2, Building, Mail, Phone, MapPin, Sparkles } from 'lucide-react';
import { CustomSelect } from './ui/Select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../context/AuthContext';

export function Clients() {
  const { user } = useAuth();
  const [clientsVendors, setClientsVendors] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('clients').select('*');
      if (data) setClientsVendors(data);
    }
    load();
  }, [user?.uid]);
  
  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('invoices').select('*');
      if (data) setInvoices(data);
    }
    load();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase.from('transactions').select('*');
      if (data) setTransactions(data);
    }
    load();
  }, [user?.uid]);

  const addClientVendor = async (cv: any) => {
    const { data } = await supabase.from('clients').insert(cv).select();
    if (data && data[0]) {
      setClientsVendors(prev => [data[0], ...prev]);
    } else {
      // Local state fallback in case of database sync lag
      setClientsVendors(prev => [{ id: `cv-${Math.random().toString(36).substr(2, 9)}`, ...cv }, ...prev]);
    }
  };
    
  const deleteClientVendor = async (id: string) => {
    await supabase.from('clients').delete().eq('id', id);
    setClientsVendors(prev => prev.filter(c => c.id !== id));
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Search query
  const [search, setSearch] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'Client' | 'Vendor'>('Client');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [state, setState] = useState('Maharashtra');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !gstin) {
      alert("Name and GSTIN tax details are required.");
      return;
    }

    await addClientVendor({
      name,
      type,
      gstin,
      phone: phone || '+91 99999 88888',
      email: email || 'billing@firm.in',
      billingAddress: billingAddress || 'Corporate Suite, BKC Multi block',
      state
    });

    // Reset fields
    setIsModalOpen(false);
    setName('');
    setGstin('');
    setPhone('');
    setEmail('');
    setBillingAddress('');
    setState('Maharashtra');
  };

  // Dynamically calculate company balance using transaction and invoice values
  const clientBalances = useMemo(() => {
    const balanceMap: { [key: string]: number } = {};

    // Initialize all master records to zero
    clientsVendors.forEach(cv => {
      balanceMap[cv.id] = 0;
    });

    // Income transaction adds positive, Expense transaction adds negative to vendor
    transactions.forEach(t => {
      if (t.entityId && balanceMap[t.entityId] !== undefined) {
        if (t.type === 'income') {
          // If transaction is outstanding (e.g. pending receivable)
          if (t.status === 'pending') {
            balanceMap[t.entityId] += t.amount;
          }
        } else {
          // If expense with outstanding payables
          if (t.status === 'pending') {
            balanceMap[t.entityId] -= Math.abs(t.amount);
          }
        }
      }
    });

    // Unpaid/Overdue invoices contribute to outstanding Client balances
    invoices.forEach(inv => {
      if (balanceMap[inv.clientId] !== undefined) {
        if (inv.status !== 'Paid' && inv.status !== 'Draft') {
          balanceMap[inv.clientId] += inv.totalAmount;
        }
      }
    });

    return balanceMap;
  }, [clientsVendors, transactions, invoices]);

  // Filter clients
  const finalFiltered = useMemo(() => {
    return clientsVendors.filter(cv => {
      const matchName = cv.name.toLowerCase().includes(search.toLowerCase());
      const matchGstin = cv.gstin.toLowerCase().includes(search.toLowerCase());
      return matchName || matchGstin;
    });
  }, [clientsVendors, search]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-[#111827] dark:text-zinc-50">Master Accounts Database</h2>
          <p className="text-[#6B7280] dark:text-zinc-400 mt-1">Manage master records for clients, vendors, GSTIN profiles, and contact details.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black">
          <Plus className="mr-2 h-4 w-4" /> Add Master Record
        </Button>
      </div>

      <Card className="shadow-sm bg-white dark:bg-zinc-900 border-[#E5E7EB] dark:border-zinc-800 text-[#111827] dark:text-zinc-100">
        <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pb-4 border-b gap-4">
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] dark:text-zinc-500" />
            <Input 
              placeholder="Search by registered name or GSTIN..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-gray-50 border-[#E5E7EB] dark:bg-zinc-950 dark:border-zinc-800 text-[#111827] dark:text-zinc-200 text-xs" 
            />
          </div>
          <Badge className="bg-indigo-50 dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 border border-indigo-150 py-1 select-none">
            {clientsVendors.length} Profiles Registered
          </Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50">
                  <TableHead className="text-[#6B7280]">Registered Entity Name</TableHead>
                  <TableHead className="text-[#6B7280]">Type</TableHead>
                  <TableHead className="text-[#6B7280]">GSTIN Number</TableHead>
                  <TableHead className="text-[#6B7280]">Billing State</TableHead>
                  <TableHead className="text-[#6B7280]">Contact Details</TableHead>
                  <TableHead className="text-[#6B7280] text-right">Outstanding (₹)</TableHead>
                  <TableHead className="text-[#6B7280] text-center">Controls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalFiltered.map((client) => {
                  const outstandingBalance = clientBalances[client.id] || 0;
                  return (
                    <TableRow key={client.id} className="border-[#E5E7EB] dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-950">
                      <TableCell className="font-semibold text-[#111827] dark:text-zinc-200">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gray-50 dark:bg-zinc-950 border flex items-center justify-center">
                            <Building className="h-4.5 w-4.5 text-[#111827] dark:text-zinc-400" />
                          </div>
                          <div>
                            <span className="block">{client.name}</span>
                            <span className="text-[10px] text-gray-500 font-normal leading-tight block truncate max-w-[200px]" title={client.billingAddress}>
                              <MapPin className="h-3 w-3 inline mr-0.5 text-[#6B7280]" />
                              {client.billingAddress}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          client.type === 'Client' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {client.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-[#6B7280] dark:text-zinc-300 font-mono text-xs">{client.gstin}</TableCell>
                      <TableCell className="text-[#111827] dark:text-zinc-200 text-xs font-semibold">{client.state}</TableCell>
                      <TableCell>
                        <div className="text-xs text-[#111827] dark:text-zinc-300 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-[#6B7280]" /> {client.email}</div>
                          <div className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-[#6B7280]" /> {client.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold text-xs ${
                        outstandingBalance > 0 ? 'text-amber-600' : (outstandingBalance < 0 ? 'text-[#22C55E]' : 'text-zinc-400')
                      }`}>
                        {outstandingBalance > 0 ? `+` : ``}₹{outstandingBalance.toLocaleString()}
                        <div className="text-[9px] font-normal text-gray-500">
                          {outstandingBalance > 0 ? 'Awaiting credit' : outstandingBalance < 0 ? 'Awaiting payout' : 'Settled balance'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteClientVendor(client.id)}
                          className="text-[#6B7280] hover:text-[#22C55E] hover:bg-rose-50 rounded-full h-8 w-8"
                          title="Administrative Delete Profile"
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
          <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[#111827] dark:text-zinc-50 border-b dark:border-zinc-800 pb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              Register New Master Record
            </h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Registered Company Name *</label>
              <Input 
                placeholder="Acme Corp, Freshworks Inc..."
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-gray-50 dark:bg-zinc-950 border-[#E5E7EB] dark:border-zinc-800 text-sm text-[#111827] dark:text-zinc-100" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Entity Classification</label>
                <CustomSelect 
                  value={type}
                  onChange={(val: any) => setType(val)}
                  options={[
                    { value: 'Client', label: 'Client (B2B Buyer)' },
                    { value: 'Vendor', label: 'Vendor (Payout Account)' }
                  ]}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">GSTIN Code *</label>
                <Input 
                  placeholder="27AADCA8955F1Z5" 
                  required
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="bg-gray-50 dark:bg-zinc-950 border-[#E5E7EB] dark:border-zinc-800 text-xs font-mono text-[#111827] dark:text-zinc-100" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Registered State *</label>
                <CustomSelect 
                  value={state}
                  onChange={(val) => setState(val)}
                  options={[
                    { value: 'Maharashtra', label: 'Maharashtra (27)' },
                    { value: 'Telangana', label: 'Telangana (36)' },
                    { value: 'Tamil Nadu', label: 'Tamil Nadu (33)' },
                    { value: 'Karnataka', label: 'Karnataka (29)' },
                    { value: 'Delhi', label: 'Delhi (07)' }
                  ]}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Email Contact</label>
                <Input 
                  type="email" 
                  placeholder="finance@acme.co" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-50 dark:bg-zinc-950 border-[#E5E7EB] dark:border-zinc-800 text-xs text-[#111827] dark:text-zinc-100" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Mobile contact (Twilio alerts)</label>
              <Input 
                type="text" 
                placeholder="+91 9876543210" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-gray-50 dark:bg-zinc-950 border-[#E5E7EB] dark:border-zinc-800 text-xs font-mono text-[#111827] dark:text-zinc-100" 
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Billing Address</label>
              <Input 
                placeholder="Unit 14B, Hitech Business Tower, Mumbai" 
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                className="bg-gray-50 dark:bg-zinc-950 border-[#E5E7EB] dark:border-zinc-800 text-xs text-[#111827] dark:text-zinc-100" 
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black dark:hover:text-zinc-100">Cancel</Button>
              <Button type="submit" className="bg-[#111827] hover:bg-gray-800 text-white dark:bg-[#22C55E] dark:hover:bg-[#16a34a] dark:text-black font-bold">Register Entity</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
