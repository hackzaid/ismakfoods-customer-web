"use client";

import { AlertCircle, Check, CheckCircle2, Info, Loader2, Minus, Plus, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "lg";
  block?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
};

function buttonClass(variant: ButtonVariant, size: "md" | "lg", block?: boolean, extra?: string) {
  return ["btn", `btn--${variant}`, size === "lg" && "btn--lg", block && "btn--block", extra].filter(Boolean).join(" ");
}

export function Button({ variant = "primary", size = "md", block, loading, icon: Icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, block, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="spin" aria-hidden /> : Icon ? <Icon aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", size = "md", block, icon: Icon, className, children }: {
  href: string; variant?: ButtonVariant; size?: "md" | "lg"; block?: boolean; icon?: LucideIcon; className?: string; children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, block, className)}>
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </Link>
  );
}

export function IconButton({ icon: Icon, label, variant = "ghost", count, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon; label: string; variant?: "ghost" | "secondary"; count?: number;
}) {
  return (
    <button type="button" aria-label={label} className={["icon-btn", variant === "secondary" && "icon-btn--secondary", className].filter(Boolean).join(" ")} {...rest}>
      <Icon aria-hidden />
      {count ? <span className="count-dot" aria-hidden>{count}</span> : null}
    </button>
  );
}

type FieldBase = { label: string; help?: string; error?: string | null; leadingIcon?: LucideIcon };

export function TextField({ label, help, error, leadingIcon: Icon, disabled, id, ...rest }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;
  const message = error || help;
  return (
    <div className={["field", error && "field--error", disabled && "field--disabled"].filter(Boolean).join(" ")}>
      <label className="field__label" htmlFor={inputId}>{label}</label>
      <div className="field__control">
        {Icon ? <Icon aria-hidden /> : null}
        <input id={inputId} disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={message ? helpId : undefined} {...rest} />
      </div>
      {message ? (
        <p className="field__help" id={helpId}>
          {error ? <AlertCircle aria-hidden /> : null}
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({ label, help, id, ...rest }: FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>{label}</label>
      <div className="field__control"><textarea id={inputId} rows={2} {...rest} /></div>
      {help ? <p className="field__help">{help}</p> : null}
    </div>
  );
}

export function Option({ type, name, checked, onChange, title, description, meta, disabled }: {
  type: "radio" | "checkbox"; name: string; checked: boolean; onChange: () => void; title: string; description?: string; meta?: string; disabled?: boolean;
}) {
  return (
    <label className={`option option--${type}`}>
      <input type={type} name={name} checked={checked} onChange={onChange} disabled={disabled} />
      <span className="option__control" aria-hidden>{type === "checkbox" ? <Check strokeWidth={3} /> : null}</span>
      <span className="option__text">
        <span className="option__title">{title}</span>
        {description ? <span className="option__desc">{description}</span> : null}
      </span>
      {meta ? <span className="option__meta">{meta}</span> : null}
    </label>
  );
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, size = "md", label }: {
  value: number; onChange: (value: number) => void; min?: number; max?: number; size?: "sm" | "md"; label: string;
}) {
  return (
    <div className={["stepper", size === "sm" && "stepper--sm"].filter(Boolean).join(" ")} role="group" aria-label={`Quantity for ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease quantity"><Minus aria-hidden /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity"><Plus aria-hidden /></button>
    </div>
  );
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

const alertIcons: Record<Exclude<Tone, "neutral">, LucideIcon> = { info: Info, success: CheckCircle2, warning: AlertCircle, danger: XCircle };

export function Alert({ tone, title, children }: { tone: Exclude<Tone, "neutral">; title: string; children?: ReactNode }) {
  const Icon = alertIcons[tone];
  return (
    <div className={`alert alert--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden />
      <div className="alert__text">
        <p className="alert__title">{title}</p>
        {children ? <div className="alert__body">{children}</div> : null}
      </div>
    </div>
  );
}
