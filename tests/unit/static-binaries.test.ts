import { describe, expect, it } from 'vitest';
import { resolveAsarUnpackedPath } from '../../apps/desktop/electron/services/static-binaries';

describe('resolveAsarUnpackedPath', () => {
  it('redirects Windows app.asar executable paths to app.asar.unpacked', () => {
    expect(
      resolveAsarUnpackedPath(
        'C:\\Program Files\\ClipForge AI\\resources\\app.asar\\node_modules\\ffmpeg-static\\ffmpeg.exe',
      ),
    ).toBe(
      'C:\\Program Files\\ClipForge AI\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg.exe',
    );
  });

  it('redirects POSIX app.asar executable paths too', () => {
    expect(
      resolveAsarUnpackedPath('/opt/ClipForge/resources/app.asar/node_modules/ffmpeg-static/ffmpeg'),
    ).toBe('/opt/ClipForge/resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg');
  });

  it('leaves development paths unchanged', () => {
    expect(resolveAsarUnpackedPath('C:\\repo\\node_modules\\ffmpeg-static\\ffmpeg.exe')).toBe(
      'C:\\repo\\node_modules\\ffmpeg-static\\ffmpeg.exe',
    );
  });
});
