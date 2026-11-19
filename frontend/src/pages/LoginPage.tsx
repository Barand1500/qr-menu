import { useState } from 'react';
import LoginWelcome from '@/components/auth/LoginWelcome';
import ContactModal from '@/components/auth/ContactModal';

export default function LoginPage() {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <>
      <LoginWelcome onContact={() => setContactOpen(true)} />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
