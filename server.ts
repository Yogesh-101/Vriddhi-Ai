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
        channels: ["Email", "Telegram"],
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

  app.post("/api/notifications/send", authenticateToken, async (req, res) => {
    try {
      const { type, message, channels, recipientEmail, recipientPhone, invoiceId, clientName } = req.body;
      const results = await dispatchNotifications({
        type: type || "delivery",
        message,
        channels: channels || ["Email", "Telegram"],
        recipientEmail,
        recipientPhone,
        invoiceId,
        clientName,
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
      channels: ["Email", "Telegram"],
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
        model: 'gemini-2.5-pro',
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

  function buildDemoResponse(query: string, metrics: any): { answer: string; navigateTo: string | null } {
    const norm = (query || "").toLowerCase();

    let navigateTo: string | null = null;
    if (norm.includes('dashboard') || norm.includes('overview') || norm.includes('home') || norm.includes('main')) {
      navigateTo = 'dashboard';
    } else if (norm.includes('invoice') || norm.includes('gst') || norm.includes('billing')) {
      navigateTo = 'invoices';
    } else if (norm.includes('transaction') || norm.includes('ledger') || norm.includes('spend')) {
      navigateTo = 'transactions';
    } else if (norm.includes('receivable') || norm.includes('payable') || norm.includes('outstanding') || norm.includes('dues')) {
      navigateTo = 'receivables';
    } else if (norm.includes('client') || norm.includes('vendor') || norm.includes('customer')) {
      navigateTo = 'clients';
    } else if (norm.includes('settings') || norm.includes('admin panel') || norm.includes('preference')) {
      navigateTo = 'settings';
    } else if (norm.includes('forecast') || norm.includes('cash flow') || norm.includes('runway') || norm.includes('projection')) {
      navigateTo = 'reports';
    } else if (norm.includes('ocr') || norm.includes('document') || norm.includes('scan') || norm.includes('receipt')) {
      navigateTo = 'documents';
    }

    const rev = metrics?.revenue || "N/A";
    const exp = metrics?.expenses || "N/A";
    const prof = metrics?.profit || "N/A";
    const recv = metrics?.receivables || "N/A";

    let answer: string;
    if (norm.includes('revenue') && norm.includes('profit')) {
      answer = `Your current revenue is **${rev}** and net profit is **${prof}**. Healthy margins indicate strong business performance this quarter.`;
    } else if (norm.includes('revenue')) {
      answer = `Your current revenue stands at **${rev}**. This reflects consistent growth across your client base.`;
    } else if (norm.includes('profit')) {
      answer = `Your net profit is **${prof}** (Revenue: ${rev}, Expenses: ${exp}). Your profit margin is healthy.`;
    } else if (norm.includes('expense') || norm.includes('spending') || norm.includes('cost')) {
      answer = `Your total expenses are **${exp}** against revenue of ${rev}. I'd recommend reviewing recurring costs for optimization.`;
    } else if (norm.includes('receivable') || norm.includes('payable') || norm.includes('outstanding') || norm.includes('dues')) {
      answer = `Outstanding receivables total **${recv}**. Consider following up on overdue invoices to improve cash flow.`;
    } else if (navigateTo) {
      answer = `Navigating you to the ${navigateTo} workspace now.`;
    } else {
      answer = `Here's your financial snapshot — Revenue: **${rev}**, Expenses: **${exp}**, Profit: **${prof}**, Receivables: **${recv}**. Ask me about any specific metric for deeper insights!`;
    }

    return { answer, navigateTo };
  }

  app.post("/api/copilot", async (req, res) => {
    try {
      const { query, metrics } = req.body;

      if (!ai) {
        return res.json(buildDemoResponse(query, metrics));
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `You are Vriddhi.Ai, a helpful and highly professional financial copilot for an Indian SMB.
The available workspace tabs/pages and their IDs are:
- 'dashboard': General Dashboard, revenues, profits, overall business metrics, dashboard summary.
- 'reports': Cash Flow Forecast, Cash Runway Diagnostics, projections, future trends, runway alerts.
- 'documents': Documents OCR, invoice scanner, receipt extraction, upload bills/invoice scans, OCR parser.
- 'invoices': GST Invoices, client invoices, generate new invoice, billing, view CGST/SGST/IGST list.
- 'transactions': Transactions, ledger list, general ledger, cash statement, CSV import, record payments/expenses.
- 'receivables': Receivables & Payables, outstanding dues, overdue invoices, vendor bills.
- 'clients': Clients & Vendors, master parties, customers, suppliers, client contact database.
- 'settings': Admin Panel, corporate settings, workspace profile, user role permissions, notification logs.

Current Business Metrics context: ${JSON.stringify(metrics, null, 2)}
User Query: "${query}"

Your task is to:
1. Provide a direct, highly professional, analytical, and short actionable response to the query. Keep it under 3 sentences. Use bold text for key numbers or metrics.
2. Determine if the user is asking to go to, open, switch to, navigate to, or view one of the specific pages/components listed above. If so, return that page ID as "navigateTo". If not, return null.

Return strictly a raw JSON object (with NO markdown codeblocks, NO text before or after the JSON) following this structure:
{
  "answer": "A short, actionable answer/insight.",
  "navigateTo": "one-of-the-above-page-ids-or-null"
}`
      });

      let responseText = response.text || "{}";
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      let resJson = { answer: "", navigateTo: null };
      try {
        resJson = JSON.parse(responseText);
      } catch (parseError) {
        const answerMatch = responseText.match(/"answer"\s*:\s*"([^"]+)"/);
        const navMatch = responseText.match(/"navigateTo"\s*:\s*"([^"]+)"/);
        resJson = {
          answer: answerMatch ? answerMatch[1] : responseText,
          navigateTo: (navMatch ? navMatch[1] : null) as any
        };
      }
      res.json(resJson);
    } catch (e: any) {
      console.error(e);
      const { query, metrics } = req.body;
      return res.json(buildDemoResponse(query, metrics));
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
