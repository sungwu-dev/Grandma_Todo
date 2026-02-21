import type { AlertTarget, TimeBlock, WeekdayTheme } from "./types";

export const TIME_BLOCKS: TimeBlock[] = [
  { start: "00:00", end: "06:30", label: "편안히 쉬기" },
  { start: "06:30", end: "09:00", label: "아침 식사 후 약 복용" },
  { start: "09:00", end: "11:30", label: "물 한 컵 마시기" },
  { start: "11:30", end: "13:30", label: "점심 식사" },
  { start: "13:30", end: "16:30", label: "가벼운 스트레칭" },
  { start: "16:30", end: "18:30", label: "휴식" },
  { start: "18:30", end: "20:30", label: "저녁 식사" },
  { start: "20:30", end: "24:00", label: "취침 준비" }
];

export const ALERT_MINUTE_PRESETS = {
  1: [5],
  2: [10, 5],
  3: [30, 10, 5],
  4: [30, 15, 10, 5],
  5: [30, 20, 15, 10, 5]
} as const;

export const DEFAULT_ALERT_MINUTES = [...ALERT_MINUTE_PRESETS[3]];

export const DEFAULT_ALERT_TARGET: AlertTarget = "start";

export function getDefaultAlertMinutes(count?: number): number[] {
  const rounded = typeof count === "number" ? Math.round(count) : 3;
  const clamped = Math.max(1, Math.min(5, rounded));
  const preset = ALERT_MINUTE_PRESETS[clamped as keyof typeof ALERT_MINUTE_PRESETS];
  return [...preset];
}

export const WEEKDAY_THEMES: WeekdayTheme[] = [
  { name: "일", color: "#f2994a", tint: "#fff3e6" },
  { name: "월", color: "#8c6bb1", tint: "#f4effa" },
  { name: "화", color: "#d64b4b", tint: "#fdecec" },
  { name: "수", color: "#3b82c4", tint: "#e7f2fb" },
  { name: "목", color: "#2f9e6c", tint: "#e6f6ef" },
  { name: "금", color: "#f0b429", tint: "#fff7dd" },
  { name: "토", color: "#9a6b3f", tint: "#f5ede3" }
];
