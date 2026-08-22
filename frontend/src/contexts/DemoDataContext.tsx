import { createContext, useContext, useState, type ReactNode } from 'react';

interface DemoDataContextType {
  demoEnabled: boolean;
  toggleDemo: () => void;
}

const DemoDataContext = createContext<DemoDataContextType | null>(null);

const STORAGE_KEY = 'menu_qr_demo_data';

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [demoEnabled, setDemoEnabled] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  function toggleDemo() {
    setDemoEnabled((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <DemoDataContext.Provider value={{ demoEnabled, toggleDemo }}>
      {children}
    </DemoDataContext.Provider>
  );
}

export function useDemoData() {
  const ctx = useContext(DemoDataContext);
  if (!ctx) throw new Error('useDemoData must be used within DemoDataProvider');
  return ctx;
}
