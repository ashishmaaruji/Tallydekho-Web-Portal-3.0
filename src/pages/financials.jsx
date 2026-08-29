import { useCallback, useEffect, useRef, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronRight, ChevronDown } from 'lucide-react';
import api, { apiGet } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { StatGrid, Panel, DataTable, Pill, Tabs, ModuleView, useDrawerParam, Empty, Skeleton, Button, useLabelT } from '../components/kit';
import { useFmt, PartyPanel, LedgerPanel, VoucherDrawer } from './shared';

const number = value => Number(value || 0);
const dataOf = res => res?.data ?? res?.result ?? res ?? {};

function useCompanyRequest(request) {
  const { selectedCompany, selectedFY, syncVersion } = useAuth();
  const companyGuid = selectedCompany?.guid || selectedCompany?.id;
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const requestSeq = useRef(0);
  const load = useCallback(() => {
    if (!companyGuid) {
      setState({ data: null, loading: false, error: 'Select a company to view this report.' });
      return;
    }
    const seq = ++requestSeq.current; // ignore stale responses (rapid company/FY/tab switches)
    setState(s => ({ ...s, loading: true, error: '' }));
    Promise.resolve(request(companyGuid, selectedFY))
      .then(res => { if (seq === requestSeq.current) setState({ data: dataOf(res), loading: false, error: '' }); })
      .catch(err => { if (seq === requestSeq.current) setState({ data: null, loading: false, error: err.message || 'Unable to load report.' }); });
  }, [companyGuid, selectedFY, request]);
  useEffect(load, [load, syncVersion]);
  return { ...state, retry: load };
}

function dates(fy) {
  return {
    from: fy?.startDate || fy?.begin_date,
    to: fy?.endDate || fy?.end_date,
  };
}

function body(companyGuid, fy) {
  const range = dates(fy);
  return { companyGuid, from: range.from, to: range.to, fromDate: range.from, toDate: range.to, fy: api.fyParamFromFY(fy) || fy?.fin_year };
}

function LoadError({ message, retry }) {
  const lt = useLabelT();
  return <Panel><Empty message="Could not load data" hint={message} /><div className="pb-5 text-center"><Button onClick={retry}>{lt('Retry')}</Button></div></Panel>;
}

export function CashBank() {
  const { money, mc, date } = useFmt();
  const [tab, setTab] = useState('Accounts');
  const [voucher, setVoucher] = useState(null);
  const request = useCallback((guid, fy) => api.fetchCashBank(body(guid, fy)), []);
  const { data, loading, error, retry } = useCompanyRequest(request);
  const accounts = (data?.bankAccounts || []).map((r, i) => ({ id: r.guid || i, ...r, balance: number(r.balance ?? r.closing_balance) }));
  const txns = (data?.transactions || []).map((r, i) => ({
    id: r.guid || i, ...r, voucher_number: r.voucher_number || r.ref,
    party_name: r.party_name || r.description, amount: number(r.amount),
  }));
  const summary = data?.summary || {};
  if (error) return <ModuleView title="Cash & Bank" sub="Balances and movement across accounts" testid="cash-bank-view"><LoadError message={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="Cash & Bank" sub="Balances and movement across accounts" testid="cash-bank-view">
      <StatGrid items={[
        { label: 'Bank balance', value: mc(number(summary.bankBalance)), sub: `${accounts.length} accounts`, tone: '#3963E4' },
        { label: 'Receipts', value: mc(number(summary.totalReceipts)), sub: 'Selected FY', tone: '#447B4B' },
        { label: 'Payments', value: mc(number(summary.totalPayments)), sub: 'Selected FY', tone: '#B14435' },
        { label: 'Net movement', value: mc(number(summary.netCash)), sub: 'Receipts less payments', tone: '#181818' },
      ]} />
      <Tabs tabs={['Accounts', 'Transactions']} value={tab} onChange={setTab} testid="cash-bank-tabs" />
      {tab === 'Accounts' ? (
        <DataTable testid="bank-accounts-table" rows={accounts} loading={loading} emptyMessage="No bank accounts found" columns={[
          { key: 'name', label: 'Account', render: r => <span className="font-medium">{r.name}</span> },
          { key: 'type', label: 'Balance type' },
          { key: 'balance', label: 'Balance', align: 'right', render: r => <span className={r.balance < 0 ? 'text-neg font-medium' : 'font-medium'}>{money(r.balance)}</span> },
        ]} />
      ) : (
        <DataTable testid="bank-transactions-table" rows={txns} loading={loading} pageSize={14} onRowClick={setVoucher} emptyMessage="No cash or bank transactions found" columns={[
          { key: 'date', label: 'Date', render: r => date(r.date) },
          { key: 'voucher_number', label: 'Voucher' },
          { key: 'voucher_type', label: 'Type', render: r => <Pill tone={r.voucher_type === 'Receipt' ? 'pos' : r.voucher_type === 'Payment' ? 'neg' : 'note'}>{r.voucher_type}</Pill> },
          { key: 'party_name', label: 'Particulars' },
          { key: 'amount', label: 'Amount', align: 'right', render: r => money(r.amount) },
        ]} />
      )}
      <VoucherDrawer voucher={voucher} onClose={() => setVoucher(null)} />
    </ModuleView>
  );
}

