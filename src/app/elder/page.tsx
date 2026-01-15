"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEFAULT_ALERT_MINUTES,
  DEFAULT_ALERT_TARGET,
  TIME_BLOCKS,
  WEEKDAY_THEMES
} from "@/lib/constants";
import type { AlertTarget, CalendarEvent, TimeBlock } from "@/lib/types";
import {
  buildBlocks,
  addDays,
  findCurrentBlockIndex,
  formatKoreanTime,
  getDateKey,
  getDayProgressPercent,
  getProgressPercentForTime,
  pad2,
  toMinutes
} from "@/lib/time";
import {
  loadDoneSet,
  loadEvents,
  loadSchedule,
  saveDoneSet,
  EVENTS_STORAGE_KEY,
  SCHEDULE_STORAGE_KEY
} from "@/lib/storage";

type AlertType = `${AlertTarget}${number}`;
type AlertInfo = {
  type: AlertType;
  message: string;
};

const DAY_MINUTES = 24 * 60;

function getAlertMinutesForBlock(block: { alertMinutes?: number[] }): number[] {
  const raw =
    Array.isArray(block.alertMinutes) && block.alertMinutes.length > 0
      ? block.alertMinutes
      : DEFAULT_ALERT_MINUTES;
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of raw) {
    const minute = Math.round(value);
    if (!Number.isFinite(minute) || minute <= 0 || minute >= DAY_MINUTES) {
      continue;
    }
    if (seen.has(minute)) {
      continue;
    }
    seen.add(minute);
    result.push(minute);
  }
  return result;
}

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const eventOccursOnDate = (event: CalendarEvent, dateKey: string) => {
  const repeat = event.repeat ?? "none";
  if (repeat === "none") {
    return dateKey >= event.startDate && dateKey <= event.endDate;
  }
  if (dateKey < event.startDate) {
    return false;
  }
  const date = parseDateKey(dateKey);
  const base = parseDateKey(event.startDate);
  if (!date || !base) {
    return false;
  }
  if (repeat === "daily") {
    return true;
  }
  if (repeat === "weekly") {
    return date.getDay() === base.getDay();
  }
  if (repeat === "yearly") {
    return date.getMonth() === base.getMonth() && date.getDate() === base.getDate();
  }
  return false;
};

