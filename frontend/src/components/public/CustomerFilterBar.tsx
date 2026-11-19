import { Sparkles } from 'lucide-react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { avatarHue } from '@/lib/customerAvatar';
import { customerProfileUi } from '@/lib/customerProfileUi';
import './customer-account.css';

/**
 * Girişten sonra menünün üstünde duran tek satırlık şerit: selam + filtre anahtarı + hesap.
 * Renkleri sayfadan miras alır (currentColor), her temada okunur.
 */
export default function CustomerFilterBar({
  lang,
  activeCount,
  onOpenAccount,
}: {
  lang?: string;
  /** Menüyü etkileyen kriter sayısı (alerji, diyet, sevmedikleri…). */
  activeCount: number;
  onOpenAccount: () => void;
}) {
  const { customer, filterEnabled, setFilterEnabled } = useCustomerAuth();
  if (!customer) return null;
  const ui = customerProfileUi(lang || 'tr');
  const first = customer.fullName.split(' ')[0] || customer.fullName;
  return (
    <div className={`cf-bar${filterEnabled ? ' is-on' : ''}`} role="status">
      <button type="button" className="cf-bar__who" onClick={onOpenAccount} aria-label={ui.profile}>
        <span className="ca-avatar ca-avatar--sm" style={{ ['--h' as string]: avatarHue(customer.id) }} aria-hidden>
          {first.charAt(0).toLocaleUpperCase('tr')}
        </span>
        <span className="cf-bar__text">
          <strong>{filterEnabled ? ui.helloFiltered(first) : ui.helloFilterOff(first)}</strong>
          {filterEnabled && activeCount > 0 ? <small>{activeCount} kriter uygulanıyor</small> : null}
        </span>
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={filterEnabled}
        aria-label={filterEnabled ? ui.closeFilter : ui.openFilter}
        title={filterEnabled ? ui.closeFilter : ui.openFilter}
        className={`ca-switch ca-switch--bar${filterEnabled ? ' is-on' : ''}`}
        onClick={() => setFilterEnabled(!filterEnabled)}
      >
        <i>
          <Sparkles size={11} aria-hidden />
        </i>
      </button>
    </div>
  );
}