export function ReceivablesPayables() {
  const { money, mc, date } = useFmt();
  const lt = useLabelT();
  const [tab, setTab] = useState('Receivables');
  const [party, setParty] = useDrawerParam('party');
  const request = useCallback((guid, fy) => api.fetchReceivablesPayables(body(guid, fy)), []);
  const { data, loading, error, retry } = useCompanyRequest(request);
  const isRec = tab === 'Receivables';
  // Aging buckets + trend from the KPI endpoint (mobile parity)
  const kpiRequest = useCallback((guid, fy) => api.fetchKpiDetail(isRec ? 'receivables' : 'payables', { companyGuid: guid, ...dates(fy) }), [isRec]);
  const kpi = useCompanyRequest(kpiRequest);
  const aging = kpi.data?.aging || [];
  const trendPct = kpi.data?.trend_pct;
  const rows = (isRec ? (data?.receivables || []) : (data?.payables || [])).map((r, i) => ({
    id: r.guid || r.id || `party-${i}`, drawer_id: r.guid || r.id, ...r, outstanding: number(r.outstanding ?? r.total_amount),
    invoice_count: number(r.invoice_count),
  }));
  if (error) return <ModuleView title="Receivables & Payables" sub="Customer and supplier balances" testid="receivables-payables-view"><LoadError message={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="Receivables & Payables" sub="Customer and supplier balances" testid="receivables-payables-view">
      <Tabs tabs={['Receivables', 'Payables']} value={tab} onChange={setTab} testid="rp-tabs" />
      <StatGrid cols={3} items={[
        { label: `Total ${tab.toLowerCase()}`, value: mc(rows.reduce((s, r) => s + r.outstanding, 0)), sub: `${rows.length} parties`, tone: isRec ? '#447B4B' : '#B14435', delta: trendPct == null ? null : Math.round(trendPct * 10) / 10, deltaInvert: !isRec },
        { label: 'Invoices', value: rows.reduce((s, r) => s + r.invoice_count, 0), sub: 'In selected FY', tone: '#3963E4' },
        { label: 'Net receivable', value: mc(number(data?.summary?.net)), sub: 'Receivables less payables', tone: '#181818' },
      ]} />
      {aging.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="rp-aging-strip">
          {aging.map(b => (
            <div key={b.bucket} className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[11px] text-ink-soft">{lt(b.label)}</p>
              <p className="mt-1 text-[15px] font-semibold tabular text-ink">{money(number(b.amount))}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
                {b.count} {lt('bills')}
                {b.trend != null && <span className={`font-semibold ${b.trend > 0 ? 'text-neg' : 'text-pos'}`}>{b.trend > 0 ? '▲' : '▼'} {Math.abs(Math.round(b.trend))}%</span>}
              </p>
            </div>
          ))}
        </div>
      )}
      <DataTable testid="rp-table" rows={rows} loading={loading} emptyMessage={`No ${tab.toLowerCase()} found`} onRowClick={r => r.drawer_id && setParty(r.drawer_id)} columns={[
        { key: 'name', label: isRec ? 'Customer' : 'Supplier', render: r => <span className="font-medium">{r.name}</span> },
        { key: 'invoice_count', label: 'Invoices', align: 'right' },
        { key: 'last_date', label: 'Last invoice', render: r => r.last_date ? date(r.last_date) : '—' },
        { key: 'outstanding', label: 'Outstanding', align: 'right', render: r => <span className="font-semibold">{money(r.outstanding)}</span> },
      ]} footer={f => `${lt('Total')} ${money(f.reduce((s, r) => s + r.outstanding, 0))}`} />
      {party && <PartyPanel id={party} onClose={() => setParty(null)} />}
    </ModuleView>
  );
}

