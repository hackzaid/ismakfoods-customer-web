import type { ReactNode } from "react";

export function StaticPage({ title, draft = true, children }: { title: string; draft?: boolean; children: ReactNode }) {
  return (
    <div className="page">
      <div className="container container--narrow">
        <div className="page-head">
          <h1 className="t-heading-xl">{title}</h1>
        </div>
        {draft ? (
          <div className="alert alert--warning" role="note" style={{ marginBottom: 24 }}>
            <div className="alert__text">
              <p className="alert__title">Draft</p>
              <p className="alert__body">This page is a placeholder. Ismak Foods will publish the final text before launch.</p>
            </div>
          </div>
        ) : null}
        <div className="prose">{children}</div>
      </div>
    </div>
  );
}
