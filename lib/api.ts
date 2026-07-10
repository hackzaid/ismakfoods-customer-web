export const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.ismakfoods.com/api/v1").replace(/\/$/, "");

export const API_ORIGIN =
  (process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://api.ismakfoods.com").replace(/\/$/, "");

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string | null;
  branchId?: number | null;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
};

export class ApiError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export type Branch = {
  id: number;
  name: string;
  address?: string;
  preparationTime?: number;
};

export type PaymentGateway = {
  gateway: string;
  label: string;
  status: number;
  enabledForCheckout: boolean;
  gatewayTitle: string;
  clientFlow: string;
  checkoutEndpoint?: string | null;
  statusEndpoint?: string | null;
};

export type PaymentGatewayContract = {
  digitalPaymentEnabled: boolean;
  activeGateway?: string | null;
  activeGateways: string[];
  foregroundGateways: string[];
  deferredGateways: string[];
  multipleActiveGateways: boolean;
  configurationError?: string | null;
  gateways: PaymentGateway[];
};

export type CustomerPaymentOption = {
  key: "cash_on_delivery" | "mobile_money" | "card" | "offline_payment";
  label: string;
  enabled: boolean;
  flow: string;
  fields: string[];
  description: string;
};

export type CustomerPaymentOptionsContract = {
  digitalPaymentEnabled: boolean;
  statusPolling: boolean;
  activeProcessor?: string | null;
  configurationError?: string | null;
  options: CustomerPaymentOption[];
};

export type AppConfig = {
  restaurantName: string;
  logoUrl?: string | null;
  logoPath?: string | null;
  faviconUrl?: string | null;
  faviconPath?: string | null;
  baseUrls: Record<string, string>;
  currencySymbol: string;
  currencySymbolPosition: "left" | "right";
  deliveryCharge: number;
  minimumOrderValue: number;
  delivery: boolean;
  selfPickup: boolean;
  guestCheckout: boolean;
  checkoutAuthRequired: boolean;
  cashOnDelivery: boolean;
  digitalPayment: boolean;
  offlinePayment: boolean;
  branches: Branch[];
  socialLogin: {
    google: boolean;
    facebook: boolean;
    apple: boolean;
  };
  paymentGatewayContract?: PaymentGatewayContract;
  customerPaymentOptions?: CustomerPaymentOptionsContract;
};

export type ProductOption = {
  id: string;
  name: string;
  price: number;
  source?: "variation" | "add_on";
  addOnId?: number;
};

export type ProductVariation = {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  min: number;
  max: number;
  values: ProductOption[];
};

export type Product = {
  id: number;
  name: string;
  description: string;
  imageUrl?: string | null;
  price: number;
  discountPrice?: number | null;
  rating: number;
  restaurantName: string;
  deliveryEta: string;
  variations: ProductVariation[];
};

export type Address = {
  id: number;
  label: string;
  address: string;
  contactName: string;
  contactPhone: string;
  isDefault: boolean;
};

export type CartLinePayload = {
  product_id: number;
  quantity: number;
  variant: Record<string, unknown>[];
  variations: Record<string, unknown>[];
  add_on_ids: number[];
  add_on_qtys: number[];
};

export type OrderPlacementResult = {
  orderId: number;
  amount: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  transactionReference?: string | null;
  raw: Record<string, unknown>;
};

export type PaymentSession = {
  orderId: number;
  state: string;
  checkoutUrl?: string | null;
  statusUrl?: string | null;
  reference?: string | null;
  message: string;
  raw: Record<string, unknown>;
};

export type PaymentStatus = {
  orderId: number;
  state: string;
  paymentStatus: string;
  orderStatus: string;
  transactionReference?: string | null;
  raw: Record<string, unknown>;
};

export type OrderSummary = {
  id: number;
  amount: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  transactionReference?: string | null;
  status: string;
  createdAt?: string | null;
  itemCount: number;
};

export type OrderDetails = {
  id: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  transactionReference?: string | null;
  totalAmount: number;
  items: { name: string; quantity: number; totalPrice: number; variations: string[] }[];
};

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function bool(value: unknown): boolean {
  const normalized = typeof value === "string" ? value.toLowerCase() : value;
  return normalized === true || normalized === 1 || normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value).trim() || fallback;
}

