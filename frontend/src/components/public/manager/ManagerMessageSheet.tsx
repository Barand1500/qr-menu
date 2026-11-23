import { useState } from 'react';
import type { SofraConfig } from '@/lib/sofra';
import SofraSheet from '../sofra/SofraSheet';
import ManagerMessageForm from './ManagerMessageForm';
export default function ManagerMessageSheet({
  open,
  onClose,
  slug,
  lang,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  lang: string;
  contact: SofraConfig['managerContact'];
}) {
  const [busy, setBusy] = useState(false);
  if (!contact.enabled) return null;
  return (
    <SofraSheet
      open={open}
      onClose={onClose}
      busy={busy}
      dismissOnBackdrop={false}
      title={lang.startsWith('tr') ? 'Yöneticiye yaz' : 'Write to manager'}
    >
      {open && (
        <ManagerMessageForm
          slug={slug}
          lang={lang}
          contact={contact}
          onBusy={setBusy}
        />
      )}
    </SofraSheet>
  );
}
