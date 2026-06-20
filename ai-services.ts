import type { GoogleGenAI } from "@google/genai";

/** Free-tier friendly default; override with GEMINI_MODEL in .env */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export const INCOME_CATEGORIES = ["Product Sales", "Services", "Consulting", "Other Income"];
export const EXPENSE_CATEGORIES = ["Salaries", "Rent", "Marketing", "Software", "Utilities", "Vendor Payments"];
export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export const SELLER_STATE = "Maharashtra";
export const SELLER_GSTIN = "27AABCV1234D1Z5";

export interface GstAuditIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  field?: string;
}

export interface GstAuditResult {
  score: number;
  passed: boolean;
  issues: GstAuditIssue[];
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

export type CopilotActionType =
  | "none"
  | "send_overdue_reminders"
  | "mark_invoice_paid"
  | "navigate_only";

export interface CopilotAction {
  type: CopilotActionType;
  params?: Record<string, unknown>;
}

export interface CopilotResponse {
  answer: string;
  navigateTo: string | null;
  action: CopilotAction;
  invoiceDraft: InvoiceDraft | null;
}

export function parseGeminiJson<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleanedMatchJson(text);
    if (match) {
      try {
        return JSON.parse(match) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

function cleanedMatchJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return null;
}

export function validateGstin(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase());
}

export function validateHsnSac(code: string): boolean {
  if (!code) return false;
  return /^[0-9]{4,8}$/.test(code);
}

export function ruleBasedGstAudit(invoice: {
  clientGSTIN?: string;
  placeOfSupply?: string;
  items?: Array<{ description?: string; hsnSac?: string; qty?: number; rate?: number; gstRate?: number }>;
  cgst?: number;
  sgst?: number;
  igst?: number;
  taxableAmount?: number;
  totalAmount?: number;
  date?: string;
  dueDate?: string;
}): GstAuditResult {
  const issues: GstAuditIssue[] = [];

  if (invoice.clientGSTIN && !validateGstin(invoice.clientGSTIN)) {
    issues.push({
      severity: "error",
      code: "INVALID_GSTIN",
      message: "Client GSTIN format is invalid (must be 15-character GSTIN).",
      field: "clientGSTIN",
    });
  }

  if (!invoice.clientGSTIN) {
    issues.push({
      severity: "warning",
      code: "MISSING_GSTIN",
      message: "Client GSTIN is missing — required for B2B GST invoices.",
      field: "clientGSTIN",
    });
  }

  const pos = (invoice.placeOfSupply || "").toLowerCase();
  const isIntrastate = pos === SELLER_STATE.toLowerCase();
  const hasCgst = (invoice.cgst || 0) > 0;
  const hasSgst = (invoice.sgst || 0) > 0;
  const hasIgst = (invoice.igst || 0) > 0;

  if (isIntrastate && hasIgst && !hasCgst) {
    issues.push({
      severity: "error",
      code: "WRONG_TAX_TYPE",
      message: `Place of supply is ${SELLER_STATE} (intra-state) but IGST is applied. Use CGST + SGST instead.`,
      field: "placeOfSupply",
    });
  }

  if (!isIntrastate && pos && (hasCgst || hasSgst) && !hasIgst) {
    issues.push({
      severity: "error",
      code: "WRONG_TAX_TYPE",
      message: "Inter-state supply detected but CGST/SGST applied. Use IGST instead.",
      field: "placeOfSupply",
    });
  }

  if (!invoice.placeOfSupply) {
    issues.push({
      severity: "error",
      code: "MISSING_POS",
      message: "Place of supply is required for GST tax split.",
      field: "placeOfSupply",
    });
  }

  (invoice.items || []).forEach((item, idx) => {
    if (!item.description?.trim()) {
      issues.push({
        severity: "error",
        code: "EMPTY_DESCRIPTION",
        message: `Line item ${idx + 1} has no description.`,
        field: `items[${idx}].description`,
      });
    }
    if (!validateHsnSac(item.hsnSac || "")) {
      issues.push({
        severity: "warning",
        code: "INVALID_HSN",
        message: `Line item ${idx + 1}: HSN/SAC "${item.hsnSac || ""}" should be 4–8 digits.`,
        field: `items[${idx}].hsnSac`,
      });
    }
    if ((item.qty || 0) <= 0 || (item.rate || 0) <= 0) {
      issues.push({
        severity: "error",
        code: "INVALID_AMOUNT",
        message: `Line item ${idx + 1}: quantity and rate must be positive.`,
        field: `items[${idx}]`,
      });
    }
    const desc = (item.description || "").toLowerCase();
    if ((item.gstRate || 0) === 0 && !desc.includes("exempt")) {
      issues.push({
        severity: "info",
        code: "ZERO_GST",
        message: `Line item ${idx + 1} has 0% GST — confirm this is exempt or nil-rated.`,
        field: `items[${idx}].gstRate`,
      });
    }
  });

  if (invoice.date && invoice.dueDate && new Date(invoice.dueDate) < new Date(invoice.date)) {
    issues.push({
      severity: "error",
      code: "INVALID_DUE_DATE",
      message: "Due date cannot be before invoice date.",
      field: "dueDate",
    });
  }

  if ((invoice.items || []).length === 0) {
    issues.push({
      severity: "error",
      code: "NO_ITEMS",
      message: "Invoice must have at least one line item.",
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 8 - issues.filter((i) => i.severity === "info").length * 2);
  const passed = errorCount === 0 && score >= 70;

  return {
    score,
    passed,
    issues,
    summary:
      errorCount === 0
        ? warningCount === 0
          ? "Invoice passes GST compliance checks."
          : `Invoice passes with ${warningCount} warning(s) to review.`
        : `${errorCount} compliance error(s) must be fixed before issuing.`,
    aiEnhanced: false,
  };
}

export async function enhanceGstAuditWithAi(
  ai: GoogleGenAI,
  invoice: Record<string, unknown>,
  base: GstAuditResult
): Promise<GstAuditResult> {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `You are an Indian GST compliance auditor. Review this invoice draft and add any additional compliance issues.
Seller state: ${SELLER_STATE}, Seller GSTIN: ${SELLER_GSTIN}.
Invoice: ${JSON.stringify(invoice)}
Existing issues: ${JSON.stringify(base.issues)}

Return ONLY JSON:
{"additionalIssues":[{"severity":"error"|"warning"|"info","code":"CODE","message":"...","field":"optional"}],"summary":"one sentence"}`,
    });
    const parsed = parseGeminiJson<{ additionalIssues?: GstAuditIssue[]; summary?: string }>(
      response.text || "{}",
      {}
    );
    const merged = [...base.issues];
    for (const issue of parsed.additionalIssues || []) {
      if (!merged.some((m) => m.code === issue.code && m.message === issue.message)) {
        merged.push(issue);
      }
    }
    const errorCount = merged.filter((i) => i.severity === "error").length;
    const warningCount = merged.filter((i) => i.severity === "warning").length;
    const score = Math.max(0, 100 - errorCount * 20 - warningCount * 8);
    return {
      score,
      passed: errorCount === 0 && score >= 70,
      issues: merged,
      summary: parsed.summary || base.summary,
      aiEnhanced: true,
    };
  } catch {
    return base;
  }
}

