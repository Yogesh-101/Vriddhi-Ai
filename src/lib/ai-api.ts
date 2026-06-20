function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("vriddhi_auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface GstAuditResult {
  score: number;
  passed: boolean;
  issues: Array<{ severity: string; code: string; message: string; field?: string }>;
  summary: string;
  aiEnhanced: boolean;
}

export interface InvoiceDraft {
  clientName?: string;
  clientId?: string;
  dueInDays?: number;
  placeOfSupply?: string;
  items: Array<{
    description: string;
    hsnSac: string;
    qty: number;
    rate: number;
    gstRate: number;
  }>;
  notes?: string;
}

export interface CategorizedRow {
  index: number;
  category: string;
  type: "income" | "expense";
  confidence: number;
  reason: string;
}

export interface ReminderComposeResult {
  emailBody: string;
  whatsappBody: string;
  subject: string;
  level: number;
  aiEnhanced: boolean;
}

export async function auditGstInvoice(invoice: Record<string, unknown>): Promise<GstAuditResult> {
  const res = await fetch("/api/ai/gst-audit", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ invoice }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "GST audit failed");
  return json.data;
}

export async function draftInvoiceFromText(query: string): Promise<InvoiceDraft | null> {
  const res = await fetch("/api/ai/invoice-draft", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Invoice draft failed");
  return json.data;
}

export async function categorizeCsvRows(
  rows: Array<{ index: number; description: string; amount: number; type?: "income" | "expense" }>
): Promise<{ rows: CategorizedRow[]; aiEnhanced: boolean }> {
  const res = await fetch("/api/ai/categorize-csv", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ rows }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Categorization failed");
  return { rows: json.data, aiEnhanced: json.aiEnhanced };
}

export async function composeReminder(ctx: Record<string, unknown>): Promise<ReminderComposeResult> {
  const res = await fetch("/api/ai/compose-reminder", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(ctx),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Compose reminder failed");
  return json.data;
}

export async function askCopilot(payload: {
  query: string;
  metrics: Record<string, unknown>;
  clients?: Array<{ id: string; name: string }>;
}): Promise<{
  answer: string;
  navigateTo: string | null;
  action?: { type: string; params?: Record<string, unknown> };
  invoiceDraft?: InvoiceDraft | null;
  actionResult?: { summary: string; details: unknown[] };
}> {
  const res = await fetch("/api/copilot", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export const INVOICE_DRAFT_EVENT = "vriddhi:invoice-draft";
export const DATA_REFRESH_EVENT = "vriddhi:data-refresh";

export function dispatchInvoiceDraft(draft: InvoiceDraft) {
  window.dispatchEvent(new CustomEvent(INVOICE_DRAFT_EVENT, { detail: draft }));
}

export function dispatchDataRefresh() {
  window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT));
}
