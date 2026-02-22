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
import { existsSync } from "node:fs";
import { access, mkdir, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import ConversionRunView, { ConversionFormValues, ConversionPreset, LastRunRecord } from "./conversion-run";

const execFileAsync = promisify(execFile);
const LAST_RUN_STORAGE_KEY = "camera-workflow:last-run";

type DependencyState = { ok: boolean; missing: string[] };
type DetectedVolume = { name: string; mountPath: string };
type SubmitValues = Omit<ConversionFormValues, "source"> & {
  sourceDetected: string;
  sourceManual: string;
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

async function checkDependencies(): Promise<DependencyState> {
  const bins = ["media-converter", "ffmpeg", "ffprobe", "magick"];
  const missing: string[] = [];

  for (const bin of bins) {
    try {
      await execFileAsync("which", [bin]);
    } catch {
      missing.push(bin);
    }
  }

  return { ok: missing.length === 0, missing };
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
          // ignore
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

  if (!existsSync(values.destination)) {
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
    return { ...values, photoFormat: "avif", videoCodec: "h265", photoQualityAvif: "78", videoCrf: "28" };
  }

  if (preset === "high-quality") {
    return { ...values, photoFormat: "avif", videoCodec: "h265", photoQualityAvif: "90", videoCrf: "23" };
  }

  if (preset === "max-compression") {
    return { ...values, photoFormat: "avif", videoCodec: "av1", photoQualityAvif: "70", videoCrf: "33" };
  }

  return values;
}

export default function Command() {
  const { push } = useNavigation();
  const deps = usePromise(checkDependencies, []);
  const volumes = usePromise(detectSourceVolumes, []);

  async function handleSubmit(input: SubmitValues) {
    try {
      if (deps.data && !deps.data.ok) {
        throw new Error(`Missing required tools: ${deps.data.missing.join(", ")}. Run setup first.`);
      }

      const source = input.sourceManual?.trim() || input.sourceDetected?.trim();
      const values = applyPreset({
        source,
        destination: input.destination,
        preset: input.preset,
        dryRun: input.dryRun,
        jobs: input.jobs,
        photoFormat: input.photoFormat,
        photoQualityAvif: input.photoQualityAvif,
        photoQualityWebp: input.photoQualityWebp,
        videoCodec: input.videoCodec,
        videoCrf: input.videoCrf,
      });
      await validateInputs(values);

      await showToast({
        style: Toast.Style.Animated,
        title: "Starting backup preparation",
        message: values.dryRun ? "Dry-run preview" : "Preparing media library",
      });

      push(
        <ConversionRunView
          values={values}
          onCompleted={async (record: LastRunRecord) => {
            await LocalStorage.setItem(LAST_RUN_STORAGE_KEY, JSON.stringify(record));
          }}
        />,
      );
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Validation failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const setupText = deps.data
    ? deps.data.ok
      ? "System setup: ready"
      : `System setup: missing ${deps.data.missing.join(", ")}`
    : "Checking system setup...";

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Prepare Library for Backup" icon={Icon.ArrowRight} onSubmit={handleSubmit} />
        </ActionPanel>
      }
      isLoading={deps.isLoading || volumes.isLoading}
    >
      <Form.Description text={`Guided single-command workflow. ${setupText}`} />

      <Form.Dropdown id="sourceDetected" title="Detected Source Volume" info="Pick a detected source volume, or leave empty and use manual path.">
        <Form.Dropdown.Item value="" title="(none) use manual source path" />
        {volumes.data?.map((volume) => (
          <Form.Dropdown.Item key={volume.mountPath} value={volume.mountPath} title={`${volume.name} (${volume.mountPath})`} />
        ))}
      </Form.Dropdown>

      <Form.TextField id="sourceManual" title="Source Folder (Manual)" placeholder="/path/to/source" />
      <Form.TextField id="destination" title="Prepared Library Folder" placeholder="/path/to/prepared-library" />

      <Form.Dropdown id="preset" title="Preset" defaultValue={defaultValues().preset}>
        <Form.Dropdown.Item value="google-photos" title="Google Photos (Recommended)" />
        <Form.Dropdown.Item value="high-quality" title="High Quality" />
        <Form.Dropdown.Item value="max-compression" title="Max Compression" />
        <Form.Dropdown.Item value="custom" title="Custom" />
      </Form.Dropdown>

      <Form.Separator />
      <Form.Checkbox id="dryRun" title="Dry Run" label="Preview changes only" defaultValue={defaultValues().dryRun} />
      <Form.TextField id="jobs" title="Parallel Jobs" placeholder={defaultValues().jobs} defaultValue={defaultValues().jobs} />
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
    </Form>
  );
}
