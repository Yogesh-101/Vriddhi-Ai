const fs = require('fs');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || "vriddhi_super_secret_jwt_key_2026";
const DEFAULT_PASSWORD = "password123";
function hashPassword(password) {
  return crypto.createHash("sha256").update(password + JWT_SECRET).digest("hex");
}

const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

db.users = [
  {
    id: "usr-admin-founder",
    email: "arjun@vriddhicapital.com",
    password_hash: hashPassword(DEFAULT_PASSWORD),
    name: "Arjun Sharma",
    company_name: "Vriddhi AI Ltd",
    role: "Founder",
    created_at: "2026-05-01T09:00:00.000Z"
  },
  {
    id: "usr-accountant-01",
    email: "sanjana@vriddhicapital.com",
    password_hash: hashPassword(DEFAULT_PASSWORD),
    name: "Sanjana Iyer",
    company_name: "Vriddhi AI Ltd",
    role: "Accountant",
    created_at: "2026-05-05T10:30:00.000Z"
  },
  {
    id: "usr-viewer-01",
    email: "neha@vriddhicapital.com",
    password_hash: hashPassword(DEFAULT_PASSWORD),
    name: "Neha Patil",
    company_name: "Vriddhi AI Ltd",
    role: "Viewer",
    created_at: "2026-05-10T14:00:00.000Z"
  }
];

db.clients = [
  {
    id: "c1",
    name: "Alpha Corp",
    email: "contact@alphacorp.in",
    phone: "+91-9876543210",
    billingAddress: "Tower B, BKC Complex, Mumbai, MH 400051",
    state: "Maharashtra",
    type: "Client",
    status: "Active",
    gstin: "27AAAAA0000A1Z5"
  },
  {
    id: "c2",
    name: "Beta Inc",
    email: "billing@betainc.co",
    phone: "+91-9876543211",
    billingAddress: "Whitefield Tech Park, Bangalore, KA 560066",
    state: "Karnataka",
    type: "Client",
    status: "Active",
    gstin: "29BBBBB0000B1Z6"
  },
  {
    id: "c3",
    name: "Gamma Ltd",
    email: "finance@gammaltd.com",
    phone: "+91-9876543212",
    billingAddress: "Hinjewadi IT Park, Pune, MH 411057",
    state: "Maharashtra",
    type: "Client",
    status: "Active",
    gstin: "27CCCCC0000C1Z7"
  },
  {
    id: "c4",
    name: "Delta Tech Solutions",
    email: "accounts@deltatech.in",
    phone: "+91-9812345678",
    billingAddress: "Cyber City, Sector 24, Gurgaon, DL 122002",
    state: "Delhi",
    type: "Client",
    status: "Active",
    gstin: "07DDDDD0000D1Z8"
  },
  {
    id: "c5",
    name: "Epsilon HealthTech",
    email: "billing@epsilonhealth.com",
    phone: "+91-9988776655",
    billingAddress: "OMR Thoraipakkam, Chennai, TN 600097",
    state: "Tamil Nadu",
    type: "Client",
    status: "Active",
    gstin: "33EEEEE0000E1Z9"
  },
  {
    id: "v1",
    name: "AWS India Pvt Ltd",
    email: "billing@aws.amazon.in",
    phone: "+91-1800111222",
    billingAddress: "DLF Cyber Hub, Gurgaon, HR 122002",
    state: "Delhi",
    type: "Vendor",
    status: "Active",
    gstin: "07AWSIN1234A1Z5"
  },
  {
    id: "v2",
    name: "WeWork India",
    email: "invoices@wework.co.in",
    phone: "+91-9000112233",
    billingAddress: "One BKC, G Block, Mumbai, MH 400051",
    state: "Maharashtra",
    type: "Vendor",
    status: "Active",
    gstin: "27WEWRK5678B1Z6"
  },
  {
    id: "v3",
    name: "Google Ads India",
    email: "ads-billing@google.com",
    phone: "+91-1800999888",
    billingAddress: "Google India, Bangalore, KA 560001",
    state: "Karnataka",
    type: "Vendor",
    status: "Active",
    gstin: "29GOOGL9012C1Z7"
  }
];

