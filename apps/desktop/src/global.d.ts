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

  type CutPlatform = 'Instagram' | 'TikTok' | 'Reels' | 'YouTube';
  type ViralLabel = 'Baixo' | 'Médio' | 'Alto' | 'Muito alto';
  type AnalysisStage = 'preparing' | 'audio' | 'frames' | 'scoring' | 'cutting' | 'finalizing' | 'completed' | 'canceled';

  type AnalysisProgress = {
    jobId: string;
    stage: AnalysisStage;
    percent: number;
    message: string;
    detail?: string;
    timestamp: string;
    workspacePath: string;
  };

  type PublicationPackage = {
    viralScore: number;
    viralLabel: ViralLabel;
    title: string;
    description: string;
    hashtags: string[];
    metadataFilePath: string;
    textFilePath: string;
    captionsStatus: 'pending-local-transcription';
  };

  type RenderedCut = {
    id: string;
    rank: number;
    platform: CutPlatform;
    filePath: string;
    startSeconds: number;
    durationSeconds: number;
    score: number;
    audioActivity: number;
    visualActivity: number;
    publication: PublicationPackage;
  };

  type AnalysisResult = {
    jobId: string;
    workspacePath: string;
    audioPath: string | null;
    framesDirectory: string;
    frameIntervalSeconds: number;
    metadata: VideoMetadata;
    cutsDirectory: string;
    cuts: RenderedCut[];
    cutDurationMinutes: 1 | 5 | 10;
    platforms: CutPlatform[];
  };

  type StartAnalysisResult = { ok: true; jobId: string } | { ok: false; error: string };
  type AnalysisError = { jobId: string; canceled: boolean; error: string };

  type PilotPlatform = 'YouTube Shorts' | 'TikTok';
  type PilotQueueStatus = 'queued' | 'processing' | 'ready-to-publish' | 'manual-review' | 'failed' | 'canceled' | 'published';
  type PilotProductionStage = 'preparing' | 'script' | 'visuals' | 'voice' | 'editing' | 'quality' | 'retrying' | 'ready' | 'manual-review' | 'failed' | 'canceled';

  type PilotProductionSettingsPayload = {
    niche: {
      id: string;
      label: string;
      audience: string;
      tone: string;
      visualStyle: string;
      contentPillars: string[];
    };
    platforms: PilotPlatform[];
    durationSeconds: 30 | 45 | 60;
    videosPerDay: 1 | 2 | 3;
    minimumQualityScore: number;
    autoRetry: boolean;
    maxRetries: 1 | 2 | 3;
  };

  type PilotQueueItem = {
    id: string;
    createdAt: string;
    updatedAt: string;
    scheduledFor: string;
    status: PilotQueueStatus;
    settings: PilotProductionSettingsPayload;
    title?: string;
    outputPath?: string;
    workspacePath?: string;
    qualityScore?: number;
    attempt?: number;
    error?: string;
  };

  type PilotProgress = {
    queueItemId: string;
    stage: PilotProductionStage;
    percent: number;
    message: string;
    detail?: string;
    timestamp: string;
  };

  type PilotResult = {
    queueItemId: string;
    status: 'ready-to-publish' | 'manual-review';
    outputPath: string;
    workspacePath: string;
    qualityScore: number;
    attempt: number;
    title: string;
  };

  interface Window {
    clipforge?: {
      platform: string;
      selectOutputDirectory: () => Promise<string | null>;
      openDirectory: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
      selectVideoFile: () => Promise<SelectVideoResult>;
      startAnalysis: (input: {
        filePath: string;
        outputPath: string;
        cutDurationMinutes: 1 | 5 | 10;
        platforms: CutPlatform[];
      }) => Promise<StartAnalysisResult>;
      cancelAnalysis: (jobId: string) => Promise<{ ok: boolean }>;
      onAnalysisProgress: (callback: (payload: AnalysisProgress) => void) => () => void;
      onAnalysisComplete: (callback: (payload: AnalysisResult) => void) => () => void;
      onAnalysisError: (callback: (payload: AnalysisError) => void) => () => void;
      getPilotSecretStatus: () => Promise<{ encryptionAvailable: boolean; openaiConfigured: boolean }>;
      savePilotOpenAiKey: (apiKey: string) => Promise<{ ok: boolean; error?: string }>;
      removePilotOpenAiKey: () => Promise<{ ok: boolean }>;
      listPilotQueue: () => Promise<PilotQueueItem[]>;
      schedulePilotWeek: (settings: PilotProductionSettingsPayload) => Promise<{ ok: boolean; items?: PilotQueueItem[]; error?: string }>;
      generatePilotNow: (settings: PilotProductionSettingsPayload) => Promise<{ ok: boolean; item?: PilotQueueItem; error?: string }>;
      cancelPilot: (queueItemId: string) => Promise<{ ok: boolean }>;
      onPilotProgress: (callback: (payload: PilotProgress) => void) => () => void;
      onPilotComplete: (callback: (payload: PilotResult) => void) => () => void;
      onPilotError: (callback: (payload: { queueItemId: string; canceled: boolean; error: string }) => void) => () => void;
    };
  }
}
