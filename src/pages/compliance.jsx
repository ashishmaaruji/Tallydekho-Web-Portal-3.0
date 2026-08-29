import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import api, { API_ROOT, apiGet, unwrapList } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { StatGrid, Button, Panel, DataTable, TableFilter, Pill, Status, Tabs, Modal, Field, Input, Select, ModuleView, Empty, Skeleton, useLabelT } from '../components/kit';
import { useFmt, RecordDrawer, useVoucherSelection, BulkActionBar, voucherRowKey } from './shared';
import { useSalesContext } from '../contexts/SalesContext';

const number = value => Number(value || 0);
const dataOf = res => res?.data ?? res?.result ?? res ?? {};
const companyId = company => company?.guid || company?.id;
const rangeFor = fy => ({
  from: fy?.startDate || fy?.begin_date,
  to: fy?.endDate || fy?.end_date,
  fy: api.fyParamFromFY(fy) || fy?.fin_year,
});

function queryPath(path, guid, fy, extra = {}) {
  const qs = new URLSearchParams({ companyGuid: guid });
  const range = rangeFor(fy);
  Object.entries({ ...range, ...extra }).forEach(([key, value]) => value != null && value !== '' && qs.set(key, value));
  return `${path}?${qs}`;
}

async function rootPost(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('authToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ROOT}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message || payload?.message || `HTTP ${res.status}`);
  return payload;
}

function useLive(loadFn) {
  const { selectedCompany, selectedFY, syncVersion } = useAuth();
  const salesCtx = useSalesContext();
  const guid = companyId(selectedCompany);

  const rangeStart = salesCtx?.dateRange?.from ?? selectedFY?.startDate ?? selectedFY?.begin_date;
  const rangeEnd = salesCtx?.dateRange?.to ?? selectedFY?.endDate ?? selectedFY?.end_date;
  const financialYear = selectedFY?.fin_year;
  const effectiveFY = useMemo(() => ({
    startDate: rangeStart,
    endDate: rangeEnd,
    fin_year: financialYear,
  }), [rangeStart, rangeEnd, financialYear]);

  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const load = useCallback(() => {
    if (!guid) {
      setState({ data: null, loading: false, error: 'Select a company to view compliance data.' });
      return;
    }
    setState(s => ({ ...s, loading: true, error: '' }));
    Promise.resolve(loadFn(guid, effectiveFY))
      .then(data => setState({ data, loading: false, error: '' }))
      .catch(err => setState({ data: null, loading: false, error: err.message || 'Unable to load compliance data.' }));
  }, [guid, effectiveFY, loadFn]);
  useEffect(load, [load, syncVersion]);
  return { ...state, retry: load, guid, fy: effectiveFY };
}

function ErrorPanel({ error, retry }) {
  const lt = useLabelT();
  return <Panel><Empty message="Could not load data" hint={error} /><div className="pb-5 text-center"><Button onClick={retry}>{lt('Retry')}</Button></div></Panel>;
}

const GST_TABS = ['Summary', 'GSTR-1', 'GSTR-2A', 'GSTR-3B', 'Unmatched', 'Returns'];

export function GST() {
  const lt = useLabelT();
  const { money, mc, date } = useFmt();
  const [tab, setTab] = useState('Summary');
  const [detailVersion, setDetailVersion] = useState(0);
  const load = useCallback(async (guid, fy) => {
    const r = rangeFor(fy);
    const summaryRes = await api.fetchGSTSummary({ companyGuid: guid, fromDate: r.from, toDate: r.to });
    return { summary: dataOf(summaryRes) };
  }, []);
  const { data, loading, error, retry, guid, fy } = useLive(load);
  const [detail, setDetail] = useState({ rows: [], loading: false, error: '' });
  useEffect(() => {
    if (!guid || !['GSTR-1', 'GSTR-2A', 'GSTR-3B'].includes(tab)) return;
    let active = true;
    setDetail({ rows: [], loading: true, error: '' });
    apiGet(queryPath('/api/reports/gst-detail', guid, fy, { type: tab }))
      .then(res => active && setDetail({ rows: unwrapList(res), loading: false, error: '' }))
      .catch(err => active && setDetail({ rows: [], loading: false, error: err.message || lt('Unable to load GST detail.') }));
    return () => { active = false; };
  }, [guid, fy, tab, detailVersion]);

  const legacy = data?.summary || {};
  const g = {
    cgst: number(legacy.cgst), sgst: number(legacy.sgst), igst: number(legacy.igst),
    outputTax: number(legacy.total), inputTax: 0, netPayable: number(legacy.total),
  };
  const rows = detail.rows.map((r, i) => ({
    id: r.guid || r.id || i, ...r,
    invoice: r.invoice || r.voucher_number, party: r.party || r.party_name,
    gstin: r.gstin || r.party_gstin, place: r.place || r.place_of_supply,
    taxable: number(r.taxable ?? r.taxable_amount), cgst: number(r.cgst ?? r.cgst_amount),
    sgst: number(r.sgst ?? r.sgst_amount), igst: number(r.igst ?? r.igst_amount),
    total: number(r.total ?? r.amount),
  }));
  const detailColumns = [
    { key: 'date', label: 'Date', render: r => date(r.date) },
    { key: 'invoice', label: 'Invoice' }, { key: 'party', label: 'Party' },
    { key: 'gstin', label: 'GSTIN' }, { key: 'place', label: 'Place of supply' },
    { key: 'taxable', label: 'Taxable', align: 'right', render: r => money(r.taxable) },
    { key: 'cgst', label: 'CGST', align: 'right', render: r => money(r.cgst) },
    { key: 'sgst', label: 'SGST', align: 'right', render: r => money(r.sgst) },
    { key: 'igst', label: 'IGST', align: 'right', render: r => money(r.igst) },
    { key: 'total', label: 'Total', align: 'right', render: r => money(r.total) },
  ];
  if (error) return <ModuleView title="GST" sub="Returns and reconciliation" testid="gst-view"><ErrorPanel error={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="GST" sub="Returns and reconciliation for the selected financial year" testid="gst-view">
      <StatGrid cols={5} items={[
        { label: 'Output tax', value: mc(g.outputTax), sub: 'GST ledgers', tone: '#B14435' },
        { label: 'Input credit', value: mc(g.inputTax), sub: 'Not separated by summary API', tone: '#447B4B' },
        { label: 'Net payable', value: mc(g.netPayable), sub: 'Summary balance', tone: '#181818' },
        { label: 'CGST', value: mc(g.cgst), sub: 'Selected FY', tone: '#3963E4' },
        { label: 'IGST', value: mc(g.igst), sub: 'Selected FY', tone: '#BB7836' },
      ]} />
      <Tabs tabs={GST_TABS} value={tab} onChange={setTab} testid="gst-tabs" />
      {tab === 'Summary' && <Panel title="Tax split"><DataTable testid="gst-split-table" loading={loading} rows={[
        { id: 1, head: lt('CGST'), amount: g.cgst }, { id: 2, head: lt('SGST'), amount: g.sgst },
        { id: 3, head: lt('IGST'), amount: g.igst }, { id: 4, head: lt('Total GST'), amount: g.outputTax },
      ]} columns={[{ key: 'head', label: 'Head' }, { key: 'amount', label: 'Amount', align: 'right', render: r => money(r.amount) }]} /></Panel>}
      {['GSTR-1', 'GSTR-2A', 'GSTR-3B'].includes(tab) && <Panel title={`${tab} detail`} sub="Live voucher-level GST data">
        {detail.error ? <ErrorPanel error={detail.error} retry={() => setDetailVersion(v => v + 1)} /> : <DataTable testid={`${tab.toLowerCase().replace('-', '')}-table`} rows={rows} loading={detail.loading} emptyMessage={`No ${tab} records found`} columns={detailColumns} pageSize={12} />}
      </Panel>}
      {tab === 'Unmatched' && <Panel title="Unmatched GST entries"><Empty message="Unmatched entry detail is not available" hint="The backend currently provides only an unmatched count, not an unmatched-entry list." /></Panel>}
      {tab === 'Returns' && <Panel title="All returns"><Empty message="GST filing history is not available" hint="No backend endpoint currently provides return due dates or filing status." /></Panel>}
    </ModuleView>
  );
}

function GenerateModal({ open, onClose, kind, rows, onGenerated }) {
  const lt = useLabelT();
  const [voucherGuid, setVoucherGuid] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [distance, setDistance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const { selectedCompany } = useAuth();
  useEffect(() => {
    if (open) {
      setVoucherGuid(rows[0]?.guid || '');
      setResult(null);
      setError('');
    }
  }, [open, rows]);
  const submit = async () => {
    if (!voucherGuid) return setError(lt('Choose an eligible invoice.'));
    setSubmitting(true);
    setError('');
    try {
      const payload = { companyGuid: companyId(selectedCompany), voucherGuid };
      const res = await rootPost(kind === 'E-Invoice' ? '/api/einvoice/generate' : '/api/ewaybills/generate', payload);
      setResult(dataOf(res));
      onGenerated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} testid="generate-modal" title={`Generate ${kind}`} sub={result ? 'Generated successfully' : 'Choose an eligible outward invoice'} footer={result
      ? <Button variant="primary" data-testid="generate-done" onClick={onClose}>{lt('Done')}</Button>
      : <><Button onClick={onClose}>{lt('Cancel')}</Button><Button variant="primary" data-testid="generate-submit" disabled={submitting || !rows.length} onClick={submit}>{lt(submitting ? 'Generating…' : 'Generate')}</Button></>}>
      {result ? <div className="py-6 text-center"><p className="text-sm font-semibold text-ink">{lt(kind === 'E-Invoice' ? 'E-Invoice generated' : 'E-Way Bill generated')}</p><p className="mt-1 text-[13px] text-ink-soft tabular">{result.irn || result.ewbNo || result.ewb_no}</p></div> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Invoice"><Select data-testid="gen-invoice" value={voucherGuid} onChange={e => setVoucherGuid(e.target.value)}>{rows.map(v => <option key={v.guid} value={v.guid}>{v.voucher_number}</option>)}</Select></Field>
          <Field label="Party"><Select data-testid="gen-party" value={voucherGuid} onChange={() => {}} disabled>{rows.map(v => <option key={v.guid} value={v.guid}>{v.party_name || '—'}</option>)}</Select></Field>
          {kind === 'E-Way Bill' && <><Field label="Vehicle number"><Input data-testid="gen-vehicle" value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder={lt('Uses synced dispatch details')} disabled /></Field><Field label="Distance (km)"><Input type="number" data-testid="gen-distance" value={distance} onChange={e => setDistance(e.target.value)} placeholder={lt('Uses synced dispatch details')} disabled /></Field><Field label="Transport mode"><Select data-testid="gen-mode" value="Road" disabled><option value="Road">{lt('Road')}</option></Select></Field></>}
          {!rows.length && <p className="text-[13px] text-ink-soft sm:col-span-2">{lt('No eligible pending invoices.')}</p>}
          {error && <p className="text-[13px] text-neg sm:col-span-2">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function normalizeInvoice(r, i) {
  const status = r.einvoice_status || (r.irn ? 'Generated' : 'Pending');
  return { id: r.guid || r.id || i, ...r, invoice: r.voucher_number, party: r.party_name, amount: number(r.amount), status: `${status}`.replace(/^./, c => c.toUpperCase()) };
}

export function EInvoice() {
  const lt = useLabelT();
  const { money, mc, date } = useFmt();
  const salesCtx = useSalesContext();
  const [localGen, setLocalGen] = useState(false);
  const [active, setActive] = useState(null);
  const [attentionFilter, setAttentionFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const selection = useVoucherSelection();
  const load = useCallback(async (guid, fy) => {
    const [generated, pending, status] = await Promise.all([
      apiGet(queryPath('/api/einvoice/generated', guid, fy, { limit: 100 })),
      apiGet(queryPath('/api/einvoice/pending', guid, fy)),
      apiGet(queryPath('/api/einvoice/status', guid, fy)),
    ]);
    return { generated: unwrapList(generated), pending: unwrapList(pending), status: dataOf(status), meta: pending?.meta };
  }, []);
  const { data, loading, error, retry } = useLive(load);
  const rows = [...(data?.generated || []), ...(data?.pending || [])].map(normalizeInvoice);
  const alertCounts = new Map((salesCtx?.alerts || []).map(alert => [alert.type, alert.count]));
  const attentionOptions = [
    { value: 'all', label: 'All invoices', count: rows.length },
    ...(alertCounts.get('EINVOICE_MISSING_GSTIN') ? [{ value: 'missing-gstin', label: 'Missing customer GSTIN', count: alertCounts.get('EINVOICE_MISSING_GSTIN'), tone: 'warning' }] : []),
    ...(alertCounts.get('EINVOICE_MISSING_PLACE') ? [{ value: 'missing-place', label: 'Missing Place of Supply', count: alertCounts.get('EINVOICE_MISSING_PLACE'), tone: 'warning' }] : []),
    ...(alertCounts.get('EINVOICE_PENDING') ? [{ value: 'pending-irn', label: 'Pending IRN', count: alertCounts.get('EINVOICE_PENDING'), tone: 'warning' }] : []),
    ...(alertCounts.get('EINVOICE_FAILED') ? [{ value: 'failed', label: 'Generation failed', count: alertCounts.get('EINVOICE_FAILED'), tone: 'critical' }] : []),
  ];
  const matchesAttention = row => {
    if (attentionFilter.length === 0) return true;
    return attentionFilter.some(filter => {
      if (filter === 'missing-gstin') return !String(row.party_gstin || '').trim();
      if (filter === 'missing-place') return !String(row.place_of_supply || '').trim();
      if (filter === 'pending-irn') return !String(row.irn || '').trim();
      if (filter === 'failed') return Boolean(row.error_message) || String(row.status).toLowerCase() === 'error';
      return false;
    });
  };
  const statusValues = [...new Set(rows.map(row => String(row.status || '').toLowerCase()).filter(Boolean))];
  const statusOptions = [
    { value: 'all', label: 'All', count: rows.length },
    ...statusValues.map(value => ({ value, label: value.replace(/^./, char => char.toUpperCase()), count: rows.filter(row => String(row.status).toLowerCase() === value).length })),
  ];
  const filteredRows = rows.filter(row =>
    matchesAttention(row) && (statusFilter.length === 0 || statusFilter.includes(String(row.status).toLowerCase()))
  );
  const genOpen = salesCtx ? salesCtx.irnGenerateOpen : localGen;
  const closeGenerator = salesCtx ? salesCtx.closeIrnGenerator : () => setLocalGen(false);
  if (error) return <ModuleView title="E-Invoice" sub="IRN generation against outward invoices" testid="einvoice-view"><ErrorPanel error={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="E-Invoice" sub="IRN generation against outward invoices" testid="einvoice-view" actions={!salesCtx ? <Button variant="primary" data-testid="einvoice-generate-button" onClick={() => setLocalGen(true)}><Plus size={13} /> {lt('Generate IRN')}</Button> : null}>
      {!salesCtx && <StatGrid items={[
        { label: 'Generated', value: number(data?.status?.generated_count), sub: 'With IRN', tone: '#447B4B' },
        { label: 'Pending', value: number(data?.status?.pending_count), sub: 'To generate', tone: '#BB7836' },
        { label: 'Failed', value: number(data?.status?.error_count), sub: 'Retry needed', tone: '#B14435' },
        { label: 'Value covered', value: mc(rows.filter(r => r.irn).reduce((s, r) => s + r.amount, 0)), sub: 'This FY', tone: '#181818' },
      ]} />}
      <DataTable
        testid="einvoice-table"
        rows={filteredRows}
        loading={loading}
        emptyMessage={data?.meta?.message || 'No e-invoice records found'}
        pageSize={12}
        onRowClick={setActive}
        selectable
        selectedKeys={selection.selectedKeys}
        onToggleRow={selection.toggleRow}
        onToggleAll={selection.toggleAll}
        rowKey={voucherRowKey}
        searchKeys={['invoice', 'party', 'date', 'irn', 'ack_no']}
        toolbar={<>
          {salesCtx && attentionOptions.length > 1 && <TableFilter label="Attention" value={attentionFilter} onChange={setAttentionFilter} options={attentionOptions} notification testid="einvoice-attention-filter" />}
          <TableFilter label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} testid="einvoice-status-filter" />
        </>}
        bottomOverlay={<BulkActionBar rows={filteredRows} selectedKeys={selection.selectedKeys} onClear={selection.clear} onToggleAll={selection.toggleAll} docLabel="invoices" testid="einvoice-bulk-bar" />}
        columns={[
        { key: 'date', label: 'Date', render: r => date(r.date) }, { key: 'invoice', label: 'Invoice' }, { key: 'party', label: 'Party' },
        { key: 'irn', label: 'IRN', render: r => r.irn ? <span className="mono text-[11px]">{r.irn}</span> : '—' },
        { key: 'ack_no', label: 'Ack no.', render: r => r.ack_no || '—' },
        { key: 'amount', label: 'Value', align: 'right', render: r => money(r.amount) },
        { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
      ]} />
      <GenerateModal open={genOpen} onClose={closeGenerator} kind="E-Invoice" rows={(data?.pending || [])} onGenerated={retry} />
      {active && <RecordDrawer record={active} onClose={() => setActive(null)} title={active.invoice} sub={<>{lt('E-Invoice')} · {date(active.date)}</>} fields={[
        ['Party', active.party], ['Invoice value', money(active.amount), true], ['IRN', active.irn || lt('Not generated'), true],
        ['Ack. number', active.ack_no || '—', true], ['Status', <Status key="st" value={active.status} />],
      ]} />}
    </ModuleView>
  );
}

export function EInvoiceCoverage() {
  const lt = useLabelT();
  const { money } = useFmt();
  const load = useCallback(async (guid, fy) => {
    const [generated, pending] = await Promise.all([apiGet(queryPath('/api/einvoice/generated', guid, fy, { limit: 100 })), apiGet(queryPath('/api/einvoice/pending', guid, fy))]);
    return { generated: unwrapList(generated), pending: unwrapList(pending) };
  }, []);
  const { data, loading, error, retry } = useLive(load);
  if (error) return <ModuleView title="E-Invoice coverage" sub="Invoices above the e-invoicing threshold" testid="einvoice-coverage-view"><ErrorPanel error={error} retry={retry} /></ModuleView>;
  const generated = data?.generated || [], pending = data?.pending || [], all = [...generated, ...pending];
  return <ModuleView title="E-Invoice coverage" sub="Invoices above the e-invoicing threshold" testid="einvoice-coverage-view"><Panel><DataTable testid="einvoice-compliance-table" loading={loading} rows={[
    { id: 1, head: lt('Invoices requiring IRN'), count: all.length, value: all.reduce((s, r) => s + number(r.amount), 0) },
    { id: 2, head: lt('IRN generated'), count: generated.length, value: generated.reduce((s, r) => s + number(r.amount), 0) },
    { id: 3, head: lt('Missing IRN'), count: pending.length, value: pending.reduce((s, r) => s + number(r.amount), 0) },
  ]} columns={[{ key: 'head', label: 'Particulars' }, { key: 'count', label: 'Invoices', align: 'right' }, { key: 'value', label: 'Value', align: 'right', render: r => money(r.value) }]} /></Panel></ModuleView>;
}

function normalizeEwb(r, i) {
  const status = r.ewb_status || (r.ewb_number ? 'Generated' : 'Pending');
  return {
    id: r.guid || r.id || i, ...r, ewb_no: r.ewb_no || r.ewb_number, invoice: r.voucher_number,
    party: r.party_name, distance: number(r.distance ?? r.distance_km), vehicle: r.vehicle || r.vehicle_no,
    amount: number(r.amount), status: `${status}`.replace(/^./, c => c.toUpperCase()),
  };
}

export function EWayBill() {
  const lt = useLabelT();
  const { money, mc, date } = useFmt();
  const salesCtx = useSalesContext();
  const [gen, setGen] = useState(false);
  const [active, setActive] = useState(null);
  const [attentionFilter, setAttentionFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const selection = useVoucherSelection();
  const load = useCallback(async (guid, fy) => {
    const [generated, pending, status] = await Promise.all([
      apiGet(queryPath('/api/ewaybills', guid, fy, { limit: 100 })),
      apiGet(queryPath('/api/ewaybills/pending', guid, fy, { limit: 100 })),
      apiGet(queryPath('/api/ewaybills/status', guid, fy)),
    ]);
    return { generated: unwrapList(generated), pending: unwrapList(pending), status: dataOf(status), meta: generated?.meta };
  }, []);
  const { data, loading, error, retry } = useLive(load);
  const rows = [...(data?.generated || []), ...(data?.pending || [])].map(normalizeEwb);
  const pendingAlert = (salesCtx?.alerts || []).find(alert => alert.type === 'EWAY_BILL_PENDING');
  const attentionOptions = [
    { value: 'all', label: 'All E-Way Bills', count: rows.length },
    ...(pendingAlert ? [{ value: 'pending', label: 'Pending E-Way Bill', count: pendingAlert.count, tone: 'warning' }] : []),
  ];
  const statusValues = [...new Set(rows.map(row => String(row.status || '').toLowerCase()).filter(Boolean))];
  const statusOptions = [
    { value: 'all', label: 'All', count: rows.length },
    ...statusValues.map(value => ({ value, label: value.replace(/^./, char => char.toUpperCase()), count: rows.filter(row => String(row.status).toLowerCase() === value).length })),
  ];
  const filteredRows = rows.filter(row =>
    (attentionFilter.length === 0 || (attentionFilter.includes('pending') && String(row.status).toLowerCase() === 'pending')) &&
    (statusFilter.length === 0 || statusFilter.includes(String(row.status).toLowerCase()))
  );
  if (error) return <ModuleView title="E-Way Bill" sub="Consignment documents and validity" testid="ewb-view"><ErrorPanel error={error} retry={retry} /></ModuleView>;
  return (
    <ModuleView title="E-Way Bill" sub="Consignment documents and validity" testid="ewb-view" actions={<Button variant="primary" data-testid="ewb-generate-button" onClick={() => setGen(true)}><Plus size={13} /> {lt('Generate EWB')}</Button>}>
      <StatGrid cols={5} items={[
        { label: 'Generated', value: number(data?.status?.generated_count), sub: 'Bills', tone: '#447B4B' },
        { label: 'Pending', value: number(data?.status?.pending_count), sub: 'To generate', tone: '#BB7836' },
        { label: 'Expiring', value: number(data?.status?.expiring_count), sub: 'Within 24 hours', tone: '#B14435' },
        { label: 'Distance', value: `${rows.reduce((s, r) => s + r.distance, 0)} km`, sub: 'Recorded', tone: '#3963E4' },
        { label: 'Value', value: mc(rows.reduce((s, r) => s + r.amount, 0)), sub: 'Consignments', tone: '#181818' },
      ]} />
      <DataTable
        testid="ewb-table"
        rows={filteredRows}
        loading={loading}
        emptyMessage={data?.meta?.message || 'No e-way bill records found'}
        pageSize={12}
        onRowClick={setActive}
        selectable
        selectedKeys={selection.selectedKeys}
        onToggleRow={selection.toggleRow}
        onToggleAll={selection.toggleAll}
        rowKey={voucherRowKey}
        searchKeys={['invoice', 'party', 'date', 'ewb_no', 'vehicle']}
        toolbar={<>
          {salesCtx && attentionOptions.length > 1 && <TableFilter label="Attention" value={attentionFilter} onChange={setAttentionFilter} options={attentionOptions} notification testid="ewb-attention-filter" />}
          <TableFilter label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} testid="ewb-status-filter" />
        </>}
        bottomOverlay={<BulkActionBar rows={filteredRows} selectedKeys={selection.selectedKeys} onClear={selection.clear} onToggleAll={selection.toggleAll} docLabel="E-Way Bills" testid="ewb-bulk-bar" />}
        columns={[
        { key: 'date', label: 'Date', render: r => date(r.date) }, { key: 'ewb_no', label: 'EWB No.', render: r => r.ewb_no || '—' },
        { key: 'invoice', label: 'Invoice' }, { key: 'party', label: 'Party' }, { key: 'distance', label: 'Km', align: 'right' },
        { key: 'vehicle', label: 'Vehicle' }, { key: 'valid_till', label: 'Valid till', render: r => r.valid_till ? date(r.valid_till) : '—' },
        { key: 'status', label: 'Status', render: r => <Status value={r.status} /> },
      ]} />
      <GenerateModal open={gen} onClose={() => setGen(false)} kind="E-Way Bill" rows={data?.pending || []} onGenerated={retry} />
      {active && <RecordDrawer record={active} onClose={() => setActive(null)} title={active.ewb_no || active.invoice} sub={<>{lt('E-Way Bill')} · {date(active.date)}</>} fields={[
        ['Invoice', active.invoice], ['Party', active.party], ['Distance', `${active.distance} km`, true], ['Vehicle', active.vehicle || '—', true],
        ['Consignment value', money(active.amount), true], ['Valid till', active.valid_till ? date(active.valid_till) : '—', true], ['Status', <Status key="st" value={active.status} />],
      ]} />}
    </ModuleView>
  );
}

export function EWayBillCoverage() {
  const lt = useLabelT();
  const { money } = useFmt();
  const load = useCallback(async (guid, fy) => {
    const [generated, pending, status] = await Promise.all([apiGet(queryPath('/api/ewaybills', guid, fy, { limit: 100 })), apiGet(queryPath('/api/ewaybills/pending', guid, fy, { limit: 100 })), apiGet(queryPath('/api/ewaybills/status', guid, fy))]);
    return { generated: unwrapList(generated), pending: unwrapList(pending), status: dataOf(status) };
  }, []);
  const { data, loading, error, retry } = useLive(load);
  if (error) return <ModuleView title="E-Way Bill coverage" sub="Consignments above ₹50,000" testid="ewb-coverage-view"><ErrorPanel error={error} retry={retry} /></ModuleView>;
  const generated = data?.generated || [], pending = data?.pending || [], all = [...generated, ...pending];
  return <ModuleView title="E-Way Bill coverage" sub="Consignments above ₹50,000" testid="ewb-coverage-view"><Panel><DataTable testid="ewb-compliance-table" loading={loading} rows={[
    { id: 1, head: lt('Consignments requiring EWB'), count: all.length, value: all.reduce((s, r) => s + number(r.amount), 0) },
    { id: 2, head: lt('EWB generated'), count: generated.length, value: generated.reduce((s, r) => s + number(r.amount), 0) },
    { id: 3, head: lt('Missing EWB'), count: pending.length, value: pending.reduce((s, r) => s + number(r.amount), 0) },
    { id: 4, head: lt('Expiring bills'), count: number(data?.status?.expiring_count), value: 0 },
  ]} columns={[{ key: 'head', label: 'Particulars' }, { key: 'count', label: 'Count', align: 'right' }, { key: 'value', label: 'Value', align: 'right', render: r => money(r.value) }]} /></Panel></ModuleView>;
}

export function OtherTaxes() {
  const { money, mc, date } = useFmt();
  const load = useCallback((guid, fy) => apiGet(queryPath('/api/reports/other-taxes/summary', guid, fy)), []);
  const { data, loading, error, retry } = useLive(load);
  const rows = unwrapList(data).map((r, i) => ({ id: i, ...r, name: r.taxType, count: number(r.voucherCount), amount: number(r.totalTaxAmount), due: r.lastTransactionDate }));
  if (error) return <ModuleView title="Other taxes" sub="TDS, TCS and other statutory heads" testid="other-taxes-view"><ErrorPanel error={error} retry={retry} /></ModuleView>;
  return <ModuleView title="Other taxes" sub="TDS, TCS and other statutory heads" testid="other-taxes-view">
    <StatGrid items={[
      { label: 'Total tax', value: mc(rows.reduce((s, r) => s + r.amount, 0)), sub: 'Selected FY', tone: '#181818' },
      { label: 'Tax heads', value: rows.length, sub: 'With transactions', tone: '#447B4B' },
      { label: 'Vouchers', value: rows.reduce((s, r) => s + r.count, 0), sub: 'Tax transactions', tone: '#BB7836' },
      { label: 'Latest activity', value: rows[0]?.due ? date(rows[0].due) : '—', sub: 'Last transaction', tone: '#3963E4' },
    ]} />
    <DataTable testid="other-taxes-table" rows={rows} loading={loading} emptyMessage="No other-tax transactions found" columns={[
      { key: 'name', label: 'Tax head', render: r => <span className="font-medium">{r.name}</span> },
      { key: 'count', label: 'Vouchers', align: 'right' }, { key: 'due', label: 'Last transaction', render: r => r.due ? date(r.due) : '—' },
      { key: 'amount', label: 'Amount', align: 'right', render: r => money(r.amount) },
    ]} />
  </ModuleView>;
}

export function TaxRegister() {
  const { money, date } = useFmt();
  const load = useCallback((guid, fy) => apiGet(queryPath('/api/reports/other-taxes/transactions', guid, fy, { limit: 100 })), []);
  const { data, loading, error, retry } = useLive(load);
  const rows = unwrapList(data).map((r, i) => ({
    id: r.id || i, ...r, date: r.voucher_date, section: r.section || r.tax_type, party: r.party_name,
    gross: number(r.taxable_amount ?? r.gross_amount), tax: number(r.tax_amount), rate: number(r.tax_rate),
    challan: r.challan_number || '—',
  }));
  if (error) return <ModuleView title="Tax register" sub="Deduction-wise TDS / TCS register" testid="tax-register-view"><ErrorPanel error={error} retry={retry} /></ModuleView>;
  return <ModuleView title="Tax register" sub="Deduction-wise TDS / TCS register" testid="tax-register-view"><DataTable testid="tax-register-table" rows={rows} loading={loading} emptyMessage="No tax register transactions found" pageSize={12} columns={[
    { key: 'date', label: 'Date', render: r => r.date ? date(r.date) : '—' }, { key: 'section', label: 'Tax type', render: r => <Pill>{r.section}</Pill> },
    { key: 'party', label: 'Party' }, { key: 'gross', label: 'Taxable', align: 'right', render: r => money(r.gross) },
    { key: 'rate', label: 'Rate', align: 'right', render: r => r.rate ? `${r.rate}%` : '—' },
    { key: 'tax', label: 'Tax', align: 'right', render: r => money(r.tax) }, { key: 'challan', label: 'Challan' },
  ]} /></ModuleView>;
}

export function ComplianceKpis() {
  const { mc } = useFmt();
  const load = useCallback(async (guid, fy) => {
    const r = rangeFor(fy);
    const [gst, irn, ewb] = await Promise.all([
      api.fetchGSTSummary({ companyGuid: guid, fromDate: r.from, toDate: r.to }),
      apiGet(queryPath('/api/einvoice/status', guid, fy)),
      apiGet(queryPath('/api/ewaybills/status', guid, fy)),
    ]);
    return { gst: dataOf(gst), irn: dataOf(irn), ewb: dataOf(ewb) };
  }, []);
  const { data, loading, error, retry } = useLive(load);
  if (loading) return <Skeleton rows={3} />;
  if (error) return <ErrorPanel error={error} retry={retry} />;
  return <StatGrid items={[
    { label: 'GST total', value: mc(number(data?.gst?.summary?.total)), sub: 'Selected FY', tone: '#B14435' },
    { label: 'GST unmatched', value: number(data?.gst?.summary?.unmatchedCount), sub: 'Needs review', tone: '#BB7836' },
    { label: 'IRN pending', value: number(data?.irn?.pending_count), sub: 'E-Invoice', tone: '#3963E4' },
    { label: 'EWB expiring', value: number(data?.ewb?.expiring_count), sub: 'Within 24 hours', tone: '#181818' },
  ]} />;
}