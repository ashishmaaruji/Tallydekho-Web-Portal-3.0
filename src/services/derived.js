// Derived / extended sample datasets built on top of mockData.js.
// These power the deeper inventory, compliance, day-book and settings screens.
// When the real backend becomes reachable these selectors are the only place
// that needs to be swapped for live endpoints.
import * as D from './mockData';

let _s = 77777;
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
const between = (a, b) => Math.round(a + rnd() * (b - a));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const pad = n => String(n).padStart(2, '0');
const day = (m, d) => `${m > 3 ? 2025 : 2026}-${pad(m)}-${pad(d)}`;

export const ITEMS = D.STOCKS.map((s, i) => ({
  ...s,
  batch: `B-${2400 + i}`,
  expiry: day(between(1, 12), between(1, 28)),
  ageing_days: between(3, 420),
  turnover: +(rnd() * 9 + 0.2).toFixed(2),
  sold_qty: between(0, 900),
  purchased_qty: between(0, 950),
  barcode: `890${between(1000000, 9999999)}`,
  min_level: Math.max(5, Math.round(s.reorder_level * 0.5)),
  max_level: Math.round(s.reorder_level * 4),
  standard_cost: Math.round(s.closing_rate * 0.86),
  selling_price: Math.round(s.closing_rate * 1.22),
}));

export const itemById = id => ITEMS.find(i => i.id === id || i.guid === id) || ITEMS[0];

export const WAREHOUSES = D.WAREHOUSES.map((w, i) => ({
  ...w,
  code: `WH-${100 + i}`,
  address: pick(['Plot 22, MIDC Andheri', 'Kalyan Bhiwandi Road', 'Sector 4, Thane', 'Gate 7, Taloja']),
  manager: pick(['R. Kulkarni', 'S. Iyer', 'A. Sheikh', 'M. Rane']),
  capacity_pct: between(38, 96),
  itemCount: between(8, 20),
}));

export const warehouseById = id => WAREHOUSES.find(w => w.id === id || w.guid === id) || WAREHOUSES[0];

export const godownStock = whName =>
  ITEMS.slice(0, 14).map(i => ({
    id: `${whName}-${i.id}`,
    name: i.name,
    unit: i.unit,
    qty: between(-4, 320),
    rate: i.closing_rate,
    value: 0,
    category: i.category,
  })).map(r => ({ ...r, value: r.qty * r.rate }));

export const STOCK_LEDGER = ITEMS.flatMap(item =>
  Array.from({ length: 6 }).map((_, k) => {
    const inward = rnd() > 0.5;
    const qty = between(2, 140);
    return {
      id: `${item.id}-sl-${k}`,
      item: item.name,
      item_id: item.id,
      date: day(between(1, 12), between(1, 28)),
      voucher_type: inward ? pick(['Purchase', 'Stock Journal', 'Receipt Note']) : pick(['Sales', 'Delivery Note', 'Stock Journal']),
      voucher_number: `${inward ? 'PI' : 'SI'}/${between(1000, 9999)}`,
      warehouse: pick(WAREHOUSES).name,
      inward: inward ? qty : 0,
      outward: inward ? 0 : qty,
      rate: item.closing_rate,
      value: qty * item.closing_rate,
      balance: between(10, 700),
    };
  })
).sort((a, b) => (a.date < b.date ? 1 : -1));

export const TRANSFERS = Array.from({ length: 18 }).map((_, i) => {
  const from = pick(WAREHOUSES), to = pick(WAREHOUSES.filter(w => w.id !== from.id));
  const lines = Array.from({ length: between(1, 4) }).map(() => {
    const it = pick(ITEMS); const q = between(2, 60);
    return { name: it.name, unit: it.unit, qty: q, rate: it.closing_rate, value: q * it.closing_rate };
  });
  return {
    id: `tr-${i + 1}`,
    ref: `ST/${String(i + 1).padStart(4, '0')}`,
    date: day(between(1, 12), between(1, 28)),
    from: from.name,
    to: to?.name || 'Transit',
    items: lines.length,
    lines,
    qty: lines.reduce((s, l) => s + l.qty, 0),
    value: lines.reduce((s, l) => s + l.value, 0),
    status: pick(['Synced', 'Synced', 'Pending', 'Failed']),
    narration: 'Inter-godown movement',
  };
}).sort((a, b) => (a.date < b.date ? 1 : -1));

