import { useSyncExternalStore } from "react";
import type { AppConfig, PaymentGateway } from "./api";

export type PaymentChoice = {
  key: "cash_on_delivery" | "offline_payment" | "mobile_money" | "card";
  label: string;
  description: string;
  digital: boolean;
  methodForOrder: string;
  initiationMethod?: "mobile_money" | "card";
};

/** Customer-facing copy. The API's own descriptions are written for staff, so they are not shown. */
const COPY: Record<PaymentChoice["key"], { label: string; description: string }> = {
  mobile_money: { label: "Mobile money", description: "MTN or Airtel. Approve the prompt on your phone." },
  card: { label: "Card", description: "Visa or Mastercard on a secure payment page." },
  cash_on_delivery: { label: "Cash on delivery", description: "Pay the rider, or pay at the counter for pickup." },
  offline_payment: { label: "Pay at the branch", description: "Settle the order with the branch before collection." }
};

export function activeGateway(config: AppConfig | null): PaymentGateway | null {
  const contract = config?.paymentGatewayContract;
  if (!contract?.digitalPaymentEnabled || contract.configurationError || contract.multipleActiveGateways) return null;
  const foregroundActive = contract.activeGateways.filter((gateway) => contract.foregroundGateways.includes(gateway));
  if (foregroundActive.length !== 1) return null;
  const gateway = contract.gateways.find((entry) => entry.gateway === foregroundActive[0]);
  if (!gateway?.enabledForCheckout || gateway.status !== 1) return null;
  return gateway;
}

export function paymentChoices(config: AppConfig | null): PaymentChoice[] {
  if (!config) return [];
  const choices: PaymentChoice[] = [];
  const gateway = activeGateway(config);
  const customerOptions = config.customerPaymentOptions?.options ?? [];
  if (gateway && config.digitalPayment && config.customerPaymentOptions?.digitalPaymentEnabled !== false) {
    for (const key of ["mobile_money", "card"] as const) {
      if (customerOptions.some((option) => option.key === key && option.enabled)) {
        choices.push({ key, ...COPY[key], digital: true, methodForOrder: "digital_payment", initiationMethod: key });
      }
    }
  }
  if (config.cashOnDelivery) choices.push({ key: "cash_on_delivery", ...COPY.cash_on_delivery, digital: false, methodForOrder: "cash_on_delivery" });
  if (config.offlinePayment) choices.push({ key: "offline_payment", ...COPY.offline_payment, digital: false, methodForOrder: "offline_payment" });
  return choices;
}

export const PENDING_CHECKOUT_KEY = "ismakfoods.customer.pending-checkout";

export type PendingCheckout = {
  orderId: number;
  amount: number;
  method: "card" | "mobile_money";
  phone?: string;
};

export function readPendingCheckout(orderId?: number): PendingCheckout | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_CHECKOUT_KEY) ?? "null");
    if (
      saved && Number.isSafeInteger(saved.orderId) && saved.orderId > 0 &&
      typeof saved.amount === "number" &&
      (saved.method === "card" || saved.method === "mobile_money") &&
      (orderId === undefined || saved.orderId === orderId)
    ) {
      return { orderId: saved.orderId, amount: saved.amount, method: saved.method, phone: typeof saved.phone === "string" ? saved.phone : undefined };
    }
  } catch {
    // A stale browser record should never block a new checkout.
  }
  return null;
}

const pendingListeners = new Set<() => void>();
let pendingRaw: string | null | undefined;
let pendingValue: PendingCheckout | null = null;

export function savePendingCheckout(value: PendingCheckout) {
  sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(value));
  pendingListeners.forEach((listener) => listener());
}

export function clearPendingCheckout() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  pendingListeners.forEach((listener) => listener());
}

function pendingSnapshot() {
  const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  if (raw !== pendingRaw) {
    pendingRaw = raw;
    pendingValue = readPendingCheckout();
  }
  return pendingValue;
}

/** The unpaid digital order in this tab, if any. Safe during server rendering (returns null). */
export function usePendingCheckout(orderId?: number) {
  const value = useSyncExternalStore(
    (listener) => { pendingListeners.add(listener); return () => pendingListeners.delete(listener); },
    pendingSnapshot,
    () => null
  );
  return value && (orderId === undefined || value.orderId === orderId) ? value : null;
}
