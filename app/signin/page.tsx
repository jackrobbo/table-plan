"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stage = "email" | "code";

export default function SignIn() {
  const router = useRouter();
  const supabase = createClient();
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setStage("code");
    setMsg(`We've sent a 6-digit code to ${email.trim()}.`);
  };

  const verify = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="wrap">
      <p className="eyebrow">Table Plan</p>
      <h1>Sign in</h1>

      {stage === "email" ? (
        <>
          <p className="muted" style={{ marginTop: 8 }}>
            We&apos;ll email you a one-time code. We only use your email for Table Plan.
          </p>
          <div style={{ maxWidth: 360, marginTop: 14 }}>
            <label className="f">Email</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn" disabled={busy || !email.includes("@")} onClick={sendCode}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 8 }}>Enter the 6-digit code from your email.</p>
          <div style={{ maxWidth: 220, marginTop: 14 }}>
            <label className="f">Code</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ fontFamily: "'Spline Sans Mono',monospace", letterSpacing: "0.3em", fontSize: 20 }}
            />
          </div>
          <button className="btn" disabled={busy || code.length < 6} onClick={verify}>
            {busy ? "Checking…" : "Verify & continue"}
          </button>{" "}
          <button className="btn ghost" onClick={() => { setStage("email"); setMsg(null); }}>← Change email</button>
        </>
      )}

      {msg && <p className="note" style={{ marginTop: 16 }}>{msg}</p>}
    </div>
  );
}
