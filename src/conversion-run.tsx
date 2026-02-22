import { Action, ActionPanel, Detail, Icon, LaunchType, Toast, open, showToast } from "@raycast/api";
import { spawn } from "node:child_process";
import { useEffect, useMemo, useState } from "react";

export type ConversionPreset = "google-photos" | "high-quality" | "max-compression" | "custom";

export type ConversionFormValues = {
  source: string;
  destination: string;
  preset: ConversionPreset;
  dryRun: boolean;
  jobs: string;
  photoFormat: "avif" | "webp";
  photoQualityAvif: string;
  photoQualityWebp: string;
  videoCodec: "h265" | "h264" | "av1";
  videoCrf: string;
};

export type LastRunRecord = {
  timestamp: string;
  source: string;
  destination: string;
  dryRun: boolean;
  args: string[];
  status: "success" | "failure";
  logPath?: string;
  summary: string[];
};

type Props = {
  values: ConversionFormValues;
  onCompleted?: (record: LastRunRecord) => Promise<void>;
};

function buildArgs(values: ConversionFormValues): string[] {
  return [
    ...(values.dryRun ? ["--dry-run"] : []),
    `--photo-format=${values.photoFormat}`,
    `--photo-quality-avif=${values.photoQualityAvif}`,
    `--photo-quality-webp=${values.photoQualityWebp}`,
    `--video-codec=${values.videoCodec}`,
    `--video-crf=${values.videoCrf}`,
    `--jobs=${values.jobs || "2"}`,
    values.source,
    values.destination,
  ];
}

function parseSummary(logLines: string[]): string[] {
  const wanted = [
    "Files processed:",
    "Files skipped",
    "Files verified",
    "Total time:",
    "Original size:",
    "Compressed size:",
    "Space saved:",
    "Converted files in:",
    "Detailed logs:",
  ];

  const summary: string[] = [];
  for (const line of logLines) {
    const normalized = line.replace(/^\[[^\]]+\]\s*/, "").trim();
    if (wanted.some((w) => normalized.includes(w))) {
      summary.push(normalized.replace(/^[-–•\s]+/, ""));
    }
  }

  return Array.from(new Set(summary));
}

function markdownForState(lines: string[], status: "running" | "success" | "failure", summary: string[]) {
  const statusLabel = status === "running" ? "🟡 Running" : status === "success" ? "🟢 Completed" : "🔴 Failed";

  return `# Camera Workflow Run\n\n**Status:** ${statusLabel}\n\n## Live Output\n\n\`\`\`\n${lines.slice(-240).join("\n")}\n\`\`\`\n\n## Summary\n${summary.length ? summary.map((line) => `- ${line}`).join("\n") : "- Waiting for summary..."}`;
}

export default function ConversionRunView({ values, onCompleted }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<"running" | "success" | "failure">("running");
  const [summary, setSummary] = useState<string[]>([]);
  const [logPath, setLogPath] = useState<string | undefined>();

  const args = useMemo(() => buildArgs(values), [values]);

  useEffect(() => {
    let canceled = false;
    const capturedLines: string[] = [];
    let capturedLogPath: string | undefined;

    const child = spawn("media-converter", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const pushLine = (line: string) => {
      if (canceled) return;
      capturedLines.push(line);
      setLines((prev) => [...prev, line]);

      if (line.includes("Detailed logs:")) {
        const path = line.split("Detailed logs:")[1]?.trim();
        if (path) {
          capturedLogPath = path;
          setLogPath(path);
        }
      }
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      chunk
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .forEach(pushLine);
    });

    child.stderr.on("data", (chunk: string) => {
      chunk
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .forEach((line) => pushLine(`[stderr] ${line}`));
    });

    child.on("close", async (code) => {
      if (canceled) return;

      const finalSummary = parseSummary(capturedLines);
      const success = code === 0;
      setStatus(success ? "success" : "failure");
      setSummary(finalSummary);

      await showToast({
        style: success ? Toast.Style.Success : Toast.Style.Failure,
        title: success ? "Conversion completed" : "Conversion failed",
        message: success ? "Camera Workflow finished" : `Exit code ${code ?? "unknown"}`,
      });

      if (onCompleted) {
        await onCompleted({
          timestamp: new Date().toISOString(),
          source: values.source,
          destination: values.destination,
          dryRun: values.dryRun,
          args,
          status: success ? "success" : "failure",
          logPath: capturedLogPath,
          summary: finalSummary,
        });
      }
    });

    return () => {
      canceled = true;
      if (!child.killed) child.kill("SIGTERM");
    };
  }, []);

  return (
    <Detail
      markdown={markdownForState(lines, status, summary)}
      actions={
        <ActionPanel>
          {logPath ? <Action title="Open Log File" icon={Icon.Document} onAction={() => open(logPath, LaunchType.UserInitiated)} /> : null}
          <Action
            title="Open Output Folder"
            icon={Icon.Folder}
            onAction={() => open(values.destination, LaunchType.UserInitiated)}
          />
        </ActionPanel>
      }
    />
  );
}