export const transferById = id => TRANSFERS.find(t => t.id === id) || TRANSFERS[0];

export const ADJUSTMENTS = Array.from({ length: 14 }).map((_, i) => {
  const it = pick(ITEMS);
  const diff = between(-40, 60);
  return {
    id: `adj-${i + 1}`,
    ref: `SA/${String(i + 1).padStart(4, '0')}`,
    date: day(between(1, 12), between(1, 28)),
    item: it.name,
    warehouse: pick(WAREHOUSES).name,
    reason: pick(['Physical count', 'Damage', 'Shrinkage', 'Sample issue', 'Re-grade']),
    diff_qty: diff,
    unit: it.unit,
    value: diff * it.closing_rate,
    status: pick(['Synced', 'Synced', 'Pending']),
  };
}).sort((a, b) => (a.date < b.date ? 1 : -1));

export const MOVEMENT = D.MONTHS.map(month => ({
  month,
  inward: between(1200, 5400),
  outward: between(900, 4900),
  value: between(400000, 1900000),
}));

export const VALUATION = [...new Set(ITEMS.map(i => i.category))].map(name => {
  const items = ITEMS.filter(i => i.category === name);
  return {
    id: name,
    name,
    items: items.length,
    qty: items.reduce((s, i) => s + i.closing_qty, 0),
    value: items.reduce((s, i) => s + i.closing_value, 0),
    method: pick(['FIFO', 'Avg. Cost', 'Std. Cost']),
  };
});

export const BANK_ACCOUNTS = [
  { id: 'ba-1', name: 'HDFC Bank — 5521', type: 'Current A/c', ifsc: 'HDFC0000521', balance: 1875000, feed: 'Connected', last_sync: '2026-06-14 09:12' },
  { id: 'ba-2', name: 'ICICI Bank — 8890', type: 'Current A/c', ifsc: 'ICIC0008890', balance: 640000, feed: 'Connected', last_sync: '2026-06-14 08:40' },
  { id: 'ba-3', name: 'Kotak OD — 3312', type: 'Overdraft', ifsc: 'KKBK0003312', balance: -420000, feed: 'Pending', last_sync: '—' },
  { id: 'ba-4', name: 'Cash-in-Hand', type: 'Cash', ifsc: '—', balance: 342000, feed: 'Manual', last_sync: '—' },
];

export const LOANS = [
  { id: 'ln-1', name: 'HDFC Term Loan', lender: 'HDFC Bank', type: 'Term Loan', principal: 5000000, outstanding: 3120000, rate: 9.25, emi: 108400, tenure: '60 months', next_due: '2026-07-05', status: 'Active' },
  { id: 'ln-2', name: 'Kotak Cash Credit', lender: 'Kotak Mahindra', type: 'Cash Credit', principal: 2500000, outstanding: 1840000, rate: 10.4, emi: 0, tenure: 'Revolving', next_due: '2026-06-30', status: 'Active' },
  { id: 'ln-3', name: 'Vehicle Loan', lender: 'ICICI Bank', type: 'Vehicle', principal: 1200000, outstanding: 264000, rate: 8.6, emi: 24500, tenure: '48 months', next_due: '2026-07-12', status: 'Active' },
  { id: 'ln-4', name: 'Machinery Loan', lender: 'SBI', type: 'Equipment', principal: 3000000, outstanding: 0, rate: 8.9, emi: 0, tenure: 'Closed', next_due: '—', status: 'Closed' },
];

export const CASH_REGISTER = Array.from({ length: 26 }).map((_, i) => {
  const inflow = rnd() > 0.35;
  const amt = between(4000, 340000);
  return {
    id: `cr-${i + 1}`,
    date: day(between(1, 12), between(1, 28)),
    voucher_number: `${inflow ? 'RCP' : 'PMT'}/${between(1000, 9999)}`,
    particulars: pick(D.PARTIES).name,
    mode: pick(['Cash', 'NEFT', 'UPI', 'Cheque', 'RTGS']),
    inflow: inflow ? amt : 0,
    outflow: inflow ? 0 : amt,
    balance: between(120000, 900000),
  };
}).sort((a, b) => (a.date < b.date ? 1 : -1));

