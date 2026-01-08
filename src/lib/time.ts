import type { BuiltBlock, TimeBlock } from "./types";
import { DEFAULT_ALERT_TARGET } from "./constants";

const DAY_MINUTES = 24 * 60;

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatKoreanTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const isPm = hours >= 12;
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const meridiem = isPm ? "오후" : "오전";
  return `${meridiem} ${pad2(hour12)}:${pad2(minutes)}`;
}

export function toMinutes(timeStr: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(timeStr);
  if (!match) {
    return Number.NaN;
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    return Number.NaN;
  }
  if (hh === 24 && mm === 0) {
    return DAY_MINUTES;
  }
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return Number.NaN;
  }
  return hh * 60 + mm;
}

export function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(Math.round(minutes), DAY_MINUTES));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
}

export function buildBlocks(blocks: TimeBlock[]): BuiltBlock[] {
  const result: BuiltBlock[] = [];

  blocks.forEach((block) => {
    const startMin = toMinutes(block.start);
    const endMin = toMinutes(block.end);
    if (Number.isNaN(startMin) || Number.isNaN(endMin)) {
      return;
    }
    const alertMinutes = Array.isArray(block.alertMinutes)
      ? [...block.alertMinutes]
      : undefined;
    const alertTarget = block.alertTarget ?? DEFAULT_ALERT_TARGET;

    const tasks = Array.isArray(block.tasks)
      ? block.tasks
      : Array.isArray(block.label)
        ? block.label
        : [block.label ?? ""];
    const normalized = tasks
      .filter((task) => typeof task === "string")
      .map((task) => task.trim())
      .filter((task) => task.length > 0);
    const list = normalized.length > 0 ? normalized : [""];

    if (list.length <= 1) {
      result.push({
        startMin,
        endMin,
        start: block.start,
        end: block.end,
        label: list[0],
        alertMinutes,
        alertTarget
      });
      return;
    }

    // Split a single time block into evenly sized sub-tasks.
    const duration = endMin - startMin;
    const base = Math.floor(duration / list.length);
    const remainder = duration % list.length;
    let cursor = startMin;

    list.forEach((task, index) => {
      const slice = base + (index < remainder ? 1 : 0);
      const subStart = cursor;
      const subEnd = cursor + slice;
      cursor = subEnd;
      result.push({
        startMin: subStart,
        endMin: subEnd,
        start: minutesToTime(subStart),
        end: minutesToTime(subEnd),
        label: task,
        alertMinutes,
        alertTarget
      });
    });
  });

  return result;
}

export function findCurrentBlockIndex(date: Date, blocks: BuiltBlock[]): number {
  if (blocks.length === 0) {
    return 0;
  }
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const start = block.startMin;
    const end = block.endMin;
    if (start <= end && nowMinutes >= start && nowMinutes < end) {
      return i;
    }
    if (start > end && (nowMinutes >= start || nowMinutes < end)) {
      return i;
    }
  }
  let nextIndex = -1;
  let nextStart = Number.POSITIVE_INFINITY;
  let prevIndex = -1;
  let prevStart = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < blocks.length; i += 1) {
    const start = blocks[i].startMin;
    if (start >= nowMinutes && start < nextStart) {
      nextStart = start;
      nextIndex = i;
    }
    if (start <= nowMinutes && start > prevStart) {
      prevStart = start;
      prevIndex = i;
    }
  }

  if (nextIndex !== -1) {
    return nextIndex;
  }
  if (prevIndex !== -1) {
    return prevIndex;
  }
  return 0;
}

export function getTimelineTicks(blocks: BuiltBlock[]): number[] {
  const boundaries = blocks.map((block) =>
    Math.min(Math.max(block.startMin, 0), DAY_MINUTES)
  );
  boundaries.push(DAY_MINUTES);

  const unique = [...new Set(boundaries.map((value) => Math.round(value)))]
    .filter((value) => value > 0 && value < DAY_MINUTES)
    .sort((a, b) => a - b);

  return unique.map((minutes) => (minutes / DAY_MINUTES) * 100);
}

export function getDayProgressPercent(date: Date): number {
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  if (nowMinutes >= DAY_MINUTES - 1) {
    return 100;
  }
  return (nowMinutes / DAY_MINUTES) * 100;
}

export function getProgressPercentForTime(timeStr: string): number {
  const minutes = toMinutes(timeStr);
  if (Number.isNaN(minutes)) {
    return 0;
  }
  const percent = (minutes / DAY_MINUTES) * 100;
  return Math.max(0, Math.min(100, percent));
}

export function validateSchedule(blocks: TimeBlock[]): { ok: true } | { ok: false; message: string } {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, message: "시간 블록을 최소 1개 이상 추가해 주세요." };
  }

  const normalized = blocks.map((block, index) => {
    const start = String(block.start ?? "").trim();
    const end = String(block.end ?? "").trim();
    const label = Array.isArray(block.label)
      ? block.label.join(" / ").trim()
      : String(block.label ?? "").trim();
    const tasks = Array.isArray(block.tasks)
      ? block.tasks.map((task) => String(task).trim()).filter((task) => task.length > 0)
      : [];
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);

    if (!start || Number.isNaN(startMin)) {
      return { ok: false as const, message: `${index + 1}번째 시작 시간이 올바르지 않습니다.` };
    }
    if (!end || Number.isNaN(endMin)) {
      return { ok: false as const, message: `${index + 1}번째 종료 시간이 올바르지 않습니다.` };
    }
    if (startMin >= endMin) {
      return { ok: false as const, message: `${index + 1}번째 시간의 시작/종료 순서를 확인해 주세요.` };
    }
    if (!label && tasks.length === 0) {
      return { ok: false as const, message: `${index + 1}번째 할 일을 입력해 주세요.` };
    }

    return {
      ok: true as const,
      block: { start, end, label },
      startMin,
      endMin
    };
  });

  for (const entry of normalized) {
    if (!entry.ok) {
      return { ok: false, message: entry.message };
    }
  }

  const sorted = normalized
    .filter((entry): entry is Extract<typeof entry, { ok: true }> => entry.ok)
    .sort((a, b) => a.startMin - b.startMin);

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (current.startMin < prev.endMin) {
      return { ok: false, message: "시간 블록이 서로 겹치지 않도록 조정해 주세요." };
    }
  }

  return { ok: true };
}
