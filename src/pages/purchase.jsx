import { useCallback, useEffect, useState } from 'react';
import { StatGrid, Panel, DataTable, Pill, ModuleView, Empty, Skeleton, Button, Status, useLabelT } from '../components/kit';
import { useFmt, VoucherDrawer, useVoucherSelection, BulkActionBar, voucherRowKey } from './shared';
import { useAuth } from '../contexts/AuthContext';
import api, { unwrapList } from '../services/api';

const amountOf = row => Number(row?.amount ?? row?.total_amount ?? row?.totalAmount ?? 0) || 0;
const normalizeRows = response => unwrapList(response).map((row, index) => ({
  ...row,
  id: row.id ?? row.guid ?? `${row.voucher_number || row.voucherNumber || 'voucher'}-${index}`,
  date: row.date ?? row.voucher_date ?? row.voucherDate,
  voucher_number: row.voucher_number ?? row.voucherNumber ?? row.number ?? '—',
  voucher_type: row.voucher_type ?? row.voucherType,
  party_name: row.party_name ?? row.partyName ?? row.party ?? '—',
  amount: amountOf(row),
  is_cancelled: row.is_cancelled ?? row.isCancelled ?? false,
}));
const paramsFor = fy => ({ fromDate: fy?.startDate, toDate: fy?.endDate, pageSize: 500 });

function useLiveRows(loader) {
  const [state, setState] = useState({ rows: [], loading: true, error: '' });
  const load = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      setState({ rows: normalizeRows(await loader()), loading: false, error: '' });
    } catch (error) {
      setState({ rows: [], loading: false, error: error?.message || 'Unable to load records.' });
    }
  }, [loader]);
  useEffect(() => { load(); }, [load]);
  return { ...state, retry: load };
}

function LoadState({ loading, error, rows, retry, emptyMessage, children }) {
  const lt = useLabelT();
  if (loading) return <Panel><Skeleton rows={6} /></Panel>;
  if (error) return <Panel><Empty message="Could not load records" hint={error} /><div className="-mt-8 mb-8 flex justify-center"><Button onClick={retry}>{lt('Retry')}</Button></div></Panel>;
  if (!rows.length) return <Panel><Empty message={emptyMessage} hint="No records were returned for the selected financial year." /></Panel>;
  return children;
}

function LiveRegister({ rows, testid, numberLabel = 'Voucher No.' }) {
  const { money, date } = useFmt();
  const lt = useLabelT();
  const [active, setActive] = useState(null);
  const { selectedKeys, toggleRow, toggleAll, clear } = useVoucherSelection();
  return (
    <>
      <BulkActionBar rows={rows} selectedKeys={selectedKeys} onClear={clear} testid={`${testid}-bulk-bar`} />
      <DataTable testid={testid} rows={rows} onRowClick={setActive} selectable selectedKeys={selectedKeys} onToggleRow={toggleRow} onToggleAll={toggleAll} rowKey={voucherRowKey} searchKeys={['voucher_number', 'party_name', 'date']} columns={[
        { key: 'date', label: 'Date', width: 110, render: r => date(r.date) },
        { key: 'voucher_number', label: numberLabel, width: 130 },
        { key: 'party_name', label: 'Supplier' },
        { key: 'amount', label: 'Amount', align: 'right', render: r => <span className="font-semibold">{money(r.amount)}</span> },
        { key: 'status', label: 'Status', width: 110, render: r => r.is_cancelled ? <Pill tone="neg">{lt('Cancelled')}</Pill> : r.status ? <Status value={r.status} /> : <Pill tone="pos">{lt('Synced')}</Pill> },
      ]} footer={visible => `${lt('Total')} ${money(visible.reduce((sum, row) => sum + row.amount, 0))}`} />
      <VoucherDrawer voucher={active} onClose={() => setActive(null)} />
    </>
  );
}

export function PurchaseKpis() {
  const { mc } = useFmt();
  const lt = useLabelT();
  const { selectedCompany, selectedFY } = useAuth();
  const guid = selectedCompany?.guid;
  const loader = useCallback(async () => {
    if (!guid) return [];
    const params = paramsFor(selectedFY);
    const [invoices, orders, notes] = await Promise.all([
      api.fetchVouchers({ companyGuid: guid, voucherType: 'Purchase', ...params }),
      api.fetchPurchaseOrders(guid, params),
      api.fetchDebitNotes(guid, params),
    ]);
    return [
      ...normalizeRows(invoices).map(row => ({ ...row, _group: 'invoice' })),
      ...normalizeRows(orders).map(row => ({ ...row, _group: 'order' })),
      ...normalizeRows(notes).map(row => ({ ...row, _group: 'note' })),
    ];
  }, [guid, selectedFY?.startDate, selectedFY?.endDate]);
  const data = useLiveRows(loader);
  const invoices = data.rows.filter(row => row._group === 'invoice');
  const orders = data.rows.filter(row => row._group === 'order');
  const notes = data.rows.filter(row => row._group === 'note');
  const total = invoices.reduce((sum, row) => sum + row.amount, 0);
  return (
    <LoadState {...data} emptyMessage="No purchase activity">
      <StatGrid items={[
        { label: 'Purchased', value: mc(total), sub: <>{invoices.length} {lt('invoices')}</>, tone: '#BB7836' },
        { label: 'Open orders', value: mc(orders.reduce((sum, row) => sum + row.amount, 0)), sub: <>{orders.length} {lt('orders')}</>, tone: '#3963E4' },
        { label: 'Debit notes', value: mc(notes.reduce((sum, row) => sum + row.amount, 0)), sub: <>{notes.length} {lt('notes')}</>, tone: '#B14435' },
        { label: 'Avg. invoice', value: mc(total / (invoices.length || 1)), sub: 'This FY', tone: '#181818' },
      ]} />
    </LoadState>
  );
}

