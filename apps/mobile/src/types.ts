export type PilotPlatform = 'YouTube Shorts' | 'TikTok';
export type PilotQueueStatus =
  | 'queued'
  | 'processing'
  | 'ready-to-publish'
  | 'manual-review'
  | 'failed'
  | 'canceled'
  | 'published';

export interface NichePreset {
  id: string;
  label: string;
  emoji: string;
  audience: string;
  tone: string;
  visualStyle: string;
  contentPillars: string[];
  preferredDurationSeconds: 30 | 45 | 60;
}

export interface PilotProductionSettingsPayload {
  niche: Omit<NichePreset, 'emoji' | 'preferredDurationSeconds'>;
  platforms: PilotPlatform[];
  durationSeconds: 30 | 45 | 60;
  videosPerDay: 1 | 2 | 3;
  minimumQualityScore: number;
  autoRetry: boolean;
  maxRetries: 1 | 2 | 3;
}

export interface PilotQueueItem {
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
}

export interface CompanionConfig {
  baseUrl: string;
  token: string;
}

export interface CompanionHealth {
  ok: boolean;
  product: string;
  companionApi: number;
  busy: boolean;
}
