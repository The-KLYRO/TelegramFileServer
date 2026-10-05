export type RequiredChannelConfig = {
  chatTitle: string;
  chatId: number;
  inviteLink: string;
};

const GIST_URL =
  "https://gist.githubusercontent.com/pamod-madubashana/e047e987eadcb7521c0f157e8335db14/raw/SkyBox.json";

export const REQUIRED_CHANNEL_FALLBACK: RequiredChannelConfig = {
  chatTitle: "SkyBox Desktop",
  chatId: -1003712541671,
  inviteLink: "https://t.me/SkyBoxDesktop",
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export async function loadRequiredChannelConfig(
  timeoutMs: number = 2500,
): Promise<RequiredChannelConfig> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GIST_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return REQUIRED_CHANNEL_FALLBACK;
    }

    const rawText = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      // Tolerate trailing commas in the gist (JSON5-ish).
      const cleaned = rawText.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      json = JSON.parse(cleaned);
    }
    const channel =
      typeof json === "object" && json !== null && "channel" in json
        ? (json as { channel?: unknown }).channel
        : null;

    if (typeof channel !== "object" || channel === null) {
      return REQUIRED_CHANNEL_FALLBACK;
    }

    const chatTitle = (channel as { chat_title?: unknown }).chat_title;
    const chatId = (channel as { chat_id?: unknown }).chat_id;
    const inviteLink = (channel as { invite_link?: unknown }).invite_link;

    if (
      !isNonEmptyString(chatTitle) ||
      !isNumber(chatId) ||
      !isNonEmptyString(inviteLink)
    ) {
      return REQUIRED_CHANNEL_FALLBACK;
    }

    return {
      chatTitle: chatTitle.trim(),
      chatId,
      inviteLink: inviteLink.trim(),
    };
  } catch {
    return REQUIRED_CHANNEL_FALLBACK;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
