"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Notice = { type: "success" | "error"; text: string } | null;
type ProfileForm = {
  name: string;
  relation: string;
  phone: string;
  birthdate: string;
};

const initialForm: ProfileForm = {
  name: "",
  relation: "",
  phone: "",
  birthdate: ""
};

export default function EditProfilePage() {
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
  const [form, setForm] = useState<ProfileForm>(initialForm);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoadingProfile(false);
      return;
    }
    let cancelled = false;
    const loadProfile = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) {
        return;
      }
      if (error || !data.user) {
        setNotice({ type: "error", text: "사용자 정보를 불러오지 못했습니다." });
        setLoadingProfile(false);
        return;
      }
      const metadata = data.user.user_metadata ?? {};
      setEmail(data.user.email ?? "");
      setForm({
        name: metadata.name ?? "",
        relation: metadata.relation ?? "",
        phone: metadata.phone ?? "",
        birthdate: metadata.birthdate ?? ""
      });
      setLoadingProfile(false);
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const updateField = (key: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (notice) {
      setNotice(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!supabase) {
      setNotice({ type: "error", text: "Supabase 환경변수를 먼저 설정해 주세요." });
      return;
    }
    if (!form.name.trim()) {
      setNotice({ type: "error", text: "이름을 입력해 주세요." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: form.name.trim(),
          relation: form.relation.trim(),
          phone: form.phone.trim(),
          birthdate: form.birthdate
        }
      });
      if (error) {
        setNotice({ type: "error", text: error.message });
        return;
      }
      setNotice({ type: "success", text: "정보가 업데이트되었습니다." });
    } catch {
      setNotice({ type: "error", text: "정보 수정에 실패했습니다." });
    } finally {
      setLoading(false);
    }
  };

  const formDisabled = loading || loadingProfile;

  return (
    <AuthGate>
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">정보 수정</h1>
          <p className="page-subtitle">프로필 정보를 업데이트할 수 있어요.</p>
        </header>

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-field">
            <label className="field">
              <span>이메일</span>
              <input
                className="input"
                type="email"
                value={email}
                readOnly
                disabled
              />
            </label>
          </div>
          <div className="signup-field">
            <label className="field">
              <span>이름</span>
              <input
                className="input"
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="이름을 입력해 주세요"
                disabled={formDisabled}
                required
              />
            </label>
          </div>
          <div className="signup-field">
            <label className="field">
              <span>할머니와의 관계</span>
              <input
                className="input"
                type="text"
                value={form.relation}
                onChange={(event) => updateField("relation", event.target.value)}
                placeholder="관계를 입력해 주세요"
                disabled={formDisabled}
              />
            </label>
          </div>
          <div className="signup-field">
            <label className="field">
              <span>전화번호</span>
              <input
                className="input"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="010-1234-5678"
                disabled={formDisabled}
              />
            </label>
          </div>
          <div className="signup-field">
            <label className="field">
              <span>생년월일</span>
              <input
                className="input"
                type="date"
                value={form.birthdate}
                onChange={(event) => updateField("birthdate", event.target.value)}
                disabled={formDisabled}
              />
            </label>
          </div>
          {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
          <div className="block-actions">
            <button
              className="btn"
              type="submit"
              disabled={formDisabled || !supabaseAvailable}
            >
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
          <Link className="text-link" href="/mypage">
            마이페이지로 돌아가기
          </Link>
        </form>

        {!supabaseAvailable && (
          <div className="notice error">
            Supabase 환경변수가 비어 있습니다. README의 설정 섹션을 확인해 주세요.
          </div>
        )}
      </div>
    </AuthGate>
  );
}
