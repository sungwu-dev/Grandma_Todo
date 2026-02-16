"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_ALERT_MINUTES, TIME_BLOCKS } from "@/lib/constants";
import { loadSchedule, SCHEDULE_STORAGE_KEY } from "@/lib/storage";
import { buildBlocks } from "@/lib/time";

type FamilyMember = {
  name: string;
  role: string;
};

type FamilyGroup = {
  id: string;
  title: string;
  members: FamilyMember[];
};

type ProfileMeta = {
  relation: string;
  region: string;
  phone: string;
  birthdate: string;
};

type NextSchedule = {
  time: string;
  title: string;
  meta: string;
};

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSUNG_LATIN = [
  "G",
  "K",
  "N",
  "D",
  "D",
  "R",
  "M",
  "B",
  "B",
  "S",
  "S",
  "",
  "J",
  "J",
  "C",
  "K",
  "T",
  "P",
  "H"
];
const JUNGSEONG_LATIN = [
  "A",
  "A",
  "Y",
  "Y",
  "E",
  "E",
  "Y",
  "Y",
  "O",
  "W",
  "W",
  "W",
  "Y",
  "W",
  "W",
  "W",
  "W",
  "Y",
  "E",
  "E",
  "I"
];

const isHangulSyllable = (char: string) => {
  const code = char.codePointAt(0) ?? 0;
  return code >= HANGUL_BASE && code <= HANGUL_END;
};

const getHangulInitial = (char: string) => {
  const code = (char.codePointAt(0) ?? 0) - HANGUL_BASE;
  if (code < 0 || code > HANGUL_END - HANGUL_BASE) {
    return "";
  }
  const initialIndex = Math.floor(code / 588);
  const vowelIndex = Math.floor((code % 588) / 28);
  const consonant = CHOSUNG_LATIN[initialIndex] ?? "";
  if (consonant) {
    return consonant;
  }
  return JUNGSEONG_LATIN[vowelIndex] ?? "";
};

const getAvatarInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }
  const hangul = Array.from(trimmed).filter(isHangulSyllable);
  if (hangul.length > 0) {
    const target = hangul.slice(-2);
    const letters = target
      .map((char) => getHangulInitial(char))
      .filter((value) => value.length > 0);
    return letters.join("").slice(0, 2);
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
};

const FAMILY_GROUPS: FamilyGroup[] = [
  {
    id: "park-hyunju",
    title: "첫째 딸 가족",
    members: [
      { name: "박현주", role: "첫째 딸" },
      { name: "정길호", role: "첫째 사위" },
      { name: "정다미", role: "손녀" },
      { name: "정다훈", role: "손자" },
      { name: "정진욱", role: "손자" },
      { name: "정유경", role: "손녀" }
    ]
  },
  {
    id: "park-hyunjung",
    title: "둘째 딸 가족",
    members: [
      { name: "박현정", role: "둘째 딸" },
      { name: "홍지석", role: "둘째 사위" },
      { name: "홍성우", role: "손자" }
    ]
  },
  {
    id: "park-suwon",
    title: "아들 가족",
    members: [{ name: "박수원", role: "아들" }]
  }
];

const REGISTERED_MEMBERS_STORAGE_KEY = "registered_family_members_v1";

