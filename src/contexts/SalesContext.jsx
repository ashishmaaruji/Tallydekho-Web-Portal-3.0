import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';

const SalesContext = createContext(null);

export function SalesProvider({ children }) {
  const { selectedFY } = useAuth();

  const [dateRange, setDateRange] = useState({
    from: selectedFY?.startDate,
    to: selectedFY?.endDate,
    preset: 'This FY'
  });
  const [irnGenerateOpen, setIrnGenerateOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (
      selectedFY?.startDate &&
      selectedFY?.endDate &&
      dateRange.preset === 'This FY' &&
      (dateRange.from !== selectedFY.startDate || dateRange.to !== selectedFY.endDate)
    ) {
      setDateRange({
        from: selectedFY.startDate,
        to: selectedFY.endDate,
        preset: 'This FY'
      });
    }
  }, [selectedFY?.startDate, selectedFY?.endDate, dateRange.from, dateRange.to, dateRange.preset]);

  const setRange = (from, to, preset) => {
    setDateRange({ from, to, preset });
  };

  const value = useMemo(() => ({
    dateRange,
    setRange,
    irnGenerateOpen,
    openIrnGenerator: () => setIrnGenerateOpen(true),
    closeIrnGenerator: () => setIrnGenerateOpen(false),
    alerts,
    setAlerts,
  }), [dateRange, irnGenerateOpen, alerts]);

  return (
    <SalesContext.Provider value={value}>
      {children}
    </SalesContext.Provider>
  );
}

export const useSalesContext = () => useContext(SalesContext);
