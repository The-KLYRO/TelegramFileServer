export type UnlistenFn = () => void;

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const handlerMap = new Map<string, Set<(e: { payload: unknown }) => void>>();

function scheduleReconnect(): void {
  // A single transient error must not kill live progress for the rest of the
  // page session — without this, index-sync bars freeze at their last value.
  if (reconnectTimer) return;
  const attempt = Math.min(reconnectAttempts + 1, 6);
  reconnectAttempts = attempt;
  const delay = 1000 * Math.pow(2, attempt - 1);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    // Only rebuild when the stream is actually dead. While CONNECTING the
    // browser is already retrying on its own.
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) return;
    eventSource = null;
    getEventSource();
  }, delay);
}

function getEventSource(): EventSource | null {
  if (eventSource) return eventSource;

  try {
    const token = localStorage.getItem("tfs_token");
    const url = token
      ? `/api/events?token=${encodeURIComponent(token)}`
      : "/api/events";
    const es = new EventSource(url);
    es.onopen = () => {
      reconnectAttempts = 0;
    };
    es.onerror = () => {
      // EventSource retries by itself while CONNECTING; only act once the
      // browser has given up (CLOSED), which happens after repeated failures.
      if (es.readyState === EventSource.CLOSED) scheduleReconnect();
    };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data?.type || data?.event;
        if (type && handlerMap.has(type)) {
          const payload = data.payload ?? data;
          handlerMap.get(type)!.forEach((handler) => {
            try {
              handler({ payload });
            } catch {
              // Ignore handler errors
            }
          });
        }
      } catch {
        // Ignore malformed SSE messages
      }
    };
    eventSource = es;
    return es;
  } catch {
    // EventSource not supported or failed to create
    return null;
  }
}

export async function listen<T>(
  event: string,
  handler: (e: { payload: T }) => void,
): Promise<UnlistenFn> {
  // Register CustomEvent listener
  const customHandler = (e: Event) => {
    const ce = e as CustomEvent;
    const detail = ce.detail ?? ce;
    handler({ payload: detail as T });
  };
  window.addEventListener(event, customHandler as EventListener);

  // Register SSE handler (lazy init)
  const es = getEventSource();
  if (es) {
    let handlers = handlerMap.get(event);
    if (!handlers) {
      handlers = new Set();
      handlerMap.set(event, handlers);
    }
    handlers.add(handler as (e: { payload: unknown }) => void);
  }

  // Return unlisten function
  return () => {
    window.removeEventListener(event, customHandler as EventListener);

    if (es) {
      const handlers = handlerMap.get(event);
      if (handlers) {
        handlers.delete(handler as (e: { payload: unknown }) => void);
        if (handlers.size === 0) {
          handlerMap.delete(event);
        }
      }
    }
  };
}