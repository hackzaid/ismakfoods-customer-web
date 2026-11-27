"use client";

import { Check, ChevronRight, HelpCircle, Info, MapPin, Phone, Receipt, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { fetchAddresses, fetchCustomerInfo, fetchOrderDetails, fetchOrders, type Address, type CustomerInfo, type OrderDetails, type OrderSummary } from "@/lib/api";
import { formatOrderDate, formatPrice, pluralize } from "@/lib/format";
import { actions, useStore } from "@/lib/store";
import { useConfig } from "./config-context";
import { TopBar } from "./top-bar";
import { Alert, Badge, Button, ButtonLink, type Tone } from "./ui";

const STATUS: Record<string, [string, Tone]> = {
  pending: ["Pending", "neutral"],
  confirmed: ["Confirmed", "info"],
  processing: ["Preparing", "info"],
  cooking: ["Preparing", "info"],
  done: ["Ready", "info"],
  out_for_delivery: ["On the way", "info"],
  delivered: ["Delivered", "success"],
  canceled: ["Cancelled", "danger"],
  cancelled: ["Cancelled", "danger"],
  failed: ["Failed", "danger"],
  returned: ["Returned", "neutral"]
};

export function statusBadge(status: string) {
  const [label, tone] = STATUS[status] ?? [status.replaceAll("_", " "), "neutral" as Tone];
  return <Badge tone={tone}>{label}</Badge>;
}

const ACTIVE = new Set(["pending", "confirmed", "processing", "cooking", "done", "out_for_delivery"]);

/** Redirects to sign-in when there is no session; returns the token once the store has loaded. */
function useAuthToken() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, ready } = useStore();
  useEffect(() => {
    if (ready && !token) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [ready, token, router, pathname]);
  return ready ? token : null;
}

function useLoad<T>(token: string | null, load: (token: string) => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: string | null; key: string | null }>({ data: null, error: null, key: null });
  const key = token ? JSON.stringify([token, ...deps]) : null;
  useEffect(() => {
    if (!token || !key) return;
    let alive = true;
    load(token)
      .then((data) => alive && setState({ data, error: null, key }))
      .catch((err) => {
        if (!alive) return;
        if (err?.status === 401) actions.setToken(null);
        setState({ data: null, error: err instanceof Error ? err.message : "This could not be loaded.", key });
      });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!key && !current };
}

const NAV = [
  { href: "/account/orders", label: "My orders" },
  { href: "/account/addresses", label: "Saved addresses" },
  { href: "/account", label: "Account details" },
  { href: "/contact", label: "Help and contact" }
];

