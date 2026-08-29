import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { fetchMe } from '../services/api';
import wsService from '../services/websocket';
import { USE_MOCK } from '../services/config';

const AuthContext = createContext(null);

// Clear any stale/fake tokens from previous sessions on page load
// This prevents blank screens caused by expired or fake demo tokens
(function cleanStaleToken() {
  const t = localStorage.getItem('authToken');
  if (t && t.startsWith('demo-token-')) {
    localStorage.clear();
  }
})();

// Mock mode keeps a real login screen — no session is auto-seeded.

export function AuthProvider({ children }) {
  const [token,     setToken]     = useState(() => localStorage.getItem('authToken'));
  const [user,      setUser]      = useState(() => { try { return JSON.parse(localStorage.getItem('authUser')); } catch { return null; } });
  const [companies, setCompanies] = useState(() => { try { return JSON.parse(localStorage.getItem('companies')) || []; } catch { return []; } });
  const [selectedCompany, setSelectedCompany] = useState(() => { try { return JSON.parse(localStorage.getItem('selectedCompany')); } catch { return null; } });
  const [selectedFY, setSelectedFY] = useState(() => { try { return JSON.parse(localStorage.getItem('selectedFY')); } catch { return null; } });
  const [isPaired,  setIsPaired]  = useState(() => localStorage.getItem('isPaired') === 'true');
  const [syncToast, setSyncToast] = useState(null);
  // Incremented on every successful sync — any page that depends on fresh data should use this as a useEffect dep
  const [syncVersion, setSyncVersion] = useState(0);

  // ── Connect WebSocket when token is available ─────────────────────────────
  useEffect(() => {
    if (!token || USE_MOCK) return;
    wsService.connect(token);

    const unSynced   = wsService.on('synced',   (d) => { showToast('✅ Tally data synced', 'success'); loadCompanies(); setSyncVersion(v => v + 1); });
    const unUnpaired = wsService.on('unpaired', (d) => { setIsPaired(false); localStorage.removeItem('isPaired'); showToast('⚠️ Tally unpaired', 'warning'); });
    const unLogout   = wsService.on('logout',   (d) => logout());
    // Auto-refresh everything after successful pairing
    const unPaired   = wsService.on('paired', async (d) => {
      localStorage.setItem('isPaired', 'true');
      setIsPaired(true);
      showToast(`✅ Paired with ${d?.deviceName || 'Desktop App'}! Loading your data...`, 'success');
      await loadCompanies(); // Load real companies + years immediately
    });

    return () => { unSynced(); unUnpaired(); unLogout(); unPaired(); wsService.disconnect(); };
  }, [token]);

  // Backend replied 403 "Device not paired" to any API call → show pairing state.
  useEffect(() => {
    const onUnpaired = () => {
      setIsPaired(prev => {
        if (prev) localStorage.setItem('isPaired', 'false');
        return false;
      });
    };
    window.addEventListener('td:unpaired', onUnpaired);
    return () => window.removeEventListener('td:unpaired', onUnpaired);
  }, []);

  const showToast = (message, type = 'info') => {
    setSyncToast({ message, type });
    setTimeout(() => setSyncToast(null), 4000);
  };

  // ── Load companies from real API ──────────────────────────────────────────
  const loadCompanies = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.fetchCompanies();
      const list = res?.data?.companies || res?.data || [];
      const arr = Array.isArray(list) ? list : [];
      localStorage.setItem('companies', JSON.stringify(arr));
      setCompanies(arr);

      if (arr.length > 0) {
        // Always refresh the selected company with fresh data (picks up new FY years)
        const currentGuid = selectedCompany?.guid;
        const freshComp = currentGuid
          ? (arr.find(c => c.guid === currentGuid) || arr[0])
          : arr[0];
        localStorage.setItem('selectedCompany', JSON.stringify(freshComp));
        setSelectedCompany(freshComp);

        // Reset selectedFY if it points to a future year with no data
        const today = new Date().toISOString().slice(0, 10);
        if (selectedFY && selectedFY.startDate > today) {
          // Current selection is a future FY — reset to latest past FY
          const fyWithData = [...freshComp.years].reverse().find(y => y.startDate <= today);
          if (fyWithData) {
            localStorage.setItem('selectedFY', JSON.stringify(fyWithData));
            setSelectedFY(fyWithData);
          }
        }

        // Auto-select latest FY with data (not a future FY that has no vouchers yet)
        if (freshComp?.years?.length && !selectedFY) {
          const today = new Date().toISOString().slice(0, 10);
          // Pick the latest FY whose start date is on or before today
          const fyWithData = [...freshComp.years]
            .reverse()
            .find(y => y.startDate <= today);
          const defaultFY = fyWithData || freshComp.years[freshComp.years.length - 1];
          localStorage.setItem('selectedFY', JSON.stringify(defaultFY));
          setSelectedFY(defaultFY);
        }
      } else {
        // The API is authoritative. Do not keep a company from an older
        // account/session when the signed-in user has no accessible companies.
        localStorage.removeItem('selectedCompany');
        localStorage.removeItem('selectedFY');
        setSelectedCompany(null);
        setSelectedFY(null);
      }
      return arr;
    } catch (err) {
      console.warn('fetchCompanies failed:', err.message);
      return [];
    }
  }, [token, selectedCompany]);

  // Refresh user profile from backend on mount
  useEffect(() => {
    if (!token) return;
    fetchMe()
      .then(res => {
        if (res?.data) {
          const fresh = { ...user, ...res.data };
          localStorage.setItem('authUser', JSON.stringify(fresh));
          setUser(fresh);
          if (typeof res.data.is_paired === 'boolean') {
            localStorage.setItem('isPaired', String(res.data.is_paired));
            setIsPaired(res.data.is_paired);
          }
        }
      })
      .catch(() => {}); // silent - network error or token expired, don't crash
  }, [token]);

  // Load companies on mount
  useEffect(() => { if (token) loadCompanies(); }, [token]);

  // Keep cached selection aligned with the authoritative company list. This
  // also closes the reload race where a page can render an older account's
  // selected company before loadCompanies finishes.
  useEffect(() => {
    if (!token || companies.length > 0 || !selectedCompany) return;
    localStorage.removeItem('selectedCompany');
    localStorage.removeItem('selectedFY');
    setSelectedCompany(null);
    setSelectedFY(null);
  }, [token, companies, selectedCompany]);

  const login = async (authToken, userData) => {
    // Company access is user-scoped. Clear any previous account's selection
    // before the new account's company list is loaded.
    localStorage.removeItem('companies');
    localStorage.removeItem('selectedCompany');
    localStorage.removeItem('selectedFY');
    setCompanies([]);
    setSelectedCompany(null);
    setSelectedFY(null);

    localStorage.setItem('authToken', authToken);
    localStorage.setItem('authUser', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);

    if (USE_MOCK) {
      localStorage.setItem('isPaired', 'true');
      setIsPaired(true);
      return;
    }

    // Fetch /api/auth/me to get real isPaired + company state
    try {
      const apiBase = (process.env.REACT_APP_API_URL || '').replace(/\/app\/?$/, '');
      const meRes = await fetch(`${apiBase}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
      });
      const meData = await meRes.json();
      const me = meData?.data;
      if (me) {
        const freshUser = { ...userData, ...me };
        localStorage.setItem('authUser', JSON.stringify(freshUser));
        setUser(freshUser);
        if (me.is_paired) {
          localStorage.setItem('isPaired', 'true');
          setIsPaired(true);
        } else {
          localStorage.setItem('isPaired', 'false');
          setIsPaired(false);
        }
        // Load companies if paired
        if (me.is_paired && me.company?.guid) {
          const comp = me.company;
          // Fetch full companies list
          const compRes = await fetch(`${apiBase}/api/companies`, {
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
          });
          const compData = await compRes.json();
          const arr = compData?.data || [];
          if (arr.length > 0) {
            localStorage.setItem('companies', JSON.stringify(arr));
            setCompanies(arr);
            localStorage.setItem('selectedCompany', JSON.stringify(arr[0]));
            setSelectedCompany(arr[0]);
          } else {
            // Fallback: use company from me endpoint
            localStorage.setItem('companies', JSON.stringify([comp]));
            setCompanies([comp]);
            localStorage.setItem('selectedCompany', JSON.stringify(comp));
            setSelectedCompany(comp);
          }
        }
      }
    } catch (e) {
      console.warn('Login bootstrap failed:', e.message);
    }
  };

  const logout = () => {
    // Keep isPaired in localStorage - pairing is device-level, not session-level
    const pairedState = localStorage.getItem('isPaired');
    localStorage.clear();
    if (pairedState) localStorage.setItem('isPaired', pairedState);
    setToken(null); setUser(null); setCompanies([]); setSelectedCompany(null);
    wsService.disconnect();
  };

  const selectCompany = (company) => {
    localStorage.setItem('selectedCompany', JSON.stringify(company));
    setSelectedCompany(company);
    // Auto-select latest FY when company changes
    if (company?.years?.length) {
      const latestFY = company.years[company.years.length - 1];
      localStorage.setItem('selectedFY', JSON.stringify(latestFY));
      setSelectedFY(latestFY);
    }
  };

  const selectFY = (fy) => {
    localStorage.setItem('selectedFY', JSON.stringify(fy));
    setSelectedFY(fy);
  };

  const markPaired = () => {
    localStorage.setItem('isPaired', 'true');
    setIsPaired(true);
  };

  return (
    <AuthContext.Provider value={{
      token, user, companies, selectedCompany, selectedFY, isPaired, syncToast, syncVersion,
      login, logout, selectCompany, selectFY, loadCompanies, markPaired, showToast,
    }}>
      {children}
      {/* Global sync toast */}
      {syncToast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all
          ${syncToast.type === 'success' ? 'bg-[#059669]' : syncToast.type === 'warning' ? 'bg-amber-500' : 'bg-[#181818]'}`}>
          {syncToast.message}
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
