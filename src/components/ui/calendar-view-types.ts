export type CalendarViewEventItem = {
  id: string;
  label: string;
  timeText: string;
  noteText?: string;
};

export type CalendarViewDay = {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
  isToday: boolean;
  events: CalendarViewEventItem[];
  hiddenCount: number;
};

