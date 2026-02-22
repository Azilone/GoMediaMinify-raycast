import {
  Action,
  ActionPanel,
  Form,
  LocalStorage,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { existsSync } from "node:fs";
import { access, mkdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import ConversionRunView, { ConversionFormValues, ConversionPreset, LastRunRecord } from "./conversion-run";

const LAST_RUN_STORAGE_KEY = "camera-workflow:last-run";

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

  async function handleSubmit(input: ConversionFormValues) {
    try {
      const values = applyPreset(input);
      await validateInputs(values);

      await showToast({
        style: Toast.Style.Animated,
        title: "Starting conversion",
        message: values.dryRun ? "Dry-run mode" : "Processing media files",
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

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Run Camera Workflow" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="80/20 local workflow: pick source + destination, choose a preset, run safely." />
      <Form.TextField id="source" title="Source Folder" placeholder="/path/to/source" />
      <Form.TextField id="destination" title="Destination Folder" placeholder="/path/to/output" />

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
      <Form.TextField
        id="photoQualityAvif"
        title="AVIF Quality"
        placeholder={defaultValues().photoQualityAvif}
        defaultValue={defaultValues().photoQualityAvif}
      />
      <Form.TextField
        id="photoQualityWebp"
        title="WebP Quality"
        placeholder={defaultValues().photoQualityWebp}
        defaultValue={defaultValues().photoQualityWebp}
      />
      <Form.Dropdown id="videoCodec" title="Video Codec" defaultValue={defaultValues().videoCodec}>
        <Form.Dropdown.Item value="h265" title="H.265" />
        <Form.Dropdown.Item value="h264" title="H.264" />
        <Form.Dropdown.Item value="av1" title="AV1" />
      </Form.Dropdown>
      <Form.TextField id="videoCrf" title="Video CRF" placeholder={defaultValues().videoCrf} defaultValue={defaultValues().videoCrf} />
    </Form>
  );
}
