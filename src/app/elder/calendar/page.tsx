"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
import IconButton from "@/components/ui/icon-button";
import AgendaView from "@/components/ui/agenda-view";
import WeekGrid from "@/components/ui/week-grid";
import { WEEKDAY_THEMES } from "@/lib/constants";
import type { CalendarEvent } from "@/lib/types";
import { addDays, getDateKey, pad2, toMinutes } from "@/lib/time";
import { loadEvents } from "@/lib/storage";

const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_EVENTS_PER_DAY = 4;

const formatShortDate = (date: Date) =>
  `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

const sortEvents = (list: CalendarEvent[]) =>
  [...list].sort((a, b) => {
    if (a.allDay && !b.allDay) {
      return -1;
    }
    if (!a.allDay && b.allDay) {
      return 1;
    }
    return toMinutes(a.start) - toMinutes(b.start);
  });

const formatEventTime = (event: CalendarEvent) =>
  event.allDay ? "종일" : `${event.start} ~ ${event.end}`;

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const eventMatchesDate = (event: CalendarEvent, dateKey: string) => {
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

const getWeekStart = (date: Date) => {
  const day = date.getDay();
  const diffFromMonday = (day + 6) % 7;
  return addDays(date, -diffFromMonday);
};

function ElderCalendarContent() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const today = useMemo(() => new Date(), []);
  const themeDefaultsRef = useRef<{
    theme: string;
    themeTint: string;
    pageBg: string;
  } | null>(null);

  useEffect(() => {
    setEvents(loadEvents());
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "events_v1") {
        setEvents(loadEvents());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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
    const theme = WEEKDAY_THEMES[today.getDay()] ?? WEEKDAY_THEMES[0];
    document.documentElement.style.setProperty("--theme", theme.color);
    document.documentElement.style.setProperty("--theme-tint", theme.tint);
    document.documentElement.style.setProperty("--page-bg", theme.tint);
  }, [today]);

  const baseDate = useMemo(() => addDays(today, weekOffset * 7), [today, weekOffset]);
  const weekStart = useMemo(() => getWeekStart(baseDate), [baseDate]);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const rangeText = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `${formatShortDate(weekStart)} ~ ${formatShortDate(end)}`;
  }, [weekStart]);
  const todayKey = getDateKey(today);
  const weekTitle = "이번 주 일정";

  const viewDays = useMemo(() => {
    return weekDates.map((date) => {
      const dateKey = getDateKey(date);
      const dayEvents = sortEvents(
        events.filter((event) => eventMatchesDate(event, dateKey))
      );
      const visibleEvents = dayEvents.slice(0, MAX_EVENTS_PER_DAY);
      return {
        dateKey,
        weekdayLabel: WEEK_LABELS[date.getDay()],
        dateLabel: formatShortDate(date),
        isToday: dateKey === todayKey,
        events: visibleEvents.map((event) => ({
          id: event.id,
          label: event.label,
          timeText: formatEventTime(event),
          noteText:
            event.startDate !== event.endDate
              ? `기간 ${event.startDate} ~ ${event.endDate}`
              : undefined
        })),
        hiddenCount: Math.max(0, dayEvents.length - visibleEvents.length)
      };
    });
  }, [weekDates, events, todayKey]);

  const weekHasEvents = useMemo(
    () => viewDays.some((day) => day.events.length > 0 || day.hiddenCount > 0),
    [viewDays]
  );

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-3 py-3 md:gap-4 md:py-4">
        <section className="mx-auto w-full max-w-[1080px] px-4 md:px-6 lg:px-8">
          <header className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:p-4" aria-label="주간 이동">
            <div className="grid grid-cols-[56px_1fr_56px] items-center gap-3">
              <div className="flex items-center justify-center">
                <IconButton
                  icon="<"
                  label="이전 주"
                  className="h-12 w-12 rounded-lg p-0 text-xl md:h-14 md:w-14"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-gray-900 md:text-2xl">{weekTitle}</h1>
                <p className="mt-1 text-base font-medium text-gray-600">{rangeText}</p>
              </div>
              <div className="flex items-center justify-center">
                <IconButton
                  icon=">"
                  label="다음 주"
                  className="h-12 w-12 rounded-lg p-0 text-xl md:h-14 md:w-14"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                />
              </div>
            </div>
          </header>
        </section>

        <section className="mx-auto w-full max-w-[1080px] flex-1 px-4 pb-3 md:px-6 md:pb-4 lg:px-8">
          {weekHasEvents ? (
            <>
              <div className="lg:hidden">
                <AgendaView days={viewDays} />
              </div>
              <WeekGrid days={viewDays} className="hidden lg:grid" />
            </>
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center">
              <div className="w-full rounded-xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm md:max-w-2xl md:py-12">
                <p className="text-3xl font-bold text-gray-900 md:text-4xl">일정이 없어요</p>
                <p className="mt-3 text-base font-medium text-gray-600 md:text-lg">
                  이번 주에 등록된 일정이 없습니다.
                </p>
                <p className="mt-2 text-sm font-medium text-gray-500 md:text-base">
                  가족 모드에서 일정을 추가하면 여기에서 바로 확인할 수 있어요.
                </p>
                <Link
                  href="/calendar"
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-5 text-base font-semibold text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                >
                  일정 추가하러 가기
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ElderCalendarPage() {
  return (
    <AuthGate>
      <ElderCalendarContent />
    </AuthGate>
  );
}
