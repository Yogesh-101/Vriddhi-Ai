export type NotificationType = "delivery" | "reminder" | "escalation" | "welcome" | "contact";

export async function sendNotification(payload: {
  type: NotificationType;
  message: string;
  channels?: ("Email" | "Telegram" | "WhatsApp")[];
  recipientEmail?: string;
  recipientPhone?: string;
  invoiceId?: string;
  clientName?: string;
}) {
  const token = localStorage.getItem("vriddhi_auth_token");
  const response = await fetch("/api/notifications/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      channels: ["Email", "Telegram"],
      ...payload,
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Notification failed");
  return json;
}

export async function submitContactForm(data: {
  name: string;
  email: string;
  company?: string;
  message: string;
}) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Contact submission failed");
  return json;
}