db.transactions = [
  { id: "t1", date: "2026-04-05", description: "Consulting engagement - Alpha Corp Q1", amount: 180000, type: "income", status: "paid", category: "Consulting", entityId: "c1" },
  { id: "t2", date: "2026-04-10", description: "SaaS platform subscription - Beta Inc", amount: 95000, type: "income", status: "paid", category: "Product Sales", entityId: "c2" },
  { id: "t3", date: "2026-04-12", description: "AWS EC2 & S3 hosting charges", amount: -28500, type: "expense", status: "paid", category: "Software", entityId: "v1" },
  { id: "t4", date: "2026-04-15", description: "WeWork coworking office rent - April", amount: -55000, type: "expense", status: "paid", category: "Rent", entityId: "v2" },
  { id: "t5", date: "2026-04-20", description: "Staff salary - April payroll", amount: -185000, type: "expense", status: "paid", category: "Salaries" },
  { id: "t6", date: "2026-04-22", description: "Google Ads digital campaign Q1", amount: -32000, type: "expense", status: "paid", category: "Marketing", entityId: "v3" },
  { id: "t7", date: "2026-04-28", description: "API integration project - Gamma Ltd", amount: 125000, type: "income", status: "paid", category: "Services", entityId: "c3" },
  { id: "t8", date: "2026-05-03", description: "Custom dashboard build - Delta Tech", amount: 220000, type: "income", status: "paid", category: "Services", entityId: "c4" },
  { id: "t9", date: "2026-05-08", description: "Figma & Slack team licenses", amount: -12400, type: "expense", status: "paid", category: "Software" },
  { id: "t10", date: "2026-05-10", description: "WeWork coworking office rent - May", amount: -55000, type: "expense", status: "paid", category: "Rent", entityId: "v2" },
  { id: "t11", date: "2026-05-12", description: "Health analytics module - Epsilon HealthTech", amount: 175000, type: "income", status: "paid", category: "Consulting", entityId: "c5" },
  { id: "t12", date: "2026-05-15", description: "Staff salary - May payroll", amount: -195000, type: "expense", status: "paid", category: "Salaries" },
  { id: "t13", date: "2026-05-18", description: "Electricity & Internet bills", amount: -8200, type: "expense", status: "paid", category: "Utilities" },
  { id: "t14", date: "2026-05-22", description: "Client advisory retainer - Alpha Corp", amount: 85000, type: "income", status: "paid", category: "Consulting", entityId: "c1" },
  { id: "t15", date: "2026-05-25", description: "Google Ads digital campaign Q2", amount: -45000, type: "expense", status: "paid", category: "Marketing", entityId: "v3" },
  { id: "t16", date: "2026-06-01", description: "Platform license renewal - Beta Inc", amount: 150000, type: "income", status: "paid", category: "Product Sales", entityId: "c2" },
  { id: "t17", date: "2026-06-03", description: "AWS hosting charges - June", amount: -25000, type: "expense", status: "paid", category: "Software", entityId: "v1" },
  { id: "t18", date: "2026-06-05", description: "WeWork coworking office rent - June", amount: -55000, type: "expense", status: "paid", category: "Rent", entityId: "v2" },
  { id: "t19", date: "2026-06-08", description: "AI model training project - Gamma Ltd", amount: 280000, type: "income", status: "paid", category: "Services", entityId: "c3" },
  { id: "t20", date: "2026-06-10", description: "Staff salary - June payroll", amount: -210000, type: "expense", status: "paid", category: "Salaries" },
  { id: "t21", date: "2026-06-12", description: "Data pipeline setup - Delta Tech", amount: 165000, type: "income", status: "pending", category: "Services", entityId: "c4", dueDate: "2026-06-30" },
  { id: "t22", date: "2026-06-14", description: "SEO & content marketing", amount: -38000, type: "expense", status: "pending", category: "Marketing", dueDate: "2026-06-25" },
  { id: "t23", date: "2026-06-15", description: "Telehealth integration - Epsilon HealthTech", amount: 195000, type: "income", status: "pending", category: "Consulting", entityId: "c5", dueDate: "2026-07-05" },
  { id: "t24", date: "2026-06-18", description: "AWS reserved instance payment", amount: -42000, type: "expense", status: "pending", category: "Software", entityId: "v1", dueDate: "2026-07-01" }
];

