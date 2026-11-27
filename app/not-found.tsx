import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="page page--subtle">
      <div className="container">
        <div className="empty" style={{ padding: "120px 0 160px" }}>
          <p className="t-label-md c-brand">404</p>
          <h1 className="t-heading-xl">We could not find that page</h1>
          <p className="t-body-lg c-secondary">The link may be out of date. The full menu is one click away.</p>
          <ButtonLink href="/menu" size="lg">Back to the menu</ButtonLink>
        </div>
      </div>
    </div>
  );
}
