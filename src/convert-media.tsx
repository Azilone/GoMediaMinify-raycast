import {
  Action,
  ActionPanel,
  Form,
  Icon,
  LocalStorage,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { access, mkdir, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { useState } from "react";
import ConversionRunView, { ConversionFormValues, ConversionPreset, LastRunRecord } from "./conversion-run";

const execFileAsync = promisify(execFile);
const LAST_RUN_STORAGE_KEY = "camera-workflow:last-run";

type DependencyState = { ok: boolean; missing: string[]; found: Record<string, string> };
type DetectedVolume = { name: string; mountPath: string };
type SubmitValues = Partial<Omit<ConversionFormValues, "source" | "destination">> & {
  sourceFolder?: string[];
  destinationFolder?: string[];
  sourceSuggested?: string;
  autoDestination?: boolean;
  destinationName?: string;
};

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

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".avif", ".tiff", ".bmp", ".gif", ".raw", ".cr2", ".arw", ".nef", ".dng"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".avi", ".m4v", ".mts", ".m2ts", ".wmv", ".flv", ".3gp", ".mpeg", ".mpg"]);

type SourceStats = {
  totalBytes: number;
  images: number;
  videos: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

async function collectSourceStats(root: string): Promise<SourceStats> {
  const stack = [root];
  const stats: SourceStats = { totalBytes: 0, images: 0, videos: 0 };

  while (stack.length) {
    const current = stack.pop() as string;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      try {
        const st = await stat(fullPath);
        stats.totalBytes += st.size;
      } catch {
        // ignore unreadable file
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) stats.images += 1;
      if (VIDEO_EXTENSIONS.has(ext)) stats.videos += 1;
    }
  }

  return stats;
}

function buildDesktopDestination(folderName?: string): string {
  const home = process.env.HOME;
  if (!home) throw new Error("Cannot resolve HOME directory");

  const safeName = (folderName || "prepared-library").trim() || "prepared-library";
  return path.join(home, "Desktop", safeName);
}

function defaultDestinationName(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `prepared-library-${yyyy}${mm}${dd}-${hh}${min}`;
}

function defaultValues(): ConversionFormValues {
  return {
    source: "",
    destination: "",
    preset: "google-photos",
    dryRun: true,
    jobs: "2",
    photoFormat: "avif",
    photoQualityAvif: "80",
    photoQualityWebp: "85",
    videoCodec: "h265",
    videoCrf: "28",
  };
}

