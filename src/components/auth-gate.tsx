"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthGateProps = {
  children: ReactNode;
};

type AuthStatus = "loading" | "signedOut" | "signedIn";
type Session = { user: { id: string } } | null;
type AuthSessionData = { session: Session };
type Notice = { type: "success" | "error"; text: string } | null;

export default function AuthGate({ children }: AuthGateProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
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
      setStatus("signedOut");
      return;
    }
    if (!supabase) {
      return;
    }
    let cancelled = false;

    const updateStatus = (session: Session) => {
      if (cancelled) {
        return;
      }
      setStatus(session ? "signedIn" : "signedOut");
    };

    supabase.auth.getSession().then(({ data }: { data: AuthSessionData }) => {
      updateStatus(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session) => {
        updateStatus(session);
      }
    );

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabaseAvailable, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setNotice({ type: "error", text: "이메일을 입력해 주세요." });
      return;
    }
    if (!password) {
      setNotice({ type: "error", text: "비밀번호를 입력해 주세요." });
      return;
    }
    if (!supabase) {
      setNotice({
        type: "error",
        text: "Supabase 환경변수를 먼저 설정해 주세요."
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password
      });
      if (error) {
        setNotice({ type: "error", text: error.message });
        return;
      }
      setNotice({ type: "success", text: "로그인되었습니다." });
    } catch {
      setNotice({ type: "error", text: "로그인에 실패했습니다." });
    } finally {
      setLoading(false);
    }
  };

  if (status === "signedIn") {
    return <>{children}</>;
  }

  if (status === "loading") {
    return null;
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">로그인 후 이용 가능합니다</h1>
        <p className="page-subtitle">계정을 입력하면 계속 이용할 수 있어요.</p>
      </header>

      <form className="signup-form" onSubmit={handleSubmit}>
        <div className="signup-field">
          <label className="field">
            <span>이메일</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={loading}
              required
            />
          </label>
        </div>
        <div className="signup-field">
          <label className="field">
            <span>비밀번호</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </label>
        </div>
        <div className="block-actions">
          <button className="btn" type="submit" disabled={loading || !supabaseAvailable}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>
      </form>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      {!supabaseAvailable && (
        <div className="notice error">
          Supabase 환경변수가 설정되지 않았습니다. README를 확인해 주세요.
        </div>
      )}
    </div>
  );
}
