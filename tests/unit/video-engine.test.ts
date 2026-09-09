import { describe, expect, it } from 'vitest';
import { parseProbeOutput } from '../../apps/desktop/electron/services/video-engine';

describe('parseProbeOutput', () => {
  it('normaliza metadados principais de vídeo e áudio', () => {
    const metadata = parseProbeOutput('D:\\Videos\\entrada.mp4', {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          avg_frame_rate: '30000/1001',
        },
        {
          codec_type: 'audio',
          codec_name: 'aac',
        },
      ],
      format: {
        format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
        duration: '123.456',
        size: '104857600',
        bit_rate: '8000000',
      },
    });

    expect(metadata.fileName).toBe('D:\\Videos\\entrada.mp4');
    expect(metadata.extension).toBe('.mp4');
    expect(metadata.durationSeconds).toBeCloseTo(123.456);
    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
    expect(metadata.fps).toBeCloseTo(29.97, 2);
    expect(metadata.videoCodec).toBe('h264');
    expect(metadata.audioCodec).toBe('aac');
    expect(metadata.sizeBytes).toBe(104857600);
    expect(metadata.bitrate).toBe(8000000);
  });

  it('lida com streams incompletos sem quebrar', () => {
    const metadata = parseProbeOutput('C:\\temp\\video.webm', {
      streams: [],
      format: { duration: '10' },
    });

    expect(metadata.durationSeconds).toBe(10);
    expect(metadata.width).toBeNull();
    expect(metadata.height).toBeNull();
    expect(metadata.fps).toBeNull();
    expect(metadata.videoCodec).toBeNull();
    expect(metadata.audioCodec).toBeNull();
  });
});
