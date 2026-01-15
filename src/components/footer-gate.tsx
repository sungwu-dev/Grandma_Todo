"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type FooterGateProps = {
  children: ReactNode;
};

type Session = { user: { id: string } } | null;

export default function FooterGate({ children }: FooterGateProps) {
  const [visible, setVisible] = useState(false);
  const supabaseAvailable = useMemo(() => {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }, []);
  const supabase = useMemo(
    () => (supabaseAvailable ? createSupabaseBrowserClient() : null),
    [supabaseAvailable]
  );

  useEffect(() => {
    if (!supabaseAvailable) {
      setVisible(false);
      return;
    }
    if (!supabase) {
      return;
    }
    let cancelled = false;

    const updateVisibility = (session: Session) => {
      if (cancelled) {
        return;
      }
      setVisible(Boolean(session));
    };

    supabase.auth.getSession().then(({ data }) => {
      updateVisibility(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      updateVisibility(session);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabaseAvailable, supabase]);

  if (!visible) {
    return null;
  }

  return <>{children}</>;
}
