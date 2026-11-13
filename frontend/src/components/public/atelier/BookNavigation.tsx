import { createContext, useContext, useState, type ReactNode } from 'react';
const Navigation = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);
export function BookNavigationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Navigation.Provider value={{ open, setOpen }}>{children}</Navigation.Provider>;
}
export function useBookNavigation() {
  return useContext(Navigation);
}
