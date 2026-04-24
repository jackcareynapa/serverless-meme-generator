import { getBucketName, getS3Client } from "@/lib/s3/client";
import { jobManifestKey, jobStatusKey } from "@/lib/s3/paths";
import { getObjectText } from "@/lib/s3/ops";
import { parseJobManifest } from "@/lib/s3/manifest";
import { parseJobStatus } from "@/lib/s3/status";
import { toJobStatusPayload } from "@/lib/server/jobStatusResponse";

function err(msg, status = 400) {
  return Response.json({ error: msg }, { status });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return err("Valid jobId query parameter is required.");
  }

  try {
    getS3Client();
    getBucketName();
  } catch (e) {
    return err(e?.message || "Server configuration error (AWS/S3).", 500);
  }

  const statusKey = jobStatusKey(jobId);
  const manifestKey = jobManifestKey(jobId);
  let statusRaw;
  try {
    statusRaw = await getObjectText(statusKey);
  } catch (e) {
    if (
      e?.name === "NoSuchKey" ||
      e?.Code === "NoSuchKey" ||
      e?.$metadata?.httpStatusCode === 404
    ) {
      return err("Job not found.", 404);
    }
    console.error("get_status", e);
    return err("Could not read job status.", 500);
  }

  let manifestRaw;
  try {
    manifestRaw = await getObjectText(manifestKey);
  } catch (e) {
    console.error("get_manifest", e);
    return err("Could not read job manifest.", 500);
  }

  let statusParsed;
  let manifestParsed;
  try {
    statusParsed = JSON.parse(statusRaw);
    manifestParsed = JSON.parse(manifestRaw);
  } catch {
    return err("Invalid job data in storage.", 500);
  }

  const jobStatus = parseJobStatus(statusParsed);
  if (!jobStatus || jobStatus.jobId !== jobId) {
    return err("Invalid job status.", 500);
  }

  const manifest = parseJobManifest(manifestParsed);
  if (!manifest || manifest.jobId !== jobId) {
    return err("Invalid job manifest.", 500);
  }

  try {
    const payload = await toJobStatusPayload(manifest, jobStatus, {});
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("job_status_payload", e);
    return err("Could not build job response.", 500);
  }
}
