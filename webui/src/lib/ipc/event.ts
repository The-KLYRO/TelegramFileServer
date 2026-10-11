export type UnlistenFn = () => void;

let eventSource: EventSource | null = null;
const handlerMap = new Map<string, Set<(e: { payload: unknown }) => void>>();

function getEventSource(): EventSource | null {
  if (eventSource) return eventSource;

  try {
    const token = localStorage.getItem("tfs_token");
    const url = token
      ? `/api/events?token=${encodeURIComponent(token)}`
      : "/api/events";
    const es = new EventSource(url);
    es.onerror = () => {
      // Suppress browser console errors for failed SSE connection
      es.close();
      eventSource = null;
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