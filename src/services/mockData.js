// ─────────────────────────────────────────────────────────────────────────────
// Mock Tally dataset — realistic sample data for the web portal.
// Deterministic (seeded) so numbers stay stable across reloads.
// Shapes mirror what the mobile app / backend return.
// ─────────────────────────────────────────────────────────────────────────────

let _seed = 20260601;
const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
export const between = (a, b) => Math.round(a + rnd() * (b - a));
const pad = (n) => String(n).padStart(2, '0');

// ── Company + Financial Years ────────────────────────────────────────────────
export const COMPANY = {
  guid: 'acme-traders-0001',
  name: 'Acme Traders Pvt Ltd',
  gstin: '27AABCA1234F1Z5',
  state: 'Maharashtra',
  address: '204, Prestige Corporate Park, Andheri East, Mumbai 400069',
  phone: '+91 98200 11223',
  email: 'accounts@acmetraders.in',
  years: [
    { uniqueId: 'fy-2024', name: '2024-25', fin_year: '2024-2025', startDate: '2024-04-01', endDate: '2025-03-31' },
    { uniqueId: 'fy-2025', name: '2025-26', fin_year: '2025-2026', startDate: '2025-04-01', endDate: '2026-03-31' },
  ],
};

export const COMPANIES = [
  COMPANY,
  {
    guid: 'zenith-exports-0002',
    name: 'Zenith Exports LLP',
    gstin: '24AAECZ9876K1Z2',
    state: 'Gujarat',
    address: 'Plot 12, GIDC Estate, Vapi 396195',
    phone: '+91 90999 44556',
    email: 'finance@zenithexports.in',
    years: COMPANY.years,
  },
];

export const USER = {
  id: 'u-100',
  name: 'Rahul Mehta',
  mobile: '+91 98200 11223',
  email: 'rahul@acmetraders.in',
  role: 'Owner',
  is_paired: true,
  company: { guid: COMPANY.guid, name: COMPANY.name },
};

// ── Parties (customers + suppliers) ───────────────────────────────────────────
const CUSTOMER_NAMES = [
  'Sharma Enterprises', 'Global Tech Solutions', 'Reliable Distributors', 'Metro Wholesale',
  'Sunrise Traders', 'Kohinoor Industries', 'Patel & Sons', 'Nova Retail Pvt Ltd',
  'Bright Future Corp', 'Deccan Suppliers', 'Krishna Agencies', 'Sterling Mart',
  'Apex Marketing', 'Greenfield Stores', 'Elite Ventures',
];
const SUPPLIER_NAMES = [
  'Prime Raw Materials', 'Unity Packaging', 'Sigma Components', 'National Logistics',
  'Bharat Chemicals', 'Everest Steel Co', 'Pioneer Fabrics', 'Omega Electronics',
  'Sanjay Traders', 'Continental Supplies',
];

export const PARTIES = [
  ...CUSTOMER_NAMES.map((name, i) => ({
    id: `cust-${i + 1}`, guid: `cust-${i + 1}`, name, type: 'Sundry Debtors',
    party_type: 'customer', gstin: `27ABCDE${1000 + i}F1Z${i % 9}`,
    phone: `+91 9${between(100000000, 899999999)}`, city: pick(['Mumbai', 'Pune', 'Delhi', 'Surat', 'Nagpur']),
    balance: between(-250000, 850000), outstanding: between(0, 650000),
  })),
  ...SUPPLIER_NAMES.map((name, i) => ({
    id: `supp-${i + 1}`, guid: `supp-${i + 1}`, name, type: 'Sundry Creditors',
    party_type: 'supplier', gstin: `24XYZAB${2000 + i}K1Z${i % 9}`,
    phone: `+91 9${between(100000000, 899999999)}`, city: pick(['Vapi', 'Ahmedabad', 'Indore', 'Rajkot']),
    balance: between(-450000, 120000), outstanding: between(0, 400000),
  })),
];

// ── Stock items ────────────────────────────────────────────────────────────────
const ITEM_NAMES = [
  'Steel Rod 12mm', 'Copper Wire 4sqmm', 'PVC Pipe 2inch', 'Cement Bag 50kg', 'Plywood Sheet 8x4',
  'LED Panel 40W', 'Ceramic Tile 2x2', 'Paint Emulsion 20L', 'Adhesive Tube 500g', 'Glass Pane 5mm',
  'Aluminium Section', 'Wooden Door Frame', 'Ball Bearing 6205', 'Hydraulic Oil 5L', 'Safety Helmet',
  'Cotton Fabric Roll', 'Packaging Box M', 'Steel Bolt M10', 'Rubber Gasket', 'Circuit Breaker 32A',
];
const UNITS = ['Nos', 'Kg', 'Mtr', 'Box', 'Ltr', 'Set'];
const CATEGORIES = ['Raw Material', 'Finished Goods', 'Consumables', 'Hardware', 'Electricals'];
const WAREHOUSE_NAMES = ['Main Godown', 'Andheri Store', 'Bhiwandi Warehouse', 'Transit'];

