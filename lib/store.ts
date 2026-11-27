"use client";

import { useSyncExternalStore } from "react";
import type { Product } from "./api";
import { clearPendingCheckout } from "./payments";
import { selectionKey, type CartLine, type SelectionMap } from "./cart";

export type Fulfilment = "delivery" | "take_away";

export type StoreState = {
  ready: boolean;
  branchId: number | null;
  fulfilment: Fulfilment;
  cart: CartLine[];
  token: string | null;
  cartOpen: boolean;
  toast: { id: number; message: string } | null;
};

const CART_KEY = "ismakfoods.customer.cart";
const BRANCH_KEY = "ismakfoods.customer.branch";
const FULFILMENT_KEY = "ismakfoods.customer.fulfilment";
const TOKEN_KEY = "ismakfoods.customer.token";

const serverState: StoreState = { ready: false, branchId: null, fulfilment: "delivery", cart: [], token: null, cartOpen: false, toast: null };
let state: StoreState = serverState;
let loaded = false;
const listeners = new Set<() => void>();

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const cart = readJson<CartLine[]>(localStorage, CART_KEY, []);
  state = {
    ready: true,
    branchId: readJson<number | null>(localStorage, BRANCH_KEY, null),
    fulfilment: localStorage.getItem(FULFILMENT_KEY) === "take_away" ? "take_away" : "delivery",
    cart: Array.isArray(cart) ? cart.filter((line) => line && line.product && line.quantity > 0) : [],
    token: sessionStorage.getItem(TOKEN_KEY),
    cartOpen: false,
    toast: null
  };
  window.addEventListener("storage", (event) => {
    if (event.key === CART_KEY) set({ cart: readJson<CartLine[]>(localStorage, CART_KEY, []) }, false);
  });
}

function emit() {
  listeners.forEach((listener) => listener());
}

function set(patch: Partial<StoreState>, persist = true) {
  state = { ...state, ...patch };
  if (persist && typeof window !== "undefined") {
    if ("cart" in patch) localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    if ("branchId" in patch) localStorage.setItem(BRANCH_KEY, JSON.stringify(state.branchId));
    if ("fulfilment" in patch) localStorage.setItem(FULFILMENT_KEY, state.fulfilment);
    if ("token" in patch) {
      if (state.token) sessionStorage.setItem(TOKEN_KEY, state.token);
      else sessionStorage.removeItem(TOKEN_KEY);
    }
  }
  emit();
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  load();
  return state;
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverState);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const actions = {
  setBranch(branchId: number) {
    if (branchId === state.branchId) return;
    // Prices and availability are per branch, so a cart never crosses branches.
    set({ branchId, cart: state.branchId === null ? state.cart : [] });
  },
  setFulfilment(fulfilment: Fulfilment) {
    set({ fulfilment });
  },
  addLine(product: Product, selections: SelectionMap, quantity = 1) {
    const key = selectionKey(product, selections);
    const existing = state.cart.find((line) => line.key === key);
    const cart = existing
      ? state.cart.map((line) => (line.key === key ? { ...line, quantity: line.quantity + quantity } : line))
      : [...state.cart, { key, product, selections, quantity }];
    set({ cart });
    actions.showToast(`${product.name} added to your cart`);
  },
  setQuantity(key: string, quantity: number) {
    set({ cart: quantity < 1 ? state.cart.filter((line) => line.key !== key) : state.cart.map((line) => (line.key === key ? { ...line, quantity } : line)) });
  },
  removeLine(key: string) {
    set({ cart: state.cart.filter((line) => line.key !== key) });
  },
  clearCart() {
    set({ cart: [] });
  },
  setToken(token: string | null) {
    if (token !== state.token) clearPendingCheckout();
    set({ token });
  },
  openCart(open: boolean) {
    set({ cartOpen: open }, false);
  },
  showToast(message: string) {
    clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), message } }, false);
    toastTimer = setTimeout(() => set({ toast: null }, false), 3200);
  }
};
