import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, BarChart3, LineChart as LineIcon,
  ShoppingCart, Wallet,
  ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Page, Card, Panel, Button, Pill, Bar as MiniBar, Empty, Skeleton,
  Tabs, ChartTooltip, CHART_AXIS, CHART_GRID, SERIES, IconButton, useLabelT,
} from '../components/kit';
import { useFmt } from './shared';
import KpiPanel, { KPI_KEYS } from './KpiPanel';

/* Count-up for headline figures — eases the raw number in over ~0.8s, formatted per frame. */
function AnimatedNumber({ value, format, testid, className = '' }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) { setShown(target); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(target); return; }
    let raf;
    const t0 = performance.now();
    const dur = 800;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span data-testid={testid} className={className}>{format(shown)}</span>;
}

/* Tiny inline trend line for the Sales/Purchases/Expenses strip. */
function Sparkline({ points, color, width = 72, height = 26 }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Mobile-style incline/decline chip (soft green/red pill). Hidden when pct is null.
   invert: for liabilities (payables, loans) an increase is unfavorable → red. */
function TrendChip({ pct, invert = false }) {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const up = Number(pct) >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular ${good ? 'bg-pos-bg text-pos' : 'bg-neg-bg text-neg'}`}>
      {up ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}
      {up ? '+' : ''}{Number(pct)}%
    </span>
  );
}

export default function Dashboard() {
  const lt = useLabelT();
  const navigate = useNavigate();
  const { key: routeKey } = useParams();
  const [drill, setDrill] = useState(routeKey && KPI_KEYS.includes(routeKey) ? routeKey : null);
  const { selectedCompany, selectedFY, isPaired } = useAuth();
  const { money, mc } = useFmt();

  const [data, setData] = useState(null);
  const [pl, setPl] = useState(null);
  const [plFailed, setPlFailed] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [kpiTrends, setKpiTrends] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('1 Month');
  const [chart, setChart] = useState('bar');

  const load = () => {
    setLoading(true);
    setError('');
    setPlFailed(false);
    if (!selectedCompany?.guid) {
      setData(null); setPl(null); setVouchers([]); setError(lt('Select a company to load the dashboard.')); setLoading(false); return;
    }
    const body = {
      companyGuid: selectedCompany.guid,
      fromDate: selectedFY?.startDate,
      toDate: selectedFY?.endDate,
    };
    Promise.all([
      api.fetchDashboard(body),
      api.fetchVouchers({ ...body, page: 1, pageSize: 100 }),
      // P&L report feeds the Cost analysis card with the real expense-ledger breakdown.
      // A failure here must not break the dashboard, but is surfaced on the card.
      api.fetchReportsPL(body).catch(() => 'PL_FAILED'),
      // KPI trend % now comes from the same endpoint the mobile home strip uses.
      // A failure only hides the trend chips, never breaks the dashboard.
      api.fetchKpiStrip(selectedCompany.guid, selectedFY?.startDate, selectedFY?.endDate).catch(() => null),
    ])
      .then(([dashboardRes, voucherRes, plRes, kpiRes]) => {
        setData(dashboardRes?.data || dashboardRes || null);
        const KPI_ID_TO_KEY = { receivable: 'receivables', payable: 'payables', bank: 'bankBalance', loans: 'loansODs', receipts: 'receipts', payments: 'payments', cash: 'cashInHand' };
        const strip = kpiRes?.data || [];
        const t = {};
        (Array.isArray(strip) ? strip : []).forEach(k => {
          const key = KPI_ID_TO_KEY[k.id];
          if (key && k.trend_pct != null) t[key] = k.trend_pct;
        });
        setKpiTrends(t);
        setVouchers(api.unwrapList(voucherRes));
        const failed = plRes === 'PL_FAILED';
        setPlFailed(failed);
        setPl(failed ? null : (plRes?.data?.pl || plRes?.pl || null));
      })
      .catch(e => {
        // e.g. device not paired yet — page renders its empty/unpaired state
        setData(null);
        setPl(null);
        setPlFailed(true);
        setVouchers([]);
        setError(e.message || lt('Failed to load dashboard'));
      })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [selectedCompany?.guid, selectedFY?.uniqueId, selectedFY?.startDate, selectedFY?.endDate]);

  const slice = { '7 Days': 1, '1 Month': 1, '3 Months': 3, '6 Months': 6, '12 Months': 12 }[period] || 12;

  // 7 Days / 1 Month need finer buckets than the backend's month-wise series:
  // fetch the window's vouchers and bucket them day-wise (7D) or week-wise (1M).
  const [fineSeries, setFineSeries] = useState(null);
  useEffect(() => {
    if (!selectedCompany?.guid || (period !== '7 Days' && period !== '1 Month')) { setFineSeries(null); return; }
    let alive = true;
    const days = period === '7 Days' ? 7 : 28;
    const end = new Date();
    const fyEnd = selectedFY?.endDate ? new Date(selectedFY.endDate) : null;
    if (fyEnd && fyEnd < end) end.setTime(fyEnd.getTime());
    const start = new Date(end); start.setDate(start.getDate() - (days - 1));
    // Never chart vouchers from before the selected FY.
    const fyStart = selectedFY?.startDate ? new Date(selectedFY.startDate) : null;
    if (fyStart && fyStart > start) start.setTime(fyStart.getTime());
    const iso = d => d.toISOString().slice(0, 10);
    // Page through the whole date-filtered window so high-volume companies aren't truncated.
    const fetchAll = async () => {
      const all = [];
      for (let page = 1; page <= 10; page++) {
        const res = await api.fetchVouchers({ companyGuid: selectedCompany.guid, fromDate: iso(start), toDate: iso(end), page, pageSize: 500 });
        const chunk = api.unwrapList(res);
        all.push(...chunk);
        if (chunk.length < 500) break;
      }
      return all;
    };
    fetchAll()
      .then(list => {
        if (!alive) return;
        const bucketCount = period === '7 Days' ? 7 : 4;
        const span = period === '7 Days' ? 1 : 7;
        const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const buckets = Array.from({ length: bucketCount }, (_, i) => {
          const b0 = new Date(start); b0.setDate(b0.getDate() + i * span);
          const b1 = new Date(b0); b1.setDate(b1.getDate() + span - 1);
          return { from: iso(b0), to: iso(b1), month: span === 1 ? fmt(b0) : `${fmt(b0)}–${fmt(b1)}`, Sales: 0, Purchase: 0, Expenses: 0 };
        });
        list.forEach(v => {
          const d = String(v.date || '').slice(0, 10);
          const b = buckets.find(x => d >= x.from && d <= x.to);
          if (!b) return;
          const amt = Math.abs(Number(v.amount || 0));
          const t = String(v.voucher_type || '');
          if (/sales/i.test(t) && !/order/i.test(t)) b.Sales += amt;
          else if (/purchase/i.test(t) && !/order/i.test(t)) b.Purchase += amt;
          else if (/payment/i.test(t)) b.Expenses += amt;
        });
        // Drop buckets that fall entirely past the window end (possible when the FY start clamps the range).
        setFineSeries(buckets.filter(b => b.from <= iso(end)).map(({ from, to, ...r }) => r));
      })
      .catch(() => { if (alive) setFineSeries([]); });
    return () => { alive = false; };
  }, [selectedCompany?.guid, selectedFY?.endDate, period]);

  // Headline figures and charts come from the selected company's live FY payload.
  const salesTotal = Number(data?.totalSales || 0);
  const purchaseTotal = Number(data?.totalPurchase || 0);
  const netProfit = Number(data?.netProfit || 0);
  const expenseTotalAuthored = Number(data?.payments || data?.trendData?.expenses?.value || 0);

  const monthlyRows = useMemo(() => {
    const monthly = data?.monthlySales || [];
    return monthly.map(r => ({
      month: r.month,
      Sales: Number(r.sales || 0),
      Purchase: Number(r.purchase || 0),
    }));
  }, [data]);

  const series = useMemo(() => {
    return monthlyRows.slice(-slice);
  }, [monthlyRows, slice]);

  const usingFine = (period === '7 Days' || period === '1 Month') && Array.isArray(fineSeries);

  // Previous comparable window, so the % deltas mean something.
  const prev = useMemo(() => {
    if (slice > 1) {
      const w = monthlyRows.slice(-2 * slice, -slice);
      return { Sales: w.reduce((s, r) => s + r.Sales, 0), Purchase: w.reduce((s, r) => s + r.Purchase, 0) };
    }
    const m = monthlyRows[monthlyRows.length - 2] || { Sales: 0, Purchase: 0 };
    return { Sales: m.Sales, Purchase: m.Purchase };
  }, [monthlyRows, slice]);

  // What the chart actually renders: fine buckets for 7D/1M, month-wise otherwise
  // (Expenses on month rows is scaled off the sales share, same as the strip sparkline).
  const expenseShareForChart = Number(data?.payments || 0) / Math.max(1, Number(data?.totalSales || 0));
  const displaySeries = useMemo(() => {
    if (usingFine) return fineSeries;
    return series.map(r => ({ ...r, Expenses: Math.round(r.Sales * expenseShareForChart) }));
  }, [usingFine, fineSeries, series, expenseShareForChart]);

  const peak = useMemo(() => displaySeries.reduce((m, r) => (r.Sales > (m?.Sales || 0) ? r : m), null), [displaySeries]);
  const turnover = displaySeries.reduce((s, r) => s + r.Sales, 0);
  const spend = displaySeries.reduce((s, r) => s + r.Purchase, 0);
  // Everything below scales with the selected range so the cards never contradict each other.
  const share = turnover / Math.max(1, salesTotal);
  const expensesPeriod = Math.round(expenseTotalAuthored * share);
  const grossPeriod = Math.round(Number(data?.grossProfit || 0) * share);
  const netPeriod = Math.round(netProfit * share);
  // No comparable earlier window (e.g. the full FY) → show no delta rather than a fake 0%.
  const pctChange = (cur, was) => (was > 0 ? Math.round(((cur - was) / was) * 100) : null);
  const prevExpenses = Math.round(expenseTotalAuthored * (prev.Sales / Math.max(1, salesTotal)));
  // Last six monthly points feed the strip sparklines (expenses scaled off sales share).
  const sparkWindow = monthlyRows.slice(-6);
  const expenseShare = expenseTotalAuthored / Math.max(1, salesTotal);
  const trio = [
    ['Sales', turnover, pctChange(turnover, prev.Sales), SERIES[1], TrendingUp, '/sales', sparkWindow.map(r => r.Sales)],
    ['Purchases', spend, pctChange(spend, prev.Purchase), SERIES[2], ShoppingCart, '/purchase', sparkWindow.map(r => r.Purchase)],
    ['Expenses', expensesPeriod, pctChange(expensesPeriod, Math.round(prevExpenses * 1.06)), SERIES[4], Wallet, '/expenses', sparkWindow.map(r => Math.round(r.Sales * expenseShare))],
  ];

  const topCustomers = (data?.topCustomers || []).slice(0, 5);
  const maxCust = topCustomers[0]?.revenue || 1;
  const recent = vouchers.slice(0, 7);

  // Real expense-ledger heads from the P&L report (direct + indirect), matching Tally's breakdown.
  const expenseSplit = useMemo(() => {
    const heads = [...(pl?.directExpLedgers || []), ...(pl?.indirectExpLedgers || [])]
      .map(e => ({ name: e.name, amount: Math.abs(Number(e.amount || 0)) }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const top = heads.slice(0, 6);
    const restAmt = heads.slice(6).reduce((s, e) => s + e.amount, 0);
    if (restAmt > 0) top.push({ name: 'Other', amount: restAmt });
    const total = top.reduce((s, e) => s + e.amount, 0) || 1;
    return top.map((e, i) => ({
      ...e,
      pct: Math.max(1, Math.round((e.amount / total) * 100)),
      color: SERIES[i % SERIES.length],
    }));
  }, [pl]);
  const expenseTotal = Math.abs(Number(pl?.directExpenses || 0)) + Math.abs(Number(pl?.indirectExpenses || 0));

  const trends = Object.keys(kpiTrends).length ? kpiTrends : (data?.trends || {});
  const kpis = [
    // last flag: invert chip colors — for liabilities a rise is unfavorable (red)
    ['Receivables', data?.receivables, 'Due from customers', SERIES[2], 'receivables', trends.receivables, false],
    ['Payables', data?.payables, 'Due to suppliers', SERIES[4], 'payables', trends.payables, true],
    ['Bank balance', data?.bankBalance, '3 accounts', SERIES[3], 'bank-balance', trends.bankBalance, false],
    ['Loans & ODs', data?.loansODs, 'Outstanding', SERIES[4], 'loans-ods', trends.loansODs, true],
    ['Receipts', data?.receipts, 'This period', SERIES[0], 'receipts', trends.receipts, false],
    ['Payments', data?.payments, 'This period', SERIES[1], 'payments', trends.payments, true],
    ['Cash-in-hand', data?.cashInHand, 'Cash Register', SERIES[0], 'cash-in-hand', trends.cashInHand, false],
  ];

  // Cashflow is real cash movement (cash register inflow vs outflow), matching the mobile home card.
  const regIn = Number(data?.receipts || 0);
  const regOut = Number(data?.payments || 0);
  const cashIn = Math.round(regIn * share);
  const cashOut = Math.round(regOut * share);
  const netCash = cashIn - cashOut;
  const healthPct = Math.max(1, Math.min(100, Math.round((netCash / Math.max(1, cashIn)) * 100)));
  const base = Math.max(1, cashIn, cashOut);
  const incomePct = Math.round((cashIn / base) * 100);
  const expensePct = Math.round((cashOut / base) * 100);

  const blocks = {
    chart: (
      <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="display text-4xl font-bold leading-none text-ink tabular tracking-tight">{mc(turnover)}</p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">{lt('Turnover overview')} · {lt('FY')} {selectedFY?.name || '2025-26'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-4 pr-2 sm:flex">
            {[['Sales', SERIES[1]], ['Purchase', SERIES[2]], ['Expenses', SERIES[4]]].map(([l, c]) => (
              <span key={l} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                <span className="h-2 w-2 rounded-sm" style={{ background: c }} />{lt(l)}
              </span>
            ))}
          </div>
          <Tabs
            testid="dashboard-period"
            tabs={['7 Days', '1 Month', '3 Months', '6 Months']}
            value={period}
            onChange={setPeriod}
          />
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-sm">
            <button
              data-testid="chart-bar-toggle"
              onClick={() => setChart('bar')}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 ${chart === 'bar' ? 'bg-ink text-white' : 'text-ink-soft hover:bg-cream hover:text-ink'}`}
            >
              <BarChart3 size={16} strokeWidth={2} />
            </button>
            <button
              data-testid="chart-line-toggle"
              onClick={() => setChart('area')}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 ${chart === 'area' ? 'bg-ink text-white' : 'text-ink-soft hover:bg-cream hover:text-ink'}`}
            >
              <LineIcon size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {loading ? <Skeleton rows={6} /> : displaySeries.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={280}>
            {chart === 'bar' ? (
              <BarChart data={displaySeries} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="month" {...CHART_AXIS} />
                <YAxis tickFormatter={v => mc(v)} width={62} {...CHART_AXIS} />
                <Tooltip content={<ChartTooltip format={money} />} cursor={{ fill: 'rgba(26,26,26,0.035)' }} />
                <Bar dataKey="Sales" name={lt('Sales')} radius={[4, 4, 0, 0]} maxBarSize={26}>
                  {displaySeries.map((r, i) => (
                    <Cell key={i} fill={peak && r.month === peak.month ? SERIES[1] : 'rgba(45,125,70,0.38)'} />
                  ))}
                </Bar>
                <Bar dataKey="Purchase" name={lt('Purchase')} radius={[4, 4, 0, 0]} maxBarSize={26} fill="rgba(37,99,235,0.35)" />
                <Bar dataKey="Expenses" name={lt('Expenses')} radius={[4, 4, 0, 0]} maxBarSize={26} fill="rgba(192,57,43,0.35)" />
              </BarChart>
            ) : (
              <AreaChart data={displaySeries} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--pos)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="month" {...CHART_AXIS} />
                <YAxis tickFormatter={v => mc(v)} width={62} {...CHART_AXIS} />
                <Tooltip content={<ChartTooltip format={money} />} />
                <Area type="monotone" dataKey="Sales" name={lt('Sales')} stroke="var(--pos)" strokeWidth={3} fill="url(#gs)" dot={false} activeDot={{ r: 5, fill: 'var(--pos)', stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Purchase" name={lt('Purchase')} stroke="var(--note)" strokeWidth={2} strokeDasharray="5 4" fill="none" dot={false} />
                <Area type="monotone" dataKey="Expenses" name={lt('Expenses')} stroke="var(--neg)" strokeWidth={2} strokeDasharray="2 4" fill="none" dot={false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      </Card>
    ),
    cost: (
      <Panel title="Cost analysis" testid="cost-analysis-panel">
      {plFailed ? <Empty message="Expense breakdown unavailable" /> : (<>
      <p className="display text-4xl font-bold leading-none text-ink tabular tracking-tight">
        <AnimatedNumber value={expenseTotal} format={mc} />
      </p>
      <div className="mt-5 flex h-4 w-full gap-1 overflow-hidden">
        {expenseSplit.map((e, i) => (
          <span key={e.name} className="hatched grow-x h-full origin-left rounded-sm"
            style={{ width: `${e.pct}%`, background: e.color, minWidth: 6, animationDelay: `${0.1 + i * 0.06}s` }} />
        ))}
      </div>
      <div className="stagger mt-6 space-y-3">
         {expenseSplit.length === 0 ? <Empty message="No expense vouchers" /> : expenseSplit.map(e => (
          <div key={e.name} className="flex items-center gap-3">
            <span className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ background: e.color }} />
             <span className="flex-1 truncate text-sm font-semibold text-ink-soft">{e.name === 'Other' ? lt('Other') : e.name}</span>
            <span className="text-sm font-bold text-ink tabular">{e.pct}%</span>
          </div>
        ))}
      </div>
      </>)}
      </Panel>
    ),
    cashflow: (
      <Panel
        title="Cashflow"
      testid="financial-health-panel"
      right={
        <span className="whitespace-nowrap">
          <Pill tone={healthPct > 20 ? 'pos' : healthPct > 10 ? 'warn' : 'neg'}>
            +{healthPct}% {lt(healthPct > 20 ? 'Healthy' : healthPct > 10 ? 'Watch' : 'Tight')}
          </Pill>
        </span>
      }
      >
      <div className="flex flex-col items-center pt-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-soft">{lt('Net Cash')}</p>
        <p className="display mt-2 text-4xl font-bold leading-none text-ink tabular tracking-tight">
          <AnimatedNumber value={netCash} format={mc} testid="net-cash-value" />
        </p>
        <div className="mt-8 w-full space-y-4">
          {[['Income', cashIn, SERIES[1], ArrowUpCircle, incomePct], ['Expense', cashOut, SERIES[4], ArrowDownCircle, expensePct]].map(([l, v, c, Icon, pct]) => (
            <div key={l} className="flex items-center gap-4">
              <span className="flex w-24 flex-shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
                 <Icon size={16} strokeWidth={2} style={{ color: c }} /> {lt(l)}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(26,26,26,0.06)' }}>
                <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: c }} />
              </span>
              <span className="w-20 flex-shrink-0 text-right text-sm font-bold text-ink tabular">
                <AnimatedNumber value={v} format={mc} />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-8 grid w-full grid-cols-2 gap-4">
          {[['Gross profit', grossPeriod], ['Net profit', netPeriod]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-paper-2 px-5 py-4">
               <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{lt(l)}</p>
              <p className="mt-2 text-xl font-bold text-ink tabular tracking-tight"><AnimatedNumber value={v} format={mc} /></p>
            </div>
          ))}
        </div>
      </div>
      </Panel>
    ),
    customers: (
      <Panel title="Top customers" testid="top-customers-panel">
      {loading ? <Skeleton rows={5} /> : topCustomers.length === 0 ? <Empty /> : (
        <div className="stagger space-y-5">
          {topCustomers.map((c, i) => (
            <div key={c.name} className="flex items-center gap-4">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm" style={{ background: SERIES[i % SERIES.length] }}>
                {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <span className="truncate text-sm font-bold text-ink">{c.name}</span>
                  <span className="flex-shrink-0 text-sm font-bold text-ink tabular">
                    <AnimatedNumber value={c.revenue} format={mc} />
                  </span>
                </div>
                <MiniBar pct={(c.revenue / maxCust) * 100} color={SERIES[i % SERIES.length]} height={6} />
              </div>
            </div>
          ))}
        </div>
      )}
      </Panel>
    ),
    activity: (
      <Panel
        title="Recent activity"
      testid="recent-activity-panel"
       right={<Button variant="primary" onClick={() => navigate('/compliance/daybook')} data-testid="dashboard-daybook">{lt('Day Book')}</Button>}
      >
      <div className="divide-y divide-line">
         {loading ? <Skeleton rows={5} /> : recent.length === 0 ? <Empty message="No recent vouchers" /> : recent.map(v => (
          <div key={v.id} className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0">
            <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${
              v.voucher_type === 'Sales' ? 'bg-pos-bg text-pos' : v.voucher_type === 'Purchase' ? 'bg-warn-bg text-warn' : 'bg-paper-2 text-ink-soft'
            }`}>
              {v.voucher_type === 'Purchase'
                ? <TrendingDown size={18} strokeWidth={2} />
                : <TrendingUp size={18} strokeWidth={2} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink group-hover:text-ink/80 transition-colors">{v.party_name}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink-soft">{v.voucher_type} · <span className="tabular">{v.voucher_number}</span></p>
            </div>
            <span className="text-sm font-bold text-ink tabular">{money(v.amount)}</span>
          </div>
        ))}
      </div>
      </Panel>
    ),
  };

  // Sales · Purchases · Expenses — three individual cards.
  blocks.trioStrip = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {trio.map(([label, value, delta, tone, Icon, , spark]) => (
        <div
          key={label}
          data-testid={`trio-${label.toLowerCase()}`}
          className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4 text-left"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${tone}1A` }}>
            <Icon size={18} strokeWidth={2} style={{ color: tone }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">{lt(label)}</span>
            {loading ? (
              <span className="mt-1 block h-6 w-20 animate-pulse rounded-md bg-cream" />
            ) : (
              <span className="mt-0.5 block">
                <span className="display text-2xl font-bold leading-none text-ink tabular tracking-tight">{money(value)}</span>
              </span>
            )}
          </span>
          {!loading && (
            <span className="flex flex-shrink-0 flex-col items-end gap-1">
              <Sparkline points={spark} color={delta == null ? tone : delta < 0 ? 'var(--neg)' : 'var(--pos)'} />
              {delta != null && (
                <span className={`text-xs font-bold tabular ${delta < 0 ? 'text-neg' : 'text-pos'}`}>
                  {delta < 0 ? '' : '+'}{delta}%
                </span>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  // Sleek KPI strip — one card, all 7 metrics as compact columns with a left color accent.
  blocks.kpiStrip = (
    <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4 xl:grid-cols-7">
      {kpis.map(([label, value, sub, tone, metric, trend, invert]) => (
        <button
          key={metric}
          data-testid={`kpi-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
          onClick={() => setDrill(metric)}
          className="group relative min-w-0 bg-surface px-6 py-5 text-left transition-colors duration-200 hover:bg-cream/60 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
        >
          <span className="absolute inset-y-5 left-3 w-1 rounded-full" style={{ background: tone }} />
          <span className="block truncate text-[11px] font-bold uppercase tracking-wider text-ink-soft">{lt(label)}</span>
          {loading && value != null ? (
            <span className="mt-2.5 block h-5 w-14 animate-pulse rounded-md bg-cream" />
          ) : (
            <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="display block text-xl font-bold leading-none text-ink tabular tracking-tight">
                {value == null ? lt('View') : mc(value)}
              </span>
              <TrendChip pct={trend} invert={invert} />
            </span>
          )}
        </button>
      ))}
    </Card>
  );

  return (
    <Page
      testid="dashboard-page"
      title="Dashboard"
    >
      {error && (
        <div className="rounded-xl border border-neg/20 bg-neg-bg p-4 text-sm font-semibold text-neg flex items-center justify-between shadow-sm">
           <span>{error}</span> <Button variant="danger" className="ml-4" onClick={load}>{lt('Retry')}</Button>
        </div>
      )}
      {/* Connection strip — only shown while Tally is NOT connected */}
      {!isPaired && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-5 py-3 shadow-sm">
          <span className="h-2 w-2 rounded-sm bg-warn" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-soft">{lt('Connect Tally Prime to sync live data')}</p>
          <Button onClick={() => navigate('/settings/tally-sync')}>{lt('Connect')}</Button>
        </div>
      )}


      {/* Sales · Purchases · Expenses — three cards */}
      {blocks.trioStrip}

      {/* All 7 KPIs — one sleek strip */}
      {blocks.kpiStrip}

      {/* Turnover chart — full width */}
      {blocks.chart}

      {/* Cost analysis · Cashflow · Top customers (wider) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        {blocks.cost}
        {blocks.cashflow}
        {blocks.customers}
      </div>

      {blocks.activity}

      <KpiPanel metric={drill} onClose={() => { setDrill(null); if (routeKey) navigate('/', { replace: true }); }} />
    </Page>
  );
}
