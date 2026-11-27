"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { loginWithPassword, registerWithOtp, registerWithSocialMedia, requestPhoneOtp, socialLogin, verifyPhoneOtp } from "@/lib/api";
import { FACEBOOK_APP_ID, GOOGLE_CLIENT_ID, requestFacebookProfile, requestGoogleProfile, type SocialProfile } from "@/lib/social";
import { actions, useStore } from "@/lib/store";
import { useConfig } from "./config-context";
import { TopBar } from "./top-bar";
import { Alert, Button, TextField } from "./ui";

type Mode = "password" | "register" | "otp" | "verify" | "social";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

function OtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");
  function set(index: number, digit: string) {
    const clean = digit.replace(/\D/g, "");
    if (clean.length > 1) {
      onChange(clean.slice(0, 6));
      refs.current[Math.min(clean.length, 5)]?.focus();
      return;
    }
    const next = digits.slice();
    next[index] = clean;
    onChange(next.join("").slice(0, 6));
    if (clean && index < 5) refs.current[index + 1]?.focus();
  }
  return (
    <div className="otp" role="group" aria-label="6-digit code">
      {digits.map((digit, index) => (
        <input key={index} ref={(node) => { refs.current[index] = node; }} value={digit} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`} maxLength={6}
          onChange={(event) => set(index, event.target.value)}
          onKeyDown={(event) => { if (event.key === "Backspace" && !digit && index > 0) refs.current[index - 1]?.focus(); }} />
      ))}
    </div>
  );
}

export function SignInView() {
  const config = useConfig();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { token, ready } = useStore();
  const options = config?.loginOptions ?? { manual: true, otp: false, social: true };
  const google = options.social && config?.socialLogin.google && GOOGLE_CLIENT_ID;
  const facebook = options.social && config?.socialLogin.facebook && FACEBOOK_APP_ID;
  const [mode, setMode] = useState<Mode>(options.otp ? "otp" : "password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [social, setSocial] = useState<SocialProfile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && token) router.replace(next);
  }, [ready, token, next, router]);

  async function run(label: string, task: () => Promise<string | void>) {
    setBusy(label);
    setError(null);
    try {
      const result = await task();
      if (typeof result === "string") {
        if (!result) throw new Error("Sign-in did not complete. Please try again.");
        actions.setToken(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "password") void run("password", () => loginWithPassword(identifier, password));
    if (mode === "register") void run("register", () => registerWithOtp(name, phone, email));
    if (mode === "otp") void run("otp", async () => { await requestPhoneOtp(phone); setCode(""); setMode("verify"); });
    if (mode === "verify") void run("verify", () => verifyPhoneOtp(phone, code));
    if (mode === "social" && social) void run("social", () => registerWithSocialMedia(social.name, phone, social.email, social.medium));
  }

  async function continueWith(medium: "google" | "facebook") {
    await run(medium, async () => {
      const profile = medium === "google" ? await requestGoogleProfile() : await requestFacebookProfile();
      const result = await socialLogin({ token: profile.token, uniqueId: profile.id, email: profile.email, medium: profile.medium });
      if (result.token) return result.token;
      if (!result.needsRegistration) throw new Error("This account could not be signed in. Please use another method.");
      setSocial(profile);
      setMode("social");
    });
  }

  const titles: Record<Mode, [string, string]> = {
    password: ["Sign in to place your order", "Use the email or phone number and password for your account."],
    register: ["Create your account", "It takes a minute. You can order straight after."],
    otp: ["Sign in to place your order", "Enter your phone number and we will text you a 6-digit code."],
    verify: ["Enter the 6-digit code", `We sent it by SMS to ${phone}.`],
    social: ["Add your phone number", `To finish creating your account for ${social?.email ?? "your email"}, add a phone number for order updates.`]
  };
  const submitLabel: Record<Mode, string> = { password: "Sign in", register: "Create account", otp: "Send code", verify: "Verify and continue", social: "Create account" };

  if (ready && token) return null;
  return (
    <div className="page page--subtle">
      <TopBar title={mode === "register" ? "Create account" : mode === "verify" ? "Verify your number" : "Sign in"} />
      <form className="auth" onSubmit={submit} noValidate>
        <div className="stack gap-sm">
          <h1 className="t-heading-lg">{titles[mode][0]}</h1>
          <p className="t-body-md c-secondary">{titles[mode][1]}</p>
          {mode === "verify" ? <button type="button" className="text-link" style={{ alignSelf: "flex-start" }} onClick={() => setMode("otp")}>Change number</button> : null}
        </div>

        {mode === "password" ? (
          <>
            <TextField label="Email or phone number" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required />
            <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </>
        ) : null}
        {mode === "register" ? (
          <>
            <TextField label="Full name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            <TextField label="Phone number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="07XX XXX XXX" help="We send order updates to this number" required />
            <TextField label="Email (optional)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" help="For receipts" />
          </>
        ) : null}
        {mode === "otp" || mode === "social" ? (
          <TextField label="Phone number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="07XX XXX XXX" help="MTN and Airtel numbers supported" required />
        ) : null}
        {mode === "verify" ? <OtpInput value={code} onChange={setCode} /> : null}

        {error ? <Alert tone="danger" title={error} /> : null}
        <Button type="submit" size="lg" block loading={busy === mode} disabled={mode === "verify" && code.length < 6}>{submitLabel[mode]}</Button>

        {mode === "password" || mode === "otp" ? (
          <>
            {google || facebook ? <div className="divider">or</div> : null}
            {google ? <Button type="button" variant="secondary" size="lg" block loading={busy === "google"} onClick={() => continueWith("google")}>Continue with Google</Button> : null}
            {facebook ? <Button type="button" variant="secondary" size="lg" block loading={busy === "facebook"} onClick={() => continueWith("facebook")}>Continue with Facebook</Button> : null}
            {options.otp && options.manual ? (
              <Button type="button" variant="ghost" size="lg" block onClick={() => { setError(null); setMode(mode === "otp" ? "password" : "otp"); }}>
                {mode === "otp" ? "Use email and password instead" : "Sign in with a code instead"}
              </Button>
            ) : null}
          </>
        ) : null}

        {options.manual ? (
          <p className="t-body-md" style={{ textAlign: "center" }}>
            {mode === "register" ? "Already have an account? " : mode === "password" || mode === "otp" ? "New to Ismak Foods? " : null}
            {mode === "register" || mode === "password" || mode === "otp" ? (
              <button type="button" className="text-link" onClick={() => { setError(null); setMode(mode === "register" ? (options.otp ? "otp" : "password") : "register"); }}>
                {mode === "register" ? "Sign in" : "Create an account"}
              </button>
            ) : null}
          </p>
        ) : null}
        <p className="t-body-sm c-tertiary" style={{ textAlign: "center" }}>
          By continuing you agree to our <Link className="text-link" href="/terms">Terms of service</Link> and <Link className="text-link" href="/privacy">Privacy policy</Link>.
        </p>
      </form>
    </div>
  );
}