export default function MyPage() {
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
  const [profileName, setProfileName] = useState("");
  const [profileMeta, setProfileMeta] = useState<ProfileMeta>({
    relation: "",
    region: "",
    phone: "",
    birthdate: ""
  });
  const [nextSchedule, setNextSchedule] = useState<NextSchedule | null>(null);
  const [registeredMembers, setRegisteredMembers] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) {
      setProfileName("");
      setProfileMeta({ relation: "", region: "", phone: "", birthdate: "" });
      return;
    }
    let cancelled = false;

    const loadProfileName = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) {
        return;
      }
      const metadata = data.user?.user_metadata ?? {};
      const name =
        typeof metadata.name === "string"
          ? metadata.name.trim()
          : typeof metadata.nickname === "string"
            ? metadata.nickname.trim()
            : "";
      const relation =
        typeof metadata.relation === "string" ? metadata.relation.trim() : "";
      const region =
        typeof metadata.region === "string" ? metadata.region.trim() : "";
      const phone =
        typeof metadata.phone === "string" ? metadata.phone.trim() : "";
      const birthdate =
        typeof metadata.birthdate === "string" ? metadata.birthdate.trim() : "";
      setProfileName(name);
      setProfileMeta({ relation, region, phone, birthdate });
    };

    void loadProfileName();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadProfileName();
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(REGISTERED_MEMBERS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
        setRegisteredMembers(normalized);
      }
    } catch {
      // Ignore malformed storage values.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const name = profileName.trim();
    if (!name) {
      return;
    }
    setRegisteredMembers((prev) => {
      if (prev.includes(name)) {
        return prev;
      }
      const next = [...prev, name];
      window.localStorage.setItem(
        REGISTERED_MEMBERS_STORAGE_KEY,
        JSON.stringify(next)
      );
      return next;
    });
  }, [profileName]);

  useEffect(() => {
    const updateNextSchedule = () => {
      const stored = loadSchedule();
      const baseBlocks = stored && stored.length > 0 ? stored : TIME_BLOCKS;
      const builtBlocks = buildBlocks(baseBlocks);

      if (builtBlocks.length === 0) {
        setNextSchedule(null);
        return;
      }

      const sorted = [...builtBlocks].sort((a, b) => a.startMin - b.startMin);
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      let nextBlock = sorted.find((block) => block.startMin > nowMinutes);
      let dayOffset = 0;

      if (!nextBlock) {
        nextBlock = sorted[0];
        dayOffset = 1;
      }

      const alertCount =
        Array.isArray(nextBlock.alertMinutes) && nextBlock.alertMinutes.length > 0
          ? nextBlock.alertMinutes.length
          : DEFAULT_ALERT_MINUTES.length;
      const title = nextBlock.label?.trim() ? nextBlock.label : "예정된 일정";
      const baseMeta = `알림 ${alertCount}회 예정`;
      const meta = dayOffset === 1 ? `${baseMeta} · 내일 일정` : baseMeta;

      setNextSchedule({ time: nextBlock.start, title, meta });
    };

    updateNextSchedule();
    const timerId = window.setInterval(updateNextSchedule, 60000);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SCHEDULE_STORAGE_KEY) {
        updateNextSchedule();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearInterval(timerId);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const registeredNameSet = useMemo(() => {
    const set = new Set(registeredMembers);
    if (profileName.trim()) {
      set.add(profileName.trim());
    }
    return set;
  }, [registeredMembers, profileName]);

  const profileInitials = useMemo(() => {
    return getAvatarInitials(profileName) || "NA";
  }, [profileName]);

  const visibleGroups = useMemo(() => {
    const targetName = profileName.trim();
    if (!targetName) {
      return [];
    }
    return FAMILY_GROUPS.filter((group) =>
      group.members.some((member) => member.name === targetName)
    );
  }, [profileName]);

  const nextScheduleDisplay =
    nextSchedule ?? {
      time: "--:--",
      title: "등록된 일정 없음",
      meta: "반복 일정에서 추가해 주세요."
    };

  return (
    <AuthGate>
      <div className="page profile-page">
        <header className="card profile-hero">
          <div className="profile-hero-content">
            <div className="profile-identity">
              <div className="profile-avatar" aria-hidden="true">
                <span>{profileInitials}</span>
              </div>
              <div className="profile-name-group">
                <span className="profile-label">보호자 프로필</span>
                <h1 className="profile-name">{profileName || "사용자"}</h1>
              </div>
            </div>
            <div className="profile-actions">
              <Link className="profile-action" href="/recurring_sch">
                일정 편집
              </Link>
              <Link className="profile-action secondary" href="/calendar">
                캘린더 보기
              </Link>
            </div>
          </div>
        </header>

        <div className="profile-grid">
          <div className="profile-grid-main">
            <section className="card profile-card">
              <h2 className="profile-section-title">내 소개</h2>
              <div className="profile-meta">
                <div className="profile-meta-row">
                  <span className="profile-meta-label">관계</span>
                  <span className="profile-meta-value">
                    {profileMeta.relation || "미입력"}
                  </span>
                </div>
                <div className="profile-meta-row">
                  <span className="profile-meta-label">지역</span>
                  <span className="profile-meta-value">
                    {profileMeta.region || "미입력"}
                  </span>
                </div>
                <div className="profile-meta-row">
                  <span className="profile-meta-label">연락처</span>
                  <span className="profile-meta-value">
                    {profileMeta.phone || "미입력"}
                  </span>
                </div>
                <div className="profile-meta-row">
                  <span className="profile-meta-label">생년월일</span>
                  <span className="profile-meta-value">
                    {profileMeta.birthdate || "미입력"}
                  </span>
                </div>
              </div>
            </section>

            <section className="card profile-card">
              <h2 className="profile-section-title">이번 주 목표</h2>
              <div className="profile-progress-list">
                <div className="profile-progress">
                  <div className="profile-progress-head">
                    <span>약 복용 체크</span>
                    <span className="profile-progress-count">6/7</span>
                  </div>
                  <div className="profile-progress-bar">
                    <span className="profile-progress-fill" style={{ width: "86%" }} />
                  </div>
                </div>
                <div className="profile-progress">
                  <div className="profile-progress-head">
                    <span>물 마시기</span>
                    <span className="profile-progress-count">5/7</span>
                  </div>
                  <div className="profile-progress-bar">
                    <span className="profile-progress-fill" style={{ width: "71%" }} />
                  </div>
                </div>
                <div className="profile-progress">
                  <div className="profile-progress-head">
                    <span>산책</span>
                    <span className="profile-progress-count">2/3</span>
                  </div>
                  <div className="profile-progress-bar">
                    <span className="profile-progress-fill" style={{ width: "67%" }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="card profile-card">
              <h2 className="profile-section-title">최근 활동</h2>
              <ul className="profile-activity-list">
                <li className="profile-activity-item">
                  <div className="profile-activity-head">
                    <span className="profile-activity-title">점심 약 복용 체크</span>
                    <span className="profile-activity-time">오늘 13:10</span>
                  </div>
                  <div className="profile-activity-meta">알림 1회 · 확인 완료</div>
                </li>
                <li className="profile-activity-item">
                  <div className="profile-activity-head">
                    <span className="profile-activity-title">물 마시기 리마인드</span>
                    <span className="profile-activity-time">오늘 10:00</span>
                  </div>
                  <div className="profile-activity-meta">알림 2회 · 진행 중</div>
                </li>
                <li className="profile-activity-item">
                  <div className="profile-activity-head">
                    <span className="profile-activity-title">저녁 산책 기록</span>
                    <span className="profile-activity-time">어제 18:40</span>
                  </div>
                  <div className="profile-activity-meta">기록 추가됨</div>
                </li>
              </ul>
            </section>
          </div>

          <div className="profile-grid-side">
            <section className="card profile-card">
              <h2 className="profile-section-title">돌봄 요약</h2>
              <ul className="profile-summary-list">
                <li className="profile-summary-item">
                  <span className="profile-summary-label">이번 주 알림</span>
                  <span className="profile-summary-value">12건</span>
                </li>
                <li className="profile-summary-item">
                  <span className="profile-summary-label">공유된 일정</span>
                  <span className="profile-summary-value">8개</span>
                </li>
                <li className="profile-summary-item">
                  <span className="profile-summary-label">가족 참여</span>
                  <span className="profile-summary-value">3명</span>
                </li>
                <li className="profile-summary-item">
                  <span className="profile-summary-label">마지막 로그인</span>
                  <span className="profile-summary-value">오늘</span>
                </li>
              </ul>
            </section>

            <section className="card profile-card">
              <h2 className="profile-section-title">다음 일정</h2>
              <div className="profile-next">
                <div className="profile-next-time">{nextScheduleDisplay.time}</div>
                <div className="profile-next-title">{nextScheduleDisplay.title}</div>
                <div className="profile-next-meta">{nextScheduleDisplay.meta}</div>
              </div>
              <Link className="profile-link" href="/elder">
                실시간 화면 보기
              </Link>
            </section>

            <section className="card profile-card">
              <h2 className="profile-section-title">가족 그룹</h2>
              <div className="profile-family-groups">
                {visibleGroups.map((group) => (
                  <div key={group.id} className="profile-family-group">
                    <h3 className="profile-family-title">{group.title}</h3>
                    <ul className="profile-member-list">
                      {group.members.map((member) => {
                        const isRegistered = registeredNameSet.has(member.name);
                        return (
                          <li
                            key={`${group.id}-${member.name}`}
                            className="profile-member"
                            data-registered={isRegistered ? "true" : "false"}
                          >
                            <span className="profile-member-dot" aria-hidden="true" />
                            <div className="profile-member-info">
                              <span className="profile-member-name">{member.name}</span>
                              <span className="profile-member-role">{member.role}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