export const WAREHOUSES = WAREHOUSE_NAMES.map((name, i) => ({
  id: `wh-${i + 1}`, guid: `wh-${i + 1}`, name,
  location: pick(['Mumbai', 'Bhiwandi', 'Thane']), items: between(20, 120), value: between(500000, 4500000),
}));

export const STOCKS = ITEM_NAMES.map((name, i) => {
  const rate = between(50, 5000);
  const qty = between(-15, 900);
  const reorder = between(20, 120);
  return {
    id: `item-${i + 1}`, guid: `item-${i + 1}`, name,
    stock_name: name, alias: `AC-${1000 + i}`,
    unit: pick(UNITS), category: pick(CATEGORIES),
    quantity: qty, closing_qty: qty, opening_qty: between(0, 500),
    rate, closing_rate: rate, value: qty * rate, closing_value: qty * rate,
    reorder_level: reorder, warehouse: pick(WAREHOUSE_NAMES),
    hsn: `${between(1000, 9999)}`, gst_rate: pick([5, 12, 18, 28]),
    status: qty < 0 ? 'Negative' : qty < reorder ? 'Low' : 'OK',
    last_movement: `2026-0${between(1, 6)}-${pad(between(1, 28))}`,
  };
});

// ── Voucher generator ──────────────────────────────────────────────────────────
const dateInFY = () => {
  const m = between(4, 15); const yr = m > 12 ? 2026 : 2025; const mm = m > 12 ? m - 12 : m;
  return `${yr}-${pad(mm)}-${pad(between(1, 28))}`;
};

function makeVouchers(count, voucherType, partyPool, prefix) {
  return Array.from({ length: count }).map((_, i) => {
    const party = pick(partyPool);
    const amount = between(5000, 950000);
    const cancelled = rnd() < 0.05;
    return {
      id: `${prefix}-${i + 1}`,
      guid: `${prefix}-guid-${i + 1}`,
      voucher_number: `${prefix}/${String(i + 1).padStart(4, '0')}`,
      voucherNumber: `${prefix}/${String(i + 1).padStart(4, '0')}`,
      voucher_type: voucherType,
      voucherType,
      party_name: party.name,
      partyName: party.name,
      party_guid: party.guid,
      date: dateInFY(),
      amount,
      is_cancelled: cancelled,
      narration: `Being ${voucherType.toLowerCase()} against ${party.name}`,
      items: Array.from({ length: between(1, 4) }).map(() => {
        const it = pick(STOCKS); const q = between(1, 40);
        return { name: it.name, qty: q, rate: it.rate, amount: q * it.rate, unit: it.unit, hsn: it.hsn, gst: it.gst_rate };
      }),
    };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));
}

const customers = PARTIES.filter(p => p.party_type === 'customer');
const suppliers = PARTIES.filter(p => p.party_type === 'supplier');

export const SALES_INVOICES  = makeVouchers(42, 'Sales', customers, 'SI');
export const SALES_ORDERS    = makeVouchers(20, 'Sales Order', customers, 'SO');
export const CREDIT_NOTES    = makeVouchers(12, 'Credit Note', customers, 'CN');
export const DELIVERY_NOTES  = makeVouchers(10, 'Delivery Note', customers, 'DN');
export const PURCHASE_INV    = makeVouchers(30, 'Purchase', suppliers, 'PI');
export const PURCHASE_ORDERS = makeVouchers(15, 'Purchase Order', suppliers, 'PO');
export const DEBIT_NOTES     = makeVouchers(9, 'Debit Note', suppliers, 'DBN');
export const PAYMENTS        = makeVouchers(18, 'Payment', suppliers, 'PMT');
export const RECEIPTS        = makeVouchers(22, 'Receipt', customers, 'RCP');
export const JOURNALS        = makeVouchers(10, 'Journal', PARTIES, 'JV');
export const CONTRAS         = makeVouchers(8, 'Contra', PARTIES, 'CNT');
export const EXPENSES        = makeVouchers(20, 'Payment', suppliers, 'EXP').map(v => ({
  ...v, category: pick(['Rent', 'Salaries', 'Utilities', 'Freight', 'Office Supplies', 'Travel', 'Marketing']),
}));

export const ALL_VOUCHERS = [
  ...SALES_INVOICES, ...PURCHASE_INV, ...RECEIPTS, ...PAYMENTS, ...JOURNALS, ...CONTRAS,
];

