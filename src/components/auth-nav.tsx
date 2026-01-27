"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuId = useId();
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

  useEffect(() => {
    if (authStatus !== "signedIn") {
      setProfileMenuOpen(false);
    }
  }, [authStatus]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (target && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    if (!supabase) {
      return;
    }
    setProfileMenuOpen(false);
    await supabase.auth.signOut();
  };

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
            <div className="profile-menu" ref={profileMenuRef}>
              <button
                className="profile-button"
                type="button"
                aria-label="프로필 메뉴"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls={`${profileMenuId}-menu`}
                onClick={() => setProfileMenuOpen((prev) => !prev)}
              >
                <span className="profile-icon" aria-hidden="true" />
              </button>
              <div
                id={`${profileMenuId}-menu`}
                className="profile-dropdown"
                role="menu"
                aria-hidden={!profileMenuOpen}
                data-open={profileMenuOpen ? "true" : "false"}
              >
                <Link
                  className="profile-menu-item"
                  href="/mypage"
                  role="menuitem"
                  tabIndex={profileMenuOpen ? 0 : -1}
                  onClick={() => setProfileMenuOpen(false)}
                >
                  마이페이지
                </Link>
                <Link
                  className="profile-menu-item"
                  href="/mypage/edit"
                  role="menuitem"
                  tabIndex={profileMenuOpen ? 0 : -1}
                  onClick={() => setProfileMenuOpen(false)}
                >
                  정보 수정
                </Link>
                <button
                  className="profile-menu-item danger"
                  type="button"
                  role="menuitem"
                  tabIndex={profileMenuOpen ? 0 : -1}
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            </div>
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
