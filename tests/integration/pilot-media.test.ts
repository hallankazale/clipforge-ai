import { afterAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
// Media smoke test uses the real installed FFmpeg. No paid AI calls or social uploads.
vi.mock('../../apps/desktop/electron/services/static-binaries', async (importOriginal) => process.platform === 'win32' ? await importOriginal() : ({ getFfmpegPath: () => '/usr/bin/ffmpeg', getFfprobePath: () => '/usr/bin/ffprobe' }));
import { compose, ffmpeg, inspectVideo } from '../../apps/desktop/electron/pilot/media';
let directory = '';
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
describe.skipIf(process.platform !== 'win32' && !existsSync('/usr/bin/ffmpeg'))('renderização real do piloto', () => {
  it('produz MP4 H264 vertical, AAC e legendas; reprova silêncio e tela preta', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'clipforge-media-'));
    const signal = new AbortController().signal;
    const image = path.join(directory, 'image.png'), voice = path.join(directory, 'voice.mp3');
    await ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=1', '-frames:v', '1', image], directory, signal);
    await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'libmp3lame', voice], directory, signal);
    const words = [{ word: 'Teste', start: 0, end: 1.4 }, { word: 'real', start: 1.5, end: 2.9 }];
    const file = await compose(directory, [image], voice, words, 3, signal);
    const { technical, frames } = await inspectVideo(file, words, 'Teste real', 3, signal);
    expect(technical.issues).toEqual([]); expect(technical.passed).toBe(true); expect(frames).toHaveLength(6);
    const bad = path.join(directory, 'bad.mp4');
    await ffmpeg(['-f', 'lavfi', '-i', 'color=black:size=1080x1920:rate=30:duration=3', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', bad], directory, signal);
    const failed = await inspectVideo(bad, words, 'Teste real', 3, signal);
    expect(failed.technical.passed).toBe(false);
    expect(failed.technical.issues.some(i => i.includes('preto'))).toBe(true);
    expect(failed.technical.issues.some(i => i.includes('Volume'))).toBe(true);
  }, 120_000);
});
