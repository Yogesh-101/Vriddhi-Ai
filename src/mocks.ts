export const REVENUE_DATA = [
  { name: 'Jan', value: 120000 },
  { name: 'Feb', value: 180000 },
  { name: 'Mar', value: 150000 },
  { name: 'Apr', value: 210000 },
  { name: 'May', value: 260000 },
  { name: 'Jun', value: 320000 },
];

export const EXPENSE_DATA = [
  { name: 'Rent', value: 50000 },
  { name: 'Salary', value: 150000 },
  { name: 'Marketing', value: 40000 },
  { name: 'Software', value: 15000 },
  { name: 'Travel', value: 20000 },
];

export const RECENT_TRANSACTIONS = [
  { id: '1', date: '2023-10-25', description: 'Acme Corp Consulting', amount: 50000, type: 'income', status: 'paid' },
  { id: '2', date: '2023-10-24', description: 'AWS Hosting', amount: -15000, type: 'expense', status: 'paid' },
  { id: '3', date: '2023-10-22', description: 'Stark Industries Invoice', amount: 120000, type: 'income', status: 'pending' },
  { id: '4', date: '2023-10-20', description: 'WeWork Office Rent', amount: -60000, type: 'expense', status: 'paid' },
];

export const INVOICES = [
  { id: 'INV-2023-001', client: 'Acme Corp', amount: 50000, date: '2023-10-01', status: 'Paid', dueDate: '2023-10-15' },
  { id: 'INV-2023-002', client: 'Stark Ind.', amount: 120000, date: '2023-10-10', status: 'Overdue', dueDate: '2023-10-20' },
  { id: 'INV-2023-003', client: 'Wayne Ent.', amount: 85000, date: '2023-10-24', status: 'Pending', dueDate: '2023-11-05' },
];

export const CASH_FLOW_FORECAST_DATA = [
  { days: '30 Days', expectedInflow: 450000, expectedOutflow: 280000, netCashFlow: 170000 },
  { days: '60 Days', expectedInflow: 820000, expectedOutflow: 570000, netCashFlow: 250000 },
  { days: '90 Days', expectedInflow: 1350000, expectedOutflow: 840000, netCashFlow: 510000 },
];
