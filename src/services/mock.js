// ─────────────────────────────────────────────────────────────────────────────
// Mock router — intercepts every API call and returns realistic sample data
// so the portal is fully browsable without the LAN Node backend.
// Returns `undefined` when a route isn't mocked (caller falls through to fetch).
// ─────────────────────────────────────────────────────────────────────────────
import * as D from './mockData';

const ok   = (data) => ({ success: true, data });
const list = (arr)  => ({ success: true, data: arr });

const bankLedgers = D.LEDGERS.filter(l => l.group === 'Bank Accounts' || l.group === 'Cash-in-Hand');
const salesLedgers = D.LEDGERS.filter(l => l.group === 'Sales Accounts');
const purchaseLedgers = D.LEDGERS.filter(l => l.group === 'Purchase Accounts');

function statement(id) {
  const entries = D.ALL_VOUCHERS.slice(0, 24).map((v, i) => ({
    id: `${id}-e${i}`, date: v.date, voucher_type: v.voucher_type,
    voucher_number: v.voucher_number, particulars: v.party_name,
    debit: i % 2 === 0 ? v.amount : 0, credit: i % 2 === 0 ? 0 : v.amount,
    running: D.between(50000, 900000),
  }));
  return { opening: 120000, closing: 342000, entries };
}

// path already has query string stripped by caller
export function mockRoute(method, rawPath, body) {
  const path = (rawPath || '').split('?')[0];
  const m = (method || 'GET').toUpperCase();
  const has = (s) => path.includes(s);
  const is  = (s) => path === s;

  // ── Auth ─────────────────────────────────────────────────────────────────
  if (is('/send-otp')) return ok({ sent: true });
  if (is('/verify-otp')) return ok({ token: 'mock-token-' + Date.now(), user: D.USER, is_paired: true });
  if (has('/verify-pin')) return ok({ token: 'mock-token-' + Date.now(), user: D.USER });
  if (is('/set-pin') || is('/remove-pin') || has('/reset-pin')) return ok({});
  if (is('/two-fa-status')) return ok({ enabled: false, biometric: false });
  if (is('/me')) return ok(D.USER);
  if (is('/onboarding')) return ok(D.USER);
  if (is('/verify')) return ok({ user: D.USER });
  if (is('/api/auth/me')) return ok(D.USER);
  if (is('/api/auth/user-settings')) {
    if (m === 'PATCH') return ok(body || {});
    return ok({ language: 'English', currency: 'INR', number_format: 'Indian', date_format: 'DD/MM/YYYY', decimal_places: 2 });
  }

  // ── Pairing ────────────────────────────────────────────────────────────────
  if (is('/pairing') || is('/pairing-device')) return ok({ paired: true, deviceName: 'Tally Prime — Desktop', pairedAt: '2026-06-01' });

  // ── Companies ────────────────────────────────────────────────────────────────
  if (is('/companies') || is('/api/companies')) return ok({ companies: D.COMPANIES });
  if (has('/api/company/') && has('/logo')) return ok({ logo: null });
  if (has('/api/company/profile')) return ok(body || {});

  // ── Dashboard ──────────────────────────────────────────────────────────────
  if (is('/dashboard')) {
    const d = D.dashboard();
    return ok({
      ...d,
      // Per-KPI trend % chips (null hides the chip) — mirrors the live endpoint.
      trends: d.trends || {
        cashInHand: 4.2, bankBalance: 31, receivables: -6.1, payables: 3.4,
        loansODs: null, receipts: 12.5, payments: -8.2,
      },
    });
  }

  // ── Vouchers (POST /vouchers used by many modules) ──────────────────────────
  if (is('/vouchers')) return list(D.ALL_VOUCHERS);
  if (is('/voucher-detail')) {
    const v = D.ALL_VOUCHERS.find(x => x.id === body?.voucherId || x.guid === body?.voucherId) || D.ALL_VOUCHERS[0];
    return ok(v);
  }

  // ── Register endpoints (/api/*) ──────────────────────────────────────────────
  if (has('/api/sales/orders'))      return list(D.SALES_ORDERS);
  if (has('/api/purchase/orders'))   return list(D.PURCHASE_ORDERS);
  if (has('/api/sales/credit-notes'))return list(D.CREDIT_NOTES);
  if (has('/api/purchase/debit-notes')) return list(D.DEBIT_NOTES);
  if (has('/api/sales/delivery-notes')) return list(D.DELIVERY_NOTES);
  if (has('/api/vouchers/my-entries')) return list(D.AUDIT_TRAIL);
  if (has('/api/sales/ledger-accounts')) return list(salesLedgers);
  if (has('/api/purchase/ledger-accounts')) return list(purchaseLedgers);
  if (has('/api/bank-ledgers'))      return list(bankLedgers);

  // ── Parties ──────────────────────────────────────────────────────────────────
  if (is('/parties') || has('/api/parties')) return list(D.PARTIES);

  // ── Stocks ──────────────────────────────────────────────────────────────────
  if (is('/stock-dashboard')) return ok({
    totalItems: D.STOCKS.length,
    totalValue: D.STOCKS.reduce((s, i) => s + i.value, 0),
    lowStock: D.STOCKS.filter(i => i.status === 'Low').length,
    negativeStock: D.STOCKS.filter(i => i.status === 'Negative').length,
    warehouses: D.WAREHOUSES.length,
    items: D.STOCKS,
  });
  if (is('/stock-filters')) return ok({
    categories: [...new Set(D.STOCKS.map(i => i.category))],
    warehouses: D.WAREHOUSES.map(w => w.name),
    units: [...new Set(D.STOCKS.map(i => i.unit))],
  });
  if (is('/stocks')) return ok({ stocks: D.STOCKS, totalStocks: D.STOCKS.length });
  if (is('/stock')) { const it = D.STOCKS.find(s => s.id === body?.stockId || s.name === body?.name) || D.STOCKS[0]; return ok(it); }
  if (has('/api/stocks/warehouses')) return list(D.WAREHOUSES);
  if (has('/api/stocks/items/') && has('/godowns')) {
    return list(D.WAREHOUSES.map(w => ({ warehouse: w.name, qty: D.between(0, 200), value: D.between(0, 400000) })));
  }

  // ── Ledgers ──────────────────────────────────────────────────────────────────
  if (is('/ledgers')) return list(D.LEDGERS);
  if (is('/ledger')) { const l = D.LEDGERS.find(x => x.id === body?.ledgerId) || D.LEDGERS[0]; return ok({ ...l, ...statement(l.id) }); }
  if (is('/ledger-vouchers')) return list(D.ALL_VOUCHERS.slice(0, 20));
  if (is('/ledger-trend')) return list(D.MONTHS ? [] : []);
  if (has('/api/ledgers/fy-balances')) return list(D.LEDGERS.map(l => ({ id: l.id, name: l.name, group: l.group, balance: l.balance, type: l.type })));
  if (has('/api/ledgers/') && has('/statement')) {
    const id = path.split('/api/ledgers/')[1].split('/')[0];
    return ok(statement(id));
  }

  // ── Financials ────────────────────────────────────────────────────────────────
  if (is('/cash-bank')) return ok({
    accounts: bankLedgers.map(l => ({ name: l.name, group: l.group, balance: l.balance, type: l.type })),
    totalCash: 342000, totalBank: 2515000,
    transactions: D.ALL_VOUCHERS.filter(v => v.voucher_type === 'Payment' || v.voucher_type === 'Receipt' || v.voucher_type === 'Contra').slice(0, 30),
  });
  if (is('/receivables-payables')) return ok({
    receivables: D.PARTIES.filter(p => p.party_type === 'customer').map(p => ({ name: p.name, amount: p.outstanding, overdue: D.between(0, p.outstanding), days: D.between(0, 120) })),
    payables: D.PARTIES.filter(p => p.party_type === 'supplier').map(p => ({ name: p.name, amount: p.outstanding, overdue: D.between(0, p.outstanding), days: D.between(0, 90) })),
  });
  if (is('/expenses')) {
    const expList = D.EXPENSES.map(e => ({
      ref: e.voucher_number, vendor: e.party_name, category: e.category,
      date: e.date, amount: e.amount, voucher_type: 'Payment',
    }));
    const catMap = {};
    expList.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    const categories = Object.entries(catMap).map(([name, amount]) => ({ name, amount }));
    const totalExpenses = expList.reduce((s, e) => s + e.amount, 0);
    return ok({ expenses: expList, categories, summary: { totalExpenses, count: expList.length } });
  }

  // ── Reports ──────────────────────────────────────────────────────────────────
  if (is('/reports/pl')) {
    const income = D.PROFIT_LOSS.income.map(r => ({ name: r.name, closing_balance: r.amount }));
    const expenses = D.PROFIT_LOSS.expenses.map(r => ({ name: r.name, closing_balance: r.amount }));
    const totalIncome = D.PROFIT_LOSS.income.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = D.PROFIT_LOSS.expenses.reduce((s, r) => s + r.amount, 0);
    const directGrp = D.PROFIT_LOSS.expenses.find(e => e.name === 'Direct Expenses');
    const indirectGrp = D.PROFIT_LOSS.expenses.find(e => e.name === 'Indirect Expenses');
    return ok({
      income, expenses,
      monthlySales: D.dashboard().monthlySales,
      summary: { totalIncome, totalExpenses, grossProfit: D.PROFIT_LOSS.grossProfit, netProfit: D.PROFIT_LOSS.netProfit },
      pl: {
        directExpenses: directGrp?.amount || 0,
        indirectExpenses: indirectGrp?.amount || 0,
        directExpLedgers: (directGrp?.children || []).map(c => ({ name: c.name, parent: 'Direct Expenses', amount: c.amount })),
        indirectExpLedgers: (indirectGrp?.children || []).map(c => ({ name: c.name, parent: 'Indirect Expenses', amount: c.amount })),
      },
    });
  }
  if (is('/reports/balance-sheet')) {
    const assets = D.BALANCE_SHEET.assets.map(r => ({ name: r.name, closing_balance: r.amount }));
    const liabilities = D.BALANCE_SHEET.liabilities.map(r => ({ name: r.name, closing_balance: r.amount }));
    const totalAssets = D.BALANCE_SHEET.assets.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = D.BALANCE_SHEET.liabilities.reduce((s, r) => s + r.amount, 0);
    return ok({ assets, liabilities, summary: { totalAssets, totalLiabilities } });
  }
  if (is('/reports/trial-balance')) {
    return ok({ ledgers: D.TRIAL_BALANCE.map(r => ({
      name: r.name, parent: r.group, opening_balance: 0,
      debit: r.debit, credit: r.credit, closing_balance: r.debit - r.credit,
    })) });
  }

  // ── GST / Compliance ─────────────────────────────────────────────────────────
  if (is('/gst-summary')) return ok({
    summary: {
      cgst: D.GST_SUMMARY.cgst, sgst: D.GST_SUMMARY.sgst, igst: D.GST_SUMMARY.igst,
      total: D.GST_SUMMARY.outputTax,
    },
    ...D.GST_SUMMARY,
  });

  // ── Tally write + audit ────────────────────────────────────────────────────────
  if (has('/tally/audit-trail') && has('/retry')) return ok({ retried: true });
  if (has('/tally/audit-trail')) return list(D.AUDIT_TRAIL);
  if (has('/tally/voucher/cancel')) return ok({ cancelled: true });
  if (has('/tally/voucher/')) return ok({ voucherNumber: 'NEW/' + D.between(1000, 9999), created: true });
  if (has('/tally/master/')) return ok({ guid: 'new-' + Date.now(), created: true });

  return undefined; // not mocked — fall through to real fetch
}