// ── Ledgers ──────────────────────────────────────────────────────────────────
const LEDGER_GROUPS = ['Sundry Debtors', 'Sundry Creditors', 'Bank Accounts', 'Cash-in-Hand', 'Direct Expenses', 'Indirect Expenses', 'Sales Accounts', 'Purchase Accounts', 'Duties & Taxes', 'Loans (Liability)'];
export const LEDGERS = [
  { id: 'led-cash', name: 'Cash', group: 'Cash-in-Hand', balance: 342000, type: 'Dr' },
  { id: 'led-hdfc', name: 'HDFC Bank A/c', group: 'Bank Accounts', balance: 1875000, type: 'Dr' },
  { id: 'led-icici', name: 'ICICI Bank A/c', group: 'Bank Accounts', balance: 640000, type: 'Dr' },
  { id: 'led-sales', name: 'Sales Account', group: 'Sales Accounts', balance: 8940000, type: 'Cr' },
  { id: 'led-purchase', name: 'Purchase Account', group: 'Purchase Accounts', balance: 5210000, type: 'Dr' },
  { id: 'led-gst', name: 'Output CGST', group: 'Duties & Taxes', balance: 412000, type: 'Cr' },
  ...PARTIES.map((p, i) => ({
    id: `led-${p.id}`, name: p.name, group: p.type, balance: Math.abs(p.balance),
    type: p.balance >= 0 ? 'Dr' : 'Cr', party_guid: p.guid,
  })),
];

// ── Dashboard ──────────────────────────────────────────────────────────────────
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
export { MONTHS };
let _dashCache = null;
export function dashboard() {
  if (_dashCache) return _dashCache;
  _dashCache = buildDashboard();
  return _dashCache;
}
function buildDashboard() {
  const monthlySales = MONTHS.map((month) => ({
    month, sales: between(450000, 1400000), purchase: between(300000, 950000),
  }));
  const totalSales = monthlySales.reduce((s, m) => s + m.sales, 0);
  const totalPurchase = monthlySales.reduce((s, m) => s + m.purchase, 0);
  const topCustomers = customers.slice(0, 6)
    .map(c => ({ name: c.name, revenue: between(400000, 2200000) }))
    .sort((a, b) => b.revenue - a.revenue);
  return {
    totalSales, totalPurchase,
    netProfit: Math.round(totalSales - totalPurchase - between(400000, 900000)),
    receivables: customers.reduce((s, c) => s + Math.max(0, c.outstanding), 0),
    payables: suppliers.reduce((s, c) => s + Math.max(0, c.outstanding), 0),
    cashBalance: 342000, bankBalance: 2515000,
    monthlySales, topCustomers,
    invoiceCount: SALES_INVOICES.length, purchaseCount: PURCHASE_INV.length,
  };
}

