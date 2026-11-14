/** UI confirmation for an accepted service request. This does not send a request itself. */
export const SERVICE_CALL_CONFIRMED_EVENT = 'menu-service-call-confirmed';

export interface ServiceCallReceipt {
  kind: string;
  requestId?: number;
  tableNumber?: string;
  lang?: string;
  duplicate?: boolean;
}

export function notifyServiceCallConfirmed(receipt: ServiceCallReceipt) {
  window.dispatchEvent(
    new CustomEvent<ServiceCallReceipt>(SERVICE_CALL_CONFIRMED_EVENT, {
      detail: receipt,
    }),
  );
}
