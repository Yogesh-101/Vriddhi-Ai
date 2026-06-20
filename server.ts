import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createRequire } from "module";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import {
  readTable,
  insertRecords,
  updateRecords,
  deleteRecords,
  migrateFromJsonIfNeeded,
  seedDatabase,
} from "./database";
import { dispatchNotifications, notificationsLiveStatus } from "./notifications";
import {
  buildDemoCopilotResponse,
  enhanceGstAuditWithAi,
  geminiCategorizeRows,
  geminiInvoiceDraft,
  geminiReminderCompose,
  ruleBasedCategorizeRows,
  ruleBasedGstAudit,
  ruleBasedInvoiceDraft,
  ruleBasedReminderCompose,
  parseGeminiJson,
  type CopilotResponse,
  GEMINI_MODEL,
} from "./ai-services";

const _require = createRequire(path.join(process.cwd(), "package.json"));

dotenv.config();

migrateFromJsonIfNeeded();

const JWT_SECRET = process.env.JWT_SECRET || "vriddhi_super_secret_jwt_key_2026";
const DEFAULT_PASSWORD = "password123";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + JWT_SECRET).digest("hex");
}

const apiKey = process.env.GEMINI_API_KEY?.trim();
const isDummyKey = !apiKey;
const ai = !isDummyKey ? new GoogleGenAI({ apiKey: apiKey! }) : null;
if (isDummyKey) {
  console.warn("⚠️  GEMINI_API_KEY is dummy or not set — AI OCR and Copilot endpoints will return mock responses.");
}

