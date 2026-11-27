import Link from "next/link";
import type { AppConfig } from "@/lib/api";
import { formatTime } from "@/lib/format";

export function SiteFooter({ config }: { config: AppConfig | null }) {
  const name = config?.restaurantName ?? "Ismak Foods";
  const open = formatTime(config?.openTime);
  const close = formatTime(config?.closeTime);
  const hours = open && close ? `Open daily, ${open} to ${close}` : null;
  const year = new Date().getFullYear();
  const payments = [
    config?.digitalPayment ? "mobile money and card" : null,
    config?.cashOnDelivery ? "cash on delivery" : null
  ].filter(Boolean).join(", ");
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__cols">
          <div className="site-footer__col">
            <h2>{name}</h2>
            <p>Fresh and fast meals from our Kampala kitchens.</p>
          </div>
          {(config?.branches ?? []).map((branch) => (
            <div className="site-footer__col" key={branch.id}>
              <h2>{branch.name}</h2>
              {branch.address ? <p>{branch.address}</p> : null}
              {hours ? <p>{hours}</p> : null}
            </div>
          ))}
          <div className="site-footer__col">
            <h2>Help</h2>
            {config?.phone ? <a href={`tel:${config.phone.replace(/\s+/g, "")}`}>Call {config.phone}</a> : null}
            <Link href="/contact">Contact us</Link>
            <Link href="/refunds">Refund policy</Link>
          </div>
          <div className="site-footer__col">
            <h2>Legal</h2>
            <Link href="/terms">Terms of service</Link>
            <Link href="/privacy">Privacy policy</Link>
          </div>
        </div>
        <div className="site-footer__bottom">
          <p>© {year} {name}. All rights reserved.</p>
          {payments ? <p>We accept {payments}.</p> : null}
        </div>
      </div>
    </footer>
  );
}