const loadLoansODs = companyGuid => api.fetchKpiDetail('loans-ods', { companyGuid });

export function LoansODs() {
  const { money, mc } = useFmt();
  const lt = useLabelT();
  const { data, loading, error, retry } = useCompanyRequest(loadLoansODs);
  const d = dataOf(data);
  const facilities = (d.facilities || d.loans || []).map((l, i) => ({ id: l.guid || l.name || i, ...l, balance: number(l.balance ?? l.amount) }));
  const isOd = r => /od|overdraft|cash credit/i.test(`${r.kind || ''} ${r.parent || ''} ${r.name || ''}`);
  const trend = v => (v == null ? null : Math.round(v * 10) / 10);
  if (loading) return <ModuleView title="Loans & ODs" sub="Borrowing facilities and outstanding balances" testid="loans-view"><Panel><Skeleton rows={5} /></Panel></ModuleView>;
  if (error) return (
    <ModuleView title="Loans & ODs" sub="Borrowing facilities and outstanding balances" testid="loans-view">
      <Panel><Empty message="Could not load loan facilities" hint={error} /><div className="-mt-8 mb-8 flex justify-center"><Button onClick={retry}>{lt('Retry')}</Button></div></Panel>
    </ModuleView>
  );
  return (
    <ModuleView title="Loans & ODs" sub="Borrowing facilities and outstanding balances" testid="loans-view">
      <StatGrid items={[
        { label: 'Total borrowings', value: mc(number(d.total)), sub: 'vs previous period', tone: '#B14435', delta: trend(d.trend_pct), deltaInvert: true },
        { label: 'Term loans', value: mc(number(d.loan_total)), sub: 'vs previous period', tone: '#BB7836', delta: trend(d.loan_trend_pct), deltaInvert: true },
        { label: 'Overdrafts', value: mc(number(d.od_total)), sub: 'vs previous period', tone: '#3963E4', delta: trend(d.od_trend_pct), deltaInvert: true },
        { label: 'Facilities', value: String(facilities.length), sub: 'Loan & OD ledgers', tone: '#181818' },
      ]} />
      {facilities.length ? (
        <Panel title="Facilities" sub="Loan and overdraft ledgers from Tally">
          <DataTable testid="loans-table" rows={facilities} columns={[
            { key: 'name', label: 'Ledger' },
            { key: 'parent', label: 'Group', render: r => r.parent || '—' },
            { key: 'kind', label: 'Type', render: r => <Pill tone={isOd(r) ? 'note' : 'warn'}>{lt(isOd(r) ? 'Overdraft' : 'Loan')}</Pill> },
            { key: 'balance', label: 'Outstanding', align: 'right', render: r => money(number(r.balance)) },
          ]} />
        </Panel>
      ) : (
        <Panel><Empty message="No loan or OD ledgers" hint="No ledgers under Loans, Secured/Unsecured Loans, Bank OD or Overdraft groups were found in this company." /></Panel>
      )}
    </ModuleView>
  );
}