db.invoices = [
  {
    id: "INV-2026-001",
    clientId: "c1",
    date: "2026-04-05",
    dueDate: "2026-04-20",
    status: "Paid",
    items: [
      { description: "Strategic Consulting - Q1 Engagement", hsnSac: "998311", qty: 1, rate: 150000, gstRate: 18 }
    ],
    placeOfSupply: "Maharashtra",
    isRecurring: false,
    recurringInterval: "",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 150000,
    cgst: 13500,
    sgst: 13500,
    igst: 0,
    totalAmount: 177000
  },
  {
    id: "INV-2026-002",
    clientId: "c2",
    date: "2026-04-10",
    dueDate: "2026-04-25",
    status: "Paid",
    items: [
      { description: "SaaS Platform License - Monthly", hsnSac: "998314", qty: 1, rate: 80000, gstRate: 18 }
    ],
    placeOfSupply: "Karnataka",
    isRecurring: true,
    recurringInterval: "Monthly",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 80000,
    cgst: 0,
    sgst: 0,
    igst: 14400,
    totalAmount: 94400
  },
  {
    id: "INV-2026-003",
    clientId: "c3",
    date: "2026-04-28",
    dueDate: "2026-05-15",
    status: "Paid",
    items: [
      { description: "API Integration & Development", hsnSac: "998314", qty: 1, rate: 100000, gstRate: 18 },
      { description: "Quality Assurance & Testing", hsnSac: "998314", qty: 1, rate: 25000, gstRate: 18 }
    ],
    placeOfSupply: "Maharashtra",
    isRecurring: false,
    recurringInterval: "",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 125000,
    cgst: 11250,
    sgst: 11250,
    igst: 0,
    totalAmount: 147500
  },
  {
    id: "INV-2026-004",
    clientId: "c4",
    date: "2026-05-03",
    dueDate: "2026-05-20",
    status: "Paid",
    items: [
      { description: "Custom Analytics Dashboard Build", hsnSac: "998314", qty: 1, rate: 180000, gstRate: 18 },
      { description: "Data Migration & ETL Setup", hsnSac: "998314", qty: 1, rate: 40000, gstRate: 18 }
    ],
    placeOfSupply: "Delhi",
    isRecurring: false,
    recurringInterval: "",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 220000,
    cgst: 0,
    sgst: 0,
    igst: 39600,
    totalAmount: 259600
  },
  {
    id: "INV-2026-005",
    clientId: "c5",
    date: "2026-05-12",
    dueDate: "2026-05-28",
    status: "Paid",
    items: [
      { description: "Health Analytics Module Development", hsnSac: "998314", qty: 1, rate: 150000, gstRate: 18 }
    ],
    placeOfSupply: "Tamil Nadu",
    isRecurring: false,
    recurringInterval: "",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 150000,
    cgst: 0,
    sgst: 0,
    igst: 27000,
    totalAmount: 177000
  },
  {
    id: "INV-2026-006",
    clientId: "c1",
    date: "2026-06-01",
    dueDate: "2026-06-15",
    status: "Paid",
    items: [
      { description: "Advisory Retainer - June", hsnSac: "998311", qty: 1, rate: 85000, gstRate: 18 }
    ],
    placeOfSupply: "Maharashtra",
    isRecurring: true,
    recurringInterval: "Monthly",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 85000,
    cgst: 7650,
    sgst: 7650,
    igst: 0,
    totalAmount: 100300
  },
  {
    id: "INV-2026-007",
    clientId: "c3",
    date: "2026-06-08",
    dueDate: "2026-06-10",
    status: "Overdue",
    items: [
      { description: "AI Model Training & Deployment", hsnSac: "998314", qty: 1, rate: 200000, gstRate: 18 },
      { description: "Cloud Infrastructure Setup", hsnSac: "998315", qty: 1, rate: 80000, gstRate: 18 }
    ],
    placeOfSupply: "Maharashtra",
    isRecurring: false,
    recurringInterval: "",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 280000,
    cgst: 25200,
    sgst: 25200,
    igst: 0,
    totalAmount: 330400
  },
  {
    id: "INV-2026-008",
    clientId: "c4",
    date: "2026-06-12",
    dueDate: "2026-06-30",
    status: "Sent",
    items: [
      { description: "Data Pipeline Architecture", hsnSac: "998314", qty: 1, rate: 140000, gstRate: 18 }
    ],
    placeOfSupply: "Delhi",
    isRecurring: false,
    recurringInterval: "",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 140000,
    cgst: 0,
    sgst: 0,
    igst: 25200,
    totalAmount: 165200
  },
  {
    id: "INV-2026-009",
    clientId: "c5",
    date: "2026-06-15",
    dueDate: "2026-07-05",
    status: "Sent",
    items: [
      { description: "Telehealth Platform Integration", hsnSac: "998314", qty: 1, rate: 160000, gstRate: 18 },
      { description: "HIPAA Compliance Audit", hsnSac: "998311", qty: 1, rate: 35000, gstRate: 18 }
    ],
    placeOfSupply: "Tamil Nadu",
    isRecurring: false,
    recurringInterval: "",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 195000,
    cgst: 0,
    sgst: 0,
    igst: 35100,
    totalAmount: 230100
  },
  {
    id: "INV-2026-010",
    clientId: "c2",
    date: "2026-06-01",
    dueDate: "2026-06-15",
    status: "Overdue",
    items: [
      { description: "SaaS Platform License - June", hsnSac: "998314", qty: 1, rate: 80000, gstRate: 18 },
      { description: "Premium Support Add-on", hsnSac: "998316", qty: 1, rate: 15000, gstRate: 18 }
    ],
    placeOfSupply: "Karnataka",
    isRecurring: true,
    recurringInterval: "Monthly",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 95000,
    cgst: 0,
    sgst: 0,
    igst: 17100,
    totalAmount: 112100
  },
  {
    id: "INV-2026-011",
    clientId: "c1",
    date: "2026-06-18",
    dueDate: "2026-07-18",
    status: "Draft",
    items: [
      { description: "Corporate Strategy Workshop", hsnSac: "998311", qty: 2, rate: 50000, gstRate: 18 }
    ],
    placeOfSupply: "Maharashtra",
    isRecurring: false,
    recurringInterval: "",
    currency: "INR",
    exchangeRate: 1,
    taxableAmount: 100000,
    cgst: 9000,
    sgst: 9000,
    igst: 0,
    totalAmount: 118000
  }
];

