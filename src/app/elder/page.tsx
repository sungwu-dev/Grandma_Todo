"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/auth-gate";
import PrimaryButton from "@/components/ui/primary-button";
import IconButton from "@/components/ui/icon-button";
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
  pad2,
  toMinutes
} from "@/lib/time";
import {
  appendDoneActivity,
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

function ElderPageContent() {
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
    const timerId = setInterval(() => setNow(new Date()), 1000);
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
    const timerId = setInterval(updateIndex, 30000);
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
    flashIntervalRef.current = setInterval(() => {
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
    alertTimeoutRef.current = setTimeout(() => {
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
    previewTimerRef.current = setTimeout(() => {
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
    const timerId = setInterval(tick, 15000);
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
      const titleSource = activeEvent ? activeEvent.label : displayBlock?.label ?? "";
      appendDoneActivity({
        title: titleSource.trim() || "일정",
        completedAt: new Date().toISOString(),
        dateKey: key
      });
      setDoneModalOpen(true);
      pendingAutoSlideRef.current = true;
      if (doneModalTimerRef.current) {
        window.clearTimeout(doneModalTimerRef.current);
      }
      doneModalTimerRef.current = setTimeout(() => {
        closeDoneModal();
      }, 2000);
    }
  };

  const taskLabel = (activeEvent ? activeEvent.label : displayBlock?.label ?? "").trim();
  const displayTaskLabel = taskLabel || "일정이 없어요";
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
  const textLength = displayTaskLabel.replace(/\s/g, "").length;
  const taskTitleClass =
    textLength >= 26
      ? "text-3xl font-bold leading-tight md:text-5xl"
      : textLength >= 18
        ? "text-3xl font-bold leading-tight md:text-[3.5rem]"
        : "text-3xl font-bold leading-tight md:text-6xl";
  const nowLabelText = isPreview ? "미리보기" : activeEvent ? "특별 일정" : "지금 할 일";
  const dayProgressPercent = (() => {
    const startOfDay = new Date(displayDate);
    startOfDay.setHours(0, 0, 0, 0);
    const elapsed = displayDate.getTime() - startOfDay.getTime();
    const ratio = elapsed / (24 * 60 * 60 * 1000);
    return Math.max(0, Math.min(100, ratio * 100));
  })();

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-3 py-3 md:grid md:h-[100dvh] md:grid-rows-[auto_1fr] md:overflow-hidden md:gap-3 md:py-2">
        <header className="mx-auto w-full max-w-[920px] px-4 md:px-6 lg:px-8">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-center shadow-sm md:px-6 md:py-3">
            <div id="dateText" className="text-lg font-semibold text-gray-700 md:text-xl">
              {dateLine}
            </div>
            <div
              id="timeText"
              className="mt-0.5 text-5xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-6xl lg:text-7xl"
              aria-live="polite"
            >
              {timeLine}
            </div>
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-base font-semibold text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                data-active={audioEnabled ? "true" : undefined}
                onClick={handleAudioToggle}
              >
                {audioEnabled ? "소리 켜짐" : "소리 켜기"}
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[920px] px-4 md:flex md:flex-1 md:items-center md:justify-center md:px-6 lg:px-8">
          <div className="grid w-full grid-cols-[56px_1fr_56px] items-center gap-3 md:gap-4">
            <div className="flex items-center justify-center">
              <IconButton
                icon="<"
                label="이전 시간대 미리보기"
                className="h-12 w-12 rounded-lg p-0 text-xl md:h-14 md:w-14"
                onClick={() => handlePreview(-1)}
              />
            </div>

            <div className="flex flex-col gap-4">
              <article
                id="taskArea"
                className={[
                  "w-full rounded-xl border border-gray-200 bg-white px-5 py-6 text-center shadow-sm md:px-8 md:py-8",
                  isPreview ? "border-gray-300" : ""
                ].join(" ")}
              >
                <div className="h-1.5 w-full rounded-full bg-gray-200" aria-hidden="true">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${dayProgressPercent.toFixed(2)}%`,
                      backgroundColor: theme.color,
                      opacity: 0.9
                    }}
                  />
                </div>
                <div className="mt-3 text-sm font-semibold text-gray-600">{nowLabelText}</div>
                <div id="taskText" className={`mt-2 text-gray-900 ${taskTitleClass}`} aria-live="polite">
                  {displayTaskLabel}
                </div>
                <div className="mt-4 border-t border-gray-200 pt-3 text-base font-medium text-gray-600">
                  {taskMeta}
                </div>
              </article>

              <PrimaryButton
                id="doneBtn"
                variant="primary"
                aria-pressed={doneChecked}
                aria-hidden={hideDone ? "true" : undefined}
                aria-disabled={doneDisabled ? "true" : undefined}
                disabled={doneDisabled}
                onClick={handleDoneClick}
                className={[
                  "w-full min-h-14 rounded-full py-3 text-xl md:min-h-16 md:py-4 md:text-2xl",
                  doneChecked ? "border-amber-800 bg-amber-800" : "",
                  hideDone ? "invisible pointer-events-none" : ""
                ].join(" ")}
              >
                <span className="inline-flex items-center justify-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/20 leading-none ring-1 ring-white/50">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`h-5 w-5 text-white transition-opacity ${doneChecked ? "opacity-100" : "opacity-0"}`}
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span>다 했어요!</span>
                </span>
              </PrimaryButton>
            </div>

            <div className="flex items-center justify-center">
              <IconButton
                icon=">"
                label="다음 시간대 미리보기"
                className="h-12 w-12 rounded-lg p-0 text-xl md:h-14 md:w-14"
                onClick={() => handlePreview(1)}
              />
            </div>
          </div>
        </section>

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
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
            <div className="text-sm font-semibold tracking-[0.4em] text-slate-500">알림</div>
            <div className="mt-4 whitespace-pre-line text-3xl font-bold text-slate-900">
              {alertInfo.message}
            </div>
            <PrimaryButton type="button" className="mt-6 w-full rounded-lg py-3 text-xl" onClick={stopAlert}>
              확인
            </PrimaryButton>
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
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center">
            <div className="text-3xl font-bold text-slate-900">잘했어요!</div>
            <PrimaryButton type="button" className="mt-6 w-full rounded-lg py-3 text-xl" onClick={closeDoneModal}>
              확인
            </PrimaryButton>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

export default function ElderPage() {
  return (
    <AuthGate>
      <ElderPageContent />
    </AuthGate>
  );
}
