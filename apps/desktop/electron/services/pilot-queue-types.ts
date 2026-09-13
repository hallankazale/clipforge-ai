import type { PilotPlatform } from '../core/quality';

export type PilotQueueStatus = 'queued' | 'processing' | 'ready-to-publish' | 'manual-review' | 'failed' | 'canceled' | 'published';

export interface PilotNicheProfile {
  id: string;
  label: string;
  audience: string;
  tone: string;
  visualStyle: string;
  contentPillars: string[];
}

export interface PilotProductionSettings {
  niche: PilotNicheProfile;
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
  settings: PilotProductionSettings;
  title?: string;
  outputPath?: string;
  workspacePath?: string;
  qualityScore?: number;
  attempt?: number;
  error?: string;
}
