"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Notice = { type: "success" | "error"; text: string } | null;
type AuthSessionData = { session: { user: { id: string } } | null };
type SignupForm = {
  name: string;
  relation: string;
  email: string;
  password: string;
  phone: string;
  birthdate: string;
  grandmaBirthcode: string;
};
type SignupTouched = Record<keyof SignupForm, boolean>;
type BirthdateParts = {
  year: string;
  month: string;
  day: string;
};
type SignupStep = {
  key: keyof SignupForm;
  label: string;
  placeholder: string;
  type: "text" | "email" | "password" | "tel" | "date";
  autoComplete?: string;
  inputMode?: "text" | "email" | "search" | "tel" | "url" | "none" | "numeric";
  maxLength?: number;
  options?: string[];
  validate: (value: string) => string | null;
};

const initialSignupForm: SignupForm = {
  name: "",
  relation: "",
  email: "",
  password: "",
  phone: "",
  birthdate: "",
  grandmaBirthcode: ""
};
const initialSignupTouched: SignupTouched = {
  name: false,
  relation: false,
  email: false,
  password: false,
  phone: false,
  birthdate: false,
  grandmaBirthcode: false
};
const initialBirthdateParts: BirthdateParts = {
  year: "",
  month: "",
  day: ""
};
const GRANDMA_BIRTHCODE = "490818";
const RELATION_OPTIONS = [
  "큰 딸",
  "작은 딸",
  "아들",
  "큰사위",
  "작은사위",
  "손자",
  "손녀"
];

const parseDateInput = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

