import type { QualityGateResult, QualityMetrics, PilotPlatform } from './quality';

export interface PilotSettings {
  nicheId: string;
  platforms: PilotPlatform[];
  durationSeconds: 30 | 45 | 60;
  videosPerDay: 1 | 2 | 3;
  minimumQualityScore: number;
  autoRetry: boolean;
  /** Total production attempts, including the initial generation (legacy field name). */
  maxRetries: 1 | 2 | 3;
}
export type Platform = 'youtube' | 'tiktok';
export interface Account { id: string; platform: Platform; name: string }
export interface Word { word: string; start: number; end: number }
export interface Scene { narration: string; visual: string }
export interface VideoPlan {
  title: string; description: string; hashtags: string[]; style: string;
  scenes: Scene[]; sources: string[]; fiction: boolean;
}
export interface TechnicalReport {
  passed: boolean; issues: string[]; duration: number; integratedLoudness: number;
  truePeak: number; silenceRatio: number; captionCoverage: number; transcriptSimilarity: number;
}
export interface QualityReport {
  gate: QualityGateResult; metrics: QualityMetrics; technical: TechnicalReport;
  evidence: string[]; assessedAt: string;
}
export type JobStatus = 'queued' | 'generating' | 'review' | 'ready' | 'failed' | 'canceled';
export interface Publication {
  accountId: string; platform: Platform;
  status: 'waiting' | 'uploading' | 'scheduled' | 'draft-sent' | 'processing' | 'failed' | 'uncertain';
  remoteId?: string; sessionUrl?: string; error?: string; retryCount?: number; nextAttemptAt?: string;
}
export interface PilotJob {
  id: string; createdAt: string; scheduledAt: string; settings: PilotSettings;
  outputDirectory: string; status: JobStatus; stage: string; attempt: number;
  plan?: VideoPlan; videoPath?: string; digest?: string; quality?: QualityReport;
  reports: QualityReport[]; error?: string; publications: Publication[];
  autoPublishYouTube: boolean; privacy: 'private' | 'unlisted' | 'public'; madeForKids: boolean;
}
export interface StartPilotInput {
  settings: PilotSettings; outputDirectory: string; scheduledAt: string; count: number;
  autoPublishYouTube: boolean; privacy: 'private' | 'unlisted' | 'public'; madeForKids: boolean;
}
export interface PilotSnapshot {
  jobs: PilotJob[]; accounts: Account[]; busy: boolean;
  configured: { openai: boolean; youtube: boolean; tiktok: boolean };
}
export interface PilotAPI {
  snapshot(): Promise<PilotSnapshot>;
  importCredentials(): Promise<{ canceled: boolean }>;
  connect(platform: Platform): Promise<void>;
  disconnect(accountId: string): Promise<void>;
  start(input: StartPilotInput): Promise<void>;
  cancel(id: string): Promise<void>;
  preview(id: string): Promise<void>;
  sendTikTokDraft(id: string): Promise<void>;
  onChange(callback: () => void): () => void;
}
