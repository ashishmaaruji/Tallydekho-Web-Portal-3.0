/**
 * format.js — Shared formatting utilities for TallyDekho Web Portal
 *
 * Use formatAmount / formatAmountCompact / formatDate directly,
 * or via the useFormatting() hook which auto-loads user settings.
 */

export const DEFAULT_FORMAT_SETTINGS = {
  currency: 'INR',
  number_format: 'Indian',
  decimal_places: 2,
  date_format: 'DD/MM/YYYY',
};

// ── Currency symbol map ────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS = {
  INR: '₹',  USD: '$',   EUR: '€',  GBP: '£',  AED: 'د.إ', AUD: 'A$',
  BDT: '৳',  BHD: 'BD',  CAD: 'C$', CNY: '¥',  JPY: '¥',   KES: 'KSh',
  KWD: 'KD', LKR: 'Rs',  MYR: 'RM', NGN: '₦',  NPR: 'रू',  NZD: 'NZ$',
  OMR: '﷼',  QAR: 'QR',  SAR: 'SR', SGD: 'S$', TZS: 'TSh', ZAR: 'R',
};

export function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Whether a currency uses Indian compact notation (L, Cr).
 */
function isIndianCurrency(currency) {
  return ['INR', 'NPR', 'LKR', 'BDT'].includes(currency);
}

/**
 * Full amount format.
 * INR/Indian:        ₹1,25,000.00
 * USD/International: $125,000.00
 */
export function formatAmount(n, settings = DEFAULT_FORMAT_SETTINGS) {
  const symbol = getCurrencySymbol(settings.currency);
  const abs = Math.abs(n);
  const locale = settings.number_format === 'Indian' ? 'en-IN' : 'en-US';
  const formatted = abs.toLocaleString(locale, {
    minimumFractionDigits: settings.decimal_places,
    maximumFractionDigits: settings.decimal_places,
  });
  return (n < 0 ? '-' : '') + symbol + formatted;
}

/**
 * Compact amount for KPI cards, summary rows, charts.
 *
 * Indian (INR etc.):      ₹1.2Cr / ₹4.5L / ₹23K / ₹500
 * International (USD etc.): $1.2B / $4.5M / $23K / $500
 */
export function formatAmountCompact(n, settings = DEFAULT_FORMAT_SETTINGS) {
  const symbol = getCurrencySymbol(settings.currency);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (isIndianCurrency(settings.currency)) {
    if (abs >= 1_00_00_000) return `${sign}${symbol}${(abs / 1_00_00_000).toFixed(1)}Cr`;
    if (abs >= 1_00_000)    return `${sign}${symbol}${(abs / 1_00_000).toFixed(1)}L`;
    if (abs >= 1_000)       return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${symbol}${Math.round(abs)}`;
  } else {
    if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000)     return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)         return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${symbol}${Math.round(abs)}`;
  }
}

/**
 * Format ISO date strings per user's date_format preference.
 * Non-ISO strings (e.g. "10 Jul") are returned as-is.
 */
export function formatDate(iso, settings = DEFAULT_FORMAT_SETTINGS) {
  if (!iso) return '';
  const datePart = String(iso).split('T')[0];
  if (!datePart.match(/^\d{4}-\d{2}-\d{2}$/)) return iso;
  const [y, m, d] = datePart.split('-');
  switch (settings.date_format) {
    case 'MM/DD/YYYY': return `${m}/${d}/${y}`;
    case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
    default:           return `${d}/${m}/${y}`;
  }
}