export function ruleBasedInvoiceDraft(
  query: string,
  clients: Array<{ id: string; name: string; state?: string; gstin?: string }>
): InvoiceDraft | null {
  const norm = query.toLowerCase();
  if (
    !norm.includes("invoice") &&
    !norm.includes("bill") &&
    !norm.includes("create") &&
    !norm.includes("raise") &&
    !norm.includes("generate")
  ) {
    return null;
  }

  let client = clients.find((c) => norm.includes(c.name.toLowerCase()));
  if (!client) {
    for (const c of clients) {
      const first = c.name.split(" ")[0].toLowerCase();
      if (first.length > 3 && norm.includes(first)) {
        client = c;
        break;
      }
    }
  }

  const hoursMatch = norm.match(/(\d+)\s*(?:hours?|hrs?|h\b)/);
  const rateMatch =
    norm.match(/(?:@|at|rate)\s*[₹rs.]?\s*([\d,]+)/i) ||
    norm.match(/([\d,]+)\s*(?:\/hr|per hour|per hr)/i) ||
    norm.match(/at\s+([\d,]+)\s*(?:rupees|rs|inr)?/i);
  const amountMatch = norm.match(/[₹rs.]?\s*([\d,]+(?:\.\d+)?)\s*(?:lakh|lac|k)?/i);
  const daysMatch = norm.match(/(?:due|within|in)\s*(\d+)\s*days?/);

  let qty = 1;
  let rate = 100000;
  let desc = "Professional Services";

  if (hoursMatch) {
    qty = parseInt(hoursMatch[1], 10);
    desc = "Consulting Services";
  }
  if (rateMatch) {
    rate = parseFloat(rateMatch[1].replace(/,/g, ""));
  } else if (amountMatch && !hoursMatch) {
    rate = parseFloat(amountMatch[1].replace(/,/g, ""));
  }

  if (norm.includes("consult")) desc = "Consulting Services";
  if (norm.includes("software") || norm.includes("saas")) desc = "Software Subscription";
  if (norm.includes("development") || norm.includes("dev")) desc = "Software Development Services";

  return {
    clientName: client?.name,
    clientId: client?.id,
    placeOfSupply: client?.state || SELLER_STATE,
    dueInDays: daysMatch ? parseInt(daysMatch[1], 10) : 15,
    items: [{ description: desc, hsnSac: "998314", qty, rate, gstRate: 18 }],
    notes: "Draft generated from natural language command.",
  };
}

