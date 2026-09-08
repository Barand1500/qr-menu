import { createContext, useContext, useState, type ReactNode } from 'react';

interface DemoDataContextType {
  demoEnabled: boolean;
  toggleDemo: () => void;
}

const DemoDataContext = createContext<DemoDataContextType | null>(null);

const STORAGE_KEY = 'menu_qr_demo_data';

/** Canlı ortamda her zaman gerçek veri */
const FORCE_REAL = import.meta.env.PROD;

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [demoEnabled, setDemoEnabled] = useState(() => {
    if (FORCE_REAL) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return false;
    }
    // Bu sürümden sonra varsayılan gerçek veri (eski açık bayrağı kapat)
    try {
      if (localStorage.getItem('menu_qr_demo_data_cleared') !== '1') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem('menu_qr_demo_data_cleared', '1');
      }
    } catch {
      /* ignore */
    }
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  function toggleDemo() {
    if (FORCE_REAL) return;
    setDemoEnabled((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <DemoDataContext.Provider value={{ demoEnabled: FORCE_REAL ? false : demoEnabled, toggleDemo }}>
      {children}
    </DemoDataContext.Provider>
  );
}

export function useDemoData() {
  const ctx = useContext(DemoDataContext);
  if (!ctx) throw new Error('useDemoData must be used within DemoDataProvider');
  return ctx;
}
