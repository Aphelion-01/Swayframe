import { parentPort, workerData } from 'node:worker_threads';
import { writeExport } from './export-files';
const job = workerData as {
  destination: string;
  bytes: Uint8Array;
  sequence: boolean;
};
void writeExport(job.destination, job.bytes, job.sequence)
  .then(() => parentPort?.postMessage({ ok: true }))
  .catch((error) =>
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