export async function geminiInvoiceDraft(
  ai: GoogleGenAI,
  query: string,
  clients: Array<{ id: string; name: string; state?: string; gstin?: string; type?: string }>
): Promise<InvoiceDraft | null> {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
    contents: `Parse this natural language invoice request for an Indian GST SMB app.
Clients: ${JSON.stringify(clients.filter((c) => c.type !== "Vendor").slice(0, 20))}
Query: "${query}"

Return ONLY JSON (null fields ok):
{
  "clientName": "matched client name or null",
  "clientId": "id from list or null",
  "placeOfSupply": "Indian state name",
  "dueInDays": 15,
  "items": [{"description":"...","hsnSac":"998314","qty":1,"rate":50000,"gstRate":18}],
  "notes": "brief note"
}
If not an invoice creation request, return {"items":[]}`,
  });
  const parsed = parseGeminiJson<InvoiceDraft>(response.text || "{}", { items: [] });
  if (!parsed.items?.length) return null;

  if (!parsed.clientId && parsed.clientName) {
    const match = clients.find((c) => c.name.toLowerCase() === parsed.clientName!.toLowerCase());
    if (match) parsed.clientId = match.id;
  }
  return parsed;
  } catch {
    return null;
  }
}

function heuristicCategory(description: string, isWithdrawal: boolean): CategorizedRow {
  const desc = description.toLowerCase();
  let category = isWithdrawal ? "Vendor Payments" : "Other Income";
  let type: "income" | "expense" = isWithdrawal ? "expense" : "income";
  let confidence = 72;
  let reason = "Keyword heuristic match";

  if (isWithdrawal) {
    if (/salary|payroll|employee|wages/.test(desc)) {
      category = "Salaries";
      confidence = 91;
      reason = "Payroll keywords detected";
    } else if (/rent|office|lease|wework/.test(desc)) {
      category = "Rent";
      confidence = 88;
      reason = "Rent/lease keywords detected";
    } else if (/marketing|ads|google ads|campaign|seo/.test(desc)) {
      category = "Marketing";
      confidence = 86;
      reason = "Marketing spend pattern";
    } else if (/aws|gcp|azure|software|saas|cloud|github|hosting/.test(desc)) {
      category = "Software";
      confidence = 90;
      reason = "Software/cloud vendor pattern";
    } else if (/utility|electricity|internet|telecom|broadband/.test(desc)) {
      category = "Utilities";
      confidence = 84;
      reason = "Utility bill pattern";
    }
  } else {
    if (/consult|advisory|retainer/.test(desc)) {
      category = "Consulting";
      confidence = 89;
      reason = "Consulting revenue pattern";
    } else if (/service|development|project|integration/.test(desc)) {
      category = "Services";
      confidence = 85;
      reason = "Service revenue pattern";
    } else if (/product|sales|invoice/.test(desc)) {
      category = "Product Sales";
      confidence = 80;
      reason = "Product sales pattern";
    }
  }

  return { index: 0, category, type, confidence, reason };
}

export function ruleBasedCategorizeRows(
  rows: Array<{ index: number; description: string; amount: number; type?: "income" | "expense" }>
): CategorizedRow[] {
  return rows.map((row) => {
    const isWithdrawal = row.type === "expense" || row.amount < 0;
    const result = heuristicCategory(row.description, isWithdrawal);
    return { ...result, index: row.index };
  });
}