// ── Reports ──────────────────────────────────────────────────────────────────
const PL_INCOME = [
  { name: 'Sales Account', amount: 8940000, children: [
    { name: 'Domestic Sales — GST 18%', amount: 5620000 },
    { name: 'Domestic Sales — GST 12%', amount: 2110000 },
    { name: 'Export Sales (zero rated)', amount: 890000 },
    { name: 'Sales Returns', amount: -320000 },
  ] },
  { name: 'Other Income', amount: 214000, children: [
    { name: 'Interest on Deposits', amount: 96000 },
    { name: 'Discount Received', amount: 74000 },
    { name: 'Scrap Sales', amount: 44000 },
  ] },
];
const PL_EXPENSES = [
  { name: 'Purchase Account', amount: 5210000, children: [
    { name: 'Raw Material Purchase', amount: 3480000 },
    { name: 'Packing Material', amount: 940000 },
    { name: 'Trading Purchase', amount: 790000 },
  ] },
  { name: 'Direct Expenses', amount: 890000, children: [
    { name: 'Freight Inward', amount: 380000 },
    { name: 'Power & Fuel', amount: 310000 },
    { name: 'Labour Charges', amount: 200000 },
  ] },
  { name: 'Indirect Expenses', amount: 1240000, children: [
    { name: 'Rent — Godown & Office', amount: 480000 },
    { name: 'Travelling & Conveyance', amount: 260000 },
    { name: 'Professional Fees', amount: 240000 },
    { name: 'Repairs & Maintenance', amount: 160000 },
    { name: 'Bank Charges', amount: 100000 },
  ] },
  { name: 'Salaries', amount: 980000, children: [
    { name: 'Staff Salaries', amount: 720000 },
    { name: 'Director Remuneration', amount: 180000 },
    { name: 'Staff Welfare', amount: 80000 },
  ] },
];
const PL_TOTAL_INCOME = PL_INCOME.reduce((s, r) => s + r.amount, 0);
const PL_TOTAL_EXPENSES = PL_EXPENSES.reduce((s, r) => s + r.amount, 0);
export const PROFIT_LOSS = {
  income: PL_INCOME,
  expenses: PL_EXPENSES,
  // Gross profit = trading result (sales less purchases and direct expenses)
  grossProfit: PL_INCOME[0].amount - PL_EXPENSES[0].amount - PL_EXPENSES[1].amount,
  netProfit: PL_TOTAL_INCOME - PL_TOTAL_EXPENSES,
};
export const BALANCE_SHEET = {
  assets: [
    { name: 'Fixed Assets', amount: 4200000, children: [
      { name: 'Plant & Machinery', amount: 2400000 }, { name: 'Furniture & Fixtures', amount: 640000 },
      { name: 'Vehicles', amount: 820000 }, { name: 'Computers', amount: 340000 },
    ] },
    { name: 'Sundry Debtors', amount: 3120000, children: [
      { name: 'Debtors — within 30 days', amount: 1480000 }, { name: 'Debtors — 31 to 90 days', amount: 1020000 },
      { name: 'Debtors — over 90 days', amount: 620000 },
    ] },
    { name: 'Cash & Bank', amount: 2857000, children: [
      { name: 'HDFC Bank A/c', amount: 1875000 }, { name: 'ICICI Bank A/c', amount: 640000 }, { name: 'Cash-in-Hand', amount: 342000 },
    ] },
    { name: 'Closing Stock', amount: 3860000, children: [
      { name: 'Raw Material', amount: 1640000 }, { name: 'Finished Goods', amount: 1720000 }, { name: 'Consumables', amount: 500000 },
    ] },
  ],
  liabilities: [
    { name: 'Capital Account', amount: 7200000, children: [
      { name: 'Share Capital', amount: 5000000 }, { name: 'Reserves & Surplus', amount: 2200000 },
    ] },
    { name: 'Sundry Creditors', amount: 2480000, children: [
      { name: 'Creditors for Goods', amount: 1860000 }, { name: 'Creditors for Expenses', amount: 620000 },
    ] },
    { name: 'Loans (Liability)', amount: 3200000, children: [
      { name: 'HDFC Term Loan', amount: 3120000 }, { name: 'Vehicle Loan', amount: 80000 },
    ] },
    { name: 'Duties & Taxes', amount: 1157000, children: [
      { name: 'Output CGST', amount: 412000 }, { name: 'Output SGST', amount: 412000 },
      { name: 'TDS Payable', amount: 213000 }, { name: 'Professional Tax', amount: 120000 },
    ] },
  ],
};
export const TRIAL_BALANCE = LEDGERS.map(l => ({
  name: l.name, group: l.group, debit: l.type === 'Dr' ? l.balance : 0, credit: l.type === 'Cr' ? l.balance : 0,
}));

// ── GST ──────────────────────────────────────────────────────────────────────
export const GST_SUMMARY = {
  outputTax: 1258000, inputTax: 846000, netPayable: 412000,
  cgst: 206000, sgst: 206000, igst: 0,
  b2b: 168, b2c: 92, filed: true, period: 'May 2026',
  unmatched: 7,
};

// ── Notifications ──────────────────────────────────────────────────────────────
export const NOTIFICATIONS = [
  { id: 'n1', title: 'Payment received', body: '₹1,25,000 from Sharma Enterprises', type: 'success', time: '2h ago', read: false },
  { id: 'n2', title: 'GST filing due', body: 'GSTR-3B for May 2026 due in 4 days', type: 'warning', time: '5h ago', read: false },
  { id: 'n3', title: 'Low stock alert', body: 'Circuit Breaker 32A below reorder level', type: 'warning', time: '1d ago', read: false },
  { id: 'n4', title: 'Tally synced', body: '128 vouchers updated from desktop', type: 'info', time: '1d ago', read: true },
  { id: 'n5', title: 'New sales invoice', body: 'SI/0042 created for ₹8,40,000', type: 'info', time: '2d ago', read: true },
];

// ── Audit trail / My entries ────────────────────────────────────────────────────
export const AUDIT_TRAIL = Array.from({ length: 18 }).map((_, i) => ({
  id: `audit-${i + 1}`,
  voucher_type: pick(['Sales', 'Payment', 'Receipt', 'Purchase', 'Journal']),
  party_name: pick(PARTIES).name,
  amount: between(5000, 500000),
  status: pick(['synced', 'synced', 'synced', 'pending', 'failed']),
  created_at: `2026-0${between(1, 6)}-${pad(between(1, 28))} ${pad(between(9, 18))}:${pad(between(0, 59))}`,
  error: null,
}));