function AccountShell({ title, mobileTitle, backHref, children }: { title: string; mobileTitle?: string; backHref?: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="page page--subtle">
      <TopBar title={mobileTitle ?? title} backHref={backHref} />
      <div className="container">
        <div className="account">
          <nav className="account-nav" aria-label="Account">
            <p className="t-heading-md" style={{ marginBottom: 12 }}>Account</p>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} aria-current={pathname === item.href || (item.href === "/account/orders" && pathname.startsWith("/account/orders/")) ? "page" : undefined}>{item.label}</Link>
            ))}
            <button type="button" className="text-link" style={{ alignSelf: "flex-start", marginTop: 16, padding: "0 12px" }} onClick={() => { actions.setToken(null); router.push("/"); }}>Sign out</button>
          </nav>
          <div className="stack gap-2xl" style={{ paddingTop: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return <div className="stack gap-md"><div className="skeleton" style={{ height: 88 }} /><div className="skeleton" style={{ height: 88 }} /></div>;
}

/* ---------------- Orders ---------------- */

function OrderRow({ order }: { order: OrderSummary }) {
  const config = useConfig();
  const meta = [formatOrderDate(order.createdAt), order.itemCount ? pluralize(order.itemCount, "item") : null, formatPrice(config, order.amount)].filter(Boolean).join(" · ");
  return (
    <Link href={`/account/orders/${order.id}`} className="order-row">
      <div className="order-row__text">
        <div className="row"><span className="t-strong">Order #{order.id}</span>{statusBadge(order.status)}</div>
        <span className="t-body-sm c-secondary">{meta}</span>
      </div>
      <ChevronRight aria-hidden />
    </Link>
  );
}

export function OrdersView() {
  const token = useAuthToken();
  const { data, error, loading } = useLoad(token, fetchOrders);
  const active = (data ?? []).filter((order) => ACTIVE.has(order.status));
  const past = (data ?? []).filter((order) => !ACTIVE.has(order.status));
  return (
    <AccountShell title="My orders" backHref="/account">
      <h1 className="t-heading-xl desktop-only">My orders</h1>
      {loading || !token ? <Loading /> : null}
      {error ? <Alert tone="danger" title="Your orders could not be loaded">{error}</Alert> : null}
      {data && !data.length ? (
        <div className="empty">
          <Receipt aria-hidden />
          <p className="t-heading-sm">No orders yet</p>
          <p className="c-secondary">When you place an order it will appear here.</p>
          <ButtonLink href="/menu" variant="secondary">Browse the menu</ButtonLink>
        </div>
      ) : null}
      {[["Active", active], ["Past orders", past]].map(([label, list]) =>
        (list as OrderSummary[]).length ? (
          <section key={label as string} className="card card--tight card--flat-mobile">
            <h2 className="t-label-sm c-tertiary" style={{ textTransform: "uppercase", paddingTop: 8 }}>{label as string}</h2>
            {(list as OrderSummary[]).map((order) => <OrderRow key={order.id} order={order} />)}
          </section>
        ) : null
      )}
    </AccountShell>
  );
}

const STEPS: { label: string; reached: string[] }[] = [
  { label: "Order placed", reached: ["pending", "confirmed", "processing", "cooking", "done", "out_for_delivery", "delivered"] },
  { label: "Confirmed", reached: ["confirmed", "processing", "cooking", "done", "out_for_delivery", "delivered"] },
  { label: "Preparing", reached: ["processing", "cooking", "done", "out_for_delivery", "delivered"] },
  { label: "On the way", reached: ["out_for_delivery", "delivered"] },
  { label: "Delivered", reached: ["delivered"] }
];

function Timeline({ status }: { status: string }) {
  const lastReached = STEPS.reduce((last, step, index) => (step.reached.includes(status) ? index : last), -1);
  return (
    <ol className="timeline">
      {STEPS.map((step, index) => {
        const state = index < lastReached || status === "delivered" ? "done" : index === lastReached ? "current" : "upcoming";
        return (
          <li key={step.label} className={`timeline__step timeline__step--${state}`} aria-current={state === "current" ? "step" : undefined}>
            <div className="timeline__rail">
              <span className="timeline__dot">{state === "done" ? <Check aria-hidden strokeWidth={3} /> : null}</span>
              {index < STEPS.length - 1 ? <span className="timeline__line" /> : null}
            </div>
            <div className="timeline__text"><span className="timeline__title t-strong">{step.label}</span></div>
          </li>
        );
      })}
    </ol>
  );
}

const HEADLINE: Record<string, string> = {
  pending: "Waiting for the branch to confirm",
  confirmed: "Your order is confirmed",
  processing: "Preparing your order",
  cooking: "Preparing your order",
  done: "Your order is ready",
  out_for_delivery: "Your order is on the way",
  delivered: "Delivered. Enjoy your meal",
  canceled: "This order was cancelled",
  cancelled: "This order was cancelled",
  failed: "This order could not be completed"
};

export function OrderDetailView({ orderId }: { orderId: number }) {
  const config = useConfig();
  const params = useSearchParams();
  const token = useAuthToken();
  const { data, error, loading } = useLoad<OrderDetails>(token, (t) => fetchOrderDetails(t, orderId), [orderId]);
  const stopped = data && ["canceled", "cancelled", "failed", "returned"].includes(data.status);
  return (
    <AccountShell title={`Order #${orderId}`} backHref="/account/orders">
      {params.get("placed") ? <Alert tone="success" title="Order placed">Thank you. The branch has received your order.</Alert> : null}
      <div className="row gap-md desktop-only"><h1 className="t-heading-xl">Order #{orderId}</h1>{data ? statusBadge(data.status) : null}</div>
      {loading || !token ? <Loading /> : null}
      {error ? <Alert tone="danger" title="This order could not be loaded">{error}</Alert> : null}
      {data ? (
        <div className="two-col">
          <section className="card card--flat-mobile">
            <div className="stack gap-xs">
              <h2 className="t-heading-md">{HEADLINE[data.status] ?? "Order update"}</h2>
              <p className="c-secondary">Payment: {data.paymentMethod ? data.paymentMethod.replaceAll("_", " ") : "not set"} · {data.paymentStatus === "paid" ? "Paid" : "Not paid yet"}</p>
            </div>
            {stopped ? null : <Timeline status={data.status} />}
            {config?.phone ? <a href={`tel:${config.phone.replace(/\s+/g, "")}`} className="btn btn--secondary" style={{ alignSelf: "flex-start" }}><Phone aria-hidden />Call {config.phone}</a> : null}
          </section>
          <aside className="two-col__aside card card--flat-mobile">
            <h2 className="t-heading-sm">Items</h2>
            <div>
              {data.items.map((item, index) => (
                <div className="cart-line" key={index}>
                  <div className="cart-line__body">
                    <div className="cart-line__top"><span className="t-strong">{item.quantity} × {item.name}</span><span className="t-strong">{formatPrice(config, item.totalPrice)}</span></div>
                    {item.variations.length ? <span className="t-body-sm c-secondary">{item.variations.join(", ")}</span> : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="summary__total"><span>Total</span><span className="t-price-lg">{formatPrice(config, data.totalAmount)}</span></div>
          </aside>
        </div>
      ) : null}
    </AccountShell>
  );
}

/* ---------------- Account and addresses ---------------- */

export function AccountView() {
  const token = useAuthToken();
  const router = useRouter();
  const { data, loading } = useLoad<CustomerInfo>(token, fetchCustomerInfo);
  const rows = [
    { href: "/account/orders", icon: ShoppingBag, title: "My orders" },
    { href: "/account/addresses", icon: MapPin, title: "Saved addresses" },
    { href: "/contact", icon: HelpCircle, title: "Help and contact" },
    { href: "/terms", icon: Info, title: "Terms and privacy" }
  ];
  return (
    <AccountShell title="Account details" mobileTitle="Account" backHref="/">
      <h1 className="t-heading-xl desktop-only">Account details</h1>
      <section className="card card--flat-mobile" style={{ background: "var(--color-bg-page)" }}>
        {loading || !data ? <div className="skeleton" style={{ height: 72 }} /> : (
          <div className="stack gap-xs">
            <p className="t-heading-md">{data.name || "Your account"}</p>
            {data.phone ? <p className="c-secondary">{data.phone}</p> : null}
            {data.email ? <p className="c-secondary">{data.email}</p> : null}
          </div>
        )}
      </section>
      <nav className="card card--tight card--flat-mobile" aria-label="Account shortcuts">
        {rows.map((row) => (
          <Link key={row.href} href={row.href} className="list-row">
            <row.icon aria-hidden />
            <span className="list-row__text t-strong">{row.title}</span>
            <ChevronRight aria-hidden />
          </Link>
        ))}
      </nav>
      <Button variant="secondary" size="lg" block onClick={() => { actions.setToken(null); router.push("/"); }}>Sign out</Button>
    </AccountShell>
  );
}

export function AddressesView() {
  const token = useAuthToken();
  const { data, error, loading } = useLoad<Address[]>(token, fetchAddresses);
  return (
    <AccountShell title="Saved addresses" backHref="/account">
      <h1 className="t-heading-xl desktop-only">Saved addresses</h1>
      {loading || !token ? <Loading /> : null}
      {error ? <Alert tone="danger" title="Your addresses could not be loaded">{error}</Alert> : null}
      {data && !data.length ? <div className="empty"><MapPin aria-hidden /><p className="t-heading-sm">No saved addresses</p><p className="c-secondary">Add one at checkout and it will be saved here.</p></div> : null}
      {data?.length ? (
        <section className="card card--tight card--flat-mobile">
          {data.map((address) => (
            <div className="list-row" key={address.id}>
              <MapPin aria-hidden />
              <div className="list-row__text">
                <span className="row t-strong">{address.label}{address.isDefault ? <Badge>Default</Badge> : null}</span>
                <span className="t-body-sm c-secondary">{[address.address, address.contactName, address.contactPhone].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </AccountShell>
  );
}
