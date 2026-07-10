"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import {
  addAddress,
  apiRequest,
  AppConfig,
  CartLinePayload,
  CustomerPaymentOption,
  fetchAddresses,
  fetchOrderDetails,
  fetchOrders,
  fetchPaymentStatus,
  fetchProducts,
  getPublicAssetUrl,
  initiatePayment,
  loginWithPassword,
  normalizeConfig,
  OrderDetails,
  OrderPlacementResult,
  OrderSummary,
  PaymentGateway,
  PaymentSession,
  PaymentStatus,
  placeOrder,
  Product,
  ProductOption,
  ProductVariation,
  registerWithSocialMedia,
  registerWithOtp,
  searchProducts,
  SocialMedium,
  socialLogin
} from "@/lib/api";

type Section = "menu" | "live-menu" | "cart" | "checkout" | "orders" | "profile";
type PaymentState =
  | "idle"
  | "placing_order"
  | "order_created"
  | "initiating_payment"
  | "redirecting_to_gateway"
  | "waiting_for_payment"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "manual_review_if_offline";

type SelectionMap = Record<string, ProductOption[]>;

type CartLine = {
  key: string;
  product: Product;
  quantity: number;
  selections: SelectionMap;
};

type AddressForm = {
  label: string;
  address: string;
  contactName: string;
  contactPhone: string;
};

type PaymentChoice = {
  key: "cash_on_delivery" | "offline_payment" | "mobile_money" | "card";
  label: string;
  description: string;
  digital: boolean;
  methodForOrder: string;
  initiationMethod?: "mobile_money" | "card";
};

type CartFly = {
  id: number;
  imageUrl?: string | null;
  name: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type SocialProfile = {
  id: string;
  name: string;
  email: string;
  token: string;
  medium: Extract<SocialMedium, "google" | "facebook">;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleTokenClient = {
  requestAccessToken: () => void;
};

type FacebookLoginResponse = {
  authResponse?: {
    accessToken: string;
    userID: string;
  };
  status?: string;
};

type FacebookProfile = {
  id?: string;
  name?: string;
  email?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => GoogleTokenClient;
        };
      };
    };
    FB?: {
      init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: FacebookLoginResponse) => void, options: { scope: string }) => void;
      api: (path: string, params: Record<string, string>, callback: (response: FacebookProfile) => void) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const TOKEN_KEY = "ismakfoods.customer.token";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "175077116216-ldqpou5goukij9f3m97b4prc984an6fa.apps.googleusercontent.com";
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? "";
const ALL_CATEGORY = "All";
const CATEGORY_RULES = [
  { label: "Chicken", keywords: ["chicken", "broast", "wings", "grill"] },
  { label: "Rice & Meals", keywords: ["rice", "meal", "combo", "bowl", "fried rice", "teriyaki"] },
  { label: "Burgers", keywords: ["burger", "sandwich"] },
  { label: "Pizza", keywords: ["pizza"] },
  { label: "Wraps", keywords: ["wrap", "roll", "shawarma", "taco"] },
  { label: "Drinks", keywords: ["juice", "soda", "drink", "water", "tea", "coffee"] },
  { label: "Sides", keywords: ["fries", "chips", "salad", "rings", "snack"] }
];

type CategoryOption = {
  label: string;
  count: number;
  imageUrl?: string | null;
};

function formatPrice(config: AppConfig | null, amount: number) {
  const rounded = Math.round(amount).toLocaleString();
  const symbol = config?.currencySymbol ?? "UGX";
  return config?.currencySymbolPosition === "right" ? `${rounded} ${symbol}` : `${symbol} ${rounded}`;
}

function loadExternalScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function googleProfileFromAccessToken(accessToken: string): Promise<FacebookProfile> {
  const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!response.ok) {
    throw new Error("Google profile could not be loaded.");
  }
  const profile = await response.json() as { sub?: string; name?: string; email?: string };
  return { id: profile.sub, name: profile.name, email: profile.email };
}

async function requestGoogleProfile(): Promise<SocialProfile> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google login needs NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
  }
  await loadExternalScript("google-identity-services", "https://accounts.google.com/gsi/client");
  const tokenClient = window.google?.accounts?.oauth2?.initTokenClient;
  if (!tokenClient) {
    throw new Error("Google Identity Services is unavailable.");
  }

  return new Promise((resolve, reject) => {
    const client = tokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (response) => {
        try {
          if (response.error || !response.access_token) {
            throw new Error(response.error || "Google login was cancelled.");
          }
          const profile = await googleProfileFromAccessToken(response.access_token);
          if (!profile.id || !profile.email) {
            throw new Error("Google did not return an email address.");
          }
          resolve({
            id: profile.id,
            name: profile.name || profile.email,
            email: profile.email,
            token: response.access_token,
            medium: "google"
          });
        } catch (error) {
          reject(error);
        }
      }
    });
    client.requestAccessToken();
  });
}

async function requestFacebookProfile(): Promise<SocialProfile> {
  if (!FACEBOOK_APP_ID) {
    throw new Error("Facebook login needs NEXT_PUBLIC_FACEBOOK_APP_ID.");
  }
  await loadExternalScript("facebook-jssdk", "https://connect.facebook.net/en_US/sdk.js");
  const facebook = window.FB;
  if (!facebook) {
    throw new Error("Facebook SDK is unavailable.");
  }
  facebook.init({ appId: FACEBOOK_APP_ID, cookie: true, xfbml: false, version: "v19.0" });

  return new Promise((resolve, reject) => {
    facebook.login((loginResponse) => {
      const accessToken = loginResponse.authResponse?.accessToken;
      const userId = loginResponse.authResponse?.userID;
      if (!accessToken || !userId) {
        reject(new Error("Facebook login was cancelled."));
        return;
      }
      facebook.api("/me", { fields: "id,name,email" }, (profile) => {
        if (!profile.id || !profile.email) {
          reject(new Error("Facebook did not return an email address."));
          return;
        }
        resolve({
          id: profile.id,
          name: profile.name || profile.email,
          email: profile.email,
          token: accessToken,
          medium: "facebook"
        });
      });
    }, { scope: "email,public_profile" });
  });
}

function lineUnitPrice(line: CartLine) {
  const base = line.product.discountPrice ?? line.product.price;
  const optionTotal = Object.values(line.selections)
    .flat()
    .reduce((sum, option) => sum + option.price, 0);
  return base + optionTotal;
}

function cartTotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
}

function selectedVariationPayload(product: Product, selections: SelectionMap) {
  return product.variations
    .filter((group) => group.values.some((option) => option.source !== "add_on"))
    .map((group) => {
      const selected = (selections[group.id] ?? []).filter((option) => option.source !== "add_on");
      return {
        id: group.id,
        name: group.name,
        type: group.type,
        required: group.required,
        min: group.min,
        max: group.max,
        values: selected.map((option) => ({
          id: option.id,
          label: option.name,
          name: option.name,
          price: option.price,
          option_price: option.price,
          optionPrice: option.price
        }))
      };
    })
    .filter((group) => group.values.length);
}

function selectedAddOns(product: Product, selections: SelectionMap) {
  return product.variations.flatMap((group) =>
    (selections[group.id] ?? [])
      .filter((option) => option.source === "add_on" && option.addOnId)
      .map((option) => option.addOnId as number)
  );
}

function validateSelections(product: Product, selections: SelectionMap): string | null {
  for (const group of product.variations) {
    const count = selections[group.id]?.length ?? 0;
    if (group.required && count < Math.max(1, group.min)) {
      return `Choose ${group.name}.`;
    }
    if (count < group.min) {
      return `${group.name} requires at least ${group.min} option(s).`;
    }
    if (count > group.max) {
      return `${group.name} allows up to ${group.max} option(s).`;
    }
  }

  return null;
}

function cartPayload(lines: CartLine[]): CartLinePayload[] {
  return lines.map((line) => {
    const addOnIds = selectedAddOns(line.product, line.selections);
    return {
      product_id: line.product.id,
      quantity: line.quantity,
      variant: [],
      variations: selectedVariationPayload(line.product, line.selections),
      add_on_ids: addOnIds,
      add_on_qtys: addOnIds.map(() => 1)
    };
  });
}

function selectionKey(product: Product, selections: SelectionMap) {
  return `${product.id}:${JSON.stringify({
    variations: selectedVariationPayload(product, selections),
    addOns: selectedAddOns(product, selections)
  })}`;
}

function activeGateway(config: AppConfig | null): PaymentGateway | null {
  const contract = config?.paymentGatewayContract;
  if (!contract?.digitalPaymentEnabled || contract.configurationError || contract.multipleActiveGateways) {
    return null;
  }

  const foregroundActive = contract.activeGateways.filter((gateway) =>
    contract.foregroundGateways.includes(gateway)
  );
  if (foregroundActive.length !== 1) {
    return null;
  }

  const gateway = contract.gateways.find((entry) => entry.gateway === foregroundActive[0]);
  if (!gateway?.enabledForCheckout || gateway.status !== 1) {
    return null;
  }

  return gateway;
}

function paymentChoices(config: AppConfig | null): PaymentChoice[] {
  if (!config) {
    return [];
  }

  const choices: PaymentChoice[] = [];
  if (config.cashOnDelivery) {
    choices.push({
      key: "cash_on_delivery",
      label: "Cash on delivery",
      description: "Place the order now and settle it at delivery or pickup.",
      digital: false,
      methodForOrder: "cash_on_delivery"
    });
  }

  if (config.offlinePayment) {
    choices.push({
      key: "offline_payment",
      label: "Offline payment",
      description: "Use business-approved offline instructions when available.",
      digital: false,
      methodForOrder: "offline_payment"
    });
  }

  const gateway = activeGateway(config);
  const customerOptions = config.customerPaymentOptions?.options ?? [];
  if (gateway && config.digitalPayment && config.customerPaymentOptions?.digitalPaymentEnabled !== false) {
    customerOptions
      .filter((option) => option.enabled && (option.key === "mobile_money" || option.key === "card"))
      .forEach((option: CustomerPaymentOption) => {
        choices.push({
          key: option.key,
          label: option.label,
          description: option.description || "Continue through the secure backend payment flow.",
          digital: true,
          methodForOrder: "digital_payment",
          initiationMethod: option.key === "mobile_money" ? "mobile_money" : "card"
        });
      });
  }

  return choices;
}