async function buildCandidateDirs(): Promise<string[]> {
  const dirs = new Set<string>();

  const addPathString = (pathString?: string) => {
    if (!pathString) return;
    for (const part of pathString.split(":")) {
      const trimmed = part.trim();
      if (trimmed) dirs.add(trimmed);
    }
  };

  // 1) Current process PATH
  addPathString(process.env.PATH);

  // 2) Login shell PATH (often different in Raycast)
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    const shellPath = (await execFileAsync(shell, ["-lc", "echo $PATH"]))?.stdout?.trim();
    addPathString(shellPath);
  } catch {
    // ignore
  }

  // 3) macOS path_helper (system default PATH)
  try {
    const out = (await execFileAsync("/usr/libexec/path_helper", ["-s"]))?.stdout || "";
    const match = out.match(/PATH="([^"]+)"/);
    if (match?.[1]) addPathString(match[1]);
  } catch {
    // ignore
  }

  // 4) Known common locations
  const home = process.env.HOME || "";
  [
    path.join(home, ".local/bin"),
    path.join(home, "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ].forEach((d) => dirs.add(d));

  return Array.from(dirs);
}

function mergePathEntries(entries: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    for (const part of entry.split(":")) {
      const trimmed = part.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out.join(":");
}

async function resolveBinaryPath(bin: string): Promise<string | null> {
  // Fast path
  try {
    const res = await execFileAsync("which", [bin]);
    const candidate = res.stdout.trim();
    if (candidate) return candidate;
  } catch {
    // continue
  }

  // Exhaustive fallback based on merged PATH sources
  const candidateDirs = await buildCandidateDirs();
  for (const dir of candidateDirs) {
    const candidate = path.join(dir, bin);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }

  return null;
}

async function checkDependencies(): Promise<DependencyState> {
  const bins = ["media-converter", "ffmpeg", "ffprobe", "magick"];
  const missing: string[] = [];
  const found: Record<string, string> = {};

  for (const bin of bins) {
    const resolved = await resolveBinaryPath(bin);
    if (!resolved) missing.push(bin);
    else found[bin] = resolved;
  }

  return { ok: missing.length === 0, missing, found };
}

async function detectSourceVolumes(): Promise<DetectedVolume[]> {
  const roots = ["/Volumes", "/media", "/mnt"];
  const found: DetectedVolume[] = [];

  for (const root of roots) {
    try {
      const entries = await readdir(root);
      for (const entry of entries) {
        if (COMMON_SYSTEM_VOLUME_NAMES.has(entry)) continue;

        const mountPath = path.join(root, entry);
        try {
          const st = await stat(mountPath);
          if (!st.isDirectory()) continue;

          if (/(sd|card|camera|dcim|usb|eos|sony|nikon|canon|untitled)/i.test(entry.toLowerCase())) {
            found.push({ name: entry, mountPath });
          }
        } catch {
          // ignore unreadable entries
        }
      }
    } catch {
      // root not available
    }
  }

  const dedup = new Map<string, DetectedVolume>();
  for (const item of found) dedup.set(item.mountPath, item);
  return Array.from(dedup.values());
}

async function validateInputs(values: ConversionFormValues) {
  if (!values.source || !values.destination) {
    throw new Error("Source and destination are required.");
  }

  const sourceStats = await stat(values.source);
  if (!sourceStats.isDirectory()) {
    throw new Error("Source must be an existing directory.");
  }

  try {
    await stat(values.destination);
  } catch {
    await mkdir(values.destination, { recursive: true });
  }

  const destinationStats = await stat(values.destination);
  if (!destinationStats.isDirectory()) {
    throw new Error("Destination must be a directory.");
  }

  await access(values.destination, constants.W_OK);
}

function applyPreset(values: ConversionFormValues): ConversionFormValues {
  const preset = values.preset as ConversionPreset;

  if (preset === "google-photos") {
    return { ...values, photoFormat: "avif", videoCodec: "h265", photoQualityAvif: "78", photoQualityWebp: "85", videoCrf: "28" };
  }

  if (preset === "high-quality") {
    return { ...values, photoFormat: "avif", videoCodec: "h265", photoQualityAvif: "90", photoQualityWebp: "92", videoCrf: "23" };
  }

  if (preset === "max-compression") {
    return { ...values, photoFormat: "avif", videoCodec: "av1", photoQualityAvif: "70", photoQualityWebp: "75", videoCrf: "33" };
  }

  return values;
}

function normalizeValues(input: SubmitValues, source: string, destination: string): ConversionFormValues {
  const defaults = defaultValues();

  return {
    source,
    destination,
    preset: (input.preset as ConversionPreset) || defaults.preset,
    dryRun: input.dryRun ?? defaults.dryRun,
    jobs: input.jobs || defaults.jobs,
    photoFormat: (input.photoFormat as "avif" | "webp") || defaults.photoFormat,
    photoQualityAvif: input.photoQualityAvif || defaults.photoQualityAvif,
    photoQualityWebp: input.photoQualityWebp || defaults.photoQualityWebp,
    videoCodec: (input.videoCodec as "h265" | "h264" | "av1") || defaults.videoCodec,
    videoCrf: input.videoCrf || defaults.videoCrf,
  };
}

export default function Command() {
  const { push } = useNavigation();
  const deps = usePromise(checkDependencies, []);
  const volumes = usePromise(detectSourceVolumes, []);
  const [presetView, setPresetView] = useState<ConversionPreset>(defaultValues().preset as ConversionPreset);
  const [sourceFolder, setSourceFolder] = useState<string[]>([]);
  const [sourceSuggested, setSourceSuggested] = useState<string>("");
  const [autoDestination, setAutoDestination] = useState<boolean>(true);
  const [destinationName, setDestinationName] = useState<string>(defaultDestinationName());

  const selectedSourcePath = sourceFolder?.[0] || sourceSuggested;
  const sourceStats = usePromise(async (sourcePath: string) => {
    if (!sourcePath) return null;
    return collectSourceStats(sourcePath);
  }, [selectedSourcePath]);

  async function handleSubmit(input: SubmitValues) {
    try {
      if (deps.data && !deps.data.ok) {
        throw new Error(`Missing dependencies: ${deps.data.missing.join(", ")}`);
      }

      const source = input.sourceFolder?.[0] || input.sourceSuggested?.trim() || "";
      const destination = input.autoDestination
        ? buildDesktopDestination(input.destinationName)
        : input.destinationFolder?.[0] || "";

      const values = applyPreset(normalizeValues(input, source, destination));

      await validateInputs(values);

      await showToast({
        style: Toast.Style.Animated,
        title: "Starting backup preparation",
        message: values.dryRun ? "Dry-run preview" : "Preparing media library",
      });

      const searchDirs = await buildCandidateDirs();
      const runtimePath = mergePathEntries([
        process.env.PATH || "",
        searchDirs.join(":"),
        Object.values(deps.data?.found || {})
          .map((binaryPath) => path.dirname(binaryPath))
          .join(":"),
      ]);

      push(
        <ConversionRunView
          values={values}
          mediaConverterPath={deps.data?.found["media-converter"]}
          runtimePath={runtimePath}
          onCompleted={async (record: LastRunRecord) => {
            await LocalStorage.setItem(LAST_RUN_STORAGE_KEY, JSON.stringify(record));
          }}
        />,
      );
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot start",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const setupText = deps.data
    ? deps.data.ok
      ? "✅ All dependencies detected"
      : `⚠️ Missing dependencies: ${deps.data.missing.join(", ")}`
    : "Checking dependencies...";

  let destinationPreview = "Destination path unavailable";
  try {
    destinationPreview = `Destination path: ${buildDesktopDestination(destinationName)}`;
  } catch {
    destinationPreview = "Destination path unavailable (HOME not resolved)";
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Prepare Library for Backup" icon={Icon.ArrowRight} onSubmit={handleSubmit} />
        </ActionPanel>
      }
      isLoading={deps.isLoading || volumes.isLoading}
    >
      <Form.Description text={setupText} />

      <Form.FilePicker
        id="sourceFolder"
        title="Source Folder"
        canChooseDirectories
        canChooseFiles={false}
        allowMultipleSelection={false}
        info="Pick your SD card or media source folder."
        value={sourceFolder}
        onChange={setSourceFolder}
      />

      {volumes.data?.length ? (
        <Form.Dropdown
          id="sourceSuggested"
          title="Suggested Source (optional fallback)"
          value={sourceSuggested}
          onChange={setSourceSuggested}
        >
          <Form.Dropdown.Item value="" title="(none)" />
          {volumes.data.map((volume) => (
            <Form.Dropdown.Item key={volume.mountPath} value={volume.mountPath} title={`${volume.name} (${volume.mountPath})`} />
          ))}
        </Form.Dropdown>
      ) : null}

      {selectedSourcePath ? (
        <Form.Description
          text={
            sourceStats.isLoading
              ? "Source analysis: scanning..."
              : sourceStats.data
                ? `Source: ${formatBytes(sourceStats.data.totalBytes)} • ${sourceStats.data.images} images • ${sourceStats.data.videos} videos`
                : "Source analysis unavailable"
          }
        />
      ) : null}

      <Form.Checkbox
        id="autoDestination"
        title="Auto-create destination"
        label="Create folder on Desktop automatically"
        value={autoDestination}
        onChange={setAutoDestination}
      />

      {autoDestination ? (
        <>
          <Form.TextField
            id="destinationName"
            title="Destination Folder Name"
            value={destinationName}
            onChange={setDestinationName}
            placeholder="prepared-library-YYYYMMDD-HHMM"
          />
          <Form.Description text={destinationPreview} />
        </>
      ) : (
        <Form.FilePicker
          id="destinationFolder"
          title="Prepared Library Folder"
          canChooseDirectories
          canChooseFiles={false}
          allowMultipleSelection={false}
          info="Pick where the prepared library will be written."
        />
      )}

      <Form.Dropdown id="preset" title="Preset" defaultValue={defaultValues().preset} onChange={(value) => setPresetView(value as ConversionPreset)}>
        <Form.Dropdown.Item value="google-photos" title="Google Photos (Recommended)" />
        <Form.Dropdown.Item value="high-quality" title="High Quality" />
        <Form.Dropdown.Item value="max-compression" title="Max Compression" />
        <Form.Dropdown.Item value="custom" title="Custom" />
      </Form.Dropdown>

      <Form.Checkbox id="dryRun" title="Dry Run" label="Preview changes only" defaultValue={defaultValues().dryRun} />
      <Form.TextField id="jobs" title="Parallel Jobs" defaultValue={defaultValues().jobs} />

      {presetView === "custom" ? (
        <>
          <Form.Separator />
          <Form.Description text="Custom preset enabled: advanced settings are editable." />
          <Form.Dropdown id="photoFormat" title="Photo Format" defaultValue={defaultValues().photoFormat}>
            <Form.Dropdown.Item value="avif" title="AVIF" />
            <Form.Dropdown.Item value="webp" title="WebP" />
          </Form.Dropdown>
          <Form.TextField id="photoQualityAvif" title="AVIF Quality" defaultValue={defaultValues().photoQualityAvif} />
          <Form.TextField id="photoQualityWebp" title="WebP Quality" defaultValue={defaultValues().photoQualityWebp} />
          <Form.Dropdown id="videoCodec" title="Video Codec" defaultValue={defaultValues().videoCodec}>
            <Form.Dropdown.Item value="h265" title="H.265" />
            <Form.Dropdown.Item value="h264" title="H.264" />
            <Form.Dropdown.Item value="av1" title="AV1" />
          </Form.Dropdown>
          <Form.TextField id="videoCrf" title="Video CRF" defaultValue={defaultValues().videoCrf} />
        </>
      ) : (
        <>
          <Form.Separator />
          <Form.Description text="Advanced settings are auto-configured by the selected preset." />
        </>
      )}
    </Form>
  );
}
