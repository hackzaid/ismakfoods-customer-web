"use client";

import { Clock, Plus, Smartphone, Store, Truck, XCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { addAddress, fetchAddresses, fetchPaymentStatus, initiatePayment, placeOrder, type Address } from "@/lib/api";
import { cartCount, cartPayload, cartTotal } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { activeGateway, clearPendingCheckout, paymentChoices, savePendingCheckout, usePendingCheckout, type PendingCheckout } from "@/lib/payments";
import { actions, useStore } from "@/lib/store";
import { CartLineItem, EmptyCart, OrderSummary } from "./cart";
import { useBranch, useConfig } from "./config-context";
import { TopBar } from "./top-bar";
import { Alert, Badge, Button, ButtonLink, Option, TextArea, TextField } from "./ui";

function useDeliveryLabel() {
  const config = useConfig();
  const { fulfilment } = useStore();
  if (fulfilment === "take_away") return { label: "Pickup", amount: 0 };
  const amount = config?.deliveryCharge ?? 0;
  return { label: amount > 0 ? formatPrice(config, amount) : "Free", amount };
}

/* ---------------- Cart ---------------- */

export function CartView() {
  const config = useConfig();
  const branch = useBranch();
  const { cart, fulfilment, ready } = useStore();
  const count = cartCount(cart);
  const subtotal = cartTotal(cart);
  return (
    <div className="page page--subtle">
      <TopBar title="Your cart" backHref="/menu" />
      <div className="container">
        <div className="page-head desktop-only"><h1 className="t-heading-xl">Your cart</h1></div>
        {!ready ? null : !cart.length ? <EmptyCart /> : (
          <div className="two-col">
            <div className="card card--flat-mobile">
              {branch ? (
                <div className="row gap-md" style={{ padding: "12px 16px", background: "var(--color-bg-subtle)", borderRadius: 8 }}>
                  {fulfilment === "take_away" ? <Store aria-hidden width={20} color="var(--color-text-brand)" /> : <Truck aria-hidden width={20} color="var(--color-text-brand)" />}
                  <div className="stack" style={{ flex: 1 }}>
                    <span className="t-strong">{fulfilment === "take_away" ? "Pickup" : "Delivery"}</span>
                    <span className="t-body-sm c-secondary">{fulfilment === "take_away" ? "Collect from" : "From"} {branch.name}</span>
                  </div>
                  <button type="button" className="text-link" onClick={() => actions.setFulfilment(fulfilment === "take_away" ? "delivery" : "take_away")}>
                    Switch to {fulfilment === "take_away" ? "delivery" : "pickup"}
                  </button>
                </div>
              ) : null}
              <div>{cart.map((line) => <CartLineItem key={line.key} line={line} />)}</div>
              <div><ButtonLink href="/menu" variant="ghost" icon={Plus}>Add more items</ButtonLink></div>
            </div>
            <div className="two-col__aside stack gap-lg">
              <OrderSummary count={count} subtotal={subtotal} delivery="Calculated at checkout" total={subtotal} />
              <div className="action-bar" style={{ position: "static", padding: 0, border: 0, boxShadow: "none", background: "none" }}>
                <ButtonLink href="/checkout" size="lg" block>Go to checkout · {formatPrice(config, subtotal)}</ButtonLink>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Checkout ---------------- */

function AddressForm({ token, onSaved, onCancel }: { token: string; onSaved: () => void; onCancel?: () => void }) {
  const [form, setForm] = useState({ label: "Home", address: "", contactName: "", contactPhone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!form.address.trim() || !form.contactName.trim() || !form.contactPhone.trim()) {
      setError("Fill in the address, contact name and phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addAddress(token, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The address could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack gap-md" style={{ padding: 16, border: "1px solid var(--color-border-default)", borderRadius: 8 }}>
      <p className="t-heading-sm">New address</p>
      <TextField label="Label" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} help="For example: Home or Office" />
      <TextField label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Plot, street and area" autoComplete="street-address" />
      <TextField label="Contact name" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} autoComplete="name" />
      <TextField label="Contact phone" type="tel" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} placeholder="07XX XXX XXX" autoComplete="tel" />
      {error ? <Alert tone="danger" title={error} /> : null}
      <div className="row">
        <Button type="button" onClick={save} loading={busy}>Save address</Button>
        {onCancel ? <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </div>
  );
}

export function CheckoutView() {
  const config = useConfig();
  const branch = useBranch();
  const router = useRouter();
  const { cart, token, fulfilment, ready } = useStore();
  const choices = paymentChoices(config);
  const gateway = activeGateway(config);
  const delivery = useDeliveryLabel();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [paymentKey, setPaymentKey] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"placing" | "paying" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subtotal = cartTotal(cart);
  const total = subtotal + delivery.amount;
  const selected = choices.find((choice) => choice.key === paymentKey) ?? choices[0];
  const canDeliver = config?.delivery !== false;
  const canPickup = config?.selfPickup !== false;
  const unpaid = usePendingCheckout();

  useEffect(() => {
    if (ready && !token) router.replace("/sign-in?next=/checkout");
  }, [ready, token, router]);

  function loadAddresses(selectId?: number) {
    if (!token) return;
    fetchAddresses(token)
      .then((items) => {
        setAddresses(items);
        setAddressId((current) => selectId ?? current ?? items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? null);
      })
      .catch(() => setAddresses([]));
  }
  useEffect(loadAddresses, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || !branch || !selected || busy) return;
    if (fulfilment === "delivery" && !addressId) return setError("Choose or add a delivery address.");
    if (selected.initiationMethod === "mobile_money" && phone.replace(/\D/g, "").length < 9) return setError("Enter the mobile money number that should receive the payment prompt.");
    setError(null);
    setBusy("placing");
    try {
      const placed = await placeOrder({
        token,
        branchId: branch.id,
        cart: cartPayload(cart),
        orderAmount: subtotal,
        paymentMethod: selected.methodForOrder,
        orderType: fulfilment,
        deliveryAddressId: fulfilment === "delivery" ? addressId : null,
        orderNote: note
      });
      if (!placed.orderId) throw new Error("The order could not be confirmed. Please try again.");
      actions.clearCart();
      if (!selected.digital || !selected.initiationMethod) {
        router.push(`/account/orders/${placed.orderId}?placed=1`);
        return;
      }
      const pending: PendingCheckout = { orderId: placed.orderId, amount: placed.amount || total, method: selected.initiationMethod, phone };
      savePendingCheckout(pending);
      setBusy("paying");
      try {
        const session = await initiatePayment({ token, endpoint: gateway?.checkoutEndpoint ?? "/payment/initiate", orderId: placed.orderId, method: pending.method, phone });
        if (session.checkoutUrl) {
          window.location.assign(session.checkoutUrl);
          return;
        }
      } catch {
        // The order exists; the payment page offers a retry.
      }
      router.push(`/checkout/${placed.orderId}/payment`);
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "Your order could not be placed. Please try again.");
    }
  }

  if (!ready || !token) return <div className="page page--subtle" />;
  if (!cart.length && !busy) {
    return (
      <div className="page page--subtle">
        <TopBar title="Checkout" backHref="/menu" />
        <div className="container"><EmptyCart /></div>
      </div>
    );
  }

  const placeLabel = `Place order · ${formatPrice(config, total)}`;
  return (
    <form className="page page--subtle" onSubmit={submit} noValidate>
      <TopBar title="Checkout" backHref="/cart" />
      <div className="container">
        <div className="page-head desktop-only">
          <h1 className="t-heading-xl">Checkout</h1>
          {branch ? <p className="t-body-lg c-secondary">Ordering from {branch.name}</p> : null}
        </div>
        {unpaid ? (
          <div style={{ marginBottom: 24 }}>
            <Alert tone="warning" title={`Order #${unpaid.orderId} is waiting for payment`}>
              <span className="row gap-md" style={{ flexWrap: "wrap", marginTop: 4 }}>
                <Link className="text-link" href={`/checkout/${unpaid.orderId}/payment`}>Finish paying</Link>
                <button type="button" className="text-link" onClick={clearPendingCheckout}>Dismiss</button>
              </span>
            </Alert>
          </div>
        ) : null}
        <div className="two-col">
          <div className="stack gap-2xl">
            <section className="card card--flat-mobile">
              <h2 className="t-heading-sm">1. Delivery or pickup</h2>
              <div className="option-grid option-grid--2">
                {canDeliver ? <Option type="radio" name="fulfilment" checked={fulfilment === "delivery"} onChange={() => actions.setFulfilment("delivery")} title="Delivery" description={`To your address from ${branch?.name ?? "the branch"}`} /> : null}
                {canPickup ? <Option type="radio" name="fulfilment" checked={fulfilment === "take_away"} onChange={() => actions.setFulfilment("take_away")} title="Pickup" description={`Collect from ${branch?.name ?? "the branch"}`} /> : null}
              </div>
            </section>

            {fulfilment === "delivery" ? (
              <section className="card card--flat-mobile">
                <h2 className="t-heading-sm">2. Delivery address</h2>
                {addresses === null ? <div className="skeleton" style={{ height: 56 }} /> : null}
                <div className="option-list">
                  {(addresses ?? []).map((address) => (
                    <Option key={address.id} type="radio" name="address" checked={addressId === address.id} onChange={() => setAddressId(address.id)}
                      title={address.label} description={[address.address, address.contactPhone].filter(Boolean).join(" · ")} />
                  ))}
                </div>
                {adding || (addresses && !addresses.length) ? (
                  <AddressForm token={token} onSaved={() => { setAdding(false); loadAddresses(); }} onCancel={addresses?.length ? () => setAdding(false) : undefined} />
                ) : (
                  <div><Button type="button" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>Add a new address</Button></div>
                )}
              </section>
            ) : null}

            <section className="card card--flat-mobile">
              <h2 className="t-heading-sm">{fulfilment === "delivery" ? "3" : "2"}. Payment</h2>
              {!choices.length ? <Alert tone="warning" title="Online ordering cannot take payments right now">Please call the branch to order.</Alert> : null}
              <div className="option-list">
                {choices.map((choice) => (
                  <Option key={choice.key} type="radio" name="payment" checked={selected?.key === choice.key} onChange={() => setPaymentKey(choice.key)} title={choice.label} description={choice.description} />
                ))}
              </div>
              {selected?.initiationMethod === "mobile_money" ? (
                <TextField label="Mobile money number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07XX XXX XXX" help="The payment prompt is sent to this number" />
              ) : null}
            </section>

            <section className="card card--flat-mobile">
              <h2 className="t-heading-sm">{fulfilment === "delivery" ? "4" : "3"}. Note {fulfilment === "delivery" ? "for the rider" : "for the branch"}</h2>
              <TextArea label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} placeholder={fulfilment === "delivery" ? "For example: call when you arrive at the gate" : "For example: I will collect at 1 pm"} />
            </section>
          </div>

          <aside className="two-col__aside">
            <div className="card card--flat-mobile">
              <h2 className="t-heading-sm">Your order</h2>
              <div>{cart.map((line) => <CartLineItem key={line.key} line={line} readOnly />)}</div>
              <OrderSummary count={cartCount(cart)} subtotal={subtotal} delivery={delivery.label} total={total} />
              {error ? <Alert tone="danger" title={error} /> : null}
              <Button type="submit" size="lg" block loading={busy !== null} disabled={!choices.length}>
                {busy === "placing" ? "Placing your order" : busy === "paying" ? "Starting payment" : placeLabel}
              </Button>
              {selected?.initiationMethod === "mobile_money" ? <p className="t-body-sm c-tertiary">You will approve the payment on your phone after placing the order.</p> : null}
            </div>
          </aside>
        </div>
      </div>
    </form>
  );
}

/* ---------------- Payment status ---------------- */

type PayState = "waiting" | "delayed" | "failed" | "paid" | "retrying";

export function PaymentStatusView({ orderId }: { orderId: number }) {
  const config = useConfig();
  const router = useRouter();
  const { token, ready } = useStore();
  const gateway = activeGateway(config);
  const [savedPending, setSavedPending] = useState<PendingCheckout | null>(null);
  const livePending = usePendingCheckout(orderId);
  // Keep showing the order details after "paid" clears the stored record.
  const pending = livePending ?? savedPending;
  if (livePending && livePending !== savedPending) setSavedPending(livePending);
  const [state, setState] = useState<PayState>("waiting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ready && !token) router.replace(`/sign-in?next=/checkout/${orderId}/payment`);
  }, [ready, token, router, orderId]);

  useEffect(() => {
    if (!token || state !== "waiting") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 180_000;
    async function poll() {
      if (cancelled || !token) return;
      try {
        const status = await fetchPaymentStatus({ token, orderId, endpoint: gateway?.statusEndpoint });
        if (cancelled) return;
        const value = status.state || status.paymentStatus;
        if (value === "paid" || status.paymentStatus === "paid") {
          clearPendingCheckout();
          setState("paid");
          return;
        }
        if (["failed", "cancelled", "canceled", "expired"].some((entry) => entry === value || entry === status.paymentStatus)) {
          setState("failed");
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (Date.now() >= deadline) {
        setState("delayed");
        return;
      }
      timer = setTimeout(() => void poll(), 7000);
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token, state, attempt, orderId, gateway?.statusEndpoint]);

  async function retry() {
    if (!token || !pending) return;
    setState("retrying");
    try {
      const session = await initiatePayment({ token, endpoint: gateway?.checkoutEndpoint ?? "/payment/initiate", orderId, method: pending.method, phone: pending.phone });
      if (session.checkoutUrl) {
        window.location.assign(session.checkoutUrl);
        return;
      }
      setAttempt((value) => value + 1);
      setState("waiting");
    } catch {
      setState("failed");
    }
  }

  function checkAgain() {
    setAttempt((value) => value + 1);
    setState("waiting");
  }

  const amount = pending ? formatPrice(config, pending.amount) : null;
  const isMobileMoney = pending?.method === "mobile_money";
  const view = {
    waiting: { tone: "warning" as const, icon: isMobileMoney ? Smartphone : Clock, badge: ["warning", "Awaiting payment"] as const,
      title: isMobileMoney ? "Approve the payment on your phone" : "Confirming your payment",
      body: isMobileMoney ? `We sent a mobile money prompt${amount ? ` for ${amount}` : ""}${pending?.phone ? ` to ${pending.phone}` : ""}. Enter your PIN to confirm. This page updates automatically.` : "This page updates automatically once the payment provider confirms." },
    retrying: { tone: "warning" as const, icon: Clock, badge: ["warning", "Awaiting payment"] as const, title: "Starting the payment again", body: "One moment while we send a new payment request." },
    delayed: { tone: "warning" as const, icon: Clock, badge: ["warning", "Awaiting payment"] as const, title: "Still waiting for confirmation", body: "Your network has not confirmed the payment yet. Check your phone for the prompt, then check again." },
    failed: { tone: "danger" as const, icon: XCircle, badge: ["danger", "Payment failed"] as const, title: "Payment did not go through", body: "The payment was declined or timed out. Your order is saved, so you can try again." },
    paid: { tone: "success" as const, icon: CheckCircle2, badge: ["success", "Paid"] as const, title: "Order confirmed", body: "Thank you. The branch is preparing your order." }
  }[state];
  const Icon = view.icon;

  return (
    <div className="page page--subtle">
      <TopBar title={`Order #${orderId}`} backHref="/account/orders" />
      <div className="container">
        <div className="status" aria-live="polite">
          <div className={`status__icon status__icon--${view.tone}`}><Icon aria-hidden /></div>
          <div className="stack gap-sm" style={{ alignItems: "center" }}>
            <h1 className="t-heading-lg">{view.title}</h1>
            <p className="t-body-md c-secondary">{view.body}</p>
            <Badge tone={view.badge[0]}>{view.badge[1]}</Badge>
          </div>
          {state === "delayed" ? <Alert tone="info" title="Do not pay twice">If money left your account, the order updates automatically once it is confirmed.</Alert> : null}
          <dl className="summary status__details">
            <div className="summary__row"><dt>Order</dt><dd>#{orderId}</dd></div>
            {amount ? <div className="summary__row"><dt>Amount</dt><dd>{amount}</dd></div> : null}
            {pending ? <div className="summary__row"><dt>Payment</dt><dd>{isMobileMoney ? `Mobile money${pending.phone ? ` · ${pending.phone}` : ""}` : "Card"}</dd></div> : null}
          </dl>
          <div className="status__actions">
            {state === "waiting" || state === "retrying" ? <Button variant="secondary" size="lg" block loading>Checking payment status</Button> : null}
            {state === "delayed" ? <Button size="lg" block onClick={checkAgain}>Check payment status</Button> : null}
            {state === "failed" && pending ? <Button size="lg" block onClick={retry}>Retry payment</Button> : null}
            {state === "paid" ? <ButtonLink href={`/account/orders/${orderId}`} size="lg" block>Track order</ButtonLink> : null}
            <Link href={state === "paid" ? "/" : `/account/orders/${orderId}`} className="btn btn--ghost btn--lg btn--block">{state === "paid" ? "Back to the menu" : "View order"}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