db.budgets = [
  { id: "b1", category: "Rent", allocated: 60000 },
  { id: "b2", category: "Software", allocated: 40000 },
  { id: "b3", category: "Marketing", allocated: 50000 },
  { id: "b4", category: "Salaries", allocated: 220000 },
  { id: "b5", category: "Utilities", allocated: 15000 },
  { id: "b6", category: "Vendor Payments", allocated: 30000 }
];

db.notification_logs = [
  {
    id: "ntf-1",
    timestamp: "2026-06-08T10:30:00.000Z",
    type: "delivery",
    invoiceId: "INV-2026-007",
    clientName: "Gamma Ltd",
    message: "Invoice INV-2026-007 delivered to finance@gammaltd.com",
    destination: "Email",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-2",
    timestamp: "2026-06-08T10:30:05.000Z",
    type: "delivery",
    invoiceId: "INV-2026-007",
    clientName: "Gamma Ltd",
    message: "Invoice INV-2026-007 PDF sent via Telegram Bot",
    destination: "Telegram",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-3",
    timestamp: "2026-06-11T09:00:00.000Z",
    type: "reminder",
    invoiceId: "INV-2026-007",
    clientName: "Gamma Ltd",
    message: "Payment reminder sent - Invoice INV-2026-007 overdue by 1 day",
    destination: "Email",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-4",
    timestamp: "2026-06-11T09:00:03.000Z",
    type: "reminder",
    invoiceId: "INV-2026-007",
    clientName: "Gamma Ltd",
    message: "Payment reminder sent via Telegram Bot",
    destination: "Telegram",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-5",
    timestamp: "2026-06-15T09:00:00.000Z",
    type: "escalation",
    invoiceId: "INV-2026-007",
    clientName: "Gamma Ltd",
    message: "Escalated reminder (L2) - Invoice INV-2026-007 overdue by 5 days",
    destination: "Email, Telegram",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-6",
    timestamp: "2026-06-12T14:00:00.000Z",
    type: "delivery",
    invoiceId: "INV-2026-008",
    clientName: "Delta Tech Solutions",
    message: "Invoice INV-2026-008 delivered to accounts@deltatech.in",
    destination: "Email",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-7",
    timestamp: "2026-06-15T11:00:00.000Z",
    type: "delivery",
    invoiceId: "INV-2026-009",
    clientName: "Epsilon HealthTech",
    message: "Invoice INV-2026-009 delivered to billing@epsilonhealth.com",
    destination: "Email, Telegram",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-8",
    timestamp: "2026-06-16T09:00:00.000Z",
    type: "reminder",
    invoiceId: "INV-2026-010",
    clientName: "Beta Inc",
    message: "Payment reminder sent - Invoice INV-2026-010 overdue by 1 day",
    destination: "Email",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-9",
    timestamp: "2026-06-16T09:00:05.000Z",
    type: "reminder",
    invoiceId: "INV-2026-010",
    clientName: "Beta Inc",
    message: "Payment reminder sent via Telegram Bot",
    destination: "Telegram",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-10",
    timestamp: "2026-06-19T09:00:00.000Z",
    type: "escalation",
    invoiceId: "INV-2026-010",
    clientName: "Beta Inc",
    message: "Escalated reminder (L2) - Invoice INV-2026-010 overdue by 4 days",
    destination: "Email, Telegram",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-11",
    timestamp: "2026-05-01T08:00:00.000Z",
    type: "welcome",
    invoiceId: "",
    clientName: "",
    message: "Welcome email sent to arjun@vriddhicapital.com - Workspace created",
    destination: "Email",
    status: "delivered",
    simulated: false
  },
  {
    id: "ntf-12",
    timestamp: "2026-05-05T08:00:00.000Z",
    type: "welcome",
    invoiceId: "",
    clientName: "",
    message: "Welcome email sent to sanjana@vriddhicapital.com - Accountant role assigned",
    destination: "Email",
    status: "delivered",
    simulated: false
  }
];

db.contact_requests = [
  {
    id: "cr-1",
    name: "Rahul Mehta",
    email: "rahul@enterprise.co",
    company: "Enterprise Corp India",
    message: "We need custom API integrations for our 50+ entity group structure. Looking for bulk invoicing with auto-reconciliation.",
    submitted_at: "2026-06-10T14:30:00.000Z"
  }
];

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log("Comprehensive seed data injected successfully!");
console.log(`  Users: ${db.users.length}`);
console.log(`  Clients/Vendors: ${db.clients.length}`);
console.log(`  Transactions: ${db.transactions.length}`);
console.log(`  Invoices: ${db.invoices.length}`);
console.log(`  Budgets: ${db.budgets.length}`);
console.log(`  Notification Logs: ${db.notification_logs.length}`);
