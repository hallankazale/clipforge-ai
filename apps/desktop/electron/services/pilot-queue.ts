import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSevenDaySchedule } from '../core/production';
import type { PilotProductionSettings, PilotQueueItem } from './pilot-queue-types';

interface QueueStore {
  version: 1;
  items: PilotQueueItem[];
}

let writeChain: Promise<void> = Promise.resolve();

function getQueuePath(): string {
  return path.join(app.getPath('userData'), 'pilot-queue.json');
}

async function readStore(): Promise<QueueStore> {
  try {
    const raw = await readFile(getQueuePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<QueueStore>;
    return { version: 1, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, items: [] };
    throw error;
  }
}

async function writeStore(store: QueueStore): Promise<void> {
  const queuePath = getQueuePath();
  await mkdir(path.dirname(queuePath), { recursive: true });
  const temporaryPath = `${queuePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(store, null, 2), 'utf8');
  try {
    await rename(temporaryPath, queuePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function enqueueWrite(operation: () => Promise<void>): Promise<void> {
  const next = writeChain.then(operation, operation);
  writeChain = next.catch(() => undefined);
  return next;
}

function toScheduledDate(dayOffset: number, time: string, now: Date): Date {
  const [hour, minute] = time.split(':').map(Number);
  const target = new Date(now);
  target.setDate(target.getDate() + dayOffset);
  target.setHours(hour, minute, 0, 0);
  if (dayOffset === 0 && target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

export async function listPilotQueue(): Promise<PilotQueueItem[]> {
  const store = await readStore();
  return [...store.items].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  );
}

export async function createSevenDayPilotQueue(
  settings: PilotProductionSettings,
  now = new Date(),
): Promise<PilotQueueItem[]> {
  const createdAt = now.toISOString();
  const items = buildSevenDaySchedule(settings.videosPerDay).map<PilotQueueItem>((slot) => ({
    id: randomUUID(),
    createdAt,
    updatedAt: createdAt,
    scheduledFor: toScheduledDate(slot.dayOffset, slot.time, now).toISOString(),
    status: 'queued',
    settings,
  }));

  await enqueueWrite(async () => {
    const store = await readStore();
    store.items.push(...items);
    await writeStore(store);
  });
  return items;
}

export async function createImmediatePilotQueueItem(
  settings: PilotProductionSettings,
): Promise<PilotQueueItem> {
  const now = new Date().toISOString();
  const item: PilotQueueItem = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    scheduledFor: now,
    status: 'queued',
    settings,
  };
  await enqueueWrite(async () => {
    const store = await readStore();
    store.items.push(item);
    await writeStore(store);
  });
  return item;
}

export async function updatePilotQueueItem(
  id: string,
  patch: Partial<Omit<PilotQueueItem, 'id' | 'createdAt' | 'settings'>>,
): Promise<PilotQueueItem | null> {
  let updated: PilotQueueItem | null = null;
  await enqueueWrite(async () => {
    const store = await readStore();
    const index = store.items.findIndex((item) => item.id === id);
    if (index < 0) return;
    updated = { ...store.items[index], ...patch, updatedAt: new Date().toISOString() };
    store.items[index] = updated;
    await writeStore(store);
  });
  return updated;
}

export async function getPilotQueueItem(id: string): Promise<PilotQueueItem | null> {
  const store = await readStore();
  return store.items.find((item) => item.id === id) ?? null;
}

export async function getNextDuePilotQueueItem(now = new Date()): Promise<PilotQueueItem | null> {
  const items = await listPilotQueue();
  return items.find(
    (item) => item.status === 'queued' && new Date(item.scheduledFor).getTime() <= now.getTime(),
  ) ?? null;
}
