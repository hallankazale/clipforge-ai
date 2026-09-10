import path from 'node:path';
import ffmpegStaticPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

/**
 * electron-builder keeps executable dependencies outside app.asar.
 * Packages such as ffmpeg-static still report the logical app.asar path,
 * so the installed application must redirect that path to app.asar.unpacked.
 */
export function resolveAsarUnpackedPath(binaryPath: string): string {
  const asarSegment = `${path.sep}app.asar${path.sep}`;
  const unpackedSegment = `${path.sep}app.asar.unpacked${path.sep}`;

  if (binaryPath.includes(asarSegment)) {
    return binaryPath.replace(asarSegment, unpackedSegment);
  }

  // Keep this fallback for paths produced with the opposite separator style.
  return binaryPath
    .replace('/app.asar/', '/app.asar.unpacked/')
    .replace('\\app.asar\\', '\\app.asar.unpacked\\');
}

export function getFfmpegPath(): string {
  if (!ffmpegStaticPath) {
    throw new Error('O binário do FFmpeg não foi encontrado nesta instalação.');
  }

  return resolveAsarUnpackedPath(ffmpegStaticPath);
}

export function getFfprobePath(): string {
  if (!ffprobeStatic?.path) {
    throw new Error('O binário do FFprobe não foi encontrado nesta instalação.');
  }

  return resolveAsarUnpackedPath(ffprobeStatic.path);
}
