export type TimeBlock = {
  start: string;
  end: string;
  label?: string | string[];
  tasks?: string[];
  alertMinutes?: number[];
  alertTarget?: AlertTarget;
};

export type BuiltBlock = {
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  label: string;
  alertMinutes?: number[];
  alertTarget?: AlertTarget;
};

export type AlertTarget = "start" | "end";

export type CalendarEvent = {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  start: string;
  end: string;
  label: string;
  allDay?: boolean;
  repeat?: "none" | "daily" | "weekly" | "yearly";
  source?: "user" | "system";
};

export type WeekdayTheme = {
  name: string;
  color: string;
  tint: string;
};
