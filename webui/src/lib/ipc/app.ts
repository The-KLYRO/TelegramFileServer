export async function getVersion(): Promise<string> {
  try {
    const response = await fetch("/healthz");
    if (!response.ok) {
      return "0.0.0";
    }
    const data = await response.json();
    return data?.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}