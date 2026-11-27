import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { getConfig } from "@/lib/api";
import { formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Contact us" };

export default async function ContactPage() {
  const config = await getConfig().catch(() => null);
  const open = formatTime(config?.openTime);
  const close = formatTime(config?.closeTime);
  return (
    <StaticPage title="Contact us" draft={false}>
      <p>For help with an order, call or message us with your order number.</p>
      {config?.phone ? <><h2>Phone</h2><p><a className="text-link" href={`tel:${config.phone.replace(/\s+/g, "")}`}>{config.phone}</a></p></> : null}
      {config?.email ? <><h2>Email</h2><p><a className="text-link" href={`mailto:${config.email}`}>{config.email}</a></p></> : null}
      {open && close ? <><h2>Opening hours</h2><p>Daily, {open} to {close}</p></> : null}
      {(config?.branches ?? []).length ? (
        <>
          <h2>Branches</h2>
          {config!.branches.map((branch) => <p key={branch.id}><strong>{branch.name}</strong>{branch.address ? ` · ${branch.address}` : ""}</p>)}
        </>
      ) : null}
    </StaticPage>
  );
}