function getPayload(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
      return record.data as Record<string, unknown>;
    }
    return record;
  }
  return {};
}

function apiMessage(payload: unknown): string {
  const record = getPayload(payload);
  const errors = record.errors;

  if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
    return text((errors[0] as Record<string, unknown>).message, "The request could not be completed.");
  }

  if (errors && typeof errors === "object") {
    const first = Object.values(errors as Record<string, unknown>)[0];
    if (Array.isArray(first) && first.length) {
      return text(first[0], "The request could not be completed.");
    }
  }

  return text(record.message, "The request could not be completed.");
}

function apiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith("/api/v1/")) {
    return `${API_ORIGIN}${normalized}`;
  }

  return `${API_BASE_URL}${normalized}`;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = new URL(apiPath(path));
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-localization": "en",
        ...(options.branchId ? { "branch-id": String(options.branchId), branch_id: String(options.branchId) } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      throw new ApiError(apiMessage(data), response.status, data);
    }

    const payload = getPayload(data);
    const status = payload.status;
    if (status === false || status === "error" || payload.status_code === 401) {
      throw new ApiError(apiMessage(data), response.status, data);
    }

    return data as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function serverApiRequest<T>(path: string): Promise<T> {
  const response = await fetch(apiPath(path), {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getPublicAssetUrl(value?: string | null, base?: string | null): string | null {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (!base) {
    return `${API_ORIGIN}/storage-proxy.php?path=restaurant/${value.replace(/^\/+/, "")}`;
  }

  return `${base.replace(/\/$/, "")}/${value.replace(/^\/+/, "")}`;
}

function normalizeGateway(entry: Record<string, unknown>): PaymentGateway {
  return {
    gateway: text(entry.gateway),
    label: text(entry.label ?? entry.gateway_title ?? entry.gateway),
    status: number(entry.status),
    enabledForCheckout: bool(entry.enabled_for_checkout),
    gatewayTitle: text(entry.gateway_title ?? entry.label ?? entry.gateway),
    clientFlow: text(entry.client_flow),
    checkoutEndpoint: text(entry.checkout_endpoint) || null,
    statusEndpoint: text(entry.status_endpoint) || null
  };
}

function normalizePaymentGatewayContract(raw: unknown): PaymentGatewayContract | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;

  return {
    digitalPaymentEnabled: bool(record.digital_payment_enabled),
    activeGateway: text(record.active_gateway) || null,
    activeGateways: asArray(record.active_gateways).map((entry) => text(entry)).filter(Boolean),
    foregroundGateways: asArray(record.foreground_gateways).map((entry) => text(entry)).filter(Boolean),
    deferredGateways: asArray(record.deferred_gateways).map((entry) => text(entry)).filter(Boolean),
    multipleActiveGateways:
      record.multiple_active_gateways === true || asArray(record.multiple_active_gateways).length > 0,
    configurationError: text(record.configuration_error) || null,
    gateways: asArray(record.gateways)
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map(normalizeGateway)
  };
}

function normalizeCustomerPaymentOptions(raw: unknown): CustomerPaymentOptionsContract | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;

  return {
    digitalPaymentEnabled: bool(record.digital_payment_enabled),
    statusPolling: record.status_polling !== false,
    activeProcessor: text(record.active_processor) || null,
    configurationError: text(record.configuration_error) || null,
    options: asArray(record.options)
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => ({
        key: text(entry.key, "cash_on_delivery") as CustomerPaymentOption["key"],
        label: text(entry.label, "Payment"),
        enabled: bool(entry.enabled),
        flow: text(entry.flow, "offline"),
        fields: asArray(entry.fields).map((field) => text(field)).filter(Boolean),
        description: text(entry.description)
      }))
  };
}