export const DAYBOOK = Array.from({ length: 46 }).map((_, i) => {
  const type = pick(['Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra', 'Credit Note', 'Debit Note']);
  const amount = between(3000, 780000);
  return {
    id: `db-${i + 1}`,
    date: day(between(4, 12), between(1, 28)),
    voucher_type: type,
    voucher_number: `${type.slice(0, 2).toUpperCase()}/${between(1000, 9999)}`,
    party_name: pick(D.PARTIES).name,
    debit: ['Purchase', 'Payment', 'Debit Note'].includes(type) ? amount : 0,
    credit: ['Purchase', 'Payment', 'Debit Note'].includes(type) ? 0 : amount,
    amount,
    narration: `Auto entry for ${type.toLowerCase()}`,
    entered_by: pick(['Rahul Mehta', 'Priya Shah', 'Tally Sync']),
  };
}).sort((a, b) => (a.date < b.date ? 1 : -1));

const gstRow = (prefix, n) =>
  Array.from({ length: n }).map((_, i) => {
    const taxable = between(20000, 850000);
    const rate = pick([5, 12, 18, 28]);
    const tax = Math.round((taxable * rate) / 100);
    return {
      id: `${prefix}-${i + 1}`,
      gstin: `27ABCDE${1000 + i}F1Z${i % 9}`,
      party: pick(D.PARTIES).name,
      invoice: `${prefix}/${String(i + 1).padStart(4, '0')}`,
      date: day(between(4, 12), between(1, 28)),
      taxable,
      rate,
      cgst: Math.round(tax / 2),
      sgst: Math.round(tax / 2),
      igst: 0,
      total: taxable + tax,
      place: pick(['Maharashtra', 'Gujarat', 'Delhi', 'Karnataka']),
      status: pick(['Matched', 'Matched', 'Unmatched', 'Pending']),
    };
  });

export const GSTR1 = gstRow('B2B', 22);
export const GSTR2A = gstRow('P2A', 20);
export const GSTR3B = [
  { id: '3b-1', head: 'Outward taxable supplies', taxable: 8940000, cgst: 620000, sgst: 620000, igst: 18000 },
  { id: '3b-2', head: 'Zero rated supplies', taxable: 420000, cgst: 0, sgst: 0, igst: 0 },
  { id: '3b-3', head: 'Inward supplies (reverse charge)', taxable: 180000, cgst: 16200, sgst: 16200, igst: 0 },
  { id: '3b-4', head: 'Eligible ITC', taxable: 5210000, cgst: 423000, sgst: 423000, igst: 12000 },
  { id: '3b-5', head: 'Net tax payable', taxable: 0, cgst: 206000, sgst: 206000, igst: 6000 },
];
export const GST_RETURNS = [
  { id: 'r1', ret: 'GSTR-1', period: 'May 2026', due: '2026-06-11', filed_on: '2026-06-09', status: 'Filed', tax: 1258000 },
  { id: 'r2', ret: 'GSTR-3B', period: 'May 2026', due: '2026-06-20', filed_on: '—', status: 'Due', tax: 412000 },
  { id: 'r3', ret: 'GSTR-1', period: 'Apr 2026', due: '2026-05-11', filed_on: '2026-05-10', status: 'Filed', tax: 1104000 },
  { id: 'r4', ret: 'GSTR-4', period: 'FY 2025-26', due: '2026-04-30', filed_on: '2026-04-22', status: 'Filed', tax: 0 },
  { id: 'r5', ret: 'GSTR-6', period: 'May 2026', due: '2026-06-13', filed_on: '2026-06-12', status: 'Filed', tax: 24000 },
  { id: 'r6', ret: 'GSTR-9', period: 'FY 2024-25', due: '2025-12-31', filed_on: '2025-12-18', status: 'Filed', tax: 0 },
];
export const UNMATCHED = GSTR2A.filter(r => r.status !== 'Matched').map(r => ({
  ...r, reason: pick(['Not in books', 'Amount mismatch', 'GSTIN mismatch', 'Period mismatch']),
}));

