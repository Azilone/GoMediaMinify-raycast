import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type DepStatus = {
  name: string;
  required: boolean;
  found: boolean;
  path?: string;
  version?: string;
  hint?: string;
};

const DEPS: Array<{ name: string; required: boolean; versionArgs: string[]; hint: string }> = [
  { name: "media-converter", required: true, versionArgs: ["--help"], hint: "Build/install GoMediaMinify and add media-converter to PATH" },
  { name: "ffmpeg", required: true, versionArgs: ["-version"], hint: "Install ffmpeg" },
  { name: "ffprobe", required: true, versionArgs: ["-version"], hint: "Install ffprobe (usually bundled with ffmpeg)" },
  { name: "magick", required: true, versionArgs: ["-version"], hint: "Install ImageMagick (magick command)" },
];

async function resolveDependency(name: string, versionArgs: string[], required: boolean, hint: string): Promise<DepStatus> {
  try {
    const which = await execFileAsync("which", [name]);
    const binPath = which.stdout.trim();
    const versionResult = await execFileAsync(name, versionArgs);
    const firstLine = `${versionResult.stdout || versionResult.stderr}`.split(/\r?\n/).find(Boolean)?.trim();

    return {
      name,
      required,
      found: true,
      path: binPath,
      version: firstLine,
    };
  } catch {
    return {
      name,
      required,
      found: false,
      hint,
    };
  }
}

async function loadStatuses(): Promise<DepStatus[]> {
  return Promise.all(DEPS.map((dep) => resolveDependency(dep.name, dep.versionArgs, dep.required, dep.hint)));
}

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(loadStatuses, []);
  const statuses = data ?? [];

  const missingRequired = statuses.filter((status) => status.required && !status.found).length;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search dependency"
      navigationTitle={missingRequired ? `Setup incomplete: ${missingRequired} required tools missing` : "System setup is ready"}
    >
      {statuses.map((status) => {
        const icon = status.found ? { source: Icon.CheckCircle, tintColor: Color.Green } : { source: Icon.XMarkCircle, tintColor: Color.Red };

        return (
          <List.Item
            key={status.name}
            title={status.name}
            icon={icon}
            subtitle={status.found ? status.path : "Not found in PATH"}
            accessories={status.version ? [{ text: status.version.slice(0, 60) }] : []}
            actions={
              <ActionPanel>
                <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={revalidate} />
              </ActionPanel>
            }
            detail={
              <List.Item.Detail
                markdown={`# ${status.name}\n\n- Required: **${status.required ? "Yes" : "No"}**\n- Found: **${status.found ? "Yes" : "No"}**\n- Path: **${status.path ?? "N/A"}**\n- Version: **${status.version ?? "N/A"}**\n${status.hint ? `\n## Install Hint\n${status.hint}` : ""}`}
              />
            }
          />
        );
      })}
    </List>
  );
}
