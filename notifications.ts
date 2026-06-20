import nodemailer from "nodemailer";

export type NotificationChannel = "Email" | "Telegram" | "WhatsApp";

export interface SendNotificationInput {
  type: "delivery" | "reminder" | "escalation" | "welcome" | "contact";
  message: string;
  channels: NotificationChannel[];
  recipientEmail?: string;
  recipientPhone?: string;
  invoiceId?: string;
  clientName?: string;
  /** Full email body (falls back to message) */
  emailBody?: string;
  /** Short WhatsApp body (falls back to message) */
  whatsappBody?: string;
  /** Override email subject */
  subject?: string;
}

export interface SendResult {
  channel: NotificationChannel;
  status: "delivered" | "failed" | "simulated";
  detail: string;
}

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "Vriddhi.Ai <noreply@vriddhi.ai>";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "";
const TWILIO_WHATSAPP_DEFAULT_TO = process.env.TWILIO_WHATSAPP_DEFAULT_TO || "";

function isPlaceholder(value: string) {
  return !value || /your_|placeholder|xxx|<.*>/i.test(value);
}

function emailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function telegramConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && !isPlaceholder(TELEGRAM_BOT_TOKEN));
}

function whatsappConfigured() {
  return Boolean(
    TWILIO_ACCOUNT_SID &&
      TWILIO_AUTH_TOKEN &&
      TWILIO_WHATSAPP_FROM &&
      !isPlaceholder(TWILIO_ACCOUNT_SID) &&
      TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
  );
}

/** Normalize client phone to Twilio whatsapp:+E164 format */
export function normalizeWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `whatsapp:+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `whatsapp:+${digits}`;
  return `whatsapp:+${digits}`;
}

function resolveWhatsAppTo(recipientPhone?: string): string | null {
  const fromClient = recipientPhone ? normalizeWhatsAppNumber(recipientPhone) : null;
  if (fromClient) return fromClient;
  if (TWILIO_WHATSAPP_DEFAULT_TO) {
    return TWILIO_WHATSAPP_DEFAULT_TO.startsWith("whatsapp:")
      ? TWILIO_WHATSAPP_DEFAULT_TO
      : normalizeWhatsAppNumber(TWILIO_WHATSAPP_DEFAULT_TO);
  }
  return null;
}

async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  if (!emailConfigured()) {
    return {
      channel: "Email",
      status: "simulated",
      detail: `[SIMULATED] Email to ${to}: ${subject}`,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text: body,
      html: `<div style="font-family:sans-serif;line-height:1.6"><h2>Vriddhi.Ai</h2><p>${body.replace(/\n/g, "<br>")}</p></div>`,
    });

    return { channel: "Email", status: "delivered", detail: `Email sent to ${to}` };
  } catch (err: any) {
    return { channel: "Email", status: "failed", detail: err.message || "Email send failed" };
  }
}

async function sendTelegram(text: string): Promise<SendResult> {
  if (!telegramConfigured()) {
    return {
      channel: "Telegram",
      status: "simulated",
      detail: `[SIMULATED] Telegram: ${text.slice(0, 120)}...`,
    };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      return { channel: "Telegram", status: "failed", detail: json.description || "Telegram API error" };
    }
    return { channel: "Telegram", status: "delivered", detail: "Telegram message delivered" };
  } catch (err: any) {
    return { channel: "Telegram", status: "failed", detail: err.message || "Telegram send failed" };
  }
}

async function sendWhatsApp(body: string, recipientPhone?: string): Promise<SendResult> {
  if (!whatsappConfigured()) {
    return {
      channel: "WhatsApp",
      status: "simulated",
      detail: `[SIMULATED] WhatsApp to ${recipientPhone || "client"}: ${body.slice(0, 80)}...`,
    };
  }

  const to = resolveWhatsAppTo(recipientPhone);
  if (!to) {
    return {
      channel: "WhatsApp",
      status: "failed",
      detail: "No valid WhatsApp recipient. Set client phone or TWILIO_WHATSAPP_DEFAULT_TO in .env",
    };
  }

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const params = new URLSearchParams({
      From: TWILIO_WHATSAPP_FROM,
      To: to,
      Body: body.slice(0, 1600),
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const json = await res.json();
    if (!res.ok) {
      const errMsg = json.message || json.error_message || "Twilio WhatsApp API error";
      return { channel: "WhatsApp", status: "failed", detail: errMsg };
    }

    return {
      channel: "WhatsApp",
      status: "delivered",
      detail: `WhatsApp sent to ${to} (SID: ${json.sid || "ok"})`,
    };
  } catch (err: any) {
    return { channel: "WhatsApp", status: "failed", detail: err.message || "WhatsApp send failed" };
  }
}

function buildSubject(input: SendNotificationInput): string {
  switch (input.type) {
    case "delivery":
      return `Invoice ${input.invoiceId || ""} — Delivery Confirmation | Vriddhi.Ai`;
    case "reminder":
      return `Payment Reminder — Invoice ${input.invoiceId || ""} | Vriddhi.Ai`;
    case "escalation":
      return `URGENT: Overdue Invoice ${input.invoiceId || ""} | Vriddhi.Ai`;
    case "welcome":
      return "Welcome to Vriddhi.Ai — Your workspace is ready";
    case "contact":
      return "New Enterprise Demo Request | Vriddhi.Ai";
    default:
      return "Notification from Vriddhi.Ai";
  }
}

export async function dispatchNotifications(input: SendNotificationInput): Promise<SendResult[]> {
  const subject = input.subject || buildSubject(input);
  const emailBody = input.emailBody || input.message;
  const whatsappBody = input.whatsappBody || input.message;
  const results: SendResult[] = [];

  for (const channel of input.channels) {
    if (channel === "Email") {
      const to = input.recipientEmail || process.env.ADMIN_EMAIL || "admin@vriddhi.ai";
      results.push(await sendEmail(to, subject, emailBody));
    } else if (channel === "Telegram") {
      const tgText = `<b>Vriddhi.Ai</b>\n${input.clientName ? `<i>${input.clientName}</i>\n` : ""}${whatsappBody}`;
      results.push(await sendTelegram(tgText));
    } else if (channel === "WhatsApp") {
      results.push(await sendWhatsApp(whatsappBody, input.recipientPhone));
    }
  }

  return results;
}

export function notificationsLiveStatus() {
  return {
    email: emailConfigured(),
    telegram: telegramConfigured(),
    whatsapp: whatsappConfigured(),
  };
}