export const EINVOICES = Array.from({ length: 24 }).map((_, i) => ({
  id: `ei-${i + 1}`,
  invoice: `SI/${String(i + 1).padStart(4, '0')}`,
  party: pick(D.PARTIES).name,
  date: day(between(4, 12), between(1, 28)),
  amount: between(60000, 940000),
  irn: rnd() > 0.2 ? `${between(10000000, 99999999)}a${between(1000, 9999)}c` : null,
  ack_no: rnd() > 0.2 ? `1120${between(10000000, 99999999)}` : null,
  status: pick(['Generated', 'Generated', 'Generated', 'Pending', 'Failed']),
}));

export const EWAYBILLS = Array.from({ length: 22 }).map((_, i) => ({
  id: `ewb-${i + 1}`,
  ewb_no: rnd() > 0.2 ? `${between(100000000000, 999999999999)}` : null,
  invoice: `SI/${String(i + 1).padStart(4, '0')}`,
  party: pick(D.PARTIES).name,
  date: day(between(4, 12), between(1, 28)),
  from_place: 'Mumbai',
  to_place: pick(['Pune', 'Surat', 'Nashik', 'Indore', 'Delhi']),
  distance: between(80, 1400),
  vehicle: `MH${between(10, 48)}AB${between(1000, 9999)}`,
  amount: between(60000, 940000),
  valid_till: day(between(4, 12), between(1, 28)),
  status: pick(['Generated', 'Generated', 'Pending', 'Expired', 'Failed']),
}));

export const OTHER_TAXES = [
  { id: 'ot-1', name: 'TDS — 194C Contractors', period: 'May 2026', due: '2026-06-07', amount: 84000, status: 'Filed' },
  { id: 'ot-2', name: 'TDS — 194J Professional', period: 'May 2026', due: '2026-06-07', amount: 46500, status: 'Filed' },
  { id: 'ot-3', name: 'TCS — 206C(1H)', period: 'May 2026', due: '2026-06-07', amount: 12400, status: 'Due' },
  { id: 'ot-4', name: 'Professional Tax', period: 'May 2026', due: '2026-06-15', amount: 18000, status: 'Due' },
  { id: 'ot-5', name: 'Advance Tax Q1', period: 'Q1 FY26-27', due: '2026-06-15', amount: 350000, status: 'Due' },
];

export const TAX_REGISTER = Array.from({ length: 26 }).map((_, i) => ({
  id: `tr-${i + 1}`,
  date: day(between(4, 12), between(1, 28)),
  section: pick(['194C', '194J', '194Q', '206C(1H)', 'PT']),
  party: pick(D.PARTIES).name,
  pan: `AABC${between(1000, 9999)}K`,
  gross: between(40000, 620000),
  rate: pick([0.1, 1, 2, 5, 10]),
  tax: between(400, 42000),
  challan: `CH${between(100000, 999999)}`,
  status: pick(['Paid', 'Paid', 'Pending']),
}));

export const AI_INSIGHTS = [
  { id: 'ai-1', tone: 'pos', title: 'Sales momentum is up 18% QoQ', body: 'Q4 FY25-26 sales of ₹42.4L are tracking 18% above the previous quarter, driven mainly by Sharma Enterprises and Metro Wholesale.' },
  { id: 'ai-2', tone: 'warn', title: '₹6.4L of receivables crossed 90 days', body: '7 customers hold overdue balances beyond 90 days. Kohinoor Industries alone accounts for ₹2.1L — consider a payment reminder run.' },
  { id: 'ai-3', tone: 'note', title: 'Purchase concentration risk', body: '54% of purchases route through 2 suppliers. Adding a third source for packaging material would reduce delivery risk.' },
  { id: 'ai-4', tone: 'neg', title: '4 items are in negative stock', body: 'Negative balances usually mean sales were recorded before purchase entries. Reconcile the affected godowns before month-end close.' },
  { id: 'ai-5', tone: 'pos', title: 'GST input utilisation improved', body: 'Input credit utilisation is at 67% versus 52% last quarter, lowering the net cash outflow on GSTR-3B by roughly ₹1.4L.' },
];

