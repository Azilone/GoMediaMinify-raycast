import { Detail, LocalStorage } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { LastRunRecord } from "./conversion-run";

const LAST_RUN_STORAGE_KEY = "camera-workflow:last-run";

async function loadLastRun(): Promise<LastRunRecord | null> {
  const raw = await LocalStorage.getItem<string>(LAST_RUN_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LastRunRecord;
  } catch {
    return null;
  }
}

export default function Command() {
  const { data: lastRun, isLoading } = usePromise(loadLastRun, []);

  if (!lastRun) {
    return <Detail isLoading={isLoading} markdown="# No backup report available\n\nRun **Prepare Library for Backup** first." />;
  }

  const summary = lastRun.summary?.length ? lastRun.summary.map((line) => `- ${line}`).join("\n") : "- No summary captured";

  return (
    <Detail
      isLoading={isLoading}
      markdown={`# Last Backup Report\n\n- Status: **${lastRun.status}**\n- Source: **${lastRun.source}**\n- Prepared Library: **${lastRun.destination}**\n- Timestamp: **${lastRun.timestamp}**\n\n## Report Metrics\n${summary}`}
    />
  );
}
