"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthStatus = "loading" | "signedOut" | "signedIn";
type AuthSessionData = { session: { user: { id: string } } | null };

const NAV_LINKS = [
  { href: "/recurring_sch", label: "반복 일정" },
  { href: "/calendar", label: "일정 캘린더" },
  { href: "/elder", label: "매일 일정" },
  { href: "/elder/calendar", label: "주간 일정" }
];

export default function AuthNav() {
  const pathname = usePathname();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [isGrandma, setIsGrandma] = useState(false);
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
    if (!pathname) {
      return;
    }
    if (!supabaseAvailable) {
      setAuthStatus("signedOut");
      setIsGrandma(false);
      return;
    }
    if (!supabase) {
      return;
    }
    let cancelled = false;

    const updateSessionState = async (session: { user: { id: string } } | null) => {
      if (cancelled) {
        return;
      }
      setAuthStatus(session ? "signedIn" : "signedOut");
      if (!session) {
        setIsGrandma(false);
        return;
      }
      const { data: members, error } = await supabase
        .from("group_members")
        .select("role")
        .eq("user_id", session.user.id);
      if (cancelled) {
        return;
      }
      if (error) {
        setIsGrandma(false);
        return;
      }
      const grandma = (members ?? []).some(
        (member: { role?: string | null }) => member.role === "viewer"
      );
      setIsGrandma(grandma);
    };

    supabase.auth.getSession().then(({ data }: { data: AuthSessionData }) => {
      void updateSessionState(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange(
      (_event: string, session: AuthSessionData["session"]) => {
        void updateSessionState(session);
      }
    );
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [pathname, supabaseAvailable, supabase]);

  const isElderRoute = pathname?.startsWith("/elder");
  const hideForGrandma = isElderRoute && isGrandma;
  if (!pathname || hideForGrandma) {
    return null;
  }

  const navContent = (
    <nav className="main-nav" aria-label="주요 메뉴">
      <div className="main-nav-inner">
        <Link className="main-nav-brand" href="/">
          일정 도우미
        </Link>
        <div className="main-nav-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} className="main-nav-link" href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="main-nav-actions">
          {authStatus === "signedIn" ? (
            <Link className="profile-button" href="/mypage" aria-label="마이페이지">
              <span className="profile-icon" aria-hidden="true" />
            </Link>
          ) : authStatus === "signedOut" ? (
            <>
              <Link className="btn secondary" href="/login?mode=signup">
                회원가입
              </Link>
              <Link className="btn" href="/login">
                로그인
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );

  if (!isElderRoute) {
    return navContent;
  }

  return (
    <div className="nav-reveal">
      <button className="nav-reveal-handle" type="button" aria-label="메뉴 열기" />
      {navContent}
    </div>
  );
}