export default function ElderPage() {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(TIME_BLOCKS);
  const [now, setNow] = useState(() => new Date());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewOffset, setPreviewOffset] = useState(0);
  const [previewDayOffset, setPreviewDayOffset] = useState(0);
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());
  const [currentDateKey, setCurrentDateKey] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const doneModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutoSlideRef = useRef(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioEnabledRef = useRef(false);
  const themeDefaultsRef = useRef<{
    theme: string;
    themeTint: string;
    pageBg: string;
  } | null>(null);
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
  const [showHomeButton, setShowHomeButton] = useState(true);
  const [homeButtonReady, setHomeButtonReady] = useState(false);

  const blocks = useMemo(() => buildBlocks(timeBlocks), [timeBlocks]);
  const displayIndex = previewIndex ?? currentIndex;
  const displayBlock = blocks[displayIndex] ?? blocks[0];
  const isPreview = previewIndex !== null;
  const hideDone = isPreview && previewOffset > 0;
  const doneChecked = !hideDone && doneSet.has(displayIndex);

  const displayDate = isPreview ? addDays(now, previewDayOffset) : now;
  const theme = WEEKDAY_THEMES[displayDate.getDay()] ?? WEEKDAY_THEMES[0];
  const dateLine = `${displayDate.getFullYear()}년 ${pad2(
    displayDate.getMonth() + 1
  )}월 ${pad2(displayDate.getDate())}일 (${theme.name})`;
  const timeLine = formatKoreanTime(displayDate);
  const previewUsesTaskTime =
    isPreview &&
    previewIndex !== null &&
    (previewIndex !== currentIndex || previewDayOffset !== 0);
  const basePercent =
    previewUsesTaskTime && displayBlock
      ? getProgressPercentForTime(displayBlock.start)
      : getDayProgressPercent(now);
  const progressPercent = (Number.isFinite(basePercent) ? basePercent : 0).toFixed(2);
  const taskProgressStyle = {
    "--time-progress": `${progressPercent}%`
  } as React.CSSProperties;

  const displayMinutes = useMemo(() => {
    if (previewUsesTaskTime && displayBlock) {
      const minutes = toMinutes(displayBlock.start);
      if (!Number.isNaN(minutes)) {
        return minutes;
      }
    }
    return displayDate.getHours() * 60 + displayDate.getMinutes();
  }, [previewUsesTaskTime, displayBlock, displayDate]);

  const activeEvent = useMemo(() => {
    if (events.length === 0) {
      return null;
    }
    const dateKey = getDateKey(displayDate);
    const candidates = events.filter((event) => eventOccursOnDate(event, dateKey));
    if (candidates.length === 0) {
      return null;
    }
    const sorted = [...candidates].sort((a, b) => {
      if (a.allDay && !b.allDay) {
        return 1;
      }
      if (!a.allDay && b.allDay) {
        return -1;
      }
      return toMinutes(a.start) - toMinutes(b.start);
    });
    for (const event of sorted) {
      if (event.allDay) {
        return event;
      }
      const startMin = toMinutes(event.start);
      const endMin = toMinutes(event.end);
      if (Number.isNaN(startMin) || Number.isNaN(endMin)) {
        continue;
      }
      if (displayMinutes >= startMin && displayMinutes < endMin) {
        return event;
      }
    }
    return null;
  }, [events, displayDate, displayMinutes]);

  const displayDateKey = getDateKey(displayDate);
  const nowDateKey = getDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let beforeStart = false;
  if (displayDateKey > nowDateKey) {
    beforeStart = true;
  } else if (displayDateKey === nowDateKey && displayBlock) {
    const startMin = toMinutes(displayBlock.start);
    if (!Number.isNaN(startMin) && nowMinutes < startMin) {
      beforeStart = true;
    }
  }
  const doneDisabled = hideDone || beforeStart || Boolean(activeEvent);

  useEffect(() => {
    if (!supabaseAvailable) {
      setShowHomeButton(true);
      setHomeButtonReady(true);
      return;
    }
    if (!supabase) {
      return;
    }

    let cancelled = false;
    const checkHomeVisibility = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        if (!cancelled) {
          setShowHomeButton(true);
          setHomeButtonReady(true);
        }
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
        setShowHomeButton(true);
        setHomeButtonReady(true);
        return;
      }
      const isGrandma = (members ?? []).some((member) => member.role === "viewer");
      setShowHomeButton(!isGrandma);
      setHomeButtonReady(true);
    };

    void checkHomeVisibility();
    return () => {
      cancelled = true;
    };
  }, [supabaseAvailable, supabase]);

  useEffect(() => {
    const stored = localStorage.getItem("audio_enabled") === "1";
    setAudioEnabled(stored);
    audioEnabledRef.current = stored;
  }, []);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    if (!audioEnabled) {
      return;
    }
    const unlock = () => {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      context.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [audioEnabled]);
  useEffect(() => {
    const stored = loadSchedule();
    if (stored && stored.length > 0) {
      setTimeBlocks(stored);
    }
    setEvents(loadEvents());
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SCHEDULE_STORAGE_KEY) {
        const stored = loadSchedule();
        if (stored && stored.length > 0) {
          setTimeBlocks(stored);
        }
      }
      if (event.key === EVENTS_STORAGE_KEY) {
        setEvents(loadEvents());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (blocks.length === 0) {
      return;
    }
    const updateIndex = () => {
      setCurrentIndex(findCurrentBlockIndex(new Date(), blocks));
    };
    updateIndex();
    setPreviewIndex(null);
    setPreviewOffset(0);
    setPreviewDayOffset(0);
    const timerId = window.setInterval(updateIndex, 30000);
    return () => window.clearInterval(timerId);
  }, [blocks]);

  useEffect(() => {
    const dateKey = getDateKey(now);
    if (dateKey !== currentDateKey) {
      setCurrentDateKey(dateKey);
      setDoneSet(loadDoneSet(dateKey));
    }
  }, [now, currentDateKey]);

  useEffect(() => {
    if (!themeDefaultsRef.current) {
      const styles = getComputedStyle(document.documentElement);
      themeDefaultsRef.current = {
        theme: styles.getPropertyValue("--theme").trim(),
        themeTint: styles.getPropertyValue("--theme-tint").trim(),
        pageBg: styles.getPropertyValue("--page-bg").trim()
      };
    }
    return () => {
      const defaults = themeDefaultsRef.current;
      if (!defaults) {
        return;
      }
      document.documentElement.style.setProperty("--theme", defaults.theme);
      document.documentElement.style.setProperty("--theme-tint", defaults.themeTint);
      if (defaults.pageBg) {
        document.documentElement.style.setProperty("--page-bg", defaults.pageBg);
      } else {
        document.documentElement.style.removeProperty("--page-bg");
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--theme", theme.color);
    document.documentElement.style.setProperty("--theme-tint", theme.tint);
    document.documentElement.style.setProperty("--page-bg", theme.tint);
  }, [theme.color, theme.tint]);

  useEffect(() => {
    if (blocks.length === 0) {
      return;
    }
    setCurrentIndex((prev) => Math.min(prev, blocks.length - 1));
    setPreviewIndex((prev) =>
      prev === null ? null : Math.min(prev, blocks.length - 1)
    );
  }, [blocks.length]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current);
      }
      if (flashIntervalRef.current) {
        window.clearInterval(flashIntervalRef.current);
      }
      if (doneModalTimerRef.current) {
        window.clearTimeout(doneModalTimerRef.current);
      }
    };
  }, []);

  const clearAlertTimers = () => {
    if (alertTimeoutRef.current) {
      window.clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
    if (flashIntervalRef.current) {
      window.clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
  };

  const stopAlert = () => {
    clearAlertTimers();
    setFlashOn(false);
    setAlertInfo(null);
  };

  const startFlash = () => {
    if (flashIntervalRef.current) {
      window.clearInterval(flashIntervalRef.current);
    }
    let toggles = 0;
    setFlashOn(true);
    flashIntervalRef.current = window.setInterval(() => {
      // 초기 ON 포함 6회 번쩍임을 만들기 위해 11번 토글한다.
      toggles += 1;
      setFlashOn((prev) => !prev);
      if (toggles >= 11) {
        if (flashIntervalRef.current) {
          window.clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
        }
        setFlashOn(false);
      }
    }, 200);
  };

  const ensureAudioContext = async (): Promise<AudioContext | null> => {
    if (!audioEnabledRef.current) {
      return null;
    }
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    if (context.state !== "running") {
      try {
        await context.resume();
      } catch (err) {
        return null;
      }
    }
    return context.state === "running" ? context : null;
  };

  const playBeep = (times: number) => {
    void (async () => {
      const context = await ensureAudioContext();
      if (!context) {
        return;
      }
      const baseTime = context.currentTime;
      for (let i = 0; i < times; i += 1) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.connect(gain);
        gain.connect(context.destination);
        const startAt = baseTime + i * 0.22;
        osc.start(startAt);
        osc.stop(startAt + 0.12);
      }
    })();
  };

  const triggerAlert = (type: AlertType, message: string, beepTimes: number) => {
    clearAlertTimers();
    setAlertInfo({ type, message });
    startFlash();
    playBeep(beepTimes);
    alertTimeoutRef.current = window.setTimeout(() => {
      stopAlert();
    }, 8000);
  };

  const handleAudioToggle = async () => {
    if (audioEnabled) {
      setAudioEnabled(false);
      audioEnabledRef.current = false;
      localStorage.setItem("audio_enabled", "0");
      return;
    }
    try {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await context.resume();
      setAudioEnabled(true);
      audioEnabledRef.current = true;
      localStorage.setItem("audio_enabled", "1");
    } catch (err) {
      setAudioEnabled(false);
      audioEnabledRef.current = false;
      localStorage.setItem("audio_enabled", "0");
    }
  };

  // 3초 프리뷰 후 자동으로 현재 화면으로 복귀.
  const showPreview = (index: number) => {
    setPreviewIndex(index);
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = window.setTimeout(() => {
      setPreviewIndex(null);
      setPreviewOffset(0);
      setPreviewDayOffset(0);
    }, 3000);
  };

  const handlePreview = (delta: number) => {
    if (blocks.length === 0) {
      return;
    }
    const nextOffset = previewIndex === null ? delta : previewOffset + delta;
    const baseIndex = previewIndex === null ? currentIndex : previewIndex;
    const lastIndex = blocks.length - 1;
    if (delta > 0 && baseIndex === lastIndex) {
      setPreviewDayOffset((prev) => prev + 1);
    }
    if (delta < 0 && baseIndex === 0) {
      setPreviewDayOffset((prev) => prev - 1);
    }
    const nextIndex = (baseIndex + delta + blocks.length) % blocks.length;
    setPreviewOffset(nextOffset);
    showPreview(nextIndex);
  };

  const closeDoneModal = () => {
    if (doneModalTimerRef.current) {
      window.clearTimeout(doneModalTimerRef.current);
      doneModalTimerRef.current = null;
    }
    setDoneModalOpen(false);
    if (pendingAutoSlideRef.current) {
      pendingAutoSlideRef.current = false;
      handlePreview(1);
    }
  };

  // 15초마다 분 단위로 알림을 체크하고 중복 알림은 localStorage로 막는다.
  useEffect(() => {
    if (blocks.length === 0) {
      return;
    }

    const tick = () => {
      const nowDate = new Date();
      const dateKey = getDateKey(nowDate);
      const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      let triggered = false;

      for (let index = 0; index < blocks.length; index += 1) {
        if (triggered) {
          break;
        }
        if (doneSet.has(index)) {
          continue;
        }
        const block = blocks[index];
        const alertTarget = block.alertTarget ?? DEFAULT_ALERT_TARGET;
        const baseMin =
          alertTarget === "end" ? toMinutes(block.end) : toMinutes(block.start);
        if (Number.isNaN(baseMin)) {
          continue;
        }

        const alertMinutes = getAlertMinutesForBlock(block);
        for (const minuteBefore of alertMinutes) {
          const targetMinute = baseMin - minuteBefore;
          if (targetMinute < 0 || targetMinute >= DAY_MINUTES) {
            continue;
          }
          if (targetMinute !== nowMinutes) {
            continue;
          }
          const type = `${alertTarget}${minuteBefore}` as AlertType;
          const blockKey = `${block.start}-${block.end}`;
          const key = `alert_${dateKey}_${blockKey}_${type}`;
          if (localStorage.getItem(key) === "1") {
            continue;
          }
          localStorage.setItem(key, "1");
          const message =
            alertTarget === "end"
              ? `${minuteBefore}분 남았어요\n${block.label}`
              : `${minuteBefore}분 전이에요\n${block.label}`;
          triggerAlert(type, message, 2);
          triggered = true;
          break;
        }
      }
    };

    tick();
    const timerId = window.setInterval(tick, 15000);
    return () => window.clearInterval(timerId);
  }, [blocks, doneSet]);

  // 다음 방향 프리뷰 중이면 완료 토글을 막는다.
  const handleDoneClick = () => {
    if (doneDisabled) {
      return;
    }
    const targetIndex = previewIndex !== null ? previewIndex : currentIndex;
    const nextSet = new Set(doneSet);
    const wasDone = nextSet.has(targetIndex);
    if (wasDone) {
      nextSet.delete(targetIndex);
    } else {
      nextSet.add(targetIndex);
    }
    setDoneSet(nextSet);
    const key = currentDateKey || getDateKey(new Date());
    saveDoneSet(key, nextSet);
    if (!wasDone) {
      setDoneModalOpen(true);
      pendingAutoSlideRef.current = true;
      if (doneModalTimerRef.current) {
        window.clearTimeout(doneModalTimerRef.current);
      }
      doneModalTimerRef.current = window.setTimeout(() => {
        closeDoneModal();
      }, 2000);
    }
  };

  const taskLabel = activeEvent ? activeEvent.label : displayBlock?.label ?? "";
  const taskMeta = activeEvent
    ? (() => {
        const rangeText =
          activeEvent.startDate === activeEvent.endDate
            ? ""
            : `${activeEvent.startDate} ~ ${activeEvent.endDate}`;
        const timeText = activeEvent.allDay
          ? "종일"
          : `${activeEvent.start} ~ ${activeEvent.end}`;
        if (rangeText) {
          return `기간 ${rangeText} · 시간 ${timeText}`;
        }
        return activeEvent.allDay ? "시간 종일" : `시간 ${timeText}`;
      })()
    : displayBlock
      ? `시간 ${displayBlock.start} ~ ${displayBlock.end}`
      : "";
  const textLength = taskLabel.replace(/\s/g, "").length;
  const taskSizeClass =
    textLength >= 26 ? "task-text--xlong" : textLength >= 18 ? "task-text--long" : "";
  const nowLabelText = isPreview ? "미리보기" : activeEvent ? "특별 일정" : "지금 할 일";
  const shouldShowHomeButton = !supabaseAvailable || (homeButtonReady && showHomeButton);

  return (
    <div className="app elder-home" id="appRoot">
      <div className="elder-top-actions" aria-label="빠른 이동">
        {shouldShowHomeButton && (
          <Link className="big-button elder-calendar-fab elder-calendar-fab-left" href="/">
            홈
          </Link>
        )}
        <Link className="big-button elder-calendar-fab elder-calendar-fab-right" href="/elder/calendar">
          달력 보기
        </Link>
      </div>
      <header className="top">
        <div id="dateText" className="date-text">
          {dateLine}
        </div>
        <div id="timeText" className="time-text" aria-live="polite">
          {timeLine}
        </div>
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            className="rounded-full border-2 px-4 py-2 text-sm font-semibold shadow-sm"
            style={{
              borderColor: "var(--theme)",
              backgroundColor: audioEnabled ? "var(--theme)" : "var(--surface-strong)",
              color: audioEnabled ? "#1b1b1b" : "var(--text-main)"
            }}
            onClick={handleAudioToggle}
          >
            {audioEnabled ? "🔊 소리 켜짐" : "🔊 소리 켜기"}
          </button>
        </div>
      </header>

      <main className="middle">
        <button
          id="prevBtn"
          className="nav-btn prev"
          aria-label="이전 시간대 미리보기"
          onClick={() => handlePreview(-1)}
        />

        <div
          className={`task-area ${isPreview ? "previewing" : ""}`}
          id="taskArea"
          style={taskProgressStyle}
        >
          <div id="nowLabel" className="now-label">
            {nowLabelText}
          </div>
          <div id="taskText" className={`task-text ${taskSizeClass}`} aria-live="polite">
            {taskLabel}
          </div>
          <div id="taskMeta" className="task-meta">
            {taskMeta}
          </div>
        </div>

        <button
          id="nextBtn"
          className="nav-btn next"
          aria-label="다음 시간대 미리보기"
          onClick={() => handlePreview(1)}
        />
      </main>

      <footer className="bottom">
        <button
          id="doneBtn"
          className="done-btn"
          aria-pressed={doneChecked}
          aria-hidden={hideDone ? "true" : undefined}
          aria-disabled={doneDisabled ? "true" : undefined}
          data-hidden={hideDone ? "true" : undefined}
          data-checked={doneChecked ? "true" : undefined}
          data-disabled={doneDisabled ? "true" : undefined}
          disabled={doneDisabled}
          onClick={handleDoneClick}
        >
          <span className="done-check" aria-hidden="true" />
          <span id="doneText">다 했어요!</span>
        </button>
      </footer>

      {flashOn && (
        <div
          className="fixed inset-0 z-30"
          style={{ backgroundColor: "var(--theme-tint)", opacity: 0.9 }}
          aria-hidden="true"
        />
      )}

      {alertInfo && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/95 p-8 text-center shadow-2xl">
            <div className="text-sm font-semibold tracking-[0.4em] text-slate-500">알림</div>
            <div className="mt-4 whitespace-pre-line text-3xl font-bold text-slate-900">
              {alertInfo.message}
            </div>
            <button
              type="button"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full py-3 text-xl font-bold shadow-lg"
              style={{ backgroundColor: "var(--theme)", color: "#1b1b1b" }}
              onClick={stopAlert}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {doneModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white/95 p-8 text-center shadow-2xl">
            <div className="text-3xl font-bold text-slate-900">잘했어요!</div>
            <button
              type="button"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full py-3 text-xl font-bold shadow-lg"
              style={{ backgroundColor: "var(--theme)", color: "#1b1b1b" }}
              onClick={closeDoneModal}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
