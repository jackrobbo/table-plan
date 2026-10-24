"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const linkStyle = { color: "var(--leaf)", fontWeight: 600, textDecoration: "none" } as const;
const btnStyle = {
  background: "none", border: "none", color: "var(--leaf)", font: "inherit",
  fontWeight: 600, cursor: "pointer", padding: 0,
} as const;

// Lightweight auth indicator: shows the signed-in email + sign-out, or a sign-in link.
export default function AuthStatus() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setEmail(data.user?.email ?? null);
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null)
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!ready) return null;

  return (
    <p className="muted" style={{ display: "flex", justifyContent: "flex-end", gap: 10, margin: "0 0 4px" }}>
      {email ? (
        <>
          <span>{email}</span>
          <button
            style={btnStyle}
            onClick={async () => {
              await supabase.auth.signOut();
              location.reload();
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <Link href="/signin" style={linkStyle}>Sign in</Link>
      )}
    </p>
  );
}
