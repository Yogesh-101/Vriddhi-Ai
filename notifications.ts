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

function emailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function telegramConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
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
  const subject = buildSubject(input);
  const body = input.message;
  const results: SendResult[] = [];

  for (const channel of input.channels) {
    if (channel === "Email") {
      const to = input.recipientEmail || process.env.ADMIN_EMAIL || "admin@vriddhi.ai";
      results.push(await sendEmail(to, subject, body));
    } else if (channel === "Telegram") {
      const tgText = `<b>Vriddhi.Ai</b>\n${input.clientName ? `<i>${input.clientName}</i>\n` : ""}${body}`;
      results.push(await sendTelegram(tgText));
    } else if (channel === "WhatsApp") {
      results.push({
        channel: "WhatsApp",
        status: "simulated",
        detail: `[SIMULATED] WhatsApp to ${input.recipientPhone || "client"}: ${body.slice(0, 80)}...`,
      });
    }
  }

  return results;
}

export function notificationsLiveStatus() {
  return {
    email: emailConfigured(),
    telegram: telegramConfigured(),
    whatsapp: false,
  };
}