function ExpandableRows({ groups, testid }) {
  const { money } = useFmt();
  const [open, setOpen] = useState({});
  return (
    <div className="divide-y divide-line-subtle" data-testid={testid}>
      {groups.map((g, index) => (
        <div key={g.guid || `${g.name}-${index}`}>
          <button data-testid={`report-row-${String(g.name).toLowerCase().replace(/[^a-z]+/g, '-')}`} onClick={() => setOpen(o => ({ ...o, [index]: !o[index] }))} className="flex w-full items-center gap-2 px-1 py-2.5 text-left transition-colors hover:bg-cream">
            {open[index] ? <ChevronDown size={12} className="text-ink-faint" /> : <ChevronRight size={12} className="text-ink-faint" />}
            <span className="flex-1 text-[13px] font-medium text-ink">{g.name}</span>
            <span className="text-[13px] font-semibold text-ink tabular">{money(number(g.amount))}</span>
          </button>
          {open[index] && (g.children || []).length > 0 && <div className="pb-2 pl-7">{g.children.map((c, i) => <div key={c.guid || i} className="flex items-center justify-between py-1.5"><span className="text-[13px] text-ink-soft">{c.name}</span><span className="text-[13px] text-ink tabular">{money(number(c.amount))}</span></div>)}</div>}
        </div>
      ))}
    </div>
  );
}

function ReportEmpty({ loading, rows, message }) {
  if (loading) return <Skeleton rows={7} />;
  if (!rows.length) return <Empty message={message} hint="Sync Tally data for the selected financial year." />;
  return null;
}

export function ProfitLoss() {
  const { mc } = useFmt();
  const request = useCallback((guid, fy) => api.fetchReportsPL(body(guid, fy)), []);
  const { data, loading, error, retry } = useCompanyRequest(request);
  const income = data?.income || [];
  const expenses = data?.expenses || [];
  const summary = data?.summary || data?.pl || {};
  if (error) return <ModuleView title="Profit & Loss" sub="Ledger heads for the selected financial year" testid="profit-loss-view"><LoadError message={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="Profit & Loss" sub="Ledger heads for the selected financial year" testid="profit-loss-view">
      <StatGrid items={[
        { label: 'Total income', value: mc(number(summary.totalIncome)), sub: 'Credit side', tone: '#447B4B' },
        { label: 'Total expenses', value: mc(number(summary.totalExpenses)), sub: 'Debit side', tone: '#B14435' },
        { label: 'Gross profit', value: mc(number(summary.grossProfit)), sub: 'Trading result', tone: '#181818' },
        { label: 'Net profit', value: mc(number(summary.netProfit) - number(summary.netLoss)), sub: 'Bottom line', tone: '#3963E4' },
      ]} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Income"><ReportEmpty loading={loading} rows={income} message="No income ledger balances" />{!!income.length && <ExpandableRows groups={income} testid="pl-income" />}</Panel>
        <Panel title="Expenses"><ReportEmpty loading={loading} rows={expenses} message="No expense ledger balances" />{!!expenses.length && <ExpandableRows groups={expenses} testid="pl-expenses" />}</Panel>
      </div>
    </ModuleView>
  );
}

