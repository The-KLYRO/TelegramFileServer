export type UnlistenFn = () => void;

interface WebviewWindowStub {
  isMaximized(): Promise<boolean>;
  onResized(callback: () => void): Promise<UnlistenFn>;
  toggleMaximize(): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
  startDragging(): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
}

const webviewWindowStub: WebviewWindowStub = {
  async isMaximized(): Promise<boolean> {
    return false;
  },
  async onResized(_callback: () => void): Promise<UnlistenFn> {
    return () => {
      // no-op
    };
  },
  async toggleMaximize(): Promise<void> {
    // no-op
  },
  async minimize(): Promise<void> {
    // no-op
  },
  async close(): Promise<void> {
    // no-op
  },
  async startDragging(): Promise<void> {
    // no-op
  },
  async show(): Promise<void> {
    // no-op
  },
  async hide(): Promise<void> {
    // no-op
  },
};

export class WebviewWindow {
  static getCurrent(): WebviewWindowStub {
    return webviewWindowStub;
  }

  constructor(_options?: unknown) {
    // no-op
  }
}

export function getCurrentWebviewWindow(): WebviewWindowStub {
  return webviewWindowStub;
}