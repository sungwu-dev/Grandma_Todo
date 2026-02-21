import type { CalendarEvent, TimeBlock } from "./types";
import { toMinutes, validateSchedule } from "./time";

export const SCHEDULE_STORAGE_KEY = "schedule_v1";
export const EVENTS_STORAGE_KEY = "events_v1";
export const DONE_ACTIVITY_STORAGE_KEY = "done_activity_v1";

export type DoneActivityItem = {
  id: string;
  title: string;
  completedAt: string; // ISO datetime
  dateKey: string; // YYYY-MM-DD
};

const MAX_DONE_ACTIVITY_ITEMS = 200;

export function loadDoneSet(dateKey: string): Set<number> {
  if (typeof window === "undefined") {
    return new Set();
  }
  const raw = localStorage.getItem(`done_${dateKey}`);
  if (!raw) {
    return new Set();
  }
  try {
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list : []);
  } catch (err) {
    return new Set();
  }
}

export function saveDoneSet(dateKey: string, set: Set<number>): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(`done_${dateKey}`, JSON.stringify([...set]));
}

function normalizeDoneActivity(
  item: Record<string, unknown>
): DoneActivityItem | null {
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const completedAt =
    typeof item.completedAt === "string" ? item.completedAt.trim() : "";
  const dateKey = typeof item.dateKey === "string" ? item.dateKey.trim() : "";
  if (!id || !title || !completedAt || !dateKey) {
    return null;
  }
  if (Number.isNaN(new Date(completedAt).getTime())) {
    return null;
  }
  return { id, title, completedAt, dateKey };
}

export function loadDoneActivities(): DoneActivityItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(DONE_ACTIVITY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) =>
        item && typeof item === "object"
          ? normalizeDoneActivity(item as Record<string, unknown>)
          : null
      )
      .filter((item): item is DoneActivityItem => Boolean(item));
  } catch {
    return [];
  }
}

export function appendDoneActivity(
  item: Omit<DoneActivityItem, "id">
): DoneActivityItem {
  const nextItem: DoneActivityItem = {
    ...item,
    id: `done_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  };
  if (typeof window === "undefined") {
    return nextItem;
  }
  const current = loadDoneActivities();
  const next = [nextItem, ...current].slice(0, MAX_DONE_ACTIVITY_ITEMS);
  localStorage.setItem(DONE_ACTIVITY_STORAGE_KEY, JSON.stringify(next));
  return nextItem;
}

export function loadSchedule(): TimeBlock[] | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return null;
    }

    const blocks: TimeBlock[] = data
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as Record<string, unknown>;
        if (typeof record.start !== "string" || typeof record.end !== "string") {
          return null;
        }
        const block: TimeBlock = {
          start: record.start,
          end: record.end
        };
        if (typeof record.label === "string" || Array.isArray(record.label)) {
          block.label = record.label as TimeBlock["label"];
        }
        if (Array.isArray(record.tasks)) {
          block.tasks = record.tasks.map((task) => String(task));
        }
        if (record.alertTarget === "start" || record.alertTarget === "end") {
          block.alertTarget = record.alertTarget;
        }
        if (Array.isArray(record.alertMinutes)) {
          const minutes = record.alertMinutes
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
            .map((value) => Math.round(value));
          if (minutes.length > 0) {
            block.alertMinutes = minutes;
          }
        }
        return block;
      })
      .filter((block): block is TimeBlock => Boolean(block));

    const validation = validateSchedule(blocks);
    if (!validation.ok) {
      return null;
    }
    return blocks;
  } catch (err) {
    return null;
  }
}

export function saveSchedule(blocks: TimeBlock[]): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(blocks));
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const REPEAT_VALUES = new Set(["none", "daily", "weekly", "yearly"]);

function normalizeEvent(item: Record<string, unknown>): CalendarEvent | null {
  const rawStartDate =
    typeof item.startDate === "string"
      ? item.startDate
      : typeof item.date === "string"
        ? item.date
        : "";
  const rawEndDate =
    typeof item.endDate === "string"
      ? item.endDate
      : typeof item.date === "string"
        ? item.date
        : "";
  const label = typeof item.label === "string" ? item.label.trim() : "";
  const allDay = item.allDay === true;
  const repeat =
    typeof item.repeat === "string" && REPEAT_VALUES.has(item.repeat)
      ? (item.repeat as CalendarEvent["repeat"])
      : "none";
  const startValue =
    typeof item.start === "string" ? item.start : allDay ? "00:00" : "";
  const endValue =
    typeof item.end === "string" ? item.end : allDay ? "23:59" : "";

  if (!DATE_REGEX.test(rawStartDate) || !DATE_REGEX.test(rawEndDate)) {
    return null;
  }
  if (!label) {
    return null;
  }

  const start = allDay ? "00:00" : startValue;
  const end = allDay ? (endValue || "23:59") : endValue;
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (Number.isNaN(startMin) || Number.isNaN(endMin) || startMin >= endMin) {
    return null;
  }

  const startDate = rawEndDate < rawStartDate ? rawEndDate : rawStartDate;
  const endDate = rawEndDate < rawStartDate ? rawStartDate : rawEndDate;
  const id =
    typeof item.id === "string" && item.id.trim()
      ? item.id
      : `${startDate}_${endDate}_${start}_${end}_${label}`;

  return { id, startDate, endDate, start, end, label, allDay, repeat };
}

export function loadEvents(): CalendarEvent[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(EVENTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item) => (item && typeof item === "object" ? normalizeEvent(item) : null))
      .filter((event): event is CalendarEvent => Boolean(event));
  } catch (err) {
    return [];
  }
}

export function saveEvents(events: CalendarEvent[]): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
}