function readDb(): Record<string, any[]> {
  const tables = ["users", "clients", "transactions", "invoices", "budgets", "notification_logs", "contact_requests"];
  const db: Record<string, any[]> = {};
  for (const t of tables) db[t] = readTable(t);
  return db;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json({ limit: "50mb" }));

  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      (req as any).user = decoded;
      next();
    } catch (err) {
      res.status(403).json({ error: "Invalid or expired token." });
    }
  };

  // MVP API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/status", (_req, res) => {
    res.json({
      status: "ok",
      database: "sqlite",
      notifications: notificationsLiveStatus(),
      ai: Boolean(ai),
      aiModel: GEMINI_MODEL,
      appUrl: process.env.APP_URL || null,
    });
  });

  app.post("/api/reseed", authenticateToken, (_req, res) => {
    try {
      seedDatabase();
      res.json({ status: "ok", message: "SQLite database re-seeded" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Public contact form — no auth required
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, company, message } = req.body;
      if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required." });
      }
      const record = {
        id: `cr-${Date.now()}`,
        name,
        email,
        company: company || "",
        message,
        submitted_at: new Date().toISOString(),
      };
      insertRecords("contact_requests", [record]);

      const results = await dispatchNotifications({
        type: "contact",
        message: `New demo request from ${name} (${email}) at ${company || "N/A"}:\n\n${message}`,
        channels: ["Email", "WhatsApp"],
        recipientEmail: process.env.ADMIN_EMAIL || email,
        clientName: name,
      });

      const logEntries = results.map((r, i) => ({
        id: `ntf-contact-${Date.now()}-${i}`,
        timestamp: new Date().toISOString(),
        type: "contact",
        invoiceId: "",
        clientName: name,
        message: r.detail,
        destination: r.channel,
        status: r.status === "delivered" ? "delivered" : r.status,
        simulated: r.status === "simulated",
      }));
      insertRecords("notification_logs", logEntries);

      res.json({ data: record, error: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notifications/test", authenticateToken, async (req, res) => {
    try {
      const to =
        req.body?.recipientEmail ||
        process.env.ADMIN_EMAIL ||
        (req as any).user?.email;
      if (!to) {
        return res.status(400).json({ error: "No recipient email. Set ADMIN_EMAIL or pass recipientEmail." });
      }

      const results = await dispatchNotifications({
        type: "welcome",
        message: `SMTP test from Vriddhi.Ai at ${new Date().toISOString()}. If you received this, email notifications are working.`,
        channels: ["Email"],
        recipientEmail: to,
        clientName: "SMTP Test",
      });

      const emailResult = results.find((r) => r.channel === "Email");
      res.json({
        data: {
          recipient: to,
          configured: notificationsLiveStatus().email,
          result: emailResult,
        },
        error: emailResult?.status === "failed" ? emailResult.detail : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notifications/test-whatsapp", authenticateToken, async (req, res) => {
    try {
      const phone = req.body?.recipientPhone || process.env.TWILIO_WHATSAPP_DEFAULT_TO;
      if (!phone) {
        return res.status(400).json({
          error: "Pass recipientPhone or set TWILIO_WHATSAPP_DEFAULT_TO in .env (your sandbox-joined number).",
        });
      }

      const results = await dispatchNotifications({
        type: "welcome",
        message: `WhatsApp test from Vriddhi.Ai at ${new Date().toISOString()}. Sandbox delivery confirmed.`,
        channels: ["WhatsApp"],
        recipientPhone: phone,
        clientName: "WhatsApp Test",
      });

      const waResult = results.find((r) => r.channel === "WhatsApp");
      res.json({
        data: {
          recipient: phone,
          configured: notificationsLiveStatus().whatsapp,
          result: waResult,
        },
        error: waResult?.status === "failed" ? waResult.detail : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notifications/send", authenticateToken, async (req, res) => {
    try {
      const { type, message, channels, recipientEmail, recipientPhone, invoiceId, clientName, emailBody, whatsappBody, subject } = req.body;
      const results = await dispatchNotifications({
        type: type || "delivery",
        message,
        channels: channels || ["Email", "WhatsApp"],
        recipientEmail,
        recipientPhone,
        invoiceId,
        clientName,
        emailBody,
        whatsappBody,
        subject,
      });

      const logs = results.map((r, i) => ({
        id: `ntf-${Date.now()}-${i}`,
        timestamp: new Date().toISOString(),
        type: type || "delivery",
        invoiceId: invoiceId || "",
        clientName: clientName || "",
        message: r.detail,
        destination: r.channel,
        status: r.status === "delivered" ? "delivered" : r.status,
        simulated: r.status === "simulated",
      }));
      insertRecords("notification_logs", logs);
      res.json({ data: logs, results, error: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DB API Routes — SQLite-backed persistence
  app.get("/api/db/:table", authenticateToken, (req, res) => {
    const table = req.params.table;
    res.json({ data: readTable(table), error: null });
  });

  app.post("/api/db/:table", authenticateToken, (req, res) => {
    const table = req.params.table;
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const newItems = insertRecords(table, items);
    res.json({ data: newItems, error: null });
  });

  app.put("/api/db/:table/:column/:value", authenticateToken, (req, res) => {
    const { table, column, value } = req.params;
    const updatedItems = updateRecords(table, column, decodeURIComponent(value), req.body);
    res.json({ data: updatedItems, count: updatedItems.length, error: null });
  });

  app.delete("/api/db/:table/:column/:value", authenticateToken, (req, res) => {
    const { table, column, value } = req.params;
    const deleted = deleteRecords(table, column, decodeURIComponent(value));
    res.json({ data: deleted, error: null });
  });

  // Auth endpoints
  app.post("/api/auth/signup", async (req, res) => {
    const users = readTable("users");
    const { email, password, options } = req.body;
    const normalizedEmail = email.toLowerCase();
    const existing = users.find((u: any) => u.email === normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const user = {
      id: `usr-${Math.random().toString(36).substr(2, 9)}`,
      email: normalizedEmail,
      password_hash: hashPassword(password || DEFAULT_PASSWORD),
      name: options?.data?.name || '',
      company_name: options?.data?.company_name || '',
      role: options?.data?.role || 'Founder',
      created_at: new Date().toISOString()
    };
    insertRecords("users", [user]);

    dispatchNotifications({
      type: "welcome",
      message: `Welcome ${user.name}! Your Vriddhi.Ai workspace for ${user.company_name || 'your company'} is ready. Role: ${user.role}.`,
      channels: ["Email", "WhatsApp"],
      recipientEmail: user.email,
      clientName: user.name,
    }).then((results) => {
      const logs = results.map((r, i) => ({
        id: `ntf-welcome-${Date.now()}-${i}`,
        timestamp: new Date().toISOString(),
        type: "welcome",
        invoiceId: "",
        clientName: user.name,
        message: r.detail,
        destination: r.channel,
        status: r.status === "delivered" ? "delivered" : r.status,
        simulated: r.status === "simulated",
      }));
      insertRecords("notification_logs", logs);
    }).catch(() => {});

    const authUser = {
      id: user.id,
      email: user.email,
      user_metadata: {
        name: user.name,
        company_name: user.company_name,
        role: user.role
      }
    };
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ data: { user: authUser, session: { access_token: token } }, error: null });
  });

  app.post("/api/auth/login", (req, res) => {
    const users = readTable("users");
    const { email, password } = req.body;
    const user = users.find((u: any) => u.email === email.toLowerCase());
    if (!user) {
      return res.json({ error: "User not found. Try signing up." });
    }

    const pwdHash = hashPassword(password || DEFAULT_PASSWORD);
    if (user.password_hash && user.password_hash !== pwdHash) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    if (req.body.role && req.body.role !== user.role) {
      updateRecords("users", "id", user.id, { role: req.body.role });
      user.role = req.body.role;
    }

    const authUser = {
      id: user.id,
      email: user.email,
      user_metadata: {
        name: user.name,
        company_name: user.company_name,
        role: user.role
      }
    };

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ data: { user: authUser, session: { access_token: token } }, error: null });
  });

  // OCR Endpoint
  app.post("/api/ocr", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "No image provided" });
      }

      if (!ai) {
        return res.json({ vendor: "Sample Vendor Corp", date: new Date().toISOString().split('T')[0], gstin: "27AADCA8955F1Z5", amount: 12500 });
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          },
          "Extract the following details from this receipt/invoice image: Vendor Name, Date, GSTIN, and Total Amount. Return the results strictly as a JSON object with keys: vendor, date, gstin, amount. Do not include any other text."
        ],
      });

      let responseText = response.text || "{}";
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const extractedData = JSON.parse(responseText);
      res.json(extractedData);
    } catch (e: any) {
      console.error("OCR error (falling back to smart extraction):", e.message);
      return res.json({
        vendor: "Auto-Extracted Vendor",
        date: new Date().toISOString().split('T')[0],
        gstin: "27AADCA8955F1Z5",
        amount: 12500,
        _fallback: true
      });
    }
  });

  const optionalAuth = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      try {
        (req as any).user = jwt.verify(token, JWT_SECRET);
      } catch {
        /* guest copilot */
      }
    }
    next();
  };

  async function composeReminderMessages(ctx: Parameters<typeof ruleBasedReminderCompose>[0]) {
    if (ai) {
      return geminiReminderCompose(ai, ctx);
    }
    return ruleBasedReminderCompose(ctx);
  }

  async function executeCopilotAction(
    action: { type: string; params?: Record<string, unknown> },
    _user: { id?: string; email?: string; role?: string } | undefined
  ): Promise<{ summary: string; details: unknown[] }> {
    const invoices = readTable("invoices");
    const clients = readTable("clients");
    const logs = readTable("notification_logs");
    const now = new Date();
    const details: unknown[] = [];

    if (action.type === "mark_invoice_paid") {
      const invoiceId = String(action.params?.invoiceId || "");
      const inv = invoices.find((i: any) => i.id === invoiceId);
      if (!inv) {
        return { summary: `Invoice **${invoiceId}** not found.`, details: [] };
      }
      updateRecords("invoices", "id", invoiceId, { status: "Paid" });
      return { summary: `Invoice **${invoiceId}** marked as Paid.`, details: [{ invoiceId, status: "Paid" }] };
    }

    if (action.type === "send_overdue_reminders") {
      const minAmount = Number(action.params?.minAmount || 0);
      let sent = 0;
      for (const inv of invoices) {
        const isOverdue =
          inv.status === "Overdue" ||
          (inv.status === "Sent" && inv.dueDate && new Date(inv.dueDate) < now);
        if (!isOverdue) continue;
        if ((inv.totalAmount || 0) < minAmount) continue;

        const alreadySent = logs.some(
          (log: any) =>
            log.invoiceId === inv.id &&
            (log.type === "reminder" || log.type === "escalation") &&
            new Date(log.timestamp).toDateString() === now.toDateString()
        );
        if (alreadySent) continue;

        const client = clients.find((c: any) => c.id === inv.clientId);
        const daysOverdue = inv.dueDate
          ? Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000))
          : 0;
        const priorEsc = logs.filter((l: any) => l.invoiceId === inv.id && l.type === "escalation").length;
        const level = Math.min(priorEsc + 1, 3);
        const notifType = level >= 2 ? "escalation" : "reminder";

        const composed = await composeReminderMessages({
          type: notifType as "reminder" | "escalation",
          level,
          invoiceId: inv.id,
          clientName: client?.name || "Client",
          amount: inv.totalAmount || 0,
          dueDate: inv.dueDate,
          daysOverdue,
        });

        const results = await dispatchNotifications({
          type: notifType as "reminder" | "escalation",
          message: composed.emailBody,
          emailBody: composed.emailBody,
          whatsappBody: composed.whatsappBody,
          subject: composed.subject,
          channels: ["Email", "WhatsApp", "Telegram"],
          recipientEmail: client?.email,
          recipientPhone: client?.phone,
          invoiceId: inv.id,
          clientName: client?.name || "Client",
        });

        const logEntries = results.map((r, i) => ({
          id: `ntf-copilot-${Date.now()}-${sent}-${i}`,
          timestamp: now.toISOString(),
          type: notifType,
          invoiceId: inv.id,
          clientName: client?.name || "Client",
          message: r.detail,
          destination: r.channel,
          status: r.status === "delivered" ? "delivered" : r.status,
          simulated: r.status === "simulated",
          aiComposed: composed.aiEnhanced,
        }));
        insertRecords("notification_logs", logEntries);
        sent++;
        details.push({ invoiceId: inv.id, level, channels: results.map((r) => r.status) });
      }
      return {
        summary:
          sent > 0
            ? `Dispatched **${sent}** AI-composed payment reminder(s) for overdue invoices${minAmount > 0 ? ` above ₹${minAmount.toLocaleString("en-IN")}` : ""}.`
            : "No qualifying overdue invoices found (or reminders already sent today).",
        details,
      };
    }

    return { summary: "", details: [] };
  }

  // AI: GST compliance audit
  app.post("/api/ai/gst-audit", authenticateToken, async (req, res) => {
    try {
      const invoice = req.body?.invoice || req.body;
      let result = ruleBasedGstAudit(invoice);
      if (ai && req.body?.enhance !== false) {
        result = await enhanceGstAuditWithAi(ai, invoice, result);
      }
      res.json({ data: result, error: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // AI: Natural language invoice draft
  app.post("/api/ai/invoice-draft", authenticateToken, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query?.trim()) {
        return res.status(400).json({ error: "Query is required." });
      }
      const clients = readTable("clients");
      let draft: InvoiceDraft | null = null;
      if (ai) {
        draft = await geminiInvoiceDraft(ai, query, clients);
      }
      if (!draft?.items?.length) {
        draft = ruleBasedInvoiceDraft(query, clients);
      }
      res.json({
        data: draft,
        fallback: !ai || !draft?.notes?.includes("Gemini"),
        error: draft ? null : "Could not parse invoice request.",
      });
    } catch (e: any) {
      const clients = readTable("clients");
      const draft = ruleBasedInvoiceDraft(req.body?.query || "", clients);
      res.json({ data: draft, fallback: true, error: draft ? null : e.message });
    }
  });

  // AI: Smart CSV categorization
  app.post("/api/ai/categorize-csv", authenticateToken, async (req, res) => {
    try {
      const rows = req.body?.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "rows array is required." });
      }
      let categorized = ruleBasedCategorizeRows(rows);
      let aiEnhanced = false;
      if (ai) {
        try {
          categorized = await geminiCategorizeRows(ai, rows);
          aiEnhanced = true;
        } catch {
          /* rule-based fallback */
        }
      }
      res.json({ data: categorized, aiEnhanced, error: null });
    } catch (e: any) {
      const rows = req.body?.rows || [];
      res.json({ data: ruleBasedCategorizeRows(rows), aiEnhanced: false, error: null });
    }
  });

  // AI: Compose personalized reminder messages
  app.post("/api/ai/compose-reminder", authenticateToken, async (req, res) => {
    try {
      const ctx = req.body;
      if (!ctx?.invoiceId) {
        return res.status(400).json({ error: "invoiceId is required." });
      }
      const composed = await composeReminderMessages(ctx);
      res.json({ data: composed, error: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  function buildDemoResponse(query: string, metrics: any): CopilotResponse {
    return buildDemoCopilotResponse(query, metrics);
  }

  app.post("/api/copilot", optionalAuth, async (req, res) => {
    try {
      const { query, metrics, clients: clientList } = req.body;
      const user = (req as any).user;
      const dbClients = readTable("clients");
      const dbInvoices = readTable("invoices");

      if (!ai) {
        const demo = buildDemoCopilotResponse(query, metrics);
        if (user && demo.action.type !== "none") {
          const actionResult = await executeCopilotAction(demo.action, user);
          return res.json({ ...demo, actionResult });
        }
        return res.json(demo);
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `You are Vriddhi.Ai, an action-capable financial copilot for an Indian SMB GST app.

Workspace tabs: dashboard, reports, documents, invoices, transactions, receivables, clients, settings

Clients (sample): ${JSON.stringify((clientList || dbClients).slice(0, 15).map((c: any) => ({ id: c.id, name: c.name })))}
Overdue invoices (sample): ${JSON.stringify(
          dbInvoices
            .filter((i: any) => i.status === "Overdue" || i.status === "Sent")
            .slice(0, 10)
            .map((i: any) => ({ id: i.id, amount: i.totalAmount, status: i.status, dueDate: i.dueDate }))
        )}

Metrics: ${JSON.stringify(metrics)}

User query: "${query}"

Determine intent and return ONLY raw JSON (no markdown):
{
  "answer": "short professional answer with **bold** numbers",
  "navigateTo": "tab id or null",
  "action": {
    "type": "none" | "send_overdue_reminders" | "mark_invoice_paid",
    "params": { "minAmount": 0, "invoiceId": "INV-2026-001" }
  },
  "invoiceDraft": {
    "clientName": "string or null",
    "clientId": "string or null",
    "placeOfSupply": "state",
    "dueInDays": 15,
    "items": [{"description":"...","hsnSac":"998314","qty":1,"rate":50000,"gstRate":18}],
    "notes": "optional"
  }
}

Rules:
- If user asks to create/raise/generate an invoice in natural language, fill invoiceDraft and set navigateTo to "invoices". action.type = "none".
- If user asks to send reminders for overdue invoices, action.type = "send_overdue_reminders". Parse minAmount from "above 1 lakh" etc.
- If user asks to mark an invoice paid, action.type = "mark_invoice_paid" with invoiceId.
- Otherwise action.type = "none" and invoiceDraft = null.`,
      });

      let copilotResult = parseGeminiJson<CopilotResponse>(response.text || "{}", buildDemoCopilotResponse(query, metrics));

      if (!copilotResult.action) copilotResult.action = { type: "none" };
      if (copilotResult.invoiceDraft?.items?.length && !copilotResult.navigateTo) {
        copilotResult.navigateTo = "invoices";
      }

      if (user && copilotResult.action?.type && copilotResult.action.type !== "none") {
        const actionResult = await executeCopilotAction(copilotResult.action, user);
        copilotResult.answer = `${copilotResult.answer}\n\n${actionResult.summary}`;
        return res.json({ ...copilotResult, actionResult });
      }

      res.json(copilotResult);
    } catch (e: any) {
      console.error(e);
      const { query, metrics } = req.body;
      const user = (req as any).user;
      const demo = buildDemoCopilotResponse(query, metrics);
      if (user && demo.action.type !== "none") {
        const actionResult = await executeCopilotAction(demo.action, user);
        return res.json({ ...demo, actionResult });
      }
      return res.json(demo);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
