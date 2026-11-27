import Link from "next/link";
import { getConfig } from "@/lib/api";
import { StaticPage } from "./static-page";

export async function JoinPage({ title, intro, sections, subject }: {
  title: string; intro: string; sections: { heading: string; body: string }[]; subject: string;
}) {
  const config = await getConfig().catch(() => null);
  return (
    <StaticPage title={title}>
      <p>{intro}</p>
      {sections.map((section) => (
        <div key={section.heading} className="prose">
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </div>
      ))}
      <h2>Get in touch</h2>
      {config?.phone ? <p>Call <a className="text-link" href={`tel:${config.phone.replace(/\s+/g, "")}`}>{config.phone}</a></p> : null}
      {config?.email ? <p>Email <a className="text-link" href={`mailto:${config.email}?subject=${encodeURIComponent(subject)}`}>{config.email}</a> with the subject “{subject}”.</p> : null}
      {!config?.phone && !config?.email ? <p>Visit any branch and ask for the manager. <Link className="text-link" href="/contact">See branches</Link></p> : null}
    </StaticPage>
  );
}