export function normalizeConfig(raw: unknown): AppConfig {
  const record = getPayload(raw);

  return {
    restaurantName: text(record.restaurant_name, "Ismak Foods"),
    logoUrl: text(record.restaurant_logo_url) || null,
    logoPath: text(record.restaurant_logo) || null,
    faviconUrl: text(record.restaurant_fav_icon_url) || null,
    faviconPath: text(record.restaurant_fav_icon) || null,
    baseUrls: (record.base_urls && typeof record.base_urls === "object" ? record.base_urls : {}) as Record<string, string>,
    currencySymbol: text(record.currency_symbol, "UGX"),
    currencySymbolPosition: record.currency_symbol_position === "right" ? "right" : "left",
    deliveryCharge: number(record.delivery_charge),
    minimumOrderValue: number(record.minimum_order_value),
    delivery: bool(record.delivery),
    selfPickup: bool(record.self_pickup),
    guestCheckout: bool(record.guest_checkout),
    checkoutAuthRequired: record.checkout_auth_required === true || !bool(record.guest_checkout),
    cashOnDelivery: bool(record.cash_on_delivery),
    digitalPayment: bool(record.digital_payment),
    offlinePayment: bool(record.offline_payment),
    branches: asArray(record.branches)
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => ({
        id: number(entry.id),
        name: text(entry.name, "Branch"),
        address: text(entry.address),
        preparationTime: number(entry.preparation_time, 30)
      }))
      .filter((branch) => branch.id > 0),
    socialLogin: {
      google: bool((record.social_login as Record<string, unknown> | undefined)?.google),
      facebook: bool((record.social_login as Record<string, unknown> | undefined)?.facebook),
      apple: bool((record.apple_login as Record<string, unknown> | undefined)?.status)
    },
    paymentGatewayContract: normalizePaymentGatewayContract(record.payment_gateway_contract),
    customerPaymentOptions: normalizeCustomerPaymentOptions(record.customer_payment_options)
  };
}

export async function getConfig(): Promise<AppConfig> {
  const raw = await serverApiRequest<unknown>("/config");
  return normalizeConfig(raw);
}

export function normalizeProduct(raw: unknown, config: AppConfig): Product {
  const record = getPayload(raw);
  const branchProduct = getPayload(record.branch_product);
  const price = number(record.price ?? branchProduct.price);
  const discountedPrice = number(record.discounted_price ?? branchProduct.discounted_price ?? price);
  const image = Array.isArray(record.image) ? record.image[0] : record.image;
  const prep = number(branchProduct.preparation_time, 25);

  return {
    id: number(record.id),
    name: text(record.name, "Menu item"),
    description: text(record.description ?? record.details, "Freshly prepared by Ismak Foods."),
    imageUrl: getPublicAssetUrl(text(image), config.baseUrls.product_image_url),
    price,
    discountPrice: discountedPrice && discountedPrice !== price ? discountedPrice : null,
    rating: number((Array.isArray(record.rating) ? getPayload(record.rating[0]) : getPayload(record.rating)).average ?? record.avg_rating, 4.7),
    restaurantName: text(record.restaurant_name ?? record.branch_name, config.restaurantName),
    deliveryEta: `${prep}-${prep + 10} min`,
    variations: normalizeProductVariations(record)
  };
}

function optionPrice(option: Record<string, unknown>): number {
  return number(option.price ?? option.option_price ?? option.optionPrice);
}

function hasOptionValues(entry: unknown): entry is Record<string, unknown> {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return false;
  }
  const record = entry as Record<string, unknown>;
  return asArray(record.values ?? record.options).length > 0;
}

