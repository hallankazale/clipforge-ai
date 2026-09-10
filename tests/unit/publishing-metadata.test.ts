import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  calculateViralScore,
  createPublicationPackage,
} from '../../apps/desktop/electron/services/publishing-metadata';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('publishing metadata', () => {
  it('keeps viral score between 0 and 100', () => {
    const score = calculateViralScore(
      {
        startSeconds: 30,
        durationSeconds: 60,
        score: 0.92,
        audioActivity: 0.95,
        visualActivity: 0.7,
      },
      'TikTok',
    );

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('limits TikTok publication package to five hashtags', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'clipforge-publish-'));
    temporaryDirectories.push(directory);

    const result = await createPublicationPackage({
      candidate: {
        startSeconds: 0,
        durationSeconds: 60,
        score: 0.85,
        audioActivity: 0.9,
        visualActivity: 0.6,
      },
      rank: 1,
      platform: 'TikTok',
      videoFilePath: path.join(directory, 'corte-01.mp4'),
    });

    expect(result.hashtags.length).toBeLessThanOrEqual(5);
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.description).toContain(`${result.viralScore}/100`);
    expect(result.captionsStatus).toBe('pending-local-transcription');
  });
});
