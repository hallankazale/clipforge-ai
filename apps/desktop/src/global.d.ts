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

  type AnalysisStage =
    | 'preparing'
    | 'audio'
    | 'frames'
    | 'finalizing'
    | 'completed'
    | 'canceled';

  type AnalysisProgress = {
    jobId: string;
    stage: AnalysisStage;
    percent: number;
    message: string;
    detail?: string;
    timestamp: string;
    workspacePath: string;
  };

  type AnalysisResult = {
    jobId: string;
    workspacePath: string;
    audioPath: string | null;
    framesDirectory: string;
    frameIntervalSeconds: number;
    metadata: VideoMetadata;
  };

  type StartAnalysisResult =
    | { ok: true; jobId: string }
    | { ok: false; error: string };

  type AnalysisError = {
    jobId: string;
    canceled: boolean;
    error: string;
  };

  interface Window {
    clipforge?: {
      platform: string;
      selectOutputDirectory: () => Promise<string | null>;
      selectVideoFile: () => Promise<SelectVideoResult>;
      startAnalysis: (input: {
        filePath: string;
        outputPath: string;
      }) => Promise<StartAnalysisResult>;
      cancelAnalysis: (jobId: string) => Promise<{ ok: boolean }>;
      onAnalysisProgress: (callback: (payload: AnalysisProgress) => void) => () => void;
      onAnalysisComplete: (callback: (payload: AnalysisResult) => void) => () => void;
      onAnalysisError: (callback: (payload: AnalysisError) => void) => () => void;
    };
  }
}
