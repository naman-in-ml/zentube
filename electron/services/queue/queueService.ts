import { getDatabase } from "../db/client.js";

export type QueueJob = {
  id: string;
  type: string;
  status: string;
  input: string;
  outputMediaId?: string;
  progress: number;
  createdAt: string;
};

export function listQueueJobs(): QueueJob[] {
  return getDatabase()
    .prepare(
      `SELECT id, type, status, input, output_media_id AS outputMediaId, progress, created_at AS createdAt
       FROM queue_jobs
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all() as QueueJob[];
}

export function createQueueJob(input: Omit<QueueJob, "createdAt">) {
  const now = new Date().toISOString();

  getDatabase()
    .prepare(
      `INSERT INTO queue_jobs (id, type, status, input, output_media_id, progress, created_at, updated_at)
       VALUES (@id, @type, @status, @input, @outputMediaId, @progress, @createdAt, @createdAt)`
    )
    .run({
      ...input,
      outputMediaId: input.outputMediaId ?? null,
      createdAt: now
    });
}