function uniqueVariationGroups(groups: ProductVariation[]): ProductVariation[] {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const key = `${group.name.toLowerCase()}:${group.values.map((value) => value.name.toLowerCase()).join("|")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeProductVariations(record: Record<string, unknown>): ProductVariation[] {
  const branchProduct = getPayload(record.branch_product);
  const rawVariationSources = [
    ...asArray(branchProduct.variations),
    ...asArray(record.variations ?? record.variation)
  ];
  const groupedSource = [
    ...rawVariationSources.filter(hasOptionValues),
    ...asArray(record.variations_json),
    ...asArray(record.choice_options ?? record.choiceOptions),
    ...asArray(record.option_groups)
  ];
  const flatSource = rawVariationSources.filter((entry) => !hasOptionValues(entry));

  const flatByName = new Map<string, number>();
  flatSource.forEach((entry) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const value = entry as Record<string, unknown>;
      const name = text(value.name ?? value.type ?? value.label).toLowerCase();
      if (name) {
        flatByName.set(name, optionPrice(value));
      }
    }
  });

  if (groupedSource.length) {
    const variationGroups = groupedSource
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map((group, groupIndex) => {
        const sourceValues = asArray(group.values ?? group.options);
        const required = bool(group.required);
        const type: ProductVariation["type"] =
          ["multi", "multiple"].includes(text(group.type ?? group.selection_type, "single").toLowerCase()) ? "multi" : "single";
        const min = Math.max(required ? 1 : 0, number(group.min ?? group.min_select ?? group.minimum, required ? 1 : 0));
        const max = Math.max(type === "single" ? 1 : min, number(group.max ?? group.max_select ?? group.maximum, type === "single" ? 1 : 99));
        const values = sourceValues
          .map((option, optionIndex): ProductOption | null => {
            const optionRecord =
              option && typeof option === "object" && !Array.isArray(option)
                ? (option as Record<string, unknown>)
                : { name: option, value: option };
            const name = text(optionRecord.name ?? optionRecord.title ?? optionRecord.label ?? optionRecord.value, `Option ${optionIndex + 1}`);
            const fallbackPrice = flatByName.get(name.toLowerCase()) ?? 0;
            return {
              id: text(optionRecord.id ?? optionRecord.value ?? optionRecord.name ?? `${groupIndex}-${optionIndex}`),
              name,
              price: optionPrice(optionRecord) || fallbackPrice,
              source: "variation"
            };
          })
          .filter((value): value is ProductOption => Boolean(value));

        return {
          id: text(group.id ?? group.name ?? group.title ?? groupIndex),
          name: text(group.name ?? group.title, `Option group ${groupIndex + 1}`),
          type,
          required: required || min > 0,
          min,
          max,
          values
        };
      })
      .filter((group) => group.values.length);

    return uniqueVariationGroups(variationGroups).concat(normalizeProductAddOns(record));
  }

  const values = flatSource
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    .map((entry, index) => ({
      id: text(entry.id ?? entry.type ?? entry.name ?? index),
      name: text(entry.name ?? entry.label ?? entry.type, `Variation ${index + 1}`),
      price: optionPrice(entry),
      source: "variation" as const
    }))
    .filter((entry) => entry.name);

  const flatGroups: ProductVariation[] = values.length
    ? [
        {
          id: "variation",
          name: "Variation",
          type: "single",
          required: true,
          min: 1,
          max: 1,
          values
        }
      ]
    : [];
  return flatGroups.concat(normalizeProductAddOns(record));
}

function normalizeProductAddOns(record: Record<string, unknown>): ProductVariation[] {
  const addOns = asArray(record.add_ons ?? record.addOns)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    .map((entry): ProductOption | null => {
      const id = number(entry.id);
      const name = text(entry.name ?? entry.label);
      if (!id || !name) {
        return null;
      }
      return {
        id: `add-on-${id}`,
        name,
        price: optionPrice(entry),
        source: "add_on",
        addOnId: id
      };
    })
    .filter((entry): entry is ProductOption => Boolean(entry));

  return addOns.length
    ? [
        {
          id: "add_ons",
          name: "Extras",
          type: "multi",
          required: false,
          min: 0,
          max: addOns.length,
          values: addOns
        }
      ]
    : [];
}

export async function fetchProducts(config: AppConfig, branchId?: number | null): Promise<Product[]> {
  const raw = await apiRequest<unknown>("/products/latest", {
    query: { limit: 40, offset: 1 },
    branchId
  });
  const payload = getPayload(raw);
  const source = asArray(payload.products).length ? asArray(payload.products) : asArray(raw);
  return source.map((entry) => normalizeProduct(entry, config)).filter((product) => product.id > 0);
}

export async function searchProducts(config: AppConfig, search: string, branchId?: number | null): Promise<Product[]> {
  const raw = await apiRequest<unknown>("/products/search", {
    method: "POST",
    branchId,
    body: { name: search, limit: 40, offset: 1 }
  });
  const payload = getPayload(raw);
  return asArray(payload.products).map((entry) => normalizeProduct(entry, config)).filter((product) => product.id > 0);
}

export async function loginWithPassword(identifier: string, password: string): Promise<string> {
  const emailLike = identifier.includes("@");
  const response = await apiRequest<unknown>("/auth/login", {
    method: "POST",
    body: {
      email_or_phone: identifier.trim(),
      password,
      type: emailLike ? "email" : "phone"
    }
  });
  return text(getPayload(response).token);
}

export async function socialLogin(idToken: string, email: string | undefined, medium: "google" | "facebook" | "apple"): Promise<string> {
  const response = await apiRequest<unknown>("/auth/social-login", {
    method: "POST",
    body: {
      token: idToken,
      unique_id: email ?? "web",
      email,
      medium
    }
  });
  return text(getPayload(response).token);
}

export async function registerWithOtp(name: string, phone: string, email?: string): Promise<string> {
  const response = await apiRequest<unknown>("/auth/registration-with-otp", {
    method: "POST",
    body: { name, phone, email: email || null }
  });
  return text(getPayload(response).token);
}

export async function requestPhoneOtp(phone: string): Promise<string> {
  const response = await apiRequest<unknown>("/auth/check-phone", {
    method: "POST",
    body: { phone }
  });
  return text(getPayload(response).message, "OTP sent.");
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<string> {
  const response = await apiRequest<unknown>("/auth/verify-otp", {
    method: "POST",
    body: { phone, token }
  });
  return text(getPayload(response).token);
}

export async function fetchAddresses(token: string): Promise<Address[]> {
  const response = await apiRequest<unknown>("/customer/address/list", { token });
  return asArray(response).map((entry) => {
    const record = getPayload(entry);
    return {
      id: number(record.id),
      label: text(record.address_type, "Address"),
      address: text(record.address),
      contactName: text(record.contact_person_name),
      contactPhone: text(record.contact_person_number),
      isDefault: bool(record.is_default)
    };
  });
}

export async function addAddress(token: string, input: Omit<Address, "id" | "isDefault">): Promise<void> {
  await apiRequest<unknown>("/customer/address/add", {
    method: "POST",
    token,
    body: {
      address_type: input.label,
      address: input.address,
      contact_person_name: input.contactName,
      contact_person_number: input.contactPhone,
      latitude: null,
      longitude: null,
      is_default: 0
    }
  });
}

export async function placeOrder(input: {
  token: string;
  branchId: number;
  cart: CartLinePayload[];
  orderAmount: number;
  paymentMethod: string;
  orderType: "delivery" | "take_away";
  deliveryAddressId?: number | null;
  orderNote?: string;
}): Promise<OrderPlacementResult> {
  const body: Record<string, unknown> = {
    cart: input.cart,
    order_amount: input.orderAmount,
    payment_method: input.paymentMethod,
    order_type: input.orderType,
    branch_id: input.branchId,
    delivery_time: "now",
    delivery_date: new Date().toISOString().slice(0, 10),
    distance: 2,
    is_partial: 0,
    order_note: input.orderNote ?? ""
  };

  if (input.orderType === "delivery" && input.deliveryAddressId) {
    body.delivery_address_id = input.deliveryAddressId;
  }

  const response = await apiRequest<unknown>("/customer/order/place", {
    method: "POST",
    token: input.token,
    branchId: input.branchId,
    body
  });
  const payload = getPayload(response);

  return {
    orderId: number(payload.order_id ?? payload.id),
    amount: number(payload.order_amount ?? payload.amount ?? input.orderAmount),
    paymentMethod: text(payload.payment_method) || null,
    paymentStatus: text(payload.payment_status) || null,
    orderStatus: text(payload.order_status) || null,
    transactionReference: text(payload.transaction_reference) || null,
    raw: payload
  };
}

export async function initiatePayment(input: {
  token: string;
  endpoint: string;
  orderId: number;
  method: "mobile_money" | "card";
  phone?: string;
}): Promise<PaymentSession> {
  const response = await apiRequest<unknown>(input.endpoint || "/payment/initiate", {
    method: "POST",
    token: input.token,
    body: {
      order_id: input.orderId,
      method: input.method,
      channel: "web",
      phone: input.phone || undefined
    }
  });
  const payload = getPayload(response);

  return {
    orderId: number(payload.order_id ?? payload.orderId ?? input.orderId),
    state: text(payload.state, "waiting_for_payment"),
    checkoutUrl: text(payload.checkout_url ?? payload.checkoutUrl) || null,
    statusUrl: text(payload.status_url ?? payload.statusUrl) || null,
    reference: text(payload.reference) || null,
    message: text(payload.message, "Payment is waiting for backend confirmation."),
    raw: payload
  };
}

export async function fetchPaymentStatus(input: {
  token: string;
  orderId: number;
  endpoint?: string | null;
  statusUrl?: string | null;
}): Promise<PaymentStatus> {
  const endpoint = input.statusUrl || (input.endpoint ? input.endpoint.replace("{orderId}", String(input.orderId)) : `/payment/status/${input.orderId}`);
  const response = await apiRequest<unknown>(endpoint, { token: input.token });
  const payload = getPayload(response);

  return {
    orderId: number(payload.order_id ?? payload.orderId ?? input.orderId),
    state: text(payload.state, "pending"),
    paymentStatus: text(payload.payment_status ?? payload.paymentStatus, "pending"),
    orderStatus: text(payload.order_status ?? payload.orderStatus, "pending"),
    transactionReference: text(payload.transaction_reference ?? payload.transactionReference) || null,
    raw: payload
  };
}

export async function fetchOrders(token: string): Promise<OrderSummary[]> {
  const response = await apiRequest<unknown>("/customer/order/list", {
    token,
    query: { order_filter: "all", limit: 20, offset: 1 }
  });
  const payload = getPayload(response);
  const source = asArray(payload.orders).length ? asArray(payload.orders) : asArray(response);

  return source.map((entry) => {
    const record = getPayload(entry);
    return {
      id: number(record.id),
      amount: number(record.order_amount ?? record.amount),
      paymentStatus: text(record.payment_status, "unpaid"),
      paymentMethod: text(record.payment_method) || null,
      transactionReference: text(record.transaction_reference) || null,
      status: text(record.order_status, "pending"),
      createdAt: text(record.created_at) || null,
      itemCount: number(record.total_quantity ?? record.details_count)
    };
  });
}

export async function fetchOrderDetails(token: string, orderId: number): Promise<OrderDetails> {
  const response = await apiRequest<unknown>("/customer/order/details", {
    token,
    query: { order_id: orderId }
  });
  const lines = asArray(response);
  const first = getPayload(lines[0]);
  const order = getPayload(first.order);
  const items = lines.map((line) => {
    const record = getPayload(line);
    const details = getPayload(record.product_details);
    const variationLabels = asArray(record.variation).flatMap((variation) => {
      const value = getPayload(variation);
      if (Array.isArray(value.values)) {
        return value.values.map((entry) => `${text(value.name, "Option")}: ${text(getPayload(entry).label ?? getPayload(entry).name)}`);
      }
      return text(value.type ?? value.name) ? [text(value.type ?? value.name)] : [];
    });
    const qty = number(record.quantity);
    const unit = number(record.price);

    return {
      name: text(details.name, "Order item"),
      quantity: qty,
      totalPrice: qty * unit,
      variations: variationLabels
    };
  });

  return {
    id: number(order.id ?? first.order_id ?? orderId),
    status: text(order.order_status, "pending"),
    paymentStatus: text(order.payment_status, "unpaid"),
    paymentMethod: text(order.payment_method) || null,
    transactionReference: text(order.transaction_reference) || null,
    totalAmount: number(order.order_amount, items.reduce((sum, item) => sum + item.totalPrice, 0)),
    items
  };
}
