import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import MenuCustomerProfileModal, {
  type CustomerAccountProps,
} from './MenuCustomerProfileModal';
import CustomerSignIn from './CustomerSignIn';

export default function MenuCustomerAuthModal(props: CustomerAccountProps) {
  const { customer } = useCustomerAuth();
  if (!props.open) return null;
  return customer ? (
    <MenuCustomerProfileModal {...props} />
  ) : (
    <CustomerSignIn
      onClose={props.onClose}
      restaurantName={props.restaurantName}
      lang={props.lang}
    />
  );
}