export async function geminiCategorizeRows(
  ai: GoogleGenAI,
  rows: Array<{ index: number; description: string; amount: number; type?: "income" | "expense" }>
): Promise<CategorizedRow[]> {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
    contents: `Categorize these Indian bank statement transactions.
Income categories: ${INCOME_CATEGORIES.join(", ")}
Expense categories: ${EXPENSE_CATEGORIES.join(", ")}

Rows: ${JSON.stringify(rows.slice(0, 50))}

Return ONLY JSON array:
[{"index":0,"category":"Software","type":"expense","confidence":92,"reason":"AWS cloud billing"}]`,
  });
  const parsed = parseGeminiJson<CategorizedRow[]>(response.text || "[]", []);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return ruleBasedCategorizeRows(rows);
  }
  return parsed.map((r) => ({
    ...r,
    category: ALL_CATEGORIES.includes(r.category)
      ? r.category
      : r.type === "expense"
        ? "Vendor Payments"
        : "Other Income",
    confidence: Math.min(100, Math.max(0, r.confidence || 75)),
  }));
  } catch {
    return ruleBasedCategorizeRows(rows);
  }
}

export function ruleBasedReminderCompose(ctx: {
  type: "reminder" | "escalation" | "delivery";
  level?: number;
  invoiceId: string;
  clientName: string;
  amount: number;
  dueDate?: string;
  daysOverdue?: number;
}): ReminderComposeResult {
  const level = ctx.level || 1;
  const amt = ctx.amount.toLocaleString("en-IN");
  const overdue = ctx.daysOverdue || 0;

  if (ctx.type === "delivery") {
    return {
      level: 0,
      aiEnhanced: false,
      subject: `Tax Invoice ${ctx.invoiceId} from Vriddhi.Ai`,
      emailBody: `Dear ${ctx.clientName},\n\nPlease find attached GST Tax Invoice ${ctx.invoiceId} for ₹${amt}.\n\nDue date: ${ctx.dueDate || "As per terms"}\n\nThank you for your business.\n\nRegards,\nVriddhi.Ai Accounts Team`,
      whatsappBody: `Vriddhi.Ai: Invoice ${ctx.invoiceId} for ₹${amt} has been issued. Due: ${ctx.dueDate || "per terms"}. Reply for PDF/copy.`,
    };
  }

  if (ctx.type === "escalation") {
    const tones: Record<number, { subject: string; email: string; wa: string }> = {
      1: {
        subject: `Payment Reminder — Invoice ${ctx.invoiceId}`,
        email: `Dear ${ctx.clientName},\n\nThis is a friendly reminder that Invoice ${ctx.invoiceId} for ₹${amt} was due on ${ctx.dueDate}. It is now ${overdue} day(s) overdue.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\nVriddhi.Ai`,
        wa: `Hi ${ctx.clientName}, gentle reminder: Invoice ${ctx.invoiceId} (₹${amt}) is ${overdue}d overdue. Please settle soon. — Vriddhi.Ai`,
      },
      2: {
        subject: `URGENT: Overdue Invoice ${ctx.invoiceId}`,
        email: `Dear ${ctx.clientName},\n\nInvoice ${ctx.invoiceId} for ₹${amt} is ${overdue} days overdue. Per our agreement, late payment charges may apply.\n\nPlease confirm payment date within 48 hours.\n\nVriddhi.Ai Accounts`,
        wa: `URGENT: Invoice ${ctx.invoiceId} — ₹${amt} overdue ${overdue} days. Confirm payment within 48hrs to avoid penalties. Vriddhi.Ai`,
      },
      3: {
        subject: `FINAL NOTICE: Invoice ${ctx.invoiceId}`,
        email: `Dear ${ctx.clientName},\n\nFINAL NOTICE: Invoice ${ctx.invoiceId} (₹${amt}) remains unpaid after ${overdue} days. Legal recovery proceedings may be initiated without further notice.\n\nImmediate settlement required.\n\nVriddhi.Ai Legal & Accounts`,
        wa: `FINAL NOTICE: Invoice ${ctx.invoiceId} ₹${amt} — ${overdue}d overdue. Immediate payment required. Contact accounts@vriddhi.ai`,
      },
    };
    const t = tones[Math.min(3, Math.max(1, level)) as 1 | 2 | 3];
    return { level, aiEnhanced: false, subject: t.subject, emailBody: t.email, whatsappBody: t.wa };
  }

  return {
    level: 1,
    aiEnhanced: false,
    subject: `Payment Reminder — Invoice ${ctx.invoiceId}`,
    emailBody: `Dear ${ctx.clientName},\n\nReminder: Invoice ${ctx.invoiceId} for ₹${amt} is pending. Due date: ${ctx.dueDate}.\n\nRegards,\nVriddhi.Ai`,
    whatsappBody: `Reminder: Invoice ${ctx.invoiceId} ₹${amt} pending. Due ${ctx.dueDate}. — Vriddhi.Ai`,
  };
}

