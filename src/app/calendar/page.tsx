"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type WheelEvent } from "react";
import Link from "next/link";
import type { CalendarEvent } from "@/lib/types";
import { getDateKey, toMinutes } from "@/lib/time";
import { loadEvents, saveEvents } from "@/lib/storage";

type Notice = { type: "success" | "error"; text: string } | null;

const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];

const buildDefaultForm = (date: string) => ({
  startDate: date,
  endDate: date,
  start: "09:00",
  end: "10:00",
  label: "",
  allDay: false
});

const createEventId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const buildMonthDays = (cursor: Date) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: getDateKey(date),
      inMonth: date.getMonth() === month
    };
  });
};

const sortEvents = (list: CalendarEvent[]) =>
  [...list].sort((a, b) => {
    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate);
    }
    return toMinutes(a.start) - toMinutes(b.start);
  });

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const buildRangeKeys = (startKey: string, endKey: string) => {
  const startDate = parseDateKey(startKey);
  const endDate = parseDateKey(endKey);
  if (!startDate || !endDate) {
    return [];
  }
  const [from, to] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  const cursor = new Date(from);
  const keys: string[] = [];
  while (cursor <= to) {
    keys.push(getDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(getDateKey(today));
  const [form, setForm] = useState(buildDefaultForm(getDateKey(today)));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [yearMode, setYearMode] = useState<"display" | "select" | "input">("display");
  const [monthMode, setMonthMode] = useState<"display" | "select" | "input">("display");
  const [yearDraft, setYearDraft] = useState(String(cursor.getFullYear()));
  const [monthDraft, setMonthDraft] = useState(String(cursor.getMonth() + 1));
  const yearSelectRef = useRef<HTMLSelectElement | null>(null);
  const monthSelectRef = useRef<HTMLSelectElement | null>(null);
  const yearInputRef = useRef<HTMLInputElement | null>(null);
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monthAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [monthTransition, setMonthTransition] = useState<"none" | "next" | "prev">("none");

  useEffect(() => {
    setEvents(loadEvents());
  }, []);

  useEffect(() => {
    return () => {
      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
      }
      if (monthAnimationRef.current !== null) {
        window.clearTimeout(monthAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (yearMode !== "input") {
      setYearDraft(String(cursor.getFullYear()));
    }
    if (monthMode !== "input") {
      setMonthDraft(String(cursor.getMonth() + 1));
    }
  }, [cursor, yearMode, monthMode]);

  useEffect(() => {
    if (yearMode === "select") {
      yearSelectRef.current?.focus();
    }
    if (yearMode === "input") {
      yearInputRef.current?.focus();
      yearInputRef.current?.select();
    }
  }, [yearMode]);

  useEffect(() => {
    if (monthMode === "select") {
      monthSelectRef.current?.focus();
    }
    if (monthMode === "input") {
      monthInputRef.current?.focus();
      monthInputRef.current?.select();
    }
  }, [monthMode]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = 2000; year <= 2100; year += 1) {
      list.push(year);
    }
    return list;
  }, []);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const monthDays = useMemo(() => buildMonthDays(cursor), [cursor]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const keys = buildRangeKeys(event.startDate, event.endDate);
      for (const key of keys) {
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)?.push(event);
      }
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => {
    const list = eventsByDate.get(selectedDate) ?? [];
    return [...list].sort((a, b) => {
      if (a.allDay && !b.allDay) {
        return -1;
      }
      if (!a.allDay && b.allDay) {
        return 1;
      }
      return toMinutes(a.start) - toMinutes(b.start);
    });
  }, [eventsByDate, selectedDate]);

  const handleSelectDate = (dateKey: string, openModal = false) => {
    setSelectedDate(dateKey);
    if (openModal) {
      setForm(buildDefaultForm(dateKey));
    } else {
      setForm((prev) => ({ ...prev, startDate: dateKey, endDate: dateKey }));
    }
    setNotice(null);
    if (openModal) {
      setAddModalOpen(true);
    }
  };

  const handleChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "startDate" && typeof value === "string") {
      const parsed = parseDateKey(value);
      if (parsed) {
        setSelectedDate(value);
        setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      }
    }
  };

  const validateForm = () => {
    if (!form.startDate || !form.endDate) {
      return "기간을 선택해 주세요.";
    }
    if (!form.label.trim()) {
      return "일정 내용을 입력해 주세요.";
    }
    if (form.endDate < form.startDate) {
      return "종료 날짜는 시작 날짜보다 빠를 수 없습니다.";
    }
    if (form.allDay) {
      return null;
    }
    const startMin = toMinutes(form.start);
    const endMin = toMinutes(form.end);
    if (Number.isNaN(startMin) || Number.isNaN(endMin)) {
      return "시간 형식을 확인해 주세요.";
    }
    if (startMin >= endMin) {
      return "종료 시간이 시작 시간보다 늦어야 합니다.";
    }
    return null;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      setNotice({ type: "error", text: error });
      return;
    }
    const nextEvent: CalendarEvent = {
      id: createEventId(),
      startDate: form.startDate,
      endDate: form.endDate,
      start: form.allDay ? "00:00" : form.start,
      end: form.allDay ? "23:59" : form.end,
      label: form.label.trim(),
      allDay: form.allDay
    };
    const nextEvents = sortEvents([...events, nextEvent]);
    setEvents(nextEvents);
    saveEvents(nextEvents);
    setForm(buildDefaultForm(form.startDate));
    setNotice({ type: "success", text: "일정을 추가했습니다." });
  };

  const handleDelete = (id: string) => {
    const nextEvents = events.filter((event) => event.id !== id);
    setEvents(nextEvents);
    saveEvents(nextEvents);
    setNotice({ type: "success", text: "일정을 삭제했습니다." });
  };

  const handleAllDayChange = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      allDay: checked,
      start: checked ? "00:00" : prev.start,
      end: checked ? "23:59" : prev.end
    }));
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    setNotice(null);
  };

  const isToday = (dateKey: string) => dateKey === getDateKey(today);

  const clampYear = (value: number) => Math.min(2100, Math.max(2000, Math.round(value)));
  const clampMonth = (value: number) => Math.min(12, Math.max(1, Math.round(value)));

  const applyYear = (value: number) => {
    const nextYear = clampYear(value);
    setCursor(new Date(nextYear, cursor.getMonth(), 1));
  };

  const applyMonth = (value: number) => {
    const nextMonth = clampMonth(value);
    setCursor(new Date(cursor.getFullYear(), nextMonth - 1, 1));
  };

  const handleYearChange = (value: string) => {
    const nextYear = Number(value);
    if (!Number.isFinite(nextYear)) {
      return;
    }
    applyYear(nextYear);
    setYearMode("display");
  };

  const handleMonthChange = (value: string) => {
    const nextMonth = Number(value);
    if (!Number.isFinite(nextMonth)) {
      return;
    }
    applyMonth(nextMonth);
    setMonthMode("display");
  };

  const commitYearInput = (value: string) => {
    const nextYear = Number(value);
    if (Number.isFinite(nextYear)) {
      applyYear(nextYear);
    }
    setYearMode("display");
  };

  const commitMonthInput = (value: string) => {
    const nextMonth = Number(value);
    if (Number.isFinite(nextMonth)) {
      applyMonth(nextMonth);
    }
    setMonthMode("display");
  };

  const handleJumpDate = (value: string) => {
    const parsed = parseDateKey(value);
    if (!parsed) {
      return;
    }
    setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    handleSelectDate(getDateKey(parsed));
  };

  const shiftSelectedDate = (delta: number) => {
    const parsed = parseDateKey(selectedDate);
    if (!parsed) {
      return;
    }
    parsed.setDate(parsed.getDate() + delta);
    const nextKey = getDateKey(parsed);
    setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    handleSelectDate(nextKey);
  };

  const handleCalendarWheel = (event: WheelEvent<HTMLElement>) => {
    wheelDeltaRef.current += event.deltaY;
    if (wheelTimerRef.current !== null) {
      return;
    }
    wheelTimerRef.current = window.setTimeout(() => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      wheelTimerRef.current = null;
      if (Math.abs(delta) < 40) {
        return;
      }
      const direction = delta > 0 ? 1 : -1;
      setMonthTransition(direction > 0 ? "next" : "prev");
      if (monthAnimationRef.current !== null) {
        window.clearTimeout(monthAnimationRef.current);
      }
      monthAnimationRef.current = window.setTimeout(() => {
        setMonthTransition("none");
        monthAnimationRef.current = null;
      }, 260);
      setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    }, 140);
  };

  return (
    <div className="page calendar-page">
      <header className="page-header">
        <h1 className="page-title">일정 캘린더</h1>
        <p className="page-subtitle">기본 일정 외의 일정을 간편하게 관리하세요.</p>
      </header>

      <div className="calendar-layout">
        <section className="card" onWheel={handleCalendarWheel}>
          <div className="calendar-header">
            <div className="calendar-month-nav">
              <button
                type="button"
                className="calendar-arrow"
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                }
                aria-label="이전 달"
              >
                &lt;
              </button>
              <div className="calendar-title-group">
                {yearMode === "input" ? (
                  <input
                    className="calendar-title-input"
                    ref={yearInputRef}
                    value={yearDraft}
                    onChange={(event) => setYearDraft(event.target.value.replace(/[^\d]/g, ""))}
                    onBlur={() => commitYearInput(yearDraft)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitYearInput(yearDraft);
                      }
                      if (event.key === "Escape") {
                        setYearDraft(String(cursor.getFullYear()));
                        setYearMode("display");
                      }
                    }}
                    inputMode="numeric"
                    maxLength={4}
                    aria-label="연도 입력"
                  />
                ) : yearMode === "select" ? (
                  <select
                    className="calendar-title-select"
                    ref={yearSelectRef}
                    value={cursor.getFullYear()}
                    onChange={(event) => handleYearChange(event.target.value)}
                    onBlur={() => setYearMode("display")}
                    aria-label="연도 선택"
                  >
                    {years.map((year) => (
                      <option key={`year-${year}`} value={year}>
                        {year}년
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className="calendar-title-button"
                    onClick={() => {
                      setYearMode("select");
                      setMonthMode("display");
                    }}
                    onDoubleClick={() => {
                      setYearMode("input");
                      setYearDraft(String(cursor.getFullYear()));
                      setMonthMode("display");
                    }}
                  >
                    {cursor.getFullYear()}년
                  </button>
                )}
                {monthMode === "input" ? (
                  <input
                    className="calendar-title-input"
                    ref={monthInputRef}
                    value={monthDraft}
                    onChange={(event) => setMonthDraft(event.target.value.replace(/[^\d]/g, ""))}
                    onBlur={() => commitMonthInput(monthDraft)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitMonthInput(monthDraft);
                      }
                      if (event.key === "Escape") {
                        setMonthDraft(String(cursor.getMonth() + 1));
                        setMonthMode("display");
                      }
                    }}
                    inputMode="numeric"
                    maxLength={2}
                    aria-label="월 입력"
                  />
                ) : monthMode === "select" ? (
                  <select
                    className="calendar-title-select"
                    ref={monthSelectRef}
                    value={cursor.getMonth() + 1}
                    onChange={(event) => handleMonthChange(event.target.value)}
                    onBlur={() => setMonthMode("display")}
                    aria-label="월 선택"
                  >
                    {months.map((month) => (
                      <option key={`month-${month}`} value={month}>
                        {month}월
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className="calendar-title-button"
                    onClick={() => {
                      setMonthMode("select");
                      setYearMode("display");
                    }}
                    onDoubleClick={() => {
                      setMonthMode("input");
                      setMonthDraft(String(cursor.getMonth() + 1));
                      setYearMode("display");
                    }}
                  >
                    {cursor.getMonth() + 1}월
                  </button>
                )}
              </div>
              <button
                type="button"
                className="calendar-arrow"
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                }
                aria-label="다음 달"
              >
                &gt;
              </button>
            </div>
            <div className="calendar-controls">
              <button
                type="button"
                className="calendar-today"
                onClick={() => {
                  const next = new Date(today.getFullYear(), today.getMonth(), 1);
                  setCursor(next);
                  handleSelectDate(getDateKey(today));
                }}
              >
                오늘
              </button>
            </div>
          </div>
          <div className="calendar-jump">
            <span className="calendar-jump-label">날짜 이동</span>
            <input
              className="input calendar-jump-input"
              type="date"
              value={selectedDate}
              onChange={(event) => handleJumpDate(event.target.value)}
            />
          </div>

          <div
            className={`calendar-body${
              monthTransition === "none" ? "" : ` calendar-body--${monthTransition}`
            }`}
          >
            <div className="calendar-week">
              {weekLabels.map((label) => (
                <div key={label} className="calendar-weekday">
                  {label}
                </div>
              ))}
            </div>

            <div className="calendar-grid">
              {monthDays.map((day) => {
                const dayEvents = eventsByDate.get(day.key) ?? [];
                return (
                  <button
                    key={day.key}
                    type="button"
                    className="calendar-day"
                    data-outside={!day.inMonth}
                    data-selected={day.key === selectedDate}
                    data-today={isToday(day.key)}
                    onClick={() => handleSelectDate(day.key, true)}
                  >
                    <span className="calendar-day-number">{Number(day.key.slice(-2))}</span>
                    {dayEvents.length > 0 && (
                      <span className="calendar-dot" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {addModalOpen && (
        <div className="calendar-modal" role="dialog" aria-modal="true">
          <div
            className="calendar-modal-backdrop"
            onClick={closeAddModal}
            aria-hidden="true"
          />
          <div className="calendar-modal-card">
            <div className="calendar-modal-section">
              <div className="calendar-modal-head">
                <div className="calendar-section-title">선택한 날짜 일정</div>
                <p className="calendar-section-subtitle">일정을 확인하고 추가할 수 있어요.</p>
              </div>
              <div className="calendar-day-header">
                <button
                  type="button"
                  className="calendar-arrow calendar-arrow--small"
                  onClick={() => shiftSelectedDate(-1)}
                  aria-label="이전 날"
                >
                  &lt;
                </button>
                <div>
                  <div className="calendar-day-title">{selectedDate}</div>
                  <div className="calendar-day-subtitle">선택한 날짜 일정</div>
                </div>
                <button
                  type="button"
                  className="calendar-arrow calendar-arrow--small"
                  onClick={() => shiftSelectedDate(1)}
                  aria-label="다음 날"
                >
                  &gt;
                </button>
              </div>
              {selectedEvents.length === 0 ? (
                <p className="page-subtitle" style={{ marginTop: 8 }}>
                  선택한 날짜에 등록된 일정이 없습니다.
                </p>
              ) : (
                <ul className="calendar-events">
                  {selectedEvents.map((event) => (
                    <li key={event.id} className="calendar-event-item">
                      <div>
                        <div className="calendar-event-title">{event.label}</div>
                        <div className="calendar-event-time">
                          {event.startDate === event.endDate
                            ? event.startDate
                            : `${event.startDate} ~ ${event.endDate}`}
                          {" · "}
                          {event.allDay ? "종일" : `${event.start} ~ ${event.end}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => handleDelete(event.id)}
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="calendar-modal-divider" />

            <div className="calendar-modal-section">
              <div className="calendar-modal-head">
                <div className="calendar-section-title">일정 추가</div>
                <p className="calendar-section-subtitle">
                  기간과 시간을 설정해 새로운 일정을 등록하세요.
                </p>
              </div>
              <form className="calendar-form" onSubmit={handleSubmit}>
                <label className="field">
                  <span>일정 제목</span>
                  <input
                    className="input"
                    value={form.label}
                    onChange={(event) => handleChange("label", event.target.value)}
                    placeholder="예: 병원 입원"
                    required
                  />
                </label>
                <div className="calendar-range-grid">
                  <label className="field">
                    <span>시작 날짜</span>
                    <input
                      className="input"
                      type="date"
                      value={form.startDate}
                      onChange={(event) => handleChange("startDate", event.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>종료 날짜</span>
                    <input
                      className="input"
                      type="date"
                      value={form.endDate}
                      onChange={(event) => handleChange("endDate", event.target.value)}
                      required
                    />
                  </label>
                </div>
                <label className="calendar-toggle">
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={(event) => handleAllDayChange(event.target.checked)}
                  />
                  <span>하루 종일</span>
                </label>
                <div
                  className="calendar-time-grid"
                  data-disabled={form.allDay ? "true" : undefined}
                >
                  <label className="field">
                    <span>시작 시간</span>
                    <input
                      className="input"
                      type="time"
                      value={form.start}
                      onChange={(event) => handleChange("start", event.target.value)}
                      disabled={form.allDay}
                      required={!form.allDay}
                    />
                  </label>
                  <label className="field">
                    <span>종료 시간</span>
                    <input
                      className="input"
                      type="time"
                      value={form.end}
                      onChange={(event) => handleChange("end", event.target.value)}
                      disabled={form.allDay}
                      required={!form.allDay}
                    />
                  </label>
                </div>
                <div className="block-actions">
                  <button type="submit" className="btn">
                    일정 추가
                  </button>
                  <button type="button" className="btn ghost" onClick={closeAddModal}>
                    닫기
                  </button>
                  <Link className="btn secondary" href="/elder">
                    할머니 화면 보기
                  </Link>
                </div>
              </form>
              {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