export const NOTIFICATIONS = [
  { id: 'n1', title: 'Low Stock Alert', body: 'Electronic Component A has only 5 units left (reorder level 20).', category: 'Stock', type: 'warning', group: 'Today', time: '10 min', read: false, action: { label: 'Reorder', to: '/inventory/reorder-queue' } },
  { id: 'n2', title: 'Outstanding Receivable', body: 'Sharma Enterprises owes \u20b91,25,000 \u2014 overdue by 8 days.', category: 'Receivables', type: 'error', group: 'Today', time: '1 hr', read: false, action: { label: 'View party', to: '/financials/receivables-payables' } },
  { id: 'n3', title: 'GSTR-3B Filing Reminder', body: 'GSTR-3B for May is due on 20th. 3 returns pending.', category: 'Compliance', type: 'info', group: 'Today', time: '8:00 AM', read: false, action: { label: 'View GST', to: '/compliance/gst' } },
  { id: 'n4', title: 'Payment Received', body: '\u20b91,25,000 received from Sterling Mart against SI/0042.', category: 'Payments', type: 'success', group: 'Today', time: '3 hr', read: false, action: { label: 'View receipt', to: '/vouchers/receipt' } },
  { id: 'n5', title: 'E-Invoice IRN Pending', body: '6 invoices are pending IRN generation.', category: 'Compliance', type: 'success', group: 'Yesterday', time: 'Yesterday', read: false, action: { label: 'Generate IRN', to: '/compliance/einvoice' } },
  { id: 'n6', title: 'E-Way Bill Pending', body: '2 invoices need an E-Way Bill before dispatch.', category: 'Compliance', type: 'info', group: 'Yesterday', time: 'Yesterday', read: false, action: { label: 'Generate EWB', to: '/compliance/eway-bill' } },
  { id: 'n7', title: 'Negative Stock', body: 'Cement Bag 50kg is showing a negative closing balance.', category: 'Stock', type: 'error', group: 'Yesterday', time: 'Yesterday', read: false, action: { label: 'View items', to: '/inventory/negative-stock' } },
  { id: 'n8', title: 'Loan EMI Due', body: 'HDFC Term Loan EMI \u20b91,08,400 is due on 05 Jul.', category: 'Payments', type: 'warning', group: 'Earlier', time: '2 days', read: true, action: { label: 'View loans', to: '/financials/loans-ods' } },
  { id: 'n9', title: 'Bank Feed Refreshed', body: 'HDFC 5521 \u2014 18 new transactions imported.', category: 'System', type: 'info', group: 'Earlier', time: '3 days', read: true, action: { label: 'View cash & bank', to: '/financials/cash-bank' } },
  { id: 'n10', title: 'Tally Synced', body: '128 vouchers updated from the desktop agent.', category: 'System', type: 'success', group: 'Earlier', time: '4 days', read: true, action: { label: 'View day book', to: '/compliance/daybook' } },
];


export const CASHFLOW = D.MONTHS.map(month => {
  const inflow = between(500000, 1500000);
  const outflow = between(350000, 1200000);
  return { month, inflow, outflow, net: inflow - outflow };
});

export const PROFORMA = D.SALES_ORDERS.slice(0, 9).map((v, i) => ({
  ...v, voucher_number: `PF/${String(i + 1).padStart(4, '0')}`, voucher_type: 'Proforma', status: pick(['Draft', 'Pending', 'Paid']),
}));

export const QUOTATIONS = D.SALES_ORDERS.slice(9, 17).map((v, i) => ({
  ...v, voucher_number: `QT/${String(i + 1).padStart(4, '0')}`, voucher_type: 'Quotation', status: pick(['Draft', 'Pending']),
}));

export const ageBucket = d => (d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : d <= 180 ? '91-180' : '180+');

/** Sample data is authored for FY 2025-26; earlier years are scaled/shifted so
 *  the FY selector visibly changes every register instead of being cosmetic. */
export const fyScale = fy => (fy?.startDate && fy.startDate < '2025-04-01' ? 0.84 : 1);

export function applyFY(rows, fy) {
  if (!Array.isArray(rows)) return [];
  const shift = fy?.startDate && fy.startDate < '2025-04-01';
  if (!shift) return rows;
  return rows.map(r => ({
    ...r,
    date: typeof r.date === 'string' ? String(Number(r.date.slice(0, 4)) - 1) + r.date.slice(4) : r.date,
    amount: r.amount != null ? Math.round(r.amount * 0.84) : r.amount,
  }));
}

export const withStatus = arr =>
  arr.map((v, i) => ({ ...v, status: v.is_cancelled ? 'Cancelled' : ['Paid', 'Paid', 'Pending', 'Overdue', 'Draft'][i % 5] }));

export { between, pick };
