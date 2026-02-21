"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/auth-gate";
import Container from "@/components/ui/container";
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

const formatTitleDate = (date: Date) => formatShortDate(date);

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
    // localStorage: events_v1 (CalendarEvent 목록)
    setEvents(loadEvents());
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
        dateLabel: formatTitleDate(date),
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

  return (
    <div className="bg-[var(--page-bg)]">
      <Container mode="elder" className="min-h-[100dvh] py-4 md:py-6 lg:py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <header className="rounded-xl border border-gray-200 bg-white p-3 md:p-4" aria-label="주간 이동">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,140px)_minmax(0,1fr)_minmax(0,140px)] md:items-center md:gap-3">
              <IconButton
                icon="<"
                label="이전 주"
                mobileLabel="이전"
                className="w-full text-sm md:h-12 md:w-full md:px-0"
                onClick={() => setWeekOffset((prev) => prev - 1)}
              />
              <div className="col-span-2 text-center md:col-span-1">
                <h1 className="text-xl font-bold text-gray-900 md:text-2xl">{weekTitle}</h1>
                <p className="mt-1 text-base font-medium text-gray-600">{rangeText}</p>
              </div>
              <IconButton
                icon=">"
                label="다음 주"
                mobileLabel="다음"
                className="w-full text-sm md:h-12 md:w-full md:px-0"
                onClick={() => setWeekOffset((prev) => prev + 1)}
              />
            </div>
          </header>

          <div className="lg:hidden">
            <AgendaView days={viewDays} />
          </div>

          <WeekGrid days={viewDays} className="hidden lg:grid" />
        </div>
      </Container>
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
