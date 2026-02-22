import { Action, ActionPanel, List, Icon, Color } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function exists(bin: string): Promise<boolean> {
  try {
    await execFileAsync("which", [bin]);
    return true;
  } catch {
    return false;
  }
}

export default function Command() {
  const items = ["media-converter", "ffmpeg", "ffprobe", "magick"];

  return (
    <List>
      {items.map((item) => (
        <List.Item
          key={item}
          title={item}
          icon={Icon.Circle}
          accessories={[]}
          actions={
            <ActionPanel>
              <Action title="Refresh" onAction={() => undefined} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
