import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PilotJob } from './contracts';

/** Writes are serialized and committed by rename; a failed disk write never changes live state. */
export class JobStore {
  private jobs: PilotJob[] = [];
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}
  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed.version !== 1 || !Array.isArray(parsed.jobs)) throw new Error('Fila inválida.');
      this.jobs = parsed.jobs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Não foi possível ler a fila. Preserve o arquivo para recuperação.');
    }
    await this.change(jobs => {
      for (const job of jobs) {
        // Never regenerate billed media after a crash without explicit intervention.
        if (job.status === 'generating') { job.status = 'failed'; job.error = 'Produção interrompida. Os arquivos parciais foram preservados.'; }
        for (const post of job.publications) {
          if (post.status === 'uploading') { post.status = 'uncertain'; post.error = 'Upload interrompido. Conferir a plataforma antes de um novo envio.'; }
        }
      }
    });
  }
  list(): PilotJob[] { return structuredClone(this.jobs); }
  get(id: string): PilotJob {
    const job = this.jobs.find(j => j.id === id);
    if (!job) throw new Error('Vídeo não encontrado.');
    return structuredClone(job);
  }
  change(mutate: (jobs: PilotJob[]) => void): Promise<void> {
    const operation = this.tail.then(async () => {
      const next = structuredClone(this.jobs);
      mutate(next);
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, JSON.stringify({ version: 1, jobs: next }, null, 2), { mode: 0o600 });
      await rename(`${this.file}.tmp`, this.file);
      this.jobs = next;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  update(id: string, mutate: (job: PilotJob) => void): Promise<void> {
    return this.change(jobs => {
      const job = jobs.find(j => j.id === id);
      if (!job) throw new Error('Vídeo não encontrado.');
      mutate(job);
    });
  }
}
