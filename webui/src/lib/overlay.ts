const TITLE_BAR_INTERACTION_WINDOW_MS = 250;

let lastTitleBarInteractionAt = 0;

export function markTitleBarInteraction(): void {
  lastTitleBarInteractionAt = Date.now();
}

export function isTitleBarTarget(target: EventTarget | null): boolean {
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  return element?.closest('[data-skybox-titlebar="true"]') !== null;
}

function hasRecentTitleBarInteraction(): boolean {
  return (
    Date.now() - lastTitleBarInteractionAt <= TITLE_BAR_INTERACTION_WINDOW_MS
  );
}

function getOutsideInteractionTarget(event: {
  target: EventTarget | null;
  detail?: {
    originalEvent?: {
      target?: EventTarget | null;
      relatedTarget?: EventTarget | null;
    };
  };
}): EventTarget | null {
  const originalEvent = event.detail?.originalEvent;

  return originalEvent?.target ?? originalEvent?.relatedTarget ?? event.target;
}

export function preserveOverlayOnTitleBarInteraction(event: {
  target: EventTarget | null;
  detail?: {
    originalEvent?: {
      target?: EventTarget | null;
      relatedTarget?: EventTarget | null;
    };
  };
  preventDefault: () => void;
}): void {
  if (
    isTitleBarTarget(getOutsideInteractionTarget(event)) ||
    hasRecentTitleBarInteraction()
  ) {
    event.preventDefault();
  }
}
