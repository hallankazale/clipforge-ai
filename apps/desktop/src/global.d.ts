export {};

declare global {
  type VideoMetadata = {
    filePath: string;
    fileName: string;
    extension: string;
    durationSeconds: number;
    width: number | null;
    height: number | null;
    fps: number | null;
    videoCodec: string | null;
    audioCodec: string | null;
    container: string | null;
    sizeBytes: number | null;
    bitrate: number | null;
  };

  type SelectVideoResult =
    | { ok: true; canceled: false; metadata: VideoMetadata }
    | { ok: false; canceled: boolean; error: string | null };

  interface Window {
    clipforge?: {
      platform: string;
      selectOutputDirectory: () => Promise<string | null>;
      selectVideoFile: () => Promise<SelectVideoResult>;
    };
  }
}