function PurchaseVoucherView({ title, sub, testid, tableTestid, emptyMessage, numberLabel, load }) {
  const data = useLiveRows(load);
  return <ModuleView title={title} sub={sub} testid={testid}><LoadState {...data} emptyMessage={emptyMessage}><LiveRegister rows={data.rows} testid={tableTestid} numberLabel={numberLabel} /></LoadState></ModuleView>;
}

export function PurchaseInvoices() {
  const { selectedCompany, selectedFY } = useAuth();
  const loader = useCallback(() => selectedCompany?.guid ? api.fetchVouchers({ companyGuid: selectedCompany.guid, voucherType: 'Purchase', ...paramsFor(selectedFY) }) : Promise.resolve([]), [selectedCompany?.guid, selectedFY?.startDate, selectedFY?.endDate]);
  return <PurchaseVoucherView title="Purchase invoices" sub="Inward supply vouchers" testid="purchase-invoices-view" tableTestid="purchase-invoices-table" emptyMessage="No purchase invoices" load={loader} />;
}

export function PurchaseRegister() {
  const { money, date } = useFmt();
  const lt = useLabelT();
  const { selectedCompany, selectedFY } = useAuth();
  const loader = useCallback(async () => {
    if (!selectedCompany?.guid) return [];
    const params = paramsFor(selectedFY);
    const [purchases, debits] = await Promise.all([
      api.fetchVouchers({ companyGuid: selectedCompany.guid, voucherType: 'Purchase', ...params }),
      api.fetchDebitNotes(selectedCompany.guid, params),
    ]);
    return [...normalizeRows(purchases), ...normalizeRows(debits)].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [selectedCompany?.guid, selectedFY?.startDate, selectedFY?.endDate]);
  const data = useLiveRows(loader);
  const { selectedKeys, toggleRow, toggleAll, clear } = useVoucherSelection();
  const rows = data.rows.map(row => ({ ...row, taxable: Math.round(row.amount / 1.18), itc: row.amount - Math.round(row.amount / 1.18) }));
  return (
    <ModuleView title="Purchase register" sub="Inward vouchers with input tax credit" testid="purchase-register-view">
      <LoadState {...data} emptyMessage="No purchase register entries">
        <Panel>
        <BulkActionBar rows={rows} selectedKeys={selectedKeys} onClear={clear} testid="purchase-register-bulk-bar" />
        <DataTable testid="purchase-register-table" rows={rows} selectable selectedKeys={selectedKeys} onToggleRow={toggleRow} onToggleAll={toggleAll} rowKey={voucherRowKey} columns={[
          { key: 'date', label: 'Date', render: r => date(r.date) },
          { key: 'voucher_number', label: 'Voucher' },
          { key: 'party_name', label: 'Supplier' },
          { key: 'voucher_type', label: 'Type', render: r => <Pill tone={r.voucher_type === 'Purchase' ? 'warn' : 'neutral'}>{r.voucher_type}</Pill> },
          { key: 'taxable', label: 'Taxable', align: 'right', render: r => money(r.taxable) },
          { key: 'itc', label: 'ITC', align: 'right', render: r => money(r.itc) },
          { key: 'amount', label: 'Total', align: 'right', render: r => <span className="font-semibold">{money(r.amount)}</span> },
        ]} footer={visible => `${lt('Gross')} ${money(visible.reduce((sum, row) => sum + row.amount, 0))}`} /></Panel>
      </LoadState>
    </ModuleView>
  );
}

export function PurchaseOrders() {
  const { selectedCompany, selectedFY } = useAuth();
  const loader = useCallback(() => selectedCompany?.guid ? api.fetchPurchaseOrders(selectedCompany.guid, paramsFor(selectedFY)) : Promise.resolve([]), [selectedCompany?.guid, selectedFY?.startDate, selectedFY?.endDate]);
  return <PurchaseVoucherView title="Purchase orders" sub="Orders placed with suppliers" testid="purchase-orders-view" tableTestid="purchase-orders-table" emptyMessage="No purchase orders" numberLabel="Order No." load={loader} />;
}

export function DebitNotes() {
  const { selectedCompany, selectedFY } = useAuth();
  const loader = useCallback(() => selectedCompany?.guid ? api.fetchDebitNotes(selectedCompany.guid, paramsFor(selectedFY)) : Promise.resolve([]), [selectedCompany?.guid, selectedFY?.startDate, selectedFY?.endDate]);
  return <PurchaseVoucherView title="Debit notes" sub="Purchase returns and supplier adjustments" testid="debit-notes-view" tableTestid="debit-notes-table" emptyMessage="No debit notes" numberLabel="Note No." load={loader} />;
}