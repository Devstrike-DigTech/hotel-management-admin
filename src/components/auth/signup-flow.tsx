"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, WarningOctagon } from "@phosphor-icons/react";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, isApiError } from "@/lib/api/client";
import type { SignupInput } from "@/lib/api/types";
import { storeAuth } from "@/lib/auth";
import { NIGERIAN_STATES } from "@/lib/catalog";
import { config } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, Input, PasswordInput, Select } from "@/components/ui/form";
import { Wordmark, FOB_PATH } from "@/components/brand";
import { AuthSplit } from "./auth-split";

const STEPS = [
  { title: "Your hotel", body: "Name and where to find you." },
  { title: "You, the owner", body: "Your sign-in and contact." },
  { title: "Your trial", body: "Fourteen days of Growth, on us." },
];

const TRIAL_HIGHLIGHTS = [
  "The live key rack and room board",
  "Housekeeping and maintenance",
  "Your own booking page, in your colours",
  "Listing on the marketplace",
  "Owner alerts on WhatsApp",
  "Up to 60 rooms and 15 staff",
];

type Form = SignupInput & { agree: boolean };

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return s;
}

export function SignupFlow() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    hotelName: "",
    city: "",
    state: "Lagos",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    agree: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (form.hotelName.trim().length < 2) e.hotelName = "What's the hotel called?";
      if (!form.city.trim()) e.city = "Which city is it in?";
      if (!form.state) e.state = "Choose a state";
    }
    if (s === 1) {
      if (form.fullName.trim().split(/\s+/).length < 2) e.fullName = "Your first and last name, please";
      if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "That email doesn't look right";
      if (form.phone.replace(/\D/g, "").length < 10) e.phone = "A Nigerian mobile number, like 803 123 4567";
      if (form.password.length < 8) e.password = "At least 8 characters";
    }
    if (s === 2 && !form.agree) e.agree = "Please accept the terms to continue";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate(step)) setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!validate(2)) return;
    setBusy(true);
    setServerError(null);
    try {
      const phone = `+234${form.phone.replace(/\D/g, "").replace(/^0/, "").replace(/^234/, "")}`;
      const res = await authApi.signup({
        hotelName: form.hotelName.trim(),
        city: form.city.trim(),
        state: form.state,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone,
        password: form.password,
      });
      qc.clear();
      storeAuth(res);
      toast.success(`Welcome to ${config.appName}`, `${form.hotelName} is set up. Start by adding your rooms.`);
      router.replace("/today");
    } catch (err) {
      const msg = errorMessage(err);
      if (isApiError(err) && (err.status === 409 || /email/i.test(msg))) {
        setErrors({ email: msg });
        setStep(1);
      } else setServerError(msg);
      setBusy(false);
    }
  };

  const [trialEnds] = useState(() => new Date(Date.now() + 14 * 864e5).toISOString());
  const pw = strength(form.password);

  return (
    <AuthSplit aside={<StepsAside step={step} hotel={form.hotelName} />}>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Wordmark size="sm" />
          </div>
          <p className="ml-auto text-[13px] text-ink-muted">
            Have an account?{" "}
            <Link href="/login" className="font-medium text-laterite underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[420px]">
            {/* progress */}
            <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s.title} aria-current={i === step ? "step" : undefined}>
                  <span
                    className={cn(
                      "block h-[3px] rounded-full transition-colors duration-300",
                      i < step ? "bg-ink" : i === step ? "bg-laterite" : "bg-line-strong",
                    )}
                  />
                  <span className={cn("mt-2 block font-mono text-[10.5px] uppercase tracking-[0.12em]", i === step ? "text-ink" : "text-ink-faint")}>
                    {String(i + 1).padStart(2, "0")} {s.title}
                  </span>
                </li>
              ))}
            </ol>

            <div key={step} className="animate-[rise_240ms_cubic-bezier(0.22,1,0.36,1)]">
              {step === 0 && (
                <>
                  <h1 className="display text-[38px] leading-[1.04] text-ink sm:text-[44px]">
                    Let&rsquo;s open <em>the front desk</em>.
                  </h1>
                  <p className="mt-3 text-[14.5px] text-ink-muted">Start with the hotel. You can change any of this later.</p>
                  <form
                    className="mt-8 flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      next();
                    }}
                    noValidate
                  >
                    <Field label="Hotel name" htmlFor="su-hotel" error={errors.hotelName}>
                      <Input id="su-hotel" autoFocus value={form.hotelName} onChange={(e) => set("hotelName", e.target.value)} placeholder="The Palmwine House" aria-invalid={!!errors.hotelName} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="City" htmlFor="su-city" error={errors.city}>
                        <Input id="su-city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Lagos" aria-invalid={!!errors.city} />
                      </Field>
                      <Field label="State" htmlFor="su-state" error={errors.state}>
                        <Select id="su-state" value={form.state} onChange={(e) => set("state", e.target.value)}>
                          {NIGERIAN_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <Button type="submit" size="lg" className="mt-3 w-full">
                      Continue <ArrowRight size={16} weight="bold" />
                    </Button>
                  </form>
                </>
              )}

              {step === 1 && (
                <>
                  <h1 className="display text-[38px] leading-[1.04] text-ink sm:text-[44px]">
                    And you, <em>the owner</em>.
                  </h1>
                  <p className="mt-3 text-[14.5px] text-ink-muted">You&rsquo;ll sign in with this email. We&rsquo;ll only text you about your account.</p>
                  <form
                    className="mt-8 flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      next();
                    }}
                    noValidate
                  >
                    <Field label="Full name" htmlFor="su-name" error={errors.fullName}>
                      <Input id="su-name" autoFocus autoComplete="name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Adaeze Okonkwo" aria-invalid={!!errors.fullName} />
                    </Field>
                    <Field label="Email" htmlFor="su-email" error={errors.email}>
                      <Input id="su-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@yourhotel.ng" aria-invalid={!!errors.email} />
                    </Field>
                    <Field label="Mobile number" htmlFor="su-phone" error={errors.phone}>
                      <AffixInput id="su-phone" prefix="+234" inputMode="tel" autoComplete="tel-national" className="font-mono" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="803 123 4567" aria-invalid={!!errors.phone} />
                    </Field>
                    <Field label="Password" htmlFor="su-pass" error={errors.password}>
                      <PasswordInput id="su-pass" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} aria-invalid={!!errors.password} />
                      <div className="mt-1 flex items-center gap-2" aria-live="polite">
                        <div className="grid flex-1 grid-cols-4 gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="h-1 rounded-full transition-colors"
                              style={{
                                background:
                                  i < pw ? (pw <= 1 ? "var(--danger)" : pw === 2 ? "var(--ochre)" : "var(--palm)") : "var(--line)",
                              }}
                            />
                          ))}
                        </div>
                        <span className="w-14 text-right text-[11.5px] text-ink-muted">
                          {form.password ? ["Weak", "Weak", "Fair", "Good", "Strong"][pw] : ""}
                        </span>
                      </div>
                    </Field>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="secondary" size="lg" onClick={() => setStep(0)} aria-label="Back">
                        <ArrowLeft size={16} />
                      </Button>
                      <Button type="submit" size="lg" className="flex-1">
                        Continue <ArrowRight size={16} weight="bold" />
                      </Button>
                    </div>
                  </form>
                </>
              )}

              {step === 2 && (
                <>
                  <h1 className="display text-[38px] leading-[1.04] text-ink sm:text-[44px]">
                    Your 14-day <em>Growth</em> trial.
                  </h1>
                  <p className="mt-3 text-[14.5px] text-ink-muted">
                    Everything on our most popular plan, free until{" "}
                    <span className="font-medium text-ink">{formatDate(trialEnds)}</span>. No card needed.
                  </p>

                  <div className="mt-7 overflow-hidden rounded-lg border border-line bg-surface">
                    <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                      <div>
                        <p className="display-sm text-[18px] text-ink">{form.hotelName || "Your hotel"}</p>
                        <p className="text-[12.5px] text-ink-muted">
                          {form.city}
                          {form.state ? `, ${form.state}` : ""}
                        </p>
                      </div>
                      <span className="rounded-xs border border-[color-mix(in_oklab,var(--laterite)_45%,transparent)] bg-laterite-wash px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-laterite">
                        Growth trial
                      </span>
                    </div>
                    <ul className="grid gap-2 px-5 py-4 sm:grid-cols-2">
                      {TRIAL_HIGHLIGHTS.map((h) => (
                        <li key={h} className="flex items-start gap-2 text-[13px] text-ink">
                          <Check size={14} weight="bold" className="mt-0.5 shrink-0 text-palm" /> {h}
                        </li>
                      ))}
                    </ul>
                    <p className="border-t border-line bg-paper/60 px-5 py-3 text-[12.5px] text-ink-muted">
                      When the trial ends, pick any plan from &#8358;25,000 a month. If you don&rsquo;t, the account turns read-only and nothing is deleted.
                    </p>
                  </div>

                  <div className="mt-5">
                    <Checkbox
                      checked={form.agree}
                      onChange={(v) => set("agree", v)}
                      label={<>I agree to the terms of service and privacy policy</>}
                    />
                    {errors.agree && <p className="mt-1.5 text-[12.5px] text-danger">{errors.agree}</p>}
                  </div>

                  {serverError && (
                    <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3 py-2.5 text-[13px] text-danger">
                      <WarningOctagon size={16} weight="duotone" className="mt-px shrink-0" />
                      {serverError}
                    </p>
                  )}

                  <div className="mt-6 flex gap-2">
                    <Button variant="secondary" size="lg" onClick={() => setStep(1)} aria-label="Back">
                      <ArrowLeft size={16} />
                    </Button>
                    <Button size="lg" className="flex-1" loading={busy} onClick={submit}>
                      Open my front desk <ArrowRight size={16} weight="bold" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="text-[12px] text-ink-faint">
          Questions? <a href={`mailto:${config.supportEmail}`} className="hover:text-ink">{config.supportEmail}</a>
        </p>
      </div>
    </AuthSplit>
  );
}