function statusTone(state: PaymentState | string) {
  if (["paid", "confirmed", "delivered"].includes(state)) {
    return "success";
  }
  if (["failed", "cancelled", "expired"].includes(state)) {
    return "danger";
  }
  return "pending";
}

function productCategory(product: Product) {
  const haystack = `${product.name} ${product.description}`.toLowerCase();
  return CATEGORY_RULES.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)))?.label ?? "Chef Picks";
}

function categoryOptions(products: Product[], limit = 7): CategoryOption[] {
  const counts = new Map<string, CategoryOption>();
  products.forEach((product) => {
    const label = productCategory(product);
    const current = counts.get(label);
    counts.set(label, {
      label,
      count: (current?.count ?? 0) + 1,
      imageUrl: current?.imageUrl ?? product.imageUrl
    });
  });

  const options = Array.from(counts.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  return [{ label: ALL_CATEGORY, count: products.length, imageUrl: products.find((product) => product.imageUrl)?.imageUrl }, ...options.slice(0, limit)];
}

function filterByCategory(products: Product[], category: string) {
  if (category === ALL_CATEGORY) {
    return products;
  }
  return products.filter((product) => productCategory(product) === category);
}

function isBurgerProduct(product: Product) {
  return /\b(burger|cheese burger|beef burger|chicken burger)\b/i.test(product.name);
}

function heroProductRank(product: Product) {
  const category = productCategory(product);
  if (isBurgerProduct(product)) {
    return 0;
  }
  if (["Chicken", "Pizza", "Rice & Meals", "Wraps"].includes(category)) {
    return 1;
  }
  if (category === "Chef Picks") {
    return 2;
  }
  return 3;
}

export default function CustomerApp() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<Section>("menu");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [token, setTokenState] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [cartFly, setCartFly] = useState<CartFly | null>(null);

  useEffect(() => {
    setTokenState(sessionStorage.getItem(TOKEN_KEY));
    apiRequest<unknown>("/config")
      .then((raw) => {
        const nextConfig = normalizeConfig(raw);
        setConfig(nextConfig);
        setSelectedBranchId(nextConfig.branches[0]?.id ?? null);
      })
      .catch((error) => setConfigError(error instanceof Error ? error.message : "Config could not be loaded."));
  }, []);

  useEffect(() => {
    if (!config) {
      return;
    }
    if (config.branches.length && !selectedBranchId) {
      return;
    }

    let alive = true;
    setLoadingProducts(true);
    setProductsError(null);
    fetchProducts(config, selectedBranchId)
      .then((items) => {
        if (alive) {
          setProducts(items);
        }
      })
      .catch((error) => {
        if (alive) {
          setProductsError(error instanceof Error ? error.message : "Products could not be loaded.");
        }
      })
      .finally(() => {
        if (alive) {
          setLoadingProducts(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [config, selectedBranchId]);

  const logoUrl = getPublicAssetUrl(config?.logoUrl ?? config?.logoPath, config?.baseUrls.restaurant_image_url);
  const branch = config?.branches.find((entry) => entry.id === selectedBranchId) ?? config?.branches[0];
  const authVisualUrl = products.find((product) => product.imageUrl)?.imageUrl ?? null;
  const total = cartTotal(cart);
  const choices = paymentChoices(config);

  function persistToken(nextToken: string | null) {
    if (nextToken) {
      sessionStorage.setItem(TOKEN_KEY, nextToken);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(nextToken);
  }

  function openHome() {
    setSection("menu");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function openRestaurants() {
    setSection("menu");
    window.setTimeout(() => document.getElementById("popular-restaurants")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function triggerCartFly(product: Product, source?: HTMLElement | null) {
    const sourceRect = source?.getBoundingClientRect();
    const cartRect = document.querySelector(".cart-icon-btn")?.getBoundingClientRect();
    const fromX = sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2;
    const fromY = sourceRect ? sourceRect.top + sourceRect.height / 2 : window.innerHeight / 2;
    const toX = cartRect ? cartRect.left + cartRect.width / 2 : window.innerWidth - 64;
    const toY = cartRect ? cartRect.top + cartRect.height / 2 : 42;

    const id = Date.now();
    setCartFly({ id, imageUrl: product.imageUrl, name: product.name, fromX, fromY, toX, toY });
    window.setTimeout(() => {
      setCartFly((current) => (current?.id === id ? null : current));
    }, 720);
  }

  function addLine(product: Product, selections: SelectionMap = {}, source?: HTMLElement | null, quantity = 1) {
    const validation = validateSelections(product, selections);
    if (validation) {
      setNotice(validation);
      setDetailProduct(product);
      return;
    }

    const key = selectionKey(product, selections);
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) => (line.key === key ? { ...line, quantity: line.quantity + quantity } : line));
      }

      return [...current, { key, product, selections, quantity }];
    });
    triggerCartFly(product, source);
  }

  function openProduct(product: Product) {
    setDetailProduct(product);
  }

  function runProductSearch(term = query) {
    if (!config) {
      return;
    }

    setLoadingProducts(true);
    setProductsError(null);
    const normalizedTerm = term.trim();
    const action = normalizedTerm
      ? searchProducts(config, normalizedTerm, selectedBranchId)
      : fetchProducts(config, selectedBranchId);
    action
      .then(setProducts)
      .catch((error) => setProductsError(error instanceof Error ? error.message : "Search failed."))
      .finally(() => setLoadingProducts(false));
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    runProductSearch();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={openHome} type="button">
          {logoUrl && !logoFailed ? (
            <img className="brand-logo" src={logoUrl} alt={config?.restaurantName ?? "Ismak Foods"} onError={() => setLogoFailed(true)} />
          ) : (
            <span className="brand-mark">IF</span>
          )}
        </button>

        <LocationPicker
          branches={config?.branches ?? []}
          selectedBranchId={selectedBranchId}
          setSelectedBranchId={setSelectedBranchId}
        />

        <nav className="nav-tabs" aria-label="Primary">
          <button className={section === "menu" ? "active" : ""} onClick={openHome} type="button">
            Home
          </button>
          <button className={section === "live-menu" ? "active" : ""} onClick={() => setSection("live-menu")} type="button">
            Explore Foods
          </button>
          <button onClick={openRestaurants} type="button">
            Restaurants
          </button>
        </nav>

        <div className="top-actions">
          <button className="cart-icon-btn" onClick={() => setCartDrawerOpen(true)} type="button" aria-label={`Open cart with ${cart.length} item${cart.length === 1 ? "" : "s"}`}>
            <CartIcon />
            {cart.length ? <span className="cart-count">{cart.length}</span> : null}
          </button>
          <button className="account-btn" onClick={() => setSection("profile")} type="button" aria-label={token ? "Open profile" : "Open account access"}>
            <ProfileIcon />
          </button>
        </div>
      </header>

      {notice ? (
        <div className="notice" role="status">
          {notice}
          <button onClick={() => setNotice(null)} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

      {configError ? <Banner tone="danger" title="Config unavailable" body={configError} /> : null}
      {config?.paymentGatewayContract?.multipleActiveGateways ? (
        <Banner
          tone="danger"
          title="Digital checkout unavailable"
          body="More than one payment processor is active in config. The web checkout will not guess which gateway to use."
        />
      ) : null}

      {section === "menu" ? (
        <MenuSection
          config={config}
          products={products}
          loading={loadingProducts}
          error={productsError}
          query={query}
          setQuery={setQuery}
          runSearch={runSearch}
          runProductSearch={runProductSearch}
          selectedBranchId={selectedBranchId}
          setSelectedBranchId={setSelectedBranchId}
          onAdd={addLine}
          onConfigure={setModalProduct}
          onViewProduct={openProduct}
        />
      ) : null}

      {section === "live-menu" ? (
        <LiveMenuSection
          config={config}
          products={products}
          loading={loadingProducts}
          error={productsError}
          query={query}
          setQuery={setQuery}
          runSearch={runSearch}
          runProductSearch={runProductSearch}
          selectedBranchId={selectedBranchId}
          onAdd={addLine}
          onConfigure={setModalProduct}
          onViewProduct={openProduct}
        />
      ) : null}

      {section === "cart" ? (
        <CartSection config={config} cart={cart} setCart={setCart} setSection={setSection} onEdit={(product) => setModalProduct(product)} />
      ) : null}

      {section === "checkout" ? (
        <CheckoutSection
          config={config}
          token={token}
          persistToken={persistToken}
          cart={cart}
          setCart={setCart}
          branchId={branch?.id ?? null}
          choices={choices}
          total={total}
          authVisualUrl={authVisualUrl}
          setSection={setSection}
        />
      ) : null}

      {section === "orders" ? (
        <OrdersSection config={config} token={token} persistToken={persistToken} authVisualUrl={authVisualUrl} />
      ) : null}

      {section === "profile" ? (
        <ProfileSection config={config} token={token} persistToken={persistToken} setSection={setSection} authVisualUrl={authVisualUrl} />
      ) : null}

      <FloatingCartDock
        config={config}
        cart={cart}
        total={total}
        openCart={() => setCartDrawerOpen(true)}
        setSection={setSection}
      />

      <CartDrawer
        config={config}
        cart={cart}
        open={cartDrawerOpen}
        setCart={setCart}
        onClose={() => setCartDrawerOpen(false)}
        onReview={() => {
          setCartDrawerOpen(false);
          setSection("cart");
        }}
      />

      {modalProduct ? (
        <VariationModal
          product={modalProduct}
          config={config}
          onClose={() => setModalProduct(null)}
          onAdd={(product, selections) => {
            addLine(product, selections);
            setModalProduct(null);
          }}
        />
      ) : null}

      {detailProduct ? (
        <ProductDetailSection
          config={config}
          product={detailProduct}
          relatedProducts={products.filter((product) => product.id !== detailProduct.id).slice(0, 3)}
          onClose={() => setDetailProduct(null)}
          onAdd={(product, selections, source, quantity) => {
            addLine(product, selections, source, quantity);
            setDetailProduct(null);
          }}
          onViewProduct={openProduct}
        />
      ) : null}

      {cartFly ? <FlyToCart item={cartFly} /> : null}
    </main>
  );
}

function Banner({ title, body, tone }: { title: string; body: string; tone: "danger" | "pending" | "success" }) {
  return (
    <section className={`banner ${tone}`}>
      <strong>{title}</strong>
      <span>{body}</span>
    </section>
  );
}

function LocationPicker({
  branches,
  selectedBranchId,
  setSelectedBranchId
}: {
  branches: AppConfig["branches"];
  selectedBranchId: number | null;
  setSelectedBranchId: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];

  return (
    <div className="location-picker" title="Branch selection will later use the customer's vicinity.">
      <div className="location-label">
        <LocationIcon />
        <span>Location</span>
      </div>
      <button
        className="location-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <strong>{selectedBranch?.name ?? "Choose branch"}</strong>
        <ChevronDownIcon open={open} />
      </button>
      {open ? (
        <div className="location-menu" role="listbox" aria-label="Choose serving branch">
          {branches.map((branch) => (
            <button
              className={branch.id === selectedBranch?.id ? "active" : ""}
              key={branch.id}
              onClick={() => {
                setSelectedBranchId(branch.id);
                setOpen(false);
              }}
              role="option"
              aria-selected={branch.id === selectedBranch?.id}
              type="button"
            >
              {branch.name}
            </button>
          ))}
          {!branches.length ? <span>No branches available</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function LocationIcon() {
  return (
    <svg className="location-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg className={`location-chevron ${open ? "open" : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m7 9.5 5 5 5-5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 8h12l-1.2 7.2a2 2 0 0 1-2 1.7H9.3a2 2 0 0 1-2-1.6L5.8 5.8H3" />
      <circle cx="9.4" cy="20" r="1.4" />
      <circle cx="16.4" cy="20" r="1.4" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

function FlyToCart({ item }: { item: CartFly }) {
  return (
    <div
      className="fly-to-cart"
      style={{
        ["--from-x" as string]: `${item.fromX}px`,
        ["--from-y" as string]: `${item.fromY}px`,
        ["--to-x" as string]: `${item.toX}px`,
        ["--to-y" as string]: `${item.toY}px`
      }}
      aria-hidden="true"
    >
      <SafeImage src={item.imageUrl} alt="" fallbackText={item.name} />
    </div>
  );
}

function SafeImage({
  src,
  alt,
  fallbackText,
  className,
  loading
}: {
  src?: string | null;
  alt: string;
  fallbackText: string;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <span className={`image-fallback ${className ?? ""}`.trim()}>{fallbackText.slice(0, 2).toUpperCase()}</span>;
  }

  return <img className={className} src={src} alt={alt} loading={loading} onError={() => setFailed(true)} />;
}

function MenuSection({
  config,
  products,
  loading,
  error,
  query,
  setQuery,
  runSearch,
  runProductSearch,
  selectedBranchId,
  setSelectedBranchId,
  onAdd,
  onConfigure,
  onViewProduct
}: {
  config: AppConfig | null;
  products: Product[];
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: (value: string) => void;
  runSearch: (event: FormEvent) => void;
  runProductSearch: (term?: string) => void;
  selectedBranchId: number | null;
  setSelectedBranchId: (value: number) => void;
  onAdd: (product: Product, selections?: SelectionMap, source?: HTMLElement | null) => void;
  onConfigure: (product: Product) => void;
  onViewProduct: (product: Product) => void;
}) {
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [heroIndex, setHeroIndex] = useState(0);
  const categoryFilters = categoryOptions(products, 6);
  const displayProducts = filterByCategory(products, activeCategory);
  const heroProducts = products
    .filter((product) => product.imageUrl)
    .map((product, index) => ({ product, index }))
    .sort((left, right) => heroProductRank(left.product) - heroProductRank(right.product) || left.index - right.index)
    .map(({ product }) => product)
    .slice(0, 6);
  const featuredProduct = heroProducts[heroIndex % Math.max(heroProducts.length, 1)] ?? products[0];
  const gateway = activeGateway(config);
  const branch = config?.branches.find((entry) => entry.id === selectedBranchId) ?? config?.branches[0];
  const logoUrl = getPublicAssetUrl(config?.logoUrl ?? config?.logoPath, config?.baseUrls.restaurant_image_url);
  const suggested = ["Burger", "Pizza", "Pasta", "Chicken"];
  const categories = categoryFilters.filter((category) => category.label !== ALL_CATEGORY).slice(0, 4);
  const popular = displayProducts.filter((product) => product.imageUrl).slice(0, 5);
  const deals = displayProducts.filter((product) => product.imageUrl).slice(6, 12);
  const stories = products.filter((product) => product.imageUrl).slice(16, 19);

  useEffect(() => {
    setHeroIndex(0);
  }, [products]);

  useEffect(() => {
    if (heroProducts.length < 2) {
      return;
    }
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroProducts.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, [heroProducts.length]);

  function chooseCategory(category: string) {
    setActiveCategory(category);
    window.setTimeout(() => document.getElementById("popular-restaurants")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function chooseSuggestion(item: string) {
    setQuery(item);
    runProductSearch(item);
    window.setTimeout(() => document.getElementById("popular-restaurants")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function addProduct(product: Product, source?: HTMLElement | null) {
    if (product.variations.length) {
      onConfigure(product);
      return;
    }
    onAdd(product, {}, source);
  }

  return (
    <section className="home-page">
      <section className="foodex-hero">
        <div className="hero-copy">
          <h1>
            Hungry? Let&apos;s Deliver Happiness to Your <span>Doorstep!</span>
          </h1>
          <p className="hero-lede">
            Explore a world of flavour from Ismak Foods. Browse the live menu, customize your order, and checkout with the same Laravel-backed rules used across the business.
          </p>

          <form className="hero-search" onSubmit={runSearch}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rice, chicken, wraps..." />
            <button type="submit">Search</button>
          </form>

          <div className="suggestions">
            <span>Suggested</span>
            {suggested.map((item) => (
              <button key={item} type="button" onClick={() => chooseSuggestion(item)}>
                {item}
              </button>
            ))}
          </div>

          <p className="hero-service-note">{products.length || "--"} live items / {branch?.preparationTime ?? 30} min prep from the selected branch.</p>
          <div className="hero-stats" aria-label="Ordering highlights">
            <span>
              <strong>{products.length || "--"}</strong>
              Live items
            </span>
            <span>
              <strong>{branch?.preparationTime ?? 30}</strong>
              Min prep
            </span>
            <span>
              <strong>{gateway ? "Pay" : "COD"}</strong>
              Checkout ready
            </span>
          </div>
        </div>

        <div className="hero-plate">
          {featuredProduct ? (
            <>
              <div className="hero-canvas">
                <SafeImage className="hero-showcase-image" key={featuredProduct.id} src={featuredProduct.imageUrl} alt={featuredProduct.name} fallbackText={featuredProduct.name} />
              </div>
              <div className="hero-dish-card" key={`dish-${featuredProduct.id}`}>
                <span>Chef pick</span>
                <strong>{featuredProduct.name}</strong>
                <button onClick={(event) => addProduct(featuredProduct, event.currentTarget)} type="button">
                  Order {formatPrice(config, featuredProduct.discountPrice ?? featuredProduct.price)}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="brand-strip">
        <h2>Nearby Branches</h2>
        <div>
          {config?.branches.map((item) => (
            <button className={item.id === selectedBranchId ? "active" : ""} key={item.id} onClick={() => setSelectedBranchId(item.id)} type="button">
              {logoUrl ? <img src={logoUrl} alt="" /> : <span>{item.name.slice(0, 2)}</span>}
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <SectionHeader
          title="Top Food Categories"
          subtitle={`Live menu / ${displayProducts.length} dishes available`}
        />
        <CategoryPills options={categoryFilters} active={activeCategory} onSelect={chooseCategory} />
        <div className="category-grid">
          {categories.map((category, index) => (
            <button
              key={category.label}
              className={`category-card ${activeCategory === category.label ? "active" : ""}`}
              onClick={() => chooseCategory(category.label)}
              type="button"
              style={{ ["--stagger" as string]: `${index * 70}ms` }}
            >
              <SafeImage src={category.imageUrl} alt="" fallbackText={category.label} />
              <span>{category.count} Menu Products</span>
              <strong>{category.label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section popular-focus-section" id="popular-restaurants">
        <SectionHeader
          title={activeCategory === ALL_CATEGORY ? "Popular Foods" : activeCategory === "Chef Picks" ? activeCategory : `${activeCategory} Picks`}
          subtitle={`${popular.length} favourites from this selection / tap + to add`}
        />
        {loading ? <ProductSkeletonGrid count={6} variant="restaurant" /> : null}
        {error ? <div className="empty menu-empty danger-text">{error}</div> : null}
        {!loading && !displayProducts.length && !error ? <EmptyMenuState title="No products found" body="Try another category or clear the search term." /> : null}
        {!loading && displayProducts.length ? <div className="restaurant-grid">
          {popular.map((product, index) => (
            <article className={`restaurant-card reveal-card ${index === 0 ? "featured-restaurant" : ""}`} key={product.id} style={{ ["--stagger" as string]: `${index * 55}ms` }}>
              <button className="favorite-pill" type="button" aria-label="Add favorite">Fav</button>
              <button className="card-media-button" onClick={() => onViewProduct(product)} type="button" aria-label={`View ${product.name}`}>
                <SafeImage src={product.imageUrl} alt={product.name} fallbackText={product.name} />
              </button>
              <div>
                <button className="card-title-button" onClick={() => onViewProduct(product)} type="button">
                  <h3>{product.name}</h3>
                </button>
                <p>{product.description}</p>
                <span className="restaurant-meta">
                  <span>{product.deliveryEta}</span>
                  <strong>{product.rating.toFixed(1)} rated</strong>
                </span>
                <strong className="product-price-line">{formatPrice(config, product.discountPrice ?? product.price)}</strong>
                <button className="quick-add-btn" onClick={(event) => addProduct(product, event.currentTarget)} type="button" aria-label={product.variations.length ? `Customize ${product.name}` : `Add ${product.name}`}>
                  {product.variations.length ? "Options" : "+"}
                </button>
              </div>
            </article>
          ))}
        </div> : null}
      </section>

      <section className="home-section deals-section revenue-section">
        <SectionHeader title="Super Delicious Deals Just for You!" actions={["All deals"]} />
        <div className="deal-grid">
          {deals.map((product, index) => (
            <article className={`deal-card reveal-card ${index < 2 ? "wide-deal" : ""}`} key={product.id} style={{ ["--stagger" as string]: `${index * 55}ms` }}>
              <button className="card-media-button" onClick={() => onViewProduct(product)} type="button" aria-label={`View ${product.name}`}>
                <SafeImage src={product.imageUrl} alt={product.name} fallbackText={product.name} />
              </button>
              <span>{10 + index * 5} Mins</span>
              <div>
                <button className="card-title-button" onClick={() => onViewProduct(product)} type="button">
                  <h3>{product.name}</h3>
                </button>
                <p>{product.description}</p>
                <strong>{formatPrice(config, product.discountPrice ?? product.price)}</strong>
                <button className="quick-add-btn" onClick={(event) => addProduct(product, event.currentTarget)} type="button" aria-label={product.variations.length ? `Customize ${product.name}` : `Add ${product.name}`}>+</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="promo-band">
        <h2>Find special offers from your favorite Ismak branch.</h2>
        <p>Search, customize, and continue through secure restaurant-owned checkout.</p>
        <button type="button" onClick={() => document.querySelector(".restaurant-grid")?.scrollIntoView({ behavior: "smooth" })}>
          Search Menu
        </button>
      </section>

      <section className="how-section">
        <p className="eyebrow">How it works</p>
        <h2>Simple and Easy</h2>
        <div>
          <article>
            <span>01</span>
            <h3>Your Order</h3>
            <p>Browse the live API menu and customize options exactly as the restaurant allows.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Secure Checkout</h3>
            <p>Sign in before checkout; every order is placed with a customer Bearer token.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Receive Order</h3>
            <p>Track order and payment state with clear pending, paid, failed, or cancelled statuses.</p>
          </article>
        </div>
      </section>

      <section className="delivery-banner">
        <div>
          <h2>Hungry? We&apos;ve got you covered.</h2>
          <p>Order anytime from {branch?.name ?? "Ismak Foods"} and use the active checkout methods configured by the business.</p>
          <button type="button" onClick={() => document.querySelector(".restaurant-grid")?.scrollIntoView({ behavior: "smooth" })}>
            Order Now
          </button>
        </div>
        <div className="delivery-illustration">
          <span>24/7</span>
          <strong>{gateway ? gateway.gatewayTitle : "COD"} ready</strong>
        </div>
      </section>

      <section className="home-section quiet-section">
        <SectionHeader title="Tips & Picks" actions={["Fresh", "Fast", "Flavor"]} />
        <div className="blog-grid">
          {stories.map((product) => (
            <article key={product.id}>
              <SafeImage src={product.imageUrl} alt={product.name} fallbackText={product.name} />
              <h3>How to enjoy {product.name}</h3>
              <p>{product.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="footer-transition">
        <div>
          <span>Kitchen rhythm</span>
          <h2>Warm meals, clear checkout, branch-ready fulfillment.</h2>
        </div>
        <button type="button" onClick={() => document.querySelector(".restaurant-grid")?.scrollIntoView({ behavior: "smooth" })}>
          Pick a meal
        </button>
      </section>

      <footer className="site-footer">
        <div>
          <h2>{config?.restaurantName ?? "Ismak Foods"}</h2>
          <p>Fresh and fast food ordering for browser customers, powered by the same Laravel API contract used across Ismak Foods surfaces.</p>
        </div>
        <div>
          <h3>Quick Links</h3>
          <button type="button" onClick={() => document.querySelector(".foodex-hero")?.scrollIntoView({ behavior: "smooth" })}>Home</button>
          <button type="button" onClick={() => document.querySelector(".restaurant-grid")?.scrollIntoView({ behavior: "smooth" })}>Menu</button>
          <button type="button">Checkout guarded</button>
        </div>
        <div>
          <h3>Checkout</h3>
          <p>{config?.guestCheckout ? "Guest checkout enabled by config" : "Customer login required"}</p>
          <p>{gateway ? `${gateway.gatewayTitle} active` : "Digital gateway guarded by config"}</p>
        </div>
      </footer>
    </section>
  );
}

function LiveMenuSection({
  config,
  products,
  loading,
  error,
  query,
  setQuery,
  runSearch,
  runProductSearch,
  selectedBranchId,
  onAdd,
  onConfigure,
  onViewProduct
}: {
  config: AppConfig | null;
  products: Product[];
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: (value: string) => void;
  runSearch: (event: FormEvent) => void;
  runProductSearch: (term?: string) => void;
  selectedBranchId: number | null;
  onAdd: (product: Product, selections?: SelectionMap, source?: HTMLElement | null) => void;
  onConfigure: (product: Product) => void;
  onViewProduct: (product: Product) => void;
}) {
  const [showFullMenu, setShowFullMenu] = useState(false);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const branch = config?.branches.find((entry) => entry.id === selectedBranchId) ?? config?.branches[0];
  const categoryFilters = categoryOptions(products, 8);
  const displayProducts = filterByCategory(products, activeCategory);
  const fullMenuProducts = showFullMenu ? displayProducts : displayProducts.slice(0, 12);

  function addProduct(product: Product, source?: HTMLElement | null) {
    if (product.variations.length) {
      onConfigure(product);
      return;
    }
    onAdd(product, {}, source);
  }

  return (
    <section className="live-menu-page">
      <section className="menu-hero">
        <div>
          <p className="eyebrow">Explore foods</p>
          <h1>Full live menu from {branch?.name ?? "your selected branch"}</h1>
          <p>Browse the API-backed food catalogue without the homepage content in the way.</p>
        </div>
        <form className="hero-search" onSubmit={runSearch}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rice, chicken, wraps..." />
          <button type="submit">Search</button>
        </form>
        <div className="suggestions menu-suggestions">
          {["Chicken", "Rice", "Burger", "Wraps"].map((item) => (
            <button
              key={item}
              onClick={() => {
                setQuery(item);
                runProductSearch(item);
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="menu-area compact-menu">
        {loading ? <ProductSkeletonGrid count={12} /> : null}
        {error ? <div className="empty menu-empty danger-text">{error}</div> : null}
        {!loading && !displayProducts.length && !error ? <EmptyMenuState title="No products found" body="Try another category, search term, or branch." /> : null}
        <SectionHeader title="Full Live Menu" actions={["API sourced", `${displayProducts.length} shown`]} />
        <CategoryPills options={categoryFilters} active={activeCategory} onSelect={setActiveCategory} />
        {!loading && displayProducts.length ? <div className="product-grid">
          {fullMenuProducts.map((product, index) => (
            <article className="product-card reveal-card" key={product.id} style={{ ["--stagger" as string]: `${index * 45}ms` }}>
              <button className="product-image card-media-button" onClick={() => onViewProduct(product)} type="button" aria-label={`View ${product.name}`}>
                <SafeImage src={product.imageUrl} alt={product.name} fallbackText={product.name} loading="lazy" />
                {product.variations.length ? <span className="product-badge">Customizable</span> : null}
              </button>
              <div className="product-body">
                <div>
                  <span className="dish-meta">{product.deliveryEta} / {product.rating.toFixed(1)} rated</span>
                  <button className="card-title-button" onClick={() => onViewProduct(product)} type="button">
                    <h2>{product.name}</h2>
                  </button>
                  <p>{product.description}</p>
                </div>
                <div className="product-meta">
                  <span>{product.variations.length ? `${product.variations.length} option group${product.variations.length === 1 ? "" : "s"}` : product.deliveryEta}</span>
                  <strong>{formatPrice(config, product.discountPrice ?? product.price)}</strong>
                </div>
                <button className="product-action quick-add-btn" onClick={(event) => addProduct(product, event.currentTarget)} type="button" aria-label={product.variations.length ? `Customize ${product.name}` : `Add ${product.name}`}>
                  {product.variations.length ? "Options" : "+"}
                </button>
              </div>
            </article>
          ))}
        </div> : null}
        {displayProducts.length > 12 ? (
          <button className="show-menu-button" onClick={() => setShowFullMenu((value) => !value)} type="button">
            {showFullMenu ? "Show fewer items" : `Show all ${displayProducts.length} items`}
          </button>
        ) : null}
      </section>
    </section>
  );
}

function SectionHeader({
  title,
  actions = [],
  subtitle
}: {
  title: string;
  actions?: string[];
  subtitle?: string;
}) {
  return (
    <div className="section-header">
      <div className="section-heading">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions.length ? (
        <div className="section-header-actions">
          {actions.map((action) => (
            <span key={action}>{action}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoryPills({
  options,
  active,
  onSelect
}: {
  options: CategoryOption[];
  active: string;
  onSelect: (category: string) => void;
}) {
  if (!options.length) {
    return null;
  }

  return (
    <div className="category-pills" aria-label="Food categories">
      {options.map((option) => (
        <button
          className={active === option.label ? "active" : ""}
          key={option.label}
          onClick={() => onSelect(option.label)}
          aria-pressed={active === option.label}
          type="button"
        >
          <span>{option.label}</span>
          <small>{option.count}</small>
        </button>
      ))}
    </div>
  );
}

function ProductSkeletonGrid({ count, variant = "product" }: { count: number; variant?: "product" | "restaurant" }) {
  return (
    <div className={variant === "restaurant" ? "restaurant-grid skeleton-grid" : "product-grid skeleton-grid"} aria-label="Loading menu items">
      {Array.from({ length: count }).map((_, index) => (
        <article className={variant === "restaurant" ? "restaurant-card skeleton-card" : "product-card skeleton-card"} key={index}>
          <div className="skeleton-media" />
          <div className="skeleton-body">
            <span />
            <strong />
            <small />
            <button disabled type="button">Loading</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyMenuState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty menu-empty empty-state">
      <span>No results</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function EmptyCartState({ config, compact = false }: { config: AppConfig | null; compact?: boolean }) {
  const iconUrl = getPublicAssetUrl(
    config?.faviconUrl ?? config?.faviconPath ?? config?.logoUrl ?? config?.logoPath,
    config?.baseUrls.restaurant_image_url
  );

  return (
    <div className={`empty-cart-state ${compact ? "compact" : ""}`}>
      <div className="empty-cart-mark">
        {iconUrl ? <img src={iconUrl} alt="" /> : <span>IF</span>}
      </div>
      <h3>Cart is empty</h3>
      <p>Chef is waiting for your order.</p>
    </div>
  );
}

function productIngredientChips(product: Product) {
  const words = `${product.description} ${product.name}`
    .split(/[,./&+]| with | and | in | on /i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && part.length < 34);
  const unique = Array.from(new Set(words));
  return unique.slice(0, 8);
}

function ProductDetailSection({
  config,
  product,
  relatedProducts,
  onClose,
  onAdd,
  onViewProduct
}: {
  config: AppConfig | null;
  product: Product;
  relatedProducts: Product[];
  onClose: () => void;
  onAdd: (product: Product, selections?: SelectionMap, source?: HTMLElement | null, quantity?: number) => void;
  onViewProduct: (product: Product) => void;
}) {
  const [selections, setSelections] = useState<SelectionMap>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const basePrice = product.discountPrice ?? product.price;
  const optionTotal = Object.values(selections)
    .flat()
    .reduce((sum, option) => sum + option.price, 0);
  const unitTotal = basePrice + optionTotal;
  const ingredients = productIngredientChips(product);

  useEffect(() => {
    setSelections({});
    setQuantity(1);
    setError(null);
  }, [product.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function toggle(group: ProductVariation, option: ProductOption) {
    setError(null);
    setSelections((current) => {
      const selected = current[group.id] ?? [];
      if (group.type === "single") {
        return { ...current, [group.id]: [option] };
      }

      const exists = selected.some((entry) => entry.id === option.id);
      if (exists) {
        return { ...current, [group.id]: selected.filter((entry) => entry.id !== option.id) };
      }
      if (selected.length >= group.max) {
        setError(`${group.name} allows up to ${group.max} option(s).`);
        return current;
      }
      return { ...current, [group.id]: [...selected, option] };
    });
  }

  function submit(event: MouseEvent<HTMLButtonElement>) {
    const validation = validateSelections(product, selections);
    if (validation) {
      setError(validation);
      return;
    }
    onAdd(product, selections, event.currentTarget, quantity);
  }

  return (
    <div className="product-detail-backdrop">
      <button className="modal-scrim product-detail-scrim" onClick={onClose} type="button" aria-label="Close product details" />
      <section className="product-detail-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title">
        <button className="detail-close" onClick={onClose} type="button" aria-label="Close product details">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
        <div className="product-detail-page">
          <div className="product-detail-hero">
        <div className="product-detail-image">
          <SafeImage src={product.imageUrl} alt={product.name} fallbackText={product.name} />
        </div>
        <div className="product-detail-copy">
          <p className="eyebrow">Chef pick</p>
          <h1 id="product-detail-title">{product.name}</h1>
          <p>{product.description}</p>
          <div className="detail-meta-row">
            <span className="dish-meta">{product.deliveryEta}</span>
            <span className="dish-meta positive">{product.rating.toFixed(1)} rated</span>
            <span className="detail-price">{formatPrice(config, basePrice)}</span>
          </div>
          <div className="ingredient-block">
            <h2>Ingredients</h2>
            <div className="ingredient-chips">
              {ingredients.length ? ingredients.map((item) => <span key={item}>{item}</span>) : <span>Ingredient details are pending from the menu API.</span>}
            </div>
            <p className="muted">Structured ingredient/allergen fields should be exposed by the API for stronger filtering later.</p>
          </div>
        </div>
      </div>

          <div className="product-detail-layout">
        <div className="panel product-customizer">
          <div className="section-heading">
            <p className="eyebrow">Customize</p>
            <h1>Make it yours</h1>
            <p className="muted">Choose size, extras, spice, or add-ons when the menu API provides them.</p>
          </div>

          {product.variations.length ? (
            <div className="detail-option-stack">
              {product.variations.map((group, groupIndex) => {
                const selectedCount = selections[group.id]?.length ?? 0;
                const rule = group.type === "single"
                  ? "Choose one"
                  : group.min === 0
                    ? `Choose up to ${group.max}`
                    : group.min === group.max
                      ? `Choose ${group.max}`
                      : `Choose ${group.min}-${group.max}`;

                return (
                  <fieldset className="option-group detail-option-group" key={group.id}>
                    <legend>
                      <span className="option-group-number">{String(groupIndex + 1).padStart(2, "0")}</span>
                      <span className="option-group-title">
                        <strong>{group.name}</strong>
                        <small>{rule}</small>
                      </span>
                      <span className={`option-requirement ${group.required ? "required" : ""}`}>{group.required ? "Required" : "Optional"}</span>
                      {selectedCount ? <span className="option-selected-count">{selectedCount} selected</span> : null}
                    </legend>
                    <div className="option-list">
                      {group.values.map((option) => {
                        const checked = (selections[group.id] ?? []).some((entry) => entry.id === option.id);
                        return (
                          <label className={`option-row ${checked ? "selected" : ""}`} key={option.id}>
                            <input
                              type={group.type === "single" ? "radio" : "checkbox"}
                              name={`detail-${group.id}`}
                              checked={checked}
                              onChange={() => toggle(group, option)}
                            />
                            <span className="option-choice-mark" aria-hidden="true">
                              <svg viewBox="0 0 16 16">
                                <path d="m3.5 8.2 2.7 2.7 6.3-6.3" />
                              </svg>
                            </span>
                            <span className="option-name">{option.name}</span>
                            <strong className="option-price">{option.price ? `+ ${formatPrice(config, option.price)}` : "Included"}</strong>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          ) : (
            <div className="empty detail-empty">
              This item has no API-provided variations yet. The base item can be added directly.
            </div>
          )}
          {error ? <p className="modal-error" role="alert">{error}</p> : null}
        </div>

        <aside className="panel product-detail-summary">
          <p className="eyebrow">Live total</p>
          <h2>{formatPrice(config, unitTotal * quantity)}</h2>
          <dl>
            <div>
              <dt>Base</dt>
              <dd>{formatPrice(config, basePrice)}</dd>
            </div>
            <div>
              <dt>Options</dt>
              <dd>{formatPrice(config, optionTotal)}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{quantity}</dd>
            </div>
          </dl>
          <div className="quantity-row">
            <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button" aria-label="Reduce quantity">-</button>
            <strong>{quantity}</strong>
            <button onClick={() => setQuantity((value) => value + 1)} type="button" aria-label="Increase quantity">+</button>
          </div>
          <button className="primary-cta" onClick={submit} type="button">Add to cart</button>
          <p className="muted">Final availability, fees, and payment rules are validated again during checkout.</p>
        </aside>
      </div>

          {relatedProducts.length ? (
            <section className="panel related-products">
          <SectionHeader title="You may also like" subtitle="Food-forward picks from the same live menu" />
          <div className="related-grid">
            {relatedProducts.map((item) => (
              <button className="related-card" key={item.id} onClick={() => onViewProduct(item)} type="button">
                <SafeImage src={item.imageUrl} alt="" fallbackText={item.name} />
                <span>{item.name}</span>
                <strong>{formatPrice(config, item.discountPrice ?? item.price)}</strong>
              </button>
            ))}
          </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FloatingCartDock({
  config,
  cart,
  total,
  openCart,
  setSection
}: {
  config: AppConfig | null;
  cart: CartLine[];
  total: number;
  openCart: () => void;
  setSection: (section: Section) => void;
}) {
  if (!cart.length) {
    return null;
  }

  return (
    <div className="floating-cart-dock" role="status">
      <button onClick={openCart} type="button">
        <span>{cart.length} item{cart.length === 1 ? "" : "s"}</span>
        <strong>{formatPrice(config, total)}</strong>
      </button>
      <button onClick={() => setSection("checkout")} type="button">
        Checkout
      </button>
    </div>
  );
}

function CartDrawer({
  config,
  cart,
  open,
  setCart,
  onClose,
  onReview
}: {
  config: AppConfig | null;
  cart: CartLine[];
  open: boolean;
  setCart: (value: CartLine[]) => void;
  onClose: () => void;
  onReview: () => void;
}) {
  function updateQty(key: string, quantity: number) {
    if (quantity <= 0) {
      setCart(cart.filter((line) => line.key !== key));
      return;
    }
    setCart(cart.map((line) => (line.key === key ? { ...line, quantity } : line)));
  }

  if (!open) {
    return null;
  }

  return (
    <aside className="cart-drawer-backdrop" aria-label="Cart drawer">
      <button className="cart-drawer-scrim" onClick={onClose} type="button" aria-label="Close cart" />
      <section className="cart-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
        <div className="cart-drawer-heading">
          <div>
            <p className="eyebrow">Your selection</p>
            <h2 id="cart-drawer-title">Cart</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Close cart">
            x
          </button>
        </div>

        <div className="cart-drawer-lines">
          {!cart.length ? <EmptyCartState config={config} compact /> : null}
          {cart.map((line) => (
            <article className="cart-drawer-line" key={line.key}>
              <div className="cart-thumb">
                <SafeImage src={line.product.imageUrl} alt="" fallbackText={line.product.name} />
              </div>
              <div>
                <h3>{line.product.name}</h3>
                <p>{formatPrice(config, lineUnitPrice(line))}</p>
              </div>
              <div className="qty">
                <button onClick={() => updateQty(line.key, line.quantity - 1)} type="button" aria-label={`Reduce ${line.product.name}`}>
                  -
                </button>
                <span>{line.quantity}</span>
                <button onClick={() => updateQty(line.key, line.quantity + 1)} type="button" aria-label={`Increase ${line.product.name}`}>
                  +
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="cart-drawer-footer">
          <div>
            <span>Subtotal</span>
            <strong>{formatPrice(config, cartTotal(cart))}</strong>
          </div>
          <button disabled={!cart.length} onClick={onReview} type="button">
            Review order
          </button>
        </div>
      </section>
    </aside>
  );
}

function VariationModal({
  product,
  config,
  onClose,
  onAdd
}: {
  product: Product;
  config: AppConfig | null;
  onClose: () => void;
  onAdd: (product: Product, selections: SelectionMap) => void;
}) {
  const [selections, setSelections] = useState<SelectionMap>({});
  const [error, setError] = useState<string | null>(null);
  const optionTotal = Object.values(selections)
    .flat()
    .reduce((sum, option) => sum + option.price, 0);
  const basePrice = product.discountPrice ?? product.price;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function toggle(group: ProductVariation, option: ProductOption) {
    setError(null);
    setSelections((current) => {
      const selected = current[group.id] ?? [];
      if (group.type === "single") {
        return { ...current, [group.id]: [option] };
      }

      const exists = selected.some((entry) => entry.id === option.id);
      if (exists) {
        return { ...current, [group.id]: selected.filter((entry) => entry.id !== option.id) };
      }
      if (selected.length >= group.max) {
        setError(`${group.name} allows up to ${group.max} option(s).`);
        return current;
      }
      return { ...current, [group.id]: [...selected, option] };
    });
  }

  function submit() {
    const validation = validateSelections(product, selections);
    if (validation) {
      setError(validation);
      return;
    }
    onAdd(product, selections);
  }

  return (
    <div className="modal-backdrop">
      <button className="modal-scrim" onClick={onClose} type="button" aria-label="Close item customization" />
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="variation-modal-title">
        <div className="modal-heading">
          <div className="modal-product-thumb">
            <SafeImage src={product.imageUrl} alt="" fallbackText={product.name} />
          </div>
          <div className="modal-product-copy">
            <p className="eyebrow">Make it yours</p>
            <h2 id="variation-modal-title">{product.name}</h2>
            <p>{product.description}</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
          </button>
        </div>

        <div className="modal-options">
          {product.variations.map((group, groupIndex) => {
            const selectedCount = selections[group.id]?.length ?? 0;
            const rule = group.type === "single"
              ? "Choose one"
              : group.min === 0
                ? `Choose up to ${group.max}`
              : group.min === group.max
                ? `Choose ${group.max}`
                : `Choose ${group.min}-${group.max}`;

            return (
              <fieldset className="option-group" key={group.id}>
                <legend>
                  <span className="option-group-number">{String(groupIndex + 1).padStart(2, "0")}</span>
                  <span className="option-group-title">
                    <strong>{group.name}</strong>
                    <small>{rule}</small>
                  </span>
                  <span className={`option-requirement ${group.required ? "required" : ""}`}>
                    {group.required ? "Required" : "Optional"}
                  </span>
                  {selectedCount ? <span className="option-selected-count">{selectedCount} selected</span> : null}
                </legend>
                <div className="option-list">
                  {group.values.map((option) => {
                    const checked = (selections[group.id] ?? []).some((entry) => entry.id === option.id);
                    return (
                      <label className={`option-row ${checked ? "selected" : ""}`} key={option.id}>
                        <input
                          type={group.type === "single" ? "radio" : "checkbox"}
                          name={group.id}
                          checked={checked}
                          onChange={() => toggle(group, option)}
                        />
                        <span className="option-choice-mark" aria-hidden="true">
                          <svg viewBox="0 0 16 16">
                            <path d="m3.5 8.2 2.7 2.7 6.3-6.3" />
                          </svg>
                        </span>
                        <span className="option-name">{option.name}</span>
                        <strong className="option-price">{option.price ? `+ ${formatPrice(config, option.price)}` : "Included"}</strong>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          {error ? <p className="modal-error" role="alert">{error}</p> : null}
        </div>

        <div className="modal-actions">
          <div className="modal-total">
            <span>Order total</span>
            <strong>{formatPrice(config, basePrice + optionTotal)}</strong>
            <small>{optionTotal ? `${formatPrice(config, basePrice)} base + selected options` : "Options update the total instantly"}</small>
          </div>
          <button className="modal-submit" onClick={submit} type="button">
            Add customized item
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function CartSection({
  config,
  cart,
  setCart,
  setSection,
  onEdit
}: {
  config: AppConfig | null;
  cart: CartLine[];
  setCart: (value: CartLine[]) => void;
  setSection: (section: Section) => void;
  onEdit: (product: Product) => void;
}) {
  const [promo, setPromo] = useState("");
  const subtotal = cartTotal(cart);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function updateQty(key: string, quantity: number) {
    if (quantity <= 0) {
      setCart(cart.filter((line) => line.key !== key));
      return;
    }
    setCart(cart.map((line) => (line.key === key ? { ...line, quantity } : line)));
  }

  return (
    <section className="two-column cart-screen">
      <div className="panel wide">
        <div className="section-heading">
          <p className="eyebrow">Order review</p>
          <h1>Your cart</h1>
          <p className="muted">Review quantities, selected options, and estimated subtotal before checkout validates fees and availability.</p>
        </div>
        {!cart.length ? <EmptyCartState config={config} /> : null}
        {cart.length ? (
          <div className="cart-line-stack">
            {cart.map((line) => (
              <article className="cart-line" key={line.key}>
                <div className="cart-thumb">
                  <SafeImage src={line.product.imageUrl} alt="" fallbackText={line.product.name} />
                </div>
                <div className="cart-line-copy">
                  <h2>{line.product.name}</h2>
                  {Object.entries(line.selections).length ? (
                    <div className="selected-options">
                      {Object.entries(line.selections).map(([groupId, options]) => (
                        <span key={groupId}>{options.map((option) => option.name).join(", ")}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Base item</p>
                  )}
                  <div className="cart-line-actions">
                    <button onClick={() => onEdit(line.product)} type="button">Edit options</button>
                    <button onClick={() => updateQty(line.key, 0)} type="button">Remove</button>
                  </div>
                </div>
                <div className="qty">
                  <button onClick={() => updateQty(line.key, line.quantity - 1)} type="button" aria-label={`Reduce ${line.product.name}`}>
                    -
                  </button>
                  <span>{line.quantity}</span>
                  <button onClick={() => updateQty(line.key, line.quantity + 1)} type="button" aria-label={`Increase ${line.product.name}`}>
                    +
                  </button>
                </div>
                <strong className="line-price">{formatPrice(config, lineUnitPrice(line) * line.quantity)}</strong>
              </article>
            ))}
          </div>
        ) : null}
      </div>
      <aside className="panel checkout-summary order-ticket">
        <p className="eyebrow">Order ticket</p>
        <h2>{formatPrice(config, subtotal)}</h2>
        <div className="promo-box">
          <label htmlFor="promo-code">Promo code</label>
          <div>
            <input id="promo-code" value={promo} onChange={(event) => setPromo(event.target.value)} placeholder="Enter code" />
            <button disabled={!promo.trim()} type="button">Apply</button>
          </div>
          <small>Promo validation needs a backend endpoint before discounts can be applied.</small>
        </div>
        <dl>
          <div>
            <dt>Items</dt>
            <dd>{itemCount}</dd>
          </div>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatPrice(config, subtotal)}</dd>
          </div>
          <div>
            <dt>Delivery / service fees</dt>
            <dd>At checkout</dd>
          </div>
          <div>
            <dt>Estimated total</dt>
            <dd>{formatPrice(config, subtotal)}</dd>
          </div>
        </dl>
        <p className="muted">Backend still owns final taxes, delivery fees, menu availability, and payment rules.</p>
        <button disabled={!cart.length} onClick={() => setSection("checkout")} type="button">
          Continue to checkout
        </button>
      </aside>
    </section>
  );
}

function AuthPanel({
  persistToken,
  visualImageUrl
}: {
  persistToken: (token: string | null) => void;
  visualImageUrl?: string | null;
}) {
  const [mode, setMode] = useState<"password" | "register">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [socialDraft, setSocialDraft] = useState<SocialProfile | null>(null);
  const [socialPhone, setSocialPhone] = useState("");
  const [socialBusy, setSocialBusy] = useState<SocialMedium | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let nextToken = "";
      if (mode === "password") {
        nextToken = await loginWithPassword(identifier, password);
      } else {
        nextToken = await registerWithOtp(name, phone, email);
      }

      if (!nextToken) {
        throw new Error("Login completed without a customer token.");
      }
      persistToken(nextToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function continueWithSocial(medium: Extract<SocialMedium, "google" | "facebook">) {
    setError(null);
    setSocialDraft(null);
    setSocialBusy(medium);
    try {
      const profile = medium === "google" ? await requestGoogleProfile() : await requestFacebookProfile();
      const result = await socialLogin({
        token: profile.token,
        uniqueId: profile.id,
        email: profile.email,
        medium: profile.medium
      });
      if (result.token) {
        persistToken(result.token);
        return;
      }
      if (!result.needsRegistration) {
        throw new Error("This social account needs backend verification before login can continue.");
      }
      setSocialDraft(profile);
      setName(profile.name);
      setEmail(profile.email);
      setMode("register");
    } catch (err) {
      setError(err instanceof Error ? err.message : `${medium} login failed.`);
    } finally {
      setSocialBusy(null);
    }
  }

  async function completeSocialRegistration(event: FormEvent) {
    event.preventDefault();
    if (!socialDraft) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await registerWithSocialMedia(socialDraft.name, socialPhone, socialDraft.email, socialDraft.medium);
      if (!token) {
        throw new Error("Social registration completed without a customer token.");
      }
      persistToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Social registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel auth-panel">
      <div className="auth-form-side">
        <div className="auth-intro">
          <p className="eyebrow">Customer access</p>
          <h1>{mode === "register" ? "Create your account" : "Welcome Back!"}</h1>
          <p className="muted">{mode === "register" ? "Sign up with your customer details to continue checkout." : "Sign in with your email or phone and password."}</p>
        </div>

        <div className="segmented auth-tabs">
          {(["password", "register"] as const).map((item) => (
            <button className={mode === item ? "active" : ""} onClick={() => setMode(item)} type="button" key={item}>
              {item === "password" ? "Login" : "Sign up"}
            </button>
          ))}
        </div>

        <form className="stack-form auth-form" onSubmit={socialDraft ? completeSocialRegistration : submit}>
          {socialDraft ? (
            <div className="social-complete-card">
              <span>{socialDraft.medium}</span>
              <strong>{socialDraft.name}</strong>
              <small>{socialDraft.email}</small>
              <p className="muted">Add a phone number to create your Ismak Foods account.</p>
              <input value={socialPhone} onChange={(event) => setSocialPhone(event.target.value)} placeholder="Phone" required />
            </div>
          ) : null}

          {!socialDraft && mode === "password" ? (
            <>
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email or phone" required />
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" required />
              <button className="forgot-password-link" type="button" disabled>
                Forgot password?
              </button>
            </>
          ) : null}

          {!socialDraft && mode === "register" ? (
            <>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required />
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" required />
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
            </>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}
          <button className="auth-submit" disabled={busy} type="submit">
            {busy ? "Working..." : socialDraft ? "Complete social signup" : mode === "register" ? "Create account" : "Login"}
          </button>
        </form>

        {!socialDraft ? (
          <div className="social-auth-block">
            <div className="auth-divider"><span /> <strong>or continue with</strong> <span /></div>
            <button className="social-auth-button" disabled={socialBusy !== null || !GOOGLE_CLIENT_ID} onClick={() => continueWithSocial("google")} type="button">
              <span className="social-mark google-mark">G</span>
              {socialBusy === "google" ? "Connecting Google..." : "Continue with Google"}
            </button>
            <button className="social-auth-button" disabled={socialBusy !== null || !FACEBOOK_APP_ID} onClick={() => continueWithSocial("facebook")} type="button">
              <span className="social-mark facebook-mark">f</span>
              {socialBusy === "facebook" ? "Connecting Facebook..." : FACEBOOK_APP_ID ? "Continue with Facebook" : "Facebook app ID required"}
            </button>
          </div>
        ) : null}

        <p className="auth-switch-copy">
          {socialDraft ? "Prefer password login?" : mode === "register" ? "Already have an account?" : "Do not have an account?"}
          <button onClick={() => {
            setSocialDraft(null);
            setMode(mode === "register" ? "password" : "register");
          }} type="button">
            {mode === "register" ? "Login now" : "Register now"}
          </button>
        </p>
      </div>

      <div className="auth-visual-side" aria-hidden="true">
        {visualImageUrl ? <SafeImage src={visualImageUrl} alt="" fallbackText="Ismak Foods" /> : <span>Ismak Foods</span>}
        <div className="auth-visual-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

function CheckoutSection({
  config,
  token,
  persistToken,
  cart,
  setCart,
  branchId,
  choices,
  total,
  authVisualUrl,
  setSection
}: {
  config: AppConfig | null;
  token: string | null;
  persistToken: (token: string | null) => void;
  cart: CartLine[];
  setCart: (cart: CartLine[]) => void;
  branchId: number | null;
  choices: PaymentChoice[];
  total: number;
  authVisualUrl?: string | null;
  setSection: (section: Section) => void;
}) {
  const [addresses, setAddresses] = useState<{ id: number; label: string; address: string; contactName: string; contactPhone: string }[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>({ label: "Home", address: "", contactName: "", contactPhone: "" });
  const [orderType, setOrderType] = useState<"delivery" | "take_away">("delivery");
  const [paymentKey, setPaymentKey] = useState<PaymentChoice["key"] | "">("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [order, setOrder] = useState<OrderPlacementResult | null>(null);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [submittedCart, setSubmittedCart] = useState<CartLine[]>([]);
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedChoice = choices.find((choice) => choice.key === paymentKey) ?? choices[0];
  const gateway = activeGateway(config);
  const summaryCart = order ? submittedCart : cart;
  const summaryTotal = order ? submittedTotal : total;

  useEffect(() => {
    if (!choices.length) {
      setPaymentKey("");
      return;
    }
    setPaymentKey((current) => (choices.some((choice) => choice.key === current) ? current : choices[0].key));
  }, [choices]);

  useEffect(() => {
    if (!token) {
      return;
    }
    fetchAddresses(token)
      .then((items) => {
        setAddresses(items);
        setAddressId(items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? null);
      })
      .catch(() => setAddresses([]));
  }, [token]);

  useEffect(() => {
    if (!token || paymentState !== "waiting_for_payment" || !order) {
      return;
    }

    const timer = window.setInterval(() => {
      fetchPaymentStatus({
        token,
        orderId: order.orderId,
        statusUrl: paymentSession?.statusUrl,
        endpoint: gateway?.statusEndpoint
      })
        .then((status) => {
          setPaymentStatus(status);
          const state = status.state || status.paymentStatus;
          if (state === "paid" || status.paymentStatus === "paid") {
            setPaymentState("paid");
            window.clearInterval(timer);
          } else if (["failed", "cancelled", "expired"].includes(state) || ["failed", "cancelled"].includes(status.paymentStatus)) {
            setPaymentState(state as PaymentState);
            window.clearInterval(timer);
          }
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Payment status refresh failed."));
    }, 7000);

    return () => window.clearInterval(timer);
  }, [token, paymentState, order, paymentSession?.statusUrl, gateway?.statusEndpoint]);

  if (!token) {
    return (
      <section className="auth-page-shell">
        <AuthPanel persistToken={persistToken} visualImageUrl={authVisualUrl} />
      </section>
    );
  }

  async function saveAddress() {
    if (!token) {
      return;
    }
    setError(null);
    try {
      await addAddress(token, addressForm);
      const next = await fetchAddresses(token);
      setAddresses(next);
      setAddressId(next[next.length - 1]?.id ?? null);
      setAddressForm({ label: "Home", address: "", contactName: "", contactPhone: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Address could not be saved.");
    }
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    if (!token || !branchId || !selectedChoice) {
      return;
    }
    if (!cart.length) {
      setError("Cart is empty.");
      return;
    }
    if (orderType === "delivery" && !addressId) {
      setError("Select or add a delivery address.");
      return;
    }
    if (selectedChoice.digital && selectedChoice.initiationMethod === "mobile_money" && !phone.trim()) {
      setError("Enter the mobile money phone number.");
      return;
    }

    setError(null);
    setPaymentStatus(null);
    setPaymentSession(null);
    setSubmittedCart(cart);
    setSubmittedTotal(total);

    try {
      setPaymentState("placing_order");
      const placed = await placeOrder({
        token,
        branchId,
        cart: cartPayload(cart),
        orderAmount: total,
        paymentMethod: selectedChoice.methodForOrder,
        orderType,
        deliveryAddressId: orderType === "delivery" ? addressId : null,
        orderNote: note
      });
      setOrder(placed);
      setPaymentState("order_created");

      if (!selectedChoice.digital) {
        setPaymentState("manual_review_if_offline");
        setCart([]);
        return;
      }

      setPaymentState("initiating_payment");
      const session = await initiatePayment({
        token,
        endpoint: gateway?.checkoutEndpoint ?? "/payment/initiate",
        orderId: placed.orderId,
        method: selectedChoice.initiationMethod ?? "card",
        phone
      });
      setPaymentSession(session);

      if (session.checkoutUrl) {
        setPaymentState("redirecting_to_gateway");
        window.location.assign(session.checkoutUrl);
        return;
      }

      setPaymentState("waiting_for_payment");
    } catch (err) {
      setPaymentState("failed");
      setError(err instanceof Error ? err.message : "Checkout failed.");
    }
  }

  return (
    <section className="checkout-layout">
      <form className="panel checkout-panel" onSubmit={submitOrder}>
        <div className="section-heading">
          <p className="eyebrow">Secure checkout</p>
          <h1>Checkout</h1>
          <p className="muted">Choose fulfillment, confirm payment, and place the order with the authenticated customer token.</p>
        </div>
        <div className="checkout-progress" aria-label="Checkout progress">
          <span className="active">Cart</span>
          <span className={orderType ? "active" : ""}>Fulfillment</span>
          <span className={selectedChoice ? "active" : ""}>Payment</span>
          <span className={order ? "active" : ""}>Confirmed</span>
        </div>

        <section className="subsection checkout-choice-section">
          <div>
            <h2>Fulfillment</h2>
            <p className="muted">Use delivery when an address is saved, or pickup from the selected branch.</p>
          </div>
          <div className="fulfillment-toggle">
            {config?.delivery ? (
              <button className={orderType === "delivery" ? "active" : ""} onClick={() => setOrderType("delivery")} type="button">
                <strong>Delivery</strong>
                <span>Send to saved address</span>
              </button>
            ) : null}
            {config?.selfPickup ? (
              <button className={orderType === "take_away" ? "active" : ""} onClick={() => setOrderType("take_away")} type="button">
                <strong>Pickup</strong>
                <span>Collect from branch</span>
              </button>
            ) : null}
          </div>
        </section>

        {orderType === "delivery" ? (
          <section className="subsection">
            <h2>Delivery address</h2>
            {addresses.length ? (
              <select value={addressId ?? ""} onChange={(event) => setAddressId(Number(event.target.value))}>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label}: {address.address}
                  </option>
                ))}
              </select>
            ) : (
              <p className="muted">No saved addresses yet.</p>
            )}
            <div className="address-form">
              <input value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} placeholder="Label" required />
              <input value={addressForm.address} onChange={(event) => setAddressForm({ ...addressForm, address: event.target.value })} placeholder="Address" required />
              <input value={addressForm.contactName} onChange={(event) => setAddressForm({ ...addressForm, contactName: event.target.value })} placeholder="Contact name" required />
              <input value={addressForm.contactPhone} onChange={(event) => setAddressForm({ ...addressForm, contactPhone: event.target.value })} placeholder="Contact phone" required />
              <button onClick={saveAddress} type="button">Save address</button>
            </div>
          </section>
        ) : null}

        <section className="subsection">
          <div>
            <h2>Payment</h2>
            <p className="muted">{gateway ? `${gateway.gatewayTitle} ready for digital checkout.` : "Cash/offline checkout follows the active restaurant config."}</p>
          </div>
          {!choices.length ? (
            <p className="form-error">No checkout payment methods are enabled by config.</p>
          ) : null}
          <div className="payment-list">
            {choices.map((choice) => (
              <label className="payment-option" key={choice.key}>
                <input
                  checked={paymentKey === choice.key}
                  onChange={() => setPaymentKey(choice.key)}
                  type="radio"
                  name="payment"
                />
                <span>
                  <strong>{choice.label}</strong>
                  <small>{choice.description}</small>
                </span>
              </label>
            ))}
          </div>
          {selectedChoice?.key === "mobile_money" ? (
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile money phone number" />
          ) : null}
        </section>

        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Order note for the kitchen or rider" />
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-cta" disabled={!cart.length || !selectedChoice || paymentState === "placing_order" || paymentState === "initiating_payment"} type="submit">
          {paymentState === "placing_order" ? "Placing order..." : paymentState === "initiating_payment" ? "Starting payment..." : "Place order"}
        </button>
      </form>

      <aside className="panel status-panel checkout-order-summary">
        <p className="eyebrow">{order ? "Order confirmation" : "Order summary"}</p>
        {order ? (
          <div className="confirmation-card">
            <span className={`state-pill ${statusTone(paymentState)}`}>{paymentState.replaceAll("_", " ")}</span>
            <h2>Order #{order.orderId}</h2>
            <p>{paymentState === "paid" ? "Payment confirmed." : paymentState === "manual_review_if_offline" ? "Order placed for offline settlement." : "Order placed. Payment/status updates continue below."}</p>
          </div>
        ) : (
          <h2>{formatPrice(config, summaryTotal)}</h2>
        )}
        <div className="summary-lines">
          {summaryCart.map((line) => (
            <div key={line.key}>
              <span>{line.quantity} x {line.product.name}</span>
              <strong>{formatPrice(config, lineUnitPrice(line) * line.quantity)}</strong>
            </div>
          ))}
          {!summaryCart.length ? <p className="muted">Cart is empty. Add items before checkout.</p> : null}
        </div>
        <dl>
          <div>
            <dt>Total</dt>
            <dd>{formatPrice(config, summaryTotal)}</dd>
          </div>
          <div>
            <dt>Order</dt>
            <dd>{order?.orderId ?? "Not placed"}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>{paymentStatus?.paymentStatus ?? order?.paymentStatus ?? "Not started"}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{paymentStatus?.transactionReference ?? order?.transactionReference ?? paymentSession?.reference ?? "Pending"}</dd>
          </div>
        </dl>
        {paymentSession?.message ? <p className="muted">{paymentSession.message}</p> : null}
        {paymentState === "waiting_for_payment" ? <p className="muted">Payment status refreshes every 7 seconds.</p> : null}
        {["failed", "cancelled", "expired"].includes(paymentState) ? <p className="form-error">Payment did not complete. Keep the order reference visible and retry from the supported payment flow.</p> : null}
        {paymentState === "paid" || paymentState === "manual_review_if_offline" ? <button onClick={() => setSection("orders")} type="button">View orders</button> : null}
        <div className="state-coverage">
          <span>States handled</span>
          <small>pending / paid / failed / cancelled / offline review</small>
        </div>
      </aside>
    </section>
  );
}

function OrdersSection({
  config,
  token,
  persistToken,
  authVisualUrl
}: {
  config: AppConfig | null;
  token: string | null;
  persistToken: (token: string | null) => void;
  authVisualUrl?: string | null;
}) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    setLoading(true);
    fetchOrders(token)
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : "Orders could not be loaded."))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) {
    return (
      <section className="auth-page-shell">
        <AuthPanel persistToken={persistToken} visualImageUrl={authVisualUrl} />
      </section>
    );
  }

  async function openDetails(orderId: number) {
    if (!token) {
      return;
    }
    setError(null);
    setDetails(null);
    try {
      setDetails(await fetchOrderDetails(token, orderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order details could not be loaded.");
    }
  }

  return (
    <section className="two-column orders-page">
      <div className="panel wide">
        <div className="section-heading">
          <p className="eyebrow">Order history</p>
          <h1>Your orders</h1>
          <p className="muted">Track payment state, kitchen progress, and receipt details from the customer API.</p>
        </div>
        {loading ? <div className="empty">Loading orders...</div> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loading && !orders.length ? (
          <div className="empty order-empty">
            <span>No orders yet</span>
            <strong>Your first receipt will appear here after checkout.</strong>
          </div>
        ) : null}
        {orders.length ? (
          <div className="order-list">
            {orders.map((order) => (
              <article className="order-row" key={order.id}>
                <div className="order-row-main">
                  <span className={`status-dot ${statusTone(order.paymentStatus) === "success" ? "positive" : ""}`} />
                  <div>
                    <h2>Order #{order.id}</h2>
                    <p className="muted">
                      {order.status} / {order.paymentStatus}
                    </p>
                  </div>
                </div>
                <strong>{formatPrice(config, order.amount)}</strong>
                <button onClick={() => openDetails(order.id)} type="button">
                  View receipt
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </div>
      <aside className="panel status-panel order-receipt-panel">
        <p className="eyebrow">Details and tracking</p>
        {details ? (
          <>
            <div className="receipt-heading">
              <div>
                <h2>Order #{details.id}</h2>
                <p className="muted">Receipt summary</p>
              </div>
              <p className={`state-pill ${statusTone(details.paymentStatus)}`}>{details.paymentStatus}</p>
            </div>
            <div className="order-timeline">
              {["pending", "paid", "preparing"].map((step) => (
                <span className={details.paymentStatus === step || details.status === step ? "active" : ""} key={step}>{step}</span>
              ))}
            </div>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{details.status}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatPrice(config, details.totalAmount)}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{details.transactionReference ?? "Pending"}</dd>
              </div>
            </dl>
            <div className="receipt-items">
              {details.items.map((item, index) => (
                <div key={`${item.name}-${index}`}>
                  <span>{item.quantity} x {item.name}</span>
                  <strong>{formatPrice(config, item.totalPrice)}</strong>
                </div>
              ))}
            </div>
            <p className="muted">Estimated delivery time should come from the order details API when backend exposes rider/kitchen timing.</p>
          </>
        ) : (
          <div className="empty receipt-placeholder">
            <span>Receipt</span>
            <strong>Choose an order to inspect its current state.</strong>
          </div>
        )}
      </aside>
    </section>
  );
}

function ProfileSection({
  config,
  token,
  persistToken,
  setSection,
  authVisualUrl
}: {
  config: AppConfig | null;
  token: string | null;
  persistToken: (token: string | null) => void;
  setSection: (section: Section) => void;
  authVisualUrl?: string | null;
}) {
  const [addresses, setAddresses] = useState<{ id: number; label: string; address: string; contactName: string; contactPhone: string }[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);

  useEffect(() => {
    if (!token) {
      setAddresses([]);
      setOrders([]);
      return;
    }
    fetchAddresses(token).then(setAddresses).catch(() => setAddresses([]));
    fetchOrders(token).then(setOrders).catch(() => setOrders([]));
  }, [token]);

  if (!token) {
    return (
      <section className="auth-page-shell account-page">
        <AuthPanel persistToken={persistToken} visualImageUrl={authVisualUrl} />
      </section>
    );
  }

  return (
    <section className="profile-panel account-dashboard">
      <div className="panel account-hero-card">
        <p className="eyebrow">Account dashboard</p>
        <h1>Welcome back</h1>
        <p className="muted">Manage order history, saved delivery addresses, and the active browser session.</p>
        <div className="account-actions">
          <button onClick={() => setSection("orders")} type="button">View orders</button>
          <button onClick={() => setSection("checkout")} type="button">Checkout</button>
          <button
            onClick={() => {
              persistToken(null);
              setSection("menu");
            }}
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="account-grid">
        <article className="panel account-stat-card">
          <span className="status-dot positive" />
          <p className="eyebrow">Session</p>
          <h2>Authenticated</h2>
          <p className="muted">Bearer token is stored in sessionStorage for this browser session.</p>
        </article>
        <article className="panel account-stat-card">
          <span className="status-dot" />
          <p className="eyebrow">Saved addresses</p>
          <h2>{addresses.length}</h2>
          <p className="muted">{addresses.length ? addresses.map((address) => address.label).join(", ") : "Add an address during checkout."}</p>
        </article>
        <article className="panel account-stat-card">
          <span className="status-dot" />
          <p className="eyebrow">Order history</p>
          <h2>{orders.length}</h2>
          <p className="muted">{orders.length ? `${orders[0].status} latest order status` : "Order list and receipt details load from customer endpoints."}</p>
        </article>
      </div>
      <div className="account-lists">
        <section className="panel account-list-card">
          <SectionHeader title="Saved addresses" subtitle="Used by delivery checkout" />
          {addresses.length ? addresses.slice(0, 3).map((address) => (
            <article key={address.id}>
              <strong>{address.label}</strong>
              <span>{address.address}</span>
              <small>{address.contactName} / {address.contactPhone}</small>
            </article>
          )) : <p className="muted">No saved addresses yet. Add one during checkout.</p>}
        </section>
        <section className="panel account-list-card">
          <SectionHeader title="Recent orders" subtitle="Receipt details stay in order history" />
          {orders.length ? orders.slice(0, 3).map((order) => (
            <article key={order.id}>
              <strong>Order #{order.id}</strong>
              <span>{formatPrice(config, order.amount)}</span>
              <small>{order.status} / {order.paymentStatus}</small>
            </article>
          )) : <p className="muted">No recent orders yet.</p>}
        </section>
      </div>
    </section>
  );
}
