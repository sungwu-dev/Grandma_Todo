"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/auth-gate";
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
    document.body.classList.add("elder-mode");
    return () => {
      document.body.classList.remove("elder-mode");
    };
  }, []);

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

  return (
    <div className="page elder-week elder-week-screen">
      <div className="elder-top-actions" aria-label="빠른 이동">
        <button
          type="button"
          className="big-button elder-calendar-fab elder-calendar-fab-left"
          onClick={() => setWeekOffset(0)}
        >
          금주 일정
        </button>
        <Link
          className="big-button elder-calendar-fab elder-calendar-fab-right"
          href="/elder"
        >
          현재 할 일
        </Link>
      </div>
      <header className="elder-week-top" aria-label="주간 이동">
        <div className="elder-week-title-row">
          <button
            type="button"
            className="elder-week-arrow elder-week-arrow--prev"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            aria-label="?? ? ??"
          >?? ?</button>
          <div className="elder-week-title">{weekTitle}</div>
          <button
            type="button"
            className="elder-week-arrow elder-week-arrow--next"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            aria-label="?? ? ??"
          >?? ?</button>
        </div>
        <div className="elder-week-range">{rangeText}</div>
      </header>

      <section className="elder-week-board" aria-live="polite">
        {weekDates.map((date) => {
          const dateKey = getDateKey(date);
          const dayEvents = sortEvents(
            events.filter((event) => eventMatchesDate(event, dateKey))
          );
          const visibleEvents = dayEvents.slice(0, MAX_EVENTS_PER_DAY);
          const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length);
          const isToday = dateKey === todayKey;

          return (
            <article
              key={dateKey}
              className="elder-week-col"
              data-today={isToday ? "true" : undefined}
            >
              <div className="elder-week-col-head">
                <div className="elder-week-col-weekday">{WEEK_LABELS[date.getDay()]}</div>
                <div className="elder-week-col-date">{formatTitleDate(date)}</div>
                {isToday && <span className="elder-week-col-badge">오늘</span>}
              </div>
              {dayEvents.length === 0 ? (
                <div className="elder-week-col-empty">일정 없음</div>
              ) : (
                <ul className="elder-week-col-list">
                  {visibleEvents.map((event) => (
                    <li key={`${event.id}-${dateKey}`} className="elder-week-col-event">
                      <div className="elder-week-col-time">{formatEventTime(event)}</div>
                      <div className="elder-week-col-title">{event.label}</div>
                      {event.startDate !== event.endDate && (
                        <div className="elder-week-col-note">
                          기간 {event.startDate} ~ {event.endDate}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {hiddenCount > 0 && (
                <div className="elder-week-col-more">외 {hiddenCount}개 일정</div>
              )}
            </article>
          );
        })}
      </section>
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