function StepsAside({ step, hotel }: { step: number; hotel: string }) {
  return (
    <div className="max-w-[30rem]">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#ece3d2]/60">Four minutes to set up</p>
      <ol className="mt-6 flex flex-col">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.title} className="relative flex gap-5 pb-8 last:pb-0">
              {i < STEPS.length - 1 && <span aria-hidden className="absolute left-[13px] top-9 bottom-1 w-px bg-[#ece3d2]/20" />}
              <svg viewBox="0 0 44 64" width="27" height="38" aria-hidden className="shrink-0 transition-transform duration-300" style={{ transform: active ? "rotate(-6deg)" : undefined }}>
                <path
                  d={FOB_PATH}
                  fill={done ? "#d6a94a" : active ? "#e0714b" : "none"}
                  stroke={done ? "#d6a94a" : active ? "#e0714b" : "#ece3d2"}
                  strokeOpacity={done || active ? 1 : 0.35}
                  strokeWidth={2.5}
                />
                <circle cx="22" cy="13" r="4" fill="#1f2d48" />
              </svg>
              <div className="pt-1">
                <p className={cn("display text-[26px] leading-none", active ? "text-[#f4ecdd]" : done ? "text-[#ece3d2]/80" : "text-[#ece3d2]/45")}>
                  {i === 0 && hotel && done ? hotel : s.title}
                </p>
                <p className={cn("mt-1.5 text-[13px]", active ? "text-[#ece3d2]/75" : "text-[#ece3d2]/40")}>{s.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
