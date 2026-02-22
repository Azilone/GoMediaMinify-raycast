import { Action, ActionPanel, Detail, LaunchType, LocalStorage, Icon, open } from "@raycast/api";
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
    return <Detail isLoading={isLoading} markdown="# No run found\n\nRun **Convert Media** first to store a latest output location." />;
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={`# Latest Output\n\n- Destination: **${lastRun.destination}**\n- Status: **${lastRun.status}**\n- Timestamp: **${lastRun.timestamp}**\n- Dry run: **${lastRun.dryRun ? "Yes" : "No"}**`}
      actions={
        <ActionPanel>
          <Action title="Open Output Folder" icon={Icon.Folder} onAction={() => open(lastRun.destination, LaunchType.UserInitiated)} />
          {lastRun.logPath ? (
            <Action title="Open Log File" icon={Icon.Document} onAction={() => open(lastRun.logPath as string, LaunchType.UserInitiated)} />
          ) : null}
        </ActionPanel>
      }
    />
  );
}
