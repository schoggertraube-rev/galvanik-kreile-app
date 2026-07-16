import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { listCalendarEventsAction } from "./actions";

export const dynamic = "force-dynamic";

const dateKey = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

export default async function KalenderPage() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  const result = await listCalendarEventsAction(from.toISOString(), to.toISOString());
  const events = result.ok ? result.data : [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = from.getDay();
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const eventDays = new Set(events.map((event) => dateKey(event.startsAt)));

  return (
    <main className="w-full px-4 pb-24 sm:px-6 xl:px-8">
      <div className="mb-3 mt-4 flex items-center gap-2 text-xs font-semibold text-text-muted">
        <Link href="/" className="hover:text-navy-900">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-navy-900">Kalender</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900">Kalender</h1>
      <p className="mb-8 mt-1 text-sm text-text-muted">Tenantgebundene Termine aus der bestätigten Kalenderpersistenz.</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-2xl border border-neutral-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-extrabold text-navy-900">{today.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h2>
          <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-bold text-text-muted">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: offset }).map((_, index) => <span key={"empty-" + index} />)}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const date = new Date(year, month, day);
              const isToday = dateKey(date) === dateKey(today);
              const hasEvent = eventDays.has(dateKey(date));
              return (
                <div
                  key={day}
                  className={"relative flex aspect-square items-center justify-center rounded-lg text-xs font-bold " + (isToday ? "bg-navy-900 text-white" : "text-navy-900")}
                >
                  {day}
                  {hasEvent && <span className={"absolute bottom-1 h-1.5 w-1.5 rounded-full " + (isToday ? "bg-white" : "bg-accent-orange")} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-navy-900" />
            <h2 className="font-bold text-navy-900">Bestätigte Termine</h2>
          </div>
          {!result.ok ? (
            <div role="alert" className="rounded-2xl border border-error-red/30 bg-error-red/5 p-5 text-sm text-error-red">{result.message}</div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-gray-200 bg-white p-5 text-sm text-text-muted">Für diesen Monat sind keine bestätigten Termine gespeichert.</div>
          ) : events.map((event) => {
            const content = (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-navy-900">{event.title}</h3>
                  <p className="mt-1 text-xs text-text-muted">{event.eventType} · {event.status}</p>
                </div>
                <time className="shrink-0 text-right text-xs font-semibold text-text-muted">{event.startsAt.toLocaleString("de-DE")}</time>
              </div>
            );
            return event.orderId ? (
              <Link key={event.id} href={"/orders?order=" + event.orderId} className="block rounded-2xl border border-neutral-gray-100 bg-white p-5 shadow-sm hover:border-navy-300">{content}</Link>
            ) : (
              <div key={event.id} className="rounded-2xl border border-neutral-gray-100 bg-white p-5 shadow-sm">{content}</div>
            );
          })}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-800">Externe Kalender, Steuerfristen und Wiedervorlagen werden erst angezeigt, wenn ihre jeweilige Quelle bestätigt verbunden ist. Es werden keine Termine automatisch erfunden.</div>
        </section>
      </div>

      <FeedbackFooter pageTitle="Kalender" route="/kalender" variant="full" />
    </main>
  );
}
