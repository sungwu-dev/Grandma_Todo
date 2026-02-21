import type { CalendarViewDay } from "@/components/ui/calendar-view-types";

type AgendaViewProps = {
  days: CalendarViewDay[];
  className?: string;
};

export default function AgendaView({ days, className = "" }: AgendaViewProps) {
  return (
    <section
      className={["grid gap-2 md:grid-cols-3 md:gap-3", className].filter(Boolean).join(" ")}
      aria-label="주간 일정 목록"
    >
      {days.map((day) => (
        <article
          key={day.dateKey}
          className={[
            "rounded-xl border bg-white p-3",
            day.isToday ? "border-amber-400 bg-amber-50" : "border-gray-200"
          ].join(" ")}
        >
          <header className="mb-2 flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
            <div className="text-base font-semibold text-gray-900">
              {day.weekdayLabel} · {day.dateLabel}
            </div>
            {day.isToday ? (
              <span className="rounded-full bg-amber-600 px-2 py-1 text-xs font-semibold text-white">
                오늘
              </span>
            ) : null}
          </header>
          {day.events.length === 0 ? (
            <p className="py-2 text-sm font-medium text-gray-500">일정 없음</p>
          ) : (
            <ul className="grid gap-2">
              {day.events.map((event) => (
                <li key={`${day.dateKey}-${event.id}`} className="rounded-lg border border-gray-200 bg-white p-2">
                  <div className="text-xs font-medium text-gray-500">{event.timeText}</div>
                  <div className="mt-1 text-base font-semibold text-gray-900">{event.label}</div>
                  {event.noteText ? (
                    <div className="mt-1 text-xs font-medium text-gray-500">{event.noteText}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {day.hiddenCount > 0 ? (
            <div className="mt-2 text-xs font-semibold text-gray-500">외 {day.hiddenCount}개 일정</div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