export async function geminiReminderCompose(
  ai: GoogleGenAI,
  ctx: Parameters<typeof ruleBasedReminderCompose>[0]
): Promise<ReminderComposeResult> {
  const base = ruleBasedReminderCompose(ctx);
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Write personalized Indian B2B payment messages for:
${JSON.stringify(ctx)}

Return ONLY JSON:
{
  "subject": "email subject",
  "emailBody": "professional email, under 120 words, use ₹",
  "whatsappBody": "under 280 chars, no markdown",
  "level": ${ctx.level || 1}
}`,
    });
    const parsed = parseGeminiJson<Omit<ReminderComposeResult, "aiEnhanced">>(response.text || "{}", base);
    return { ...base, ...parsed, aiEnhanced: true };
  } catch {
    return base;
  }
}

export function buildDemoCopilotResponse(query: string, metrics: Record<string, unknown>): CopilotResponse {
  const norm = (query || "").toLowerCase();
  let navigateTo: string | null = null;
  let action: CopilotAction = { type: "none" };
  let invoiceDraft: InvoiceDraft | null = null;

  if (norm.includes("dashboard") || norm.includes("overview")) navigateTo = "dashboard";
  else if (norm.includes("invoice") && !norm.includes("create") && !norm.includes("raise")) navigateTo = "invoices";
  else if (norm.includes("transaction")) navigateTo = "transactions";
  else if (norm.includes("receivable") || norm.includes("payable")) navigateTo = "receivables";
  else if (norm.includes("client")) navigateTo = "clients";
  else if (norm.includes("settings") || norm.includes("admin")) navigateTo = "settings";
  else if (norm.includes("forecast") || norm.includes("cash flow")) navigateTo = "reports";
  else if (norm.includes("ocr") || norm.includes("receipt")) navigateTo = "documents";

  if (norm.includes("reminder") && (norm.includes("overdue") || norm.includes("send"))) {
    action = {
      type: "send_overdue_reminders",
      params: {
        minAmount: norm.match(/(\d+)\s*(?:lakh|lac)/)
          ? parseInt(norm.match(/(\d+)\s*(?:lakh|lac)/)![1], 10) * 100000
          : norm.match(/above\s*[₹rs.]?\s*([\d,]+)/i)
            ? parseFloat(norm.match(/above\s*[₹rs.]?\s*([\d,]+)/i)![1].replace(/,/g, ""))
            : 0,
      },
    };
  }

  if (norm.includes("mark") && norm.includes("paid")) {
    const idMatch = norm.match(/inv[- ]?\d{4}[- ]?\d+/i);
    if (idMatch) {
      action = { type: "mark_invoice_paid", params: { invoiceId: idMatch[0].toUpperCase().replace(/\s/g, "-") } };
    }
  }

  if (norm.includes("create") || norm.includes("raise") || norm.includes("generate")) {
    if (norm.includes("invoice") || norm.includes("bill")) {
      navigateTo = "invoices";
      invoiceDraft = {
        dueInDays: 15,
        placeOfSupply: SELLER_STATE,
        items: [{ description: "Consulting Services", hsnSac: "998314", qty: 40, rate: 5000, gstRate: 18 }],
        notes: "Demo draft — configure GEMINI_API_KEY for smarter parsing.",
      };
    }
  }

  const rev = metrics?.revenue || "N/A";
  let answer = `Revenue: **${rev}**. Ask me to create invoices, send overdue reminders, or navigate anywhere.`;
  if (action.type === "send_overdue_reminders") {
    answer = "I'll dispatch AI-composed payment reminders for all qualifying overdue invoices.";
  } else if (action.type === "mark_invoice_paid") {
    answer = `Marking invoice **${action.params?.invoiceId}** as Paid.`;
  } else if (invoiceDraft) {
    answer = "I've prepared an invoice draft from your request. Review it in the GST Invoices workspace.";
  } else if (navigateTo) {
    answer = `Opening **${navigateTo}** workspace.`;
  }

  return { answer, navigateTo, action, invoiceDraft };
}
