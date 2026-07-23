/** Build calendar links (Google / Outlook / Yahoo) and downloadable .ics files. */

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  /** Local date "YYYY-MM-DD" */
  date: string;
  /** Local time "HH:mm" or "HH:mm:ss" */
  time: string;
  /** Duration in minutes (default 240 = 4h) */
  durationMinutes?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local Date built from "YYYY-MM-DD" + "HH:mm(:ss)". */
const toLocalDate = (date: string, time: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0);
};

/** Format Date to "YYYYMMDDTHHmmssZ" (UTC). */
const toIcsUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

const rangeUtc = (ev: CalendarEvent) => {
  const start = toLocalDate(ev.date, ev.time);
  const end = new Date(start.getTime() + (ev.durationMinutes ?? 240) * 60000);
  return { start: toIcsUtc(start), end: toIcsUtc(end) };
};

const escapeIcs = (s: string) =>
  (s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

/** Google Calendar template URL. */
export const googleCalendarUrl = (ev: CalendarEvent) => {
  const { start, end } = rangeUtc(ev);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    details: ev.description || "",
    location: ev.location || "",
    dates: `${start}/${end}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

/** Outlook (Live) new-event URL. */
export const outlookCalendarUrl = (ev: CalendarEvent) => {
  const start = toLocalDate(ev.date, ev.time);
  const end = new Date(start.getTime() + (ev.durationMinutes ?? 240) * 60000);
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    body: ev.description || "",
    location: ev.location || "",
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
};

/** Yahoo Calendar URL. */
export const yahooCalendarUrl = (ev: CalendarEvent) => {
  const start = toLocalDate(ev.date, ev.time);
  const duration = ev.durationMinutes ?? 240;
  const dur = `${pad(Math.floor(duration / 60))}${pad(duration % 60)}`;
  const p = new URLSearchParams({
    v: "60",
    title: ev.title,
    st: toIcsUtc(start),
    dur,
    desc: ev.description || "",
    in_loc: ev.location || "",
  });
  return `https://calendar.yahoo.com/?${p.toString()}`;
};

/** Build an .ics file body (RFC 5545). */
export const buildIcs = (ev: CalendarEvent) => {
  const { start, end } = rangeUtc(ev);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@transcongo`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TransCongo//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    `DESCRIPTION:${escapeIcs(ev.description || "")}`,
    `LOCATION:${escapeIcs(ev.location || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
};

/** Trigger download of an .ics file (Apple Calendar, most desktop clients). */
export const downloadIcs = (ev: CalendarEvent, filename = "event.ics") => {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