export function BalanceSheet() {
  const { mc } = useFmt();
  const request = useCallback((guid, fy) => api.fetchReportsBS(body(guid, fy)), []);
  const { data, loading, error, retry } = useCompanyRequest(request);
  const mapRows = rows => (rows || []).map(r => ({ ...r, amount: number(r.amount ?? r.closing_balance) }));
  const assets = mapRows(data?.assets);
  const liabilities = mapRows(data?.liabilities);
  if (error) return <ModuleView title="Balance Sheet" sub="Assets and liabilities for the selected financial year" testid="balance-sheet-view"><LoadError message={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="Balance Sheet" sub="Assets and liabilities for the selected financial year" testid="balance-sheet-view">
      <StatGrid cols={2} items={[
        { label: 'Total assets', value: mc(number(data?.summary?.totalAssets) || assets.reduce((s, r) => s + r.amount, 0)), sub: 'Selected FY', tone: '#447B4B' },
        { label: 'Total liabilities', value: mc(number(data?.summary?.totalLiabilities) || liabilities.reduce((s, r) => s + r.amount, 0)), sub: 'Selected FY', tone: '#B14435' },
      ]} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Assets"><ReportEmpty loading={loading} rows={assets} message="No asset balances" />{!!assets.length && <ExpandableRows groups={assets} testid="bs-assets" />}</Panel>
        <Panel title="Liabilities"><ReportEmpty loading={loading} rows={liabilities} message="No liability balances" />{!!liabilities.length && <ExpandableRows groups={liabilities} testid="bs-liabilities" />}</Panel>
      </div>
    </ModuleView>
  );
}

export function TrialBalance() {
  const { money } = useFmt();
  const lt = useLabelT();
  const [ledger, setLedger] = useDrawerParam('ledger');
  const request = useCallback((guid, fy) => api.fetchReportsTB(body(guid, fy)), []);
  const { data, loading, error, retry } = useCompanyRequest(request);
  const raw = Array.isArray(data) ? data : data?.rows || data?.ledgers || [];
  const rows = raw.map((r, i) => ({
    id: r.guid || r.id || i, ...r, group: r.group || r.parent,
    debit: number(r.debit ?? r.debit_amount), credit: number(r.credit ?? r.credit_amount),
  })).map(r => ({ ...r, closing: r.debit - r.credit }));
  if (error) return <ModuleView title="Trial Balance" sub="Ledger-wise debit and credit totals" testid="trial-balance-view"><LoadError message={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="Trial Balance" sub="Ledger-wise debit and credit totals" testid="trial-balance-view">
      <DataTable testid="trial-balance-table" rows={rows} loading={loading} emptyMessage="No trial balance rows found" pageSize={15} onRowClick={r => r.id && setLedger(r.id)} columns={[
        { key: 'name', label: 'Ledger', render: r => <span className="font-medium">{r.name}</span> },
        { key: 'group', label: 'Under group' },
        { key: 'debit', label: 'Debit', align: 'right', render: r => r.debit ? money(r.debit) : '—' },
        { key: 'credit', label: 'Credit', align: 'right', render: r => r.credit ? money(r.credit) : '—' },
        { key: 'closing', label: 'Closing', align: 'right', render: r => <span className={r.closing < 0 ? 'text-neg' : ''}>{money(Math.abs(r.closing))} {lt(r.closing < 0 ? 'Cr' : 'Dr')}</span> },
      ]} footer={f => `${lt('Debit')} ${money(f.reduce((s, r) => s + r.debit, 0))} · ${lt('Credit')} ${money(f.reduce((s, r) => s + r.credit, 0))}`} />
      {ledger && <LedgerPanel id={ledger} onClose={() => setLedger(null)} />}
    </ModuleView>
  );
}

const iso = d => d.toISOString().slice(0, 10);

// Mobile-parity period windows: N days ending today, clamped to the selected FY;
// a fully past FY anchors the window to its end.
function periodRange(days, fy) {
  const fyRange = dates(fy);
  const today = new Date();
  let end = today;
  if (fyRange.to && new Date(fyRange.to) < today) end = new Date(fyRange.to);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  let from = iso(start);
  if (fyRange.from && from < fyRange.from) from = fyRange.from;
  return { from, to: iso(end) };
}

