export const ANALYTICS_EVENT_TYPES = [
  "package_scanned",
  "loading_plan_generated",
  "package_assigned",
  "package_retrieved",
  "package_delivered",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsEvent = {
  event_type: AnalyticsEventType;
  tracking_number?: string | null;
  stop_number?: number | null;
  zone?: string | null;
  shelf?: string | null;
  slot?: number | null;
  payload?: Record<string, unknown> | null;
};

export function recordEvents(events: AnalyticsEvent[]) {
  if (events.length === 0) return;
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  }).catch(() => undefined);
}
