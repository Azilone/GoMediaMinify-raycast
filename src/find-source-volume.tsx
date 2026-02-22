import { Action, ActionPanel, Color, Icon, List, Toast, copyTextToClipboard, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const COMMON_SYSTEM_VOLUME_NAMES = new Set([
  "Macintosh HD",
  "Macintosh HD - Data",
  "Preboot",
  "Update",
  "VM",
  "Recovery",
  "home",
  "net",
]);

type VolumeEntry = {
  name: string;
  mountPath: string;
  kind: "likely-camera-source" | "other";
  reason: string;
};

function scoreVolume(name: string): { kind: VolumeEntry["kind"]; reason: string } {
  const lower = name.toLowerCase();

  if (COMMON_SYSTEM_VOLUME_NAMES.has(name)) {
    return { kind: "other", reason: "System volume" };
  }

  if (/(sd|card|camera|eos|sony|nikon|canon|dcim|usb|untitled)/i.test(lower)) {
    return { kind: "likely-camera-source", reason: "Name matches camera/SD card pattern" };
  }

  return { kind: "other", reason: "Mounted volume" };
}

async function listVolumes(): Promise<VolumeEntry[]> {
  const roots = ["/Volumes", "/media", "/mnt"];
  const all: VolumeEntry[] = [];

  for (const root of roots) {
    try {
      const entries = await readdir(root);

      for (const entry of entries) {
        const mountPath = path.join(root, entry);
        try {
          const st = await stat(mountPath);
          if (!st.isDirectory()) continue;

          const scored = scoreVolume(entry);
          all.push({ name: entry, mountPath, ...scored });
        } catch {
          // ignore unreadable entries
        }
      }
    } catch {
      // root not available on this platform
    }
  }

  const dedup = new Map<string, VolumeEntry>();
  for (const item of all) dedup.set(item.mountPath, item);

  return Array.from(dedup.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "likely-camera-source" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(listVolumes, []);
  const volumes = data ?? [];

  return (
    <List
      isLoading={isLoading}
      navigationTitle="Find Source Volume"
      searchBarPlaceholder="Search mounted volumes"
      isShowingDetail
    >
      {volumes.length === 0 ? (
        <List.EmptyView
          title="No mounted volumes found"
          description="Insert an SD card or mount a source volume, then refresh."
          actions={
            <ActionPanel>
              <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      ) : null}

      {volumes.map((volume) => {
        const likely = volume.kind === "likely-camera-source";

        return (
          <List.Item
            key={volume.mountPath}
            title={volume.name}
            subtitle={volume.mountPath}
            icon={{ source: likely ? Icon.Camera : Icon.Folder, tintColor: likely ? Color.Green : Color.SecondaryText }}
            accessories={[{ tag: likely ? "Likely SD/Camera" : "Volume" }]}
            detail={
              <List.Item.Detail
                markdown={`# ${volume.name}\n\n- Path: **${volume.mountPath}**\n- Type: **${likely ? "Likely camera source" : "Mounted volume"}**\n- Note: ${volume.reason}\n\nUse this path as **Source Folder** in **Prepare Library for Backup**.`}
              />
            }
            actions={
              <ActionPanel>
                <Action
                  title="Copy Source Path"
                  icon={Icon.Clipboard}
                  onAction={async () => {
                    await copyTextToClipboard(volume.mountPath);
                    await showToast({ style: Toast.Style.Success, title: "Source path copied", message: volume.mountPath });
                  }}
                />
                <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={revalidate} />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