const SIGNUP_STEPS: SignupStep[] = [
  {
    key: "email",
    label: "아이디(이메일)",
    placeholder: "name@example.com",
    type: "email",
    autoComplete: "email",
    validate: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return "이메일을 입력해 주세요.";
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return "이메일 형식이 올바르지 않습니다.";
      }
      return null;
    }
  },
  {
    key: "password",
    label: "비밀번호",
    placeholder: "8자 이상 입력",
    type: "password",
    autoComplete: "new-password",
    validate: (value) => {
      if (!value) {
        return "비밀번호를 입력해 주세요.";
      }
      if (value.length < 8) {
        return "비밀번호는 8자 이상 입력해 주세요.";
      }
      if (/\s/.test(value)) {
        return "비밀번호에 공백을 사용할 수 없습니다.";
      }
      return null;
    }
  },
  {
    key: "name",
    label: "이름",
    placeholder: "홍성우",
    type: "text",
    autoComplete: "name",
    validate: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return "이름을 입력해 주세요.";
      }
      if (trimmed.length < 2) {
        return "이름은 2자 이상 입력해 주세요.";
      }
      return null;
    }
  },
  {
    key: "relation",
    label: "할머니와의 관계",
    placeholder: "관계를 선택해 주세요",
    type: "text",
    autoComplete: "off",
    options: RELATION_OPTIONS,
    validate: (value) => {
      if (!value.trim()) {
        return "할머니와의 관계를 선택해 주세요.";
      }
      return null;
    }
  },
  {
    key: "birthdate",
    label: "생년월일",
    placeholder: "YYYY-MM-DD",
    type: "text",
    autoComplete: "bday",
    validate: (value) => {
      if (!value) {
        return "생년월일을 입력해 주세요.";
      }
      const date = parseDateInput(value);
      if (!date) {
        return "생년월일 형식이 올바르지 않습니다.";
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date > today) {
        return "생년월일은 오늘 이후 날짜로 입력할 수 없습니다.";
      }
      return null;
    }
  },
  {
    key: "phone",
    label: "전화번호",
    placeholder: "010-1234-5678",
    type: "tel",
    autoComplete: "tel",
    validate: (value) => {
      const digits = value.replace(/\D/g, "");
      if (!digits) {
        return "전화번호를 입력해 주세요.";
      }
      if (!/^01[016789]\d{7,8}$/.test(digits)) {
        return "전화번호 형식이 올바르지 않습니다.";
      }
      return null;
    }
  },
  {
    key: "grandmaBirthcode",
    label: "할머니 생년월일 6자리",
    placeholder: "6자리 입력",
    type: "tel",
    autoComplete: "off",
    inputMode: "numeric",
    maxLength: 6,
    validate: (value) => {
      const digits = value.replace(/\D/g, "");
      if (digits.length !== 6) {
        return "할머니 생년월일 6자리를 입력해 주세요.";
      }
      if (digits !== GRANDMA_BIRTHCODE) {
        return "할머니 생년월일이 일치하지 않습니다.";
      }
      return null;
    }
  }
];

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";
  const rawRedirect = searchParams.get("redirectedFrom") || "/recurring_sch";
  const redirectTo = rawRedirect.startsWith("/") ? rawRedirect : "/recurring_sch";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [signupForm, setSignupForm] = useState<SignupForm>(initialSignupForm);
  const [signupTouched, setSignupTouched] =
    useState<SignupTouched>(initialSignupTouched);
  const [birthdateParts, setBirthdateParts] =
    useState<BirthdateParts>(initialBirthdateParts);
  const [signupComplete, setSignupComplete] = useState(false);
  const [signupNotice, setSignupNotice] = useState<Notice>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const birthdateRefs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => {
    if (!isSignup) {
      return;
    }
    setSignupForm(initialSignupForm);
    setSignupTouched(initialSignupTouched);
    setBirthdateParts(initialBirthdateParts);
    setSignupComplete(false);
    setSignupNotice(null);
    setSignupLoading(false);
  }, [isSignup]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(({ data }: { data: AuthSessionData }) => {
      if (data.session) {
        router.replace(redirectTo);
      }
    });
  }, [supabase, router, redirectTo]);

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
      router.replace(redirectTo);
    } catch {
      setNotice({ type: "error", text: "로그인에 실패했습니다." });
    } finally {
      setLoading(false);
    }
  };

  const updateSignupField = (key: keyof SignupForm, value: string) => {
    setSignupForm((prev) => ({ ...prev, [key]: value }));
    if (signupNotice) {
      setSignupNotice(null);
    }
  };

  const handleSignupChange = (key: keyof SignupForm, value: string) => {
    let nextValue = value;
    if (key === "grandmaBirthcode") {
      nextValue = value.replace(/\D/g, "").slice(0, 6);
    }
    updateSignupField(key, nextValue);
  };

  const handleSignupBlur = (key: keyof SignupForm) => {
    setSignupTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const focusBirthdateIndex = (index: number) => {
    const target = birthdateRefs.current[index];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const updateBirthdateParts = (nextParts: BirthdateParts) => {
    setBirthdateParts(nextParts);
    const complete =
      nextParts.year.length === 4 &&
      nextParts.month.length === 2 &&
      nextParts.day.length === 2;
    const nextValue = complete
      ? `${nextParts.year}-${nextParts.month}-${nextParts.day}`
      : "";
    setSignupForm((prev) => ({ ...prev, birthdate: nextValue }));
    if (signupNotice) {
      setSignupNotice(null);
    }
  };

  const handleBirthdateChange =
    (part: keyof BirthdateParts, maxLength: number, nextIndex?: number) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, maxLength);
      const nextParts = { ...birthdateParts, [part]: digits };
      updateBirthdateParts(nextParts);
      if (digits.length === maxLength && nextIndex !== undefined) {
        focusBirthdateIndex(nextIndex);
      }
    };

  const handleBirthdateKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (event.key !== "Backspace") {
      return;
    }
    if (event.currentTarget.value || index === 0) {
      return;
    }
    event.preventDefault();
    focusBirthdateIndex(index - 1);
  };

  const handleBirthdateBlur = (index: number) => {
    if (index === 2) {
      handleSignupBlur("birthdate");
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignupNotice(null);
    const errors = SIGNUP_STEPS.map((step) => step.validate(signupForm[step.key]));
    if (errors.some(Boolean)) {
      setSignupTouched((prev) => {
        const next = { ...prev };
        SIGNUP_STEPS.forEach((step) => {
          next[step.key] = true;
        });
        return next;
      });
      return;
    }
    if (!supabase) {
      setSignupNotice({
        type: "error",
        text: "Supabase 환경변수를 먼저 설정해 주세요."
      });
      return;
    }
    setSignupLoading(true);
    try {
      const redirectUrl = new URL("/auth/callback", window.location.origin);
      redirectUrl.searchParams.set("redirectedFrom", redirectTo);
      const trimmedEmail = signupForm.email.trim();
      const trimmedName = signupForm.name.trim();
      const trimmedRelation = signupForm.relation.trim();
      const phoneDigits = signupForm.phone.replace(/\D/g, "");
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: signupForm.password,
        options: {
          emailRedirectTo: redirectUrl.toString(),
          data: {
            name: trimmedName,
            relation: trimmedRelation,
            phone: phoneDigits,
            birthdate: signupForm.birthdate
          }
        }
      });
      if (error) {
        setSignupNotice({ type: "error", text: error.message });
        return;
      }
      const successMessage = data.session
        ? "회원가입이 완료되었습니다."
        : "회원가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.";
      setSignupNotice({ type: "success", text: successMessage });
      setSignupComplete(true);
    } catch {
      setSignupNotice({ type: "error", text: "회원가입에 실패했습니다." });
    } finally {
      setSignupLoading(false);
    }
  };

  const signupErrors = SIGNUP_STEPS.map((step) =>
    step.validate(signupForm[step.key])
  );
  let visibleCount = 1;
  for (let index = 0; index < SIGNUP_STEPS.length - 1; index += 1) {
    if (signupErrors[index]) {
      break;
    }
    visibleCount = index + 2;
  }
  const visibleSignupSteps = SIGNUP_STEPS.slice(0, visibleCount);
  const allSignupValid = signupErrors.every((error) => !error);

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{isSignup ? "회원가입" : "로그인"}</h1>
        {!isSignup && (
          <p className="page-subtitle">
            가족 일정 관리 기능은 로그인 후 이용할 수 있어요.
          </p>
        )}
      </header>

      <section>
        {isSignup ? (
          signupComplete ? (
            <div className="signup-form">
              <div className="notice success">
                {signupNotice?.text ||
                  "회원가입이 완료되었습니다. 로그인 페이지에서 계속 진행해 주세요."}
              </div>
              <Link className="btn" href="/login">
                로그인으로 이동
              </Link>
            </div>
          ) : (
            <form className="signup-form" onSubmit={handleSignupSubmit} noValidate>
              {visibleSignupSteps.map((step, index) => {
                const value = signupForm[step.key];
                const error = signupErrors[index];
                const hasValue = value.trim() !== "";
                const isBirthdateComplete =
                  birthdateParts.year.length === 4 &&
                  birthdateParts.month.length === 2 &&
                  birthdateParts.day.length === 2;
                const showError = Boolean(
                  error &&
                    (signupTouched[step.key] ||
                      (step.key === "birthdate"
                        ? isBirthdateComplete
                        : hasValue))
                );
                if (step.key === "relation") {
                  return (
                    <div key={step.key} className="signup-field">
                      <label className="field">
                        <span>{step.label}</span>
                        <select
                          className="input"
                          value={value}
                          onChange={(event) =>
                            handleSignupChange(step.key, event.target.value)
                          }
                          onBlur={() => handleSignupBlur(step.key)}
                          disabled={signupLoading}
                          required
                        >
                          <option value="">선택해 주세요</option>
                          {step.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      {showError && <div className="notice error">{error}</div>}
                    </div>
                  );
                }
                if (step.key === "birthdate") {
                  return (
                    <div key={step.key} className="signup-field">
                      <label className="field">
                        <span>{step.label}</span>
                        <div className="birthdate-input-group">
                          <input
                            ref={(element) => {
                              birthdateRefs.current[0] = element;
                            }}
                            className="birthdate-input-slot"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            placeholder="YYYY"
                            value={birthdateParts.year}
                            onChange={handleBirthdateChange("year", 4, 1)}
                            onKeyDown={(event) => handleBirthdateKeyDown(event, 0)}
                            onBlur={() => handleBirthdateBlur(0)}
                            autoComplete="bday-year"
                            disabled={signupLoading}
                          />
                          <input
                            ref={(element) => {
                              birthdateRefs.current[1] = element;
                            }}
                            className="birthdate-input-slot"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={2}
                            placeholder="MM"
                            value={birthdateParts.month}
                            onChange={handleBirthdateChange("month", 2, 2)}
                            onKeyDown={(event) => handleBirthdateKeyDown(event, 1)}
                            onBlur={() => handleBirthdateBlur(1)}
                            autoComplete="bday-month"
                            disabled={signupLoading}
                          />
                          <input
                            ref={(element) => {
                              birthdateRefs.current[2] = element;
                            }}
                            className="birthdate-input-slot"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={2}
                            placeholder="DD"
                            value={birthdateParts.day}
                            onChange={handleBirthdateChange("day", 2)}
                            onKeyDown={(event) => handleBirthdateKeyDown(event, 2)}
                            onBlur={() => handleBirthdateBlur(2)}
                            autoComplete="bday-day"
                            disabled={signupLoading}
                          />
                        </div>
                      </label>
                      {showError && <div className="notice error">{error}</div>}
                    </div>
                  );
                }
                return (
                  <div key={step.key} className="signup-field">
                    <label className="field">
                      <span>{step.label}</span>
                      <input
                        className="input"
                        type={step.type}
                        value={value}
                        onChange={(event) =>
                          handleSignupChange(step.key, event.target.value)
                        }
                        onBlur={() => handleSignupBlur(step.key)}
                        placeholder={step.placeholder}
                        autoComplete={step.autoComplete}
                        inputMode={step.inputMode}
                        maxLength={step.maxLength}
                        required
                        autoFocus={index === 0}
                        disabled={signupLoading}
                      />
                    </label>
                    {showError && <div className="notice error">{error}</div>}
                  </div>
                );
              })}
              {signupNotice && signupNotice.type === "error" && (
                <div className="notice error">{signupNotice.text}</div>
              )}
              {allSignupValid && (
                <div className="block-actions">
                  <button className="btn" type="submit" disabled={signupLoading}>
                    {signupLoading ? "가입 중..." : "입력 완료"}
                  </button>
                </div>
              )}
              <Link className="text-link" href="/login">
                이미 계정이 있나요? 로그인하기
              </Link>
            </form>
          )
        ) : (
          <form className="signup-form" onSubmit={handleSubmit}>
            <div className="signup-field">
              <label className="field">
                <span>이메일 주소</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
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
                  required
                />
              </label>
            </div>
            <div className="block-actions">
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </div>
          </form>
        )}
      </section>

      {!isSignup && notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      {!supabaseAvailable && (
        <div className="notice error">
          Supabase 환경변수가 비어 있습니다. README의 설정 섹션을 확인해 주세요.
        </div>
      )}

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
