export type UnlistenFn = () => void;

interface WindowStub {
  isMaximized(): Promise<boolean>;
  onResized(callback: () => void): Promise<UnlistenFn>;
  toggleMaximize(): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
  startDragging(): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
}

const windowStub: WindowStub = {
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

export function getCurrentWindow(): WindowStub {
  return windowStub;
}