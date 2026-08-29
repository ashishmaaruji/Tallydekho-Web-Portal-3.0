import { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { DrawerStackProvider } from './components/kit';
import AppShell from './layouts/AppShell';
import ModuleLayout, {
  INVENTORY_SECTIONS, SETTINGS_SECTIONS, FINANCIALS_TABS, COMPLIANCE_TABS, SALES_TABS, PURCHASE_TABS, VOUCHER_TABS,
} from './layouts/ModuleLayout';

import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import * as S from './pages/sales';
import * as P from './pages/purchase';
import * as V from './pages/vouchers';
import * as I from './pages/inventory';
import * as F from './pages/financials';
import * as C from './pages/compliance';
import * as M from './pages/masters';
import * as G from './pages/settings';

class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6">
        <p className="text-base font-semibold text-ink">Something went wrong</p>
        <p className="max-w-md text-center text-[13px] text-ink-soft">{this.state.error.message}</p>
        <button
          onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
          className="h-10 rounded-md bg-ink px-5 text-[13px] font-semibold text-white"
        >
          Back to sign in
        </button>
      </div>
    );
  }
}

function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}
function PublicOnly({ children }) {
  const { token } = useAuth();
  return token ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <SettingsProvider>
            <DrawerStackProvider>
              <Routes>
                <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />

                <Route path="/" element={<Protected><AppShell /></Protected>}>
                  <Route index element={<Dashboard />} />
                  <Route path="kpi/:key" element={<Dashboard />} />

                  {/* Sales — small module, segmented tabs */}
                  <Route path="sales" element={<S.SalesLayout />}>
                    <Route index element={<S.SalesInvoices />} />
                    <Route path="register" element={<Navigate to="/sales" replace />} />
                    <Route path="orders" element={<S.SalesOrders />} />
                    <Route path="credit-notes" element={<S.CreditNotes />} />
                    <Route path="delivery-notes" element={<S.DeliveryNotes />} />
                    <Route path="proforma" element={<S.Proforma />} />
                    <Route path="quotations" element={<S.Quotations />} />
                    <Route path="einvoice" element={<C.EInvoice />} />
                    <Route path="eway-bill" element={<S.SalesEwayBill />} />
                  </Route>

                  {/* Purchase */}
                  <Route path="purchase" element={<ModuleLayout title="Purchase" tabs={PURCHASE_TABS} Kpis={P.PurchaseKpis} />}>
                    <Route index element={<P.PurchaseInvoices />} />
                    <Route path="register" element={<P.PurchaseRegister />} />
                    <Route path="orders" element={<P.PurchaseOrders />} />
                    <Route path="debit-notes" element={<P.DebitNotes />} />
                  </Route>

                  {/* Vouchers */}
                  <Route path="vouchers" element={<ModuleLayout title="Vouchers" tabs={VOUCHER_TABS} Kpis={V.VoucherKpis} />}>
                    <Route index element={<V.AllVouchers />} />
                    <Route path="payment" element={<V.PaymentVouchers />} />
                    <Route path="receipt" element={<V.ReceiptVouchers />} />
                    <Route path="journal" element={<V.JournalVouchers />} />
                    <Route path="contra" element={<V.ContraVouchers />} />
                  </Route>

                  {/* Inventory — section tabs + views inside each section */}
                  <Route path="inventory" element={<ModuleLayout title="Inventory" sections={INVENTORY_SECTIONS} />}>
                    <Route index element={<I.InventoryOverview />} />
                    <Route path="items" element={<I.StockItems />} />
                    <Route path="items/:id" element={<I.StockItems />} />
                    <Route path="warehouses" element={<I.Warehouses />} />
                    <Route path="warehouses/:id" element={<I.Warehouses />} />
                    <Route path="stock-ledger" element={<I.StockLedger />} />
                    <Route path="transfers" element={<I.Transfers />} />
                    <Route path="transfers/:id" element={<I.Transfers />} />
                    <Route path="adjustments" element={<I.Adjustments />} />
                    <Route path="on-hand" element={<I.OnHandStock />} />
                    <Route path="negative-stock" element={<I.NegativeStock />} />
                    <Route path="aged-items" element={<I.AgedItems />} />
                    <Route path="fast-slow" element={<I.FastSlow />} />
                    <Route path="reorder-queue" element={<I.ReorderQueue />} />
                    <Route path="movement-analytics" element={<I.MovementAnalytics />} />
                    <Route path="valuation-summary" element={<I.ValuationSummary />} />
                    <Route path="expiry-schedule" element={<I.ExpirySchedule />} />
                    <Route path="snapshot" element={<I.StockSnapshot />} />
                    <Route path="barcodes" element={<I.Barcodes />} />
                    <Route path="print-barcodes" element={<I.PrintBarcodes />} />
                    <Route path="label-preview" element={<I.LabelPreview />} />
                    <Route path="print-settings" element={<I.PrintSettings />} />
                    <Route path="reports" element={<I.StockReports />} />
                    <Route path="settings" element={<I.StockSettings />} />
                  </Route>

                  {/* Financials — segmented tabs */}
                  <Route path="financials" element={<ModuleLayout title="Financials" tabs={FINANCIALS_TABS} Kpis={F.FinancialsKpis} />}>
                    <Route index element={<Navigate to="/financials/cash-bank" replace />} />
                    <Route path="cash-bank" element={<F.CashBank />} />
                    <Route path="receivables-payables" element={<F.ReceivablesPayables />} />
                    <Route path="loans-ods" element={<F.LoansODs />} />
                    <Route path="profit-loss" element={<F.ProfitLoss />} />
                    <Route path="balance-sheet" element={<F.BalanceSheet />} />
                    <Route path="trial-balance" element={<F.TrialBalance />} />
                    <Route path="cashflow" element={<F.CashFlow />} />
                    <Route path="reports/*" element={<Navigate to="/financials/profit-loss" replace />} />
                  </Route>

                  {/* Compliance — segmented tabs */}
                  <Route path="compliance" element={<ModuleLayout title="Compliance" tabs={COMPLIANCE_TABS} Kpis={C.ComplianceKpis} />}>
                    <Route index element={<Navigate to="/compliance/gst" replace />} />
                    <Route path="gst" element={<C.GST />} />
                    <Route path="other-taxes" element={<C.OtherTaxes />} />
                    <Route path="tax-register" element={<C.TaxRegister />} />
                    <Route path="einvoice" element={<C.EInvoice />} />
                    <Route path="einvoice-coverage" element={<C.EInvoiceCoverage />} />
                    <Route path="eway-bill" element={<C.EWayBill />} />
                    <Route path="eway-bill-coverage" element={<C.EWayBillCoverage />} />
                    <Route path="daybook" element={<M.DayBook />} />
                    <Route path="audit-trail" element={<M.AuditTrail />} />
                  </Route>

                  {/* Standalone workspaces */}
                  <Route path="expenses" element={<M.Expenses />} />
                  <Route path="payments" element={<M.PaymentsReceipts />} />
                  <Route path="parties" element={<M.Parties />} />
                  <Route path="ledgers" element={<M.Ledgers />} />
                  <Route path="ai-insights" element={<M.AIInsights />} />

                  {/* Legacy paths kept working */}
                  <Route path="notifications" element={<Navigate to="/" replace />} />
                  <Route path="daybook" element={<Navigate to="/compliance/daybook" replace />} />
                  <Route path="expenses/register" element={<Navigate to="/expenses" replace />} />
                  <Route path="parties/:id" element={<Navigate to="/parties" replace />} />
                  <Route path="ledgers/:id" element={<Navigate to="/ledgers" replace />} />

                  {/* Settings — normal two-level module, matching Inventory navigation */}
                  <Route path="settings" element={<ModuleLayout title="Settings" sections={SETTINGS_SECTIONS} testid="settings-module" />}>
                    <Route index element={<Navigate to="/settings/profile" replace />} />
                    <Route path="profile" element={<G.SettingsProfile />} />
                    <Route path="company" element={<G.SettingsCompany />} />
                    <Route path="license" element={<G.SettingsLicense />} />
                    <Route path="tally-sync" element={<G.SettingsTallySync />} />
                    <Route path="bank-feeds" element={<G.SettingsBankFeeds />} />
                    <Route path="security" element={<G.SettingsSecurity />} />
                    <Route path="preferences" element={<G.SettingsPreferences />} />
                    <Route path="currency" element={<G.SettingsCurrency />} />
                    <Route path="language" element={<G.SettingsLanguage />} />
                    <Route path="notification-channels" element={<G.SettingsNotificationChannels />} />
                    <Route path="payment-reminders" element={<G.SettingsPaymentReminders />} />
                    <Route path="compliance-reminders" element={<G.SettingsComplianceReminders />} />
                    <Route path="stock-alerts" element={<G.SettingsStockAlerts />} />
                    <Route path="voucher-config" element={<G.SettingsVoucherConfig />} />
                    <Route path="einvoice" element={<G.SettingsEInvoice />} />
                    <Route path="ewb" element={<G.SettingsEWB />} />
                    <Route path="barcodes" element={<G.SettingsBarcodes />} />
                    <Route path="help" element={<G.SettingsHelp />} />
                    <Route path="about" element={<G.SettingsAbout />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </DrawerStackProvider>
          </SettingsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
