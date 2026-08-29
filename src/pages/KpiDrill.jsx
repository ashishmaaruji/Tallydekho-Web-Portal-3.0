import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Page, Button, Empty, useLabelT } from '../components/kit';
import { useCompanyMeta } from './shared';
import KpiPanel, { KPI_KEYS } from './KpiPanel';

const TITLES = {
  'cash-register': 'Cash Register',
  receipts: 'Receipts',
  payments: 'Payments',
  receivables: 'Receivables',
  payables: 'Payables',
  'bank-balance': 'Bank Balance',
  'cash-in-hand': 'Cash in Hand',
  'loans-ods': 'Loans & ODs',
};

export default function KpiDrill() {
  const lt = useLabelT();
  const { key } = useParams();
  const navigate = useNavigate();
  const { subtitle } = useCompanyMeta();

  if (!KPI_KEYS.includes(key)) {
    return (
      <Page title="Not found" subtitle="Unknown KPI drill-down">
        <Empty message="Unknown KPI drill-down" hint={<Button onClick={() => navigate('/')}>{lt('Back to dashboard')}</Button>} />
      </Page>
    );
  }

  return (
    <Page
      testid={`kpi-${key}-page`}
      title={TITLES[key]}
      subtitle={subtitle}
      actions={<Button onClick={() => navigate('/')}><ArrowLeft size={13} /> {lt('Dashboard')}</Button>}
    >
      <KpiPanel metric={key} onClose={() => navigate('/')} />
    </Page>
  );
}