// Comprehensive country list — India, Middle East, Southeast Asia, and global
// Sorted: India first, then Middle East, then Southeast Asia, then rest alphabetically

export const COUNTRIES = [
  // ── India (primary market) ─────────────────────────────────────────────────
  { name: 'India',               code: '+91',  flag: '🇮🇳', digits: 10, iso: 'IN' },

  // ── Middle East ────────────────────────────────────────────────────────────
  { name: 'UAE / Dubai',         code: '+971', flag: '🇦🇪', digits: 9,  iso: 'AE' },
  { name: 'Saudi Arabia',        code: '+966', flag: '🇸🇦', digits: 9,  iso: 'SA' },
  { name: 'Qatar',               code: '+974', flag: '🇶🇦', digits: 8,  iso: 'QA' },
  { name: 'Kuwait',              code: '+965', flag: '🇰🇼', digits: 8,  iso: 'KW' },
  { name: 'Bahrain',             code: '+973', flag: '🇧🇭', digits: 8,  iso: 'BH' },
  { name: 'Oman',                code: '+968', flag: '🇴🇲', digits: 8,  iso: 'OM' },
  { name: 'Jordan',              code: '+962', flag: '🇯🇴', digits: 9,  iso: 'JO' },
  { name: 'Lebanon',             code: '+961', flag: '🇱🇧', digits: 8,  iso: 'LB' },
  { name: 'Iraq',                code: '+964', flag: '🇮🇶', digits: 10, iso: 'IQ' },
  { name: 'Yemen',               code: '+967', flag: '🇾🇪', digits: 9,  iso: 'YE' },
  { name: 'Syria',               code: '+963', flag: '🇸🇾', digits: 9,  iso: 'SY' },
  { name: 'Palestine',           code: '+970', flag: '🇵🇸', digits: 9,  iso: 'PS' },
  { name: 'Iran',                code: '+98',  flag: '🇮🇷', digits: 10, iso: 'IR' },
  { name: 'Turkey',              code: '+90',  flag: '🇹🇷', digits: 10, iso: 'TR' },
  { name: 'Egypt',               code: '+20',  flag: '🇪🇬', digits: 10, iso: 'EG' },
  { name: 'Israel',              code: '+972', flag: '🇮🇱', digits: 9,  iso: 'IL' },

  // ── Southeast Asia ─────────────────────────────────────────────────────────
  { name: 'Myanmar',             code: '+95',  flag: '🇲🇲', digits: 9,  iso: 'MM' },
  { name: 'Singapore',           code: '+65',  flag: '🇸🇬', digits: 8,  iso: 'SG' },
  { name: 'Malaysia',            code: '+60',  flag: '🇲🇾', digits: 10, iso: 'MY' },
  { name: 'Thailand',            code: '+66',  flag: '🇹🇭', digits: 9,  iso: 'TH' },
  { name: 'Indonesia',           code: '+62',  flag: '🇮🇩', digits: 11, iso: 'ID' },
  { name: 'Philippines',         code: '+63',  flag: '🇵🇭', digits: 10, iso: 'PH' },
  { name: 'Vietnam',             code: '+84',  flag: '🇻🇳', digits: 9,  iso: 'VN' },
  { name: 'Bangladesh',          code: '+880', flag: '🇧🇩', digits: 10, iso: 'BD' },
  { name: 'Sri Lanka',           code: '+94',  flag: '🇱🇰', digits: 9,  iso: 'LK' },
  { name: 'Nepal',               code: '+977', flag: '🇳🇵', digits: 10, iso: 'NP' },
  { name: 'Pakistan',            code: '+92',  flag: '🇵🇰', digits: 10, iso: 'PK' },
  { name: 'Afghanistan',         code: '+93',  flag: '🇦🇫', digits: 9,  iso: 'AF' },
  { name: 'Maldives',            code: '+960', flag: '🇲🇻', digits: 7,  iso: 'MV' },
  { name: 'Bhutan',              code: '+975', flag: '🇧🇹', digits: 8,  iso: 'BT' },
  { name: 'Cambodia',            code: '+855', flag: '🇰🇭', digits: 9,  iso: 'KH' },
  { name: 'Laos',                code: '+856', flag: '🇱🇦', digits: 9,  iso: 'LA' },
  { name: 'Brunei',              code: '+673', flag: '🇧🇳', digits: 7,  iso: 'BN' },
  { name: 'Timor-Leste',         code: '+670', flag: '🇹🇱', digits: 8,  iso: 'TL' },

  // ── South Asia / Central Asia ──────────────────────────────────────────────
  { name: 'Kazakhstan',          code: '+7',   flag: '🇰🇿', digits: 10, iso: 'KZ' },
  { name: 'Uzbekistan',          code: '+998', flag: '🇺🇿', digits: 9,  iso: 'UZ' },
  { name: 'Azerbaijan',          code: '+994', flag: '🇦🇿', digits: 9,  iso: 'AZ' },
  { name: 'Armenia',             code: '+374', flag: '🇦🇲', digits: 8,  iso: 'AM' },
  { name: 'Georgia',             code: '+995', flag: '🇬🇪', digits: 9,  iso: 'GE' },

  // ── Africa ─────────────────────────────────────────────────────────────────
  { name: 'Nigeria',             code: '+234', flag: '🇳🇬', digits: 10, iso: 'NG' },
  { name: 'Kenya',               code: '+254', flag: '🇰🇪', digits: 9,  iso: 'KE' },
  { name: 'South Africa',        code: '+27',  flag: '🇿🇦', digits: 9,  iso: 'ZA' },
  { name: 'Ghana',               code: '+233', flag: '🇬🇭', digits: 9,  iso: 'GH' },
  { name: 'Ethiopia',            code: '+251', flag: '🇪🇹', digits: 9,  iso: 'ET' },
  { name: 'Tanzania',            code: '+255', flag: '🇹🇿', digits: 9,  iso: 'TZ' },
  { name: 'Uganda',              code: '+256', flag: '🇺🇬', digits: 9,  iso: 'UG' },
  { name: 'Morocco',             code: '+212', flag: '🇲🇦', digits: 9,  iso: 'MA' },
  { name: 'Tunisia',             code: '+216', flag: '🇹🇳', digits: 8,  iso: 'TN' },
  { name: 'Algeria',             code: '+213', flag: '🇩🇿', digits: 9,  iso: 'DZ' },
  { name: 'Libya',               code: '+218', flag: '🇱🇾', digits: 9,  iso: 'LY' },
  { name: 'Sudan',               code: '+249', flag: '🇸🇩', digits: 9,  iso: 'SD' },

  // ── Europe ─────────────────────────────────────────────────────────────────
  { name: 'United Kingdom',      code: '+44',  flag: '🇬🇧', digits: 10, iso: 'GB' },
  { name: 'Germany',             code: '+49',  flag: '🇩🇪', digits: 11, iso: 'DE' },
  { name: 'France',              code: '+33',  flag: '🇫🇷', digits: 9,  iso: 'FR' },
  { name: 'Italy',               code: '+39',  flag: '🇮🇹', digits: 10, iso: 'IT' },
  { name: 'Spain',               code: '+34',  flag: '🇪🇸', digits: 9,  iso: 'ES' },
  { name: 'Netherlands',         code: '+31',  flag: '🇳🇱', digits: 9,  iso: 'NL' },
  { name: 'Belgium',             code: '+32',  flag: '🇧🇪', digits: 9,  iso: 'BE' },
  { name: 'Sweden',              code: '+46',  flag: '🇸🇪', digits: 9,  iso: 'SE' },
  { name: 'Norway',              code: '+47',  flag: '🇳🇴', digits: 8,  iso: 'NO' },
  { name: 'Denmark',             code: '+45',  flag: '🇩🇰', digits: 8,  iso: 'DK' },
  { name: 'Switzerland',         code: '+41',  flag: '🇨🇭', digits: 9,  iso: 'CH' },
  { name: 'Austria',             code: '+43',  flag: '🇦🇹', digits: 10, iso: 'AT' },
  { name: 'Portugal',            code: '+351', flag: '🇵🇹', digits: 9,  iso: 'PT' },
  { name: 'Russia',              code: '+7',   flag: '🇷🇺', digits: 10, iso: 'RU' },

  // ── Americas ───────────────────────────────────────────────────────────────
  { name: 'USA',                 code: '+1',   flag: '🇺🇸', digits: 10, iso: 'US' },
  { name: 'Canada',              code: '+1',   flag: '🇨🇦', digits: 10, iso: 'CA' },
  { name: 'Brazil',              code: '+55',  flag: '🇧🇷', digits: 11, iso: 'BR' },
  { name: 'Mexico',              code: '+52',  flag: '🇲🇽', digits: 10, iso: 'MX' },
  { name: 'Argentina',           code: '+54',  flag: '🇦🇷', digits: 10, iso: 'AR' },

  // ── East Asia & Pacific ────────────────────────────────────────────────────
  { name: 'China',               code: '+86',  flag: '🇨🇳', digits: 11, iso: 'CN' },
  { name: 'Japan',               code: '+81',  flag: '🇯🇵', digits: 10, iso: 'JP' },
  { name: 'South Korea',         code: '+82',  flag: '🇰🇷', digits: 10, iso: 'KR' },
  { name: 'Australia',           code: '+61',  flag: '🇦🇺', digits: 9,  iso: 'AU' },
  { name: 'New Zealand',         code: '+64',  flag: '🇳🇿', digits: 9,  iso: 'NZ' },
  { name: 'Hong Kong',           code: '+852', flag: '🇭🇰', digits: 8,  iso: 'HK' },
  { name: 'Taiwan',              code: '+886', flag: '🇹🇼', digits: 9,  iso: 'TW' },
  { name: 'Macau',               code: '+853', flag: '🇲🇴', digits: 8,  iso: 'MO' },
];

