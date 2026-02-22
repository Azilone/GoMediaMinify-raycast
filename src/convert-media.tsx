import { Action, ActionPanel, Form, showToast, Toast } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type Values = {
  source: string;
  destination: string;
  dryRun: boolean;
  photoFormat: "avif" | "webp";
  videoCodec: "h265" | "h264" | "av1";
  jobs: string;
};

export default function Command() {
  async function handleSubmit(values: Values) {
    const args = [
      ...(values.dryRun ? ["--dry-run"] : []),
      `--photo-format=${values.photoFormat}`,
      `--video-codec=${values.videoCodec}`,
      `--jobs=${values.jobs || "4"}`,
      values.source,
      values.destination,
    ];

    try {
      await showToast({ style: Toast.Style.Animated, title: "Conversion started" });
      await execFileAsync("media-converter", args);
      await showToast({ style: Toast.Style.Success, title: "Conversion completed" });
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Conversion failed", message: String(error) });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Run Conversion" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Run GoMediaMinify without remembering CLI flags." />
      <Form.TextField id="source" title="Source Folder" placeholder="/path/to/source" />
      <Form.TextField id="destination" title="Destination Folder" placeholder="/path/to/output" />
      <Form.Checkbox id="dryRun" title="Dry Run" label="Preview changes only" defaultValue={true} />
      <Form.Dropdown id="photoFormat" title="Photo Format" defaultValue="avif">
        <Form.Dropdown.Item value="avif" title="AVIF" />
        <Form.Dropdown.Item value="webp" title="WebP" />
      </Form.Dropdown>
      <Form.Dropdown id="videoCodec" title="Video Codec" defaultValue="h265">
        <Form.Dropdown.Item value="h265" title="H.265" />
        <Form.Dropdown.Item value="h264" title="H.264" />
        <Form.Dropdown.Item value="av1" title="AV1" />
      </Form.Dropdown>
      <Form.TextField id="jobs" title="Parallel Jobs" placeholder="4" />
    </Form>
  );
}
