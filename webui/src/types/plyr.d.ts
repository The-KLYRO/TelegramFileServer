declare module "plyr" {
  export type PlyrOptions = Record<string, unknown>;

  export default class Plyr {
    static supported(
      mediaType?: string,
      provider?: string,
      playsInline?: boolean,
    ): unknown;

    constructor(target: HTMLElement | string, options?: PlyrOptions);

    on?(event: string, callback: () => void): void;
    destroy(): void;
  }
}