// Group countries for display
export const COUNTRY_GROUPS = [
  { label: 'India', countries: COUNTRIES.filter(c => c.iso === 'IN') },
  { label: 'Middle East', countries: COUNTRIES.filter(c => ['AE','SA','QA','KW','BH','OM','JO','LB','IQ','YE','SY','PS','IR','TR','EG','IL'].includes(c.iso)) },
  { label: 'Southeast Asia', countries: COUNTRIES.filter(c => ['MM','SG','MY','TH','ID','PH','VN','BD','LK','NP','PK','AF','MV','BT','KH','LA','BN','TL'].includes(c.iso)) },
  { label: 'Central Asia', countries: COUNTRIES.filter(c => ['KZ','UZ','AZ','AM','GE'].includes(c.iso)) },
  { label: 'Africa', countries: COUNTRIES.filter(c => ['NG','KE','ZA','GH','ET','TZ','UG','MA','TN','DZ','LY','SD'].includes(c.iso)) },
  { label: 'Europe', countries: COUNTRIES.filter(c => ['GB','DE','FR','IT','ES','NL','BE','SE','NO','DK','CH','AT','PT','RU'].includes(c.iso)) },
  { label: 'Americas', countries: COUNTRIES.filter(c => ['US','CA','BR','MX','AR'].includes(c.iso)) },
  { label: 'East Asia & Pacific', countries: COUNTRIES.filter(c => ['CN','JP','KR','AU','NZ','HK','TW','MO'].includes(c.iso)) },
];

export default COUNTRIES;