export function CashFlow() {
  const { money, mc, date } = useFmt();
  const lt = useLabelT();
  const { selectedFY } = useAuth();
  const [period, setPeriod] = useState('1M'); // '7D' | '1M' | '3M' | 'FY' | 'custom'
  const [range, setRange] = useState(() => periodRange(30, null));
  useEffect(() => {
    if (period === 'custom') return;
    setRange(period === 'FY' ? (r => ({ from: dates(selectedFY).from || r.from, to: dates(selectedFY).to || r.to })) : periodRange(period === '7D' ? 7 : period === '1M' ? 30 : 90, selectedFY));
  }, [period, selectedFY]);
  // Ignore partially-typed dates (e.g. year "0006") so we don't fire malformed requests
  const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && v >= '1900-01-01';
  const from = validDate(range.from) ? range.from : '';
  const to = validDate(range.to) ? range.to : '';
  const request = useCallback((guid, fy) => {
    const qs = new URLSearchParams({ companyGuid: guid });
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const fyParam = api.fyParamFromFY(fy) || fy?.fin_year;
    if (fyParam) qs.set('fy', fyParam);
    return apiGet(`/api/dashboard/cashflow?${qs}`);
  }, [from, to]);
  const { data, loading, error, retry } = useCompanyRequest(request);
  const weekly = data?.interval === 'week';
  const rows = (data?.series || []).map((r, i) => ({
    id: r.date || i, date: r.date, inflow: number(r.inflow), outflow: number(r.outflow), net: number(r.net),
  }));
  const setCustom = patch => { setPeriod('custom'); setRange(r => ({ ...r, ...patch })); };
  const controls = (
    <div className="flex flex-wrap items-center gap-2" data-testid="cashflow-range">
      {['7D', '1M', '3M', 'FY'].map(p => (
        <Button key={p} variant={period === p ? 'primary' : 'ghost'} onClick={() => setPeriod(p)} data-testid={`cashflow-period-${p}`}>{lt(p)}</Button>
      ))}
      <label className="flex items-center gap-1 text-sm text-muted">{lt('From')}
        <input type="date" className="rounded border border-line bg-transparent px-2 py-1 text-sm" value={range.from || ''} max={range.to || undefined} onChange={e => setCustom({ from: e.target.value })} data-testid="cashflow-from" />
      </label>
      <label className="flex items-center gap-1 text-sm text-muted">{lt('To')}
        <input type="date" className="rounded border border-line bg-transparent px-2 py-1 text-sm" value={range.to || ''} min={range.from || undefined} onChange={e => setCustom({ to: e.target.value })} data-testid="cashflow-to" />
      </label>
    </div>
  );
  if (error) return <ModuleView title="Cash Flow" sub="Inflow and outflow trends over time" testid="cashflow-view"><LoadError message={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="Cash Flow" sub="Inflow and outflow trends over time" testid="cashflow-view">
      {controls}
      <StatGrid items={[
        { label: 'Income', value: mc(number(data?.total_income)), sub: 'Money received', tone: '#447B4B' },
        { label: 'Expense', value: mc(number(data?.total_expense)), sub: 'Money paid out', tone: '#B14435' },
        { label: 'Net movement', value: mc(number(data?.total_income) - number(data?.total_expense)), sub: 'Income less expense', tone: '#181818' },
        { label: 'Cash + bank', value: mc(number(data?.net_cash)), sub: 'Current balances', tone: '#3963E4' },
      ]} />
      <StatGrid items={[
        { label: 'Sales', value: mc(number(data?.sales)), sub: 'This period', tone: '#181818' },
        { label: 'Gross profit', value: mc(number(data?.gross_profit)), sub: 'Sales less purchases & direct costs', tone: '#447B4B' },
        { label: 'Net profit', value: mc(number(data?.net_profit)), sub: 'After indirect income & expenses', tone: '#3963E4' },
        { label: 'Gross profit vs sales', value: `${number(data?.gross_profit_vs_sales_pct)}%`, sub: 'Margin', tone: '#BB7836' },
      ]} />
      <Panel title={`Cash flow trend (${weekly ? 'weekly' : 'daily'})`}>
        {loading ? <Skeleton rows={5} /> : rows.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 5" stroke="rgba(26,26,26,0.07)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={v => date(v)} minTickGap={24} />
              <YAxis tickFormatter={v => mc(v)} width={62} />
              <Tooltip labelFormatter={v => (weekly ? `${lt('Week of')} ` : '') + date(v)} formatter={v => money(v)} />
              <Bar dataKey="inflow" name={lt('Inflow')} fill="#447B4B" maxBarSize={16} />
              <Bar dataKey="outflow" name={lt('Outflow')} fill="#B14435" maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty message="No cash flow activity in this range" />}
      </Panel>
      <DataTable testid="cashflow-table" rows={rows} loading={loading} pageSize={14} emptyMessage="No cash flow activity in this range" columns={[
        { key: 'date', label: weekly ? 'Week starting' : 'Date', render: r => date(r.date) },
        { key: 'inflow', label: 'Inflow', align: 'right', render: r => money(r.inflow) },
        { key: 'outflow', label: 'Outflow', align: 'right', render: r => money(r.outflow) },
        { key: 'net', label: 'Net', align: 'right', render: r => <span className={r.net < 0 ? 'text-neg' : 'text-pos'}>{money(r.net)}</span> },
      ]} footer={f => `${lt('Net')} ${money(f.reduce((s, r) => s + r.net, 0))}`} />
    </ModuleView>
  );
}

