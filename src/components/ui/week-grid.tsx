import type { CalendarViewDay } from "@/components/ui/calendar-view-types";

type WeekGridProps = {
  days: CalendarViewDay[];
  className?: string;
};

export default function WeekGrid({ days, className = "" }: WeekGridProps) {
  return (
    <section
      className={[
        "grid grid-cols-7 gap-2 xl:gap-3",
        className
      ].filter(Boolean).join(" ")}
      aria-label="주간 일정 그리드"
    >
      {days.map((day) => (
        <article
          key={day.dateKey}
          className={[
            "rounded-xl border p-3",
            day.isToday ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"
          ].join(" ")}
        >
          <header className="mb-2 border-b border-gray-200 pb-2 text-center">
            <div className="text-sm font-semibold text-gray-900">{day.weekdayLabel}</div>
            <div className="text-xs font-medium text-gray-500">{day.dateLabel}</div>
          </header>
          {day.events.length === 0 ? (
            <p className="text-center text-xs font-medium text-gray-500">일정 없음</p>
          ) : (
            <ul className="grid gap-2">
              {day.events.map((event) => (
                <li key={`${day.dateKey}-${event.id}`} className="rounded-lg border border-gray-200 bg-white p-2">
                  <div className="text-[11px] font-medium text-gray-500">{event.timeText}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{event.label}</div>
                  {event.noteText ? (
                    <div className="mt-1 text-[11px] font-medium text-gray-500">{event.noteText}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {day.hiddenCount > 0 ? (
            <div className="mt-2 text-center text-[11px] font-semibold text-gray-500">
              외 {day.hiddenCount}개
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