export function FinancialsKpis() {
  const { mc } = useFmt();
  const request = useCallback(async (guid, fy) => {
    const [pl, cb] = await Promise.all([api.fetchReportsPL(body(guid, fy)), api.fetchCashBank(body(guid, fy))]);
    return { pl: dataOf(pl), cb: dataOf(cb) };
  }, []);
  const { data, loading, error, retry } = useCompanyRequest(request);
  if (loading) return <Skeleton rows={3} />;
  if (error) return <LoadError message={error} retry={retry} />;
  const summary = data?.pl?.summary || data?.pl?.pl || {};
  return <StatGrid items={[
    { label: 'Turnover', value: mc(number(summary.totalIncome ?? summary.sales)), sub: 'This FY', tone: '#447B4B' },
    { label: 'Net profit', value: mc(number(summary.netProfit) - number(summary.netLoss)), sub: 'After all heads', tone: '#181818' },
    { label: 'Bank balance', value: mc(number(data?.cb?.summary?.bankBalance)), sub: `${data?.cb?.bankAccounts?.length || 0} accounts`, tone: '#3963E4' },
    { label: 'Net cash movement', value: mc(number(data?.cb?.summary?.netCash)), sub: 'Selected FY', tone: '#B14435' },
  ]} />;
}

export function SalesPurchaseChart() {
  const { money, mc } = useFmt();
  const lt = useLabelT();
  const request = useCallback((guid, fy) => api.fetchDashboard(body(guid, fy)), []);
  const { data, loading, error, retry } = useCompanyRequest(request);
  const rows = data?.monthlySales || data?.monthly_sales || [];
  return (
    <Panel title="Monthly sales vs purchase">
      {loading ? <Skeleton rows={6} /> : error ? <><Empty message="Could not load chart" hint={error} /><div className="pb-4 text-center"><Button onClick={retry}>{lt('Retry')}</Button></div></> : !rows.length ? <Empty message="No monthly sales or purchase data" /> : (
        <ResponsiveContainer width="100%" height={240}><BarChart data={rows} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}><CartesianGrid strokeDasharray="2 5" stroke="rgba(26,26,26,0.07)" vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={v => mc(v)} width={62} /><Tooltip formatter={v => money(v)} /><Bar dataKey="sales" name={lt('Sales')} fill="#181818" maxBarSize={16} /><Bar dataKey="purchase" name={lt('Purchase')} fill="#BB7836" maxBarSize={16} /></BarChart></ResponsiveContainer>
      )}
    </Panel>
  );
}