import { useEffect, useMemo, useState } from 'react';
import {
  cancelQueued,
  clearCompanionConfig,
  generateNow,
  listQueue,
  loadCompanionConfig,
  requestPairing,
  scheduleWeek,
  testCompanion,
} from './companion-api';
import { nichePresets } from './presets';
import type { CompanionConfig, PilotPlatform, PilotProductionSettingsPayload, PilotQueueItem } from './types';

const SETTINGS_KEY = 'clipforge.mobile.pilot-settings.v1';

export interface MobilePilotSettings {
  nicheId: string;
  platforms: PilotPlatform[];
  durationSeconds: 30 | 45 | 60;
  videosPerDay: 1 | 2 | 3;
  minimumQualityScore: number;
  autoRetry: boolean;
  maxRetries: 1 | 2 | 3;
}

const defaults: MobilePilotSettings = {
  nicheId: 'terror-misterio',
  platforms: ['YouTube Shorts', 'TikTok'],
  durationSeconds: 60,
  videosPerDay: 2,
  minimumQualityScore: 82,
  autoRetry: true,
  maxRetries: 3,
};

function loadSettings(): MobilePilotSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } as MobilePilotSettings : defaults;
  } catch {
    return defaults;
  }
}

export function useMobilePilot() {
  const [settings, setSettings] = useState<MobilePilotSettings>(loadSettings);
  const [config, setConfig] = useState<CompanionConfig | null>(loadCompanionConfig);
  const [serverInput, setServerInput] = useState(config?.baseUrl ?? 'http://192.168.0.2:43170');
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState<PilotQueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const niche = useMemo(
    () => nichePresets.find((item) => item.id === settings.nicheId) ?? nichePresets[0],
    [settings.nicheId],
  );

  const payload = useMemo<PilotProductionSettingsPayload>(() => ({
    niche: {
      id: niche.id,
      label: niche.label,
      audience: niche.audience,
      tone: niche.tone,
      visualStyle: niche.visualStyle,
      contentPillars: niche.contentPillars,
    },
    platforms: settings.platforms,
    durationSeconds: settings.durationSeconds,
    videosPerDay: settings.videosPerDay,
    minimumQualityScore: settings.minimumQualityScore,
    autoRetry: settings.autoRetry,
    maxRetries: settings.maxRetries,
  }), [niche, settings]);

  async function refresh(current = config): Promise<void> {
    if (!current) return;
    try {
      setQueue(await listQueue(current));
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!config) return undefined;
    let active = true;
    void testCompanion(config).then(() => active && setConnected(true)).catch(() => active && setConnected(false));
    void refresh(config);
    const timer = window.setInterval(() => active && void refresh(config), 4_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [config]);

  async function pair(): Promise<boolean> {
    setBusy(true);
    setMessage('Confirme o pareamento na tela do computador.');
    try {
      const paired = await requestPairing(serverInput, 'ClipForge Android');
      await testCompanion(paired);
      setConfig(paired);
      setServerInput(paired.baseUrl);
      setConnected(true);
      setMessage('Celular conectado ao ClipForge do PC.');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível parear.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function runNow(): Promise<boolean> {
    if (!config || settings.platforms.length === 0) return false;
    setBusy(true);
    try {
      await generateNow(config, payload);
      setMessage('Vídeo entrou na fila. O PC inicia a produção automaticamente.');
      await refresh(config);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao iniciar a produção.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function schedule(): Promise<boolean> {
    if (!config || settings.platforms.length === 0) return false;
    setBusy(true);
    try {
      const items = await scheduleWeek(config, payload);
      setMessage(`${items.length} produção(ões) adicionada(s) aos próximos 7 dias.`);
      await refresh(config);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao programar a semana.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function cancel(item: PilotQueueItem): Promise<void> {
    if (!config || item.status !== 'queued') return;
    try {
      await cancelQueued(config, item.id);
      setMessage('Produção removida da fila.');
      await refresh(config);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cancelar.');
    }
  }

  function togglePlatform(platform: PilotPlatform): void {
    setSettings((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
  }

  function disconnect(): void {
    clearCompanionConfig();
    setConfig(null);
    setConnected(false);
    setQueue([]);
    setMessage('Pareamento removido deste celular.');
  }

  return {
    settings,
    setSettings,
    config,
    serverInput,
    setServerInput,
    connected,
    queue,
    busy,
    message,
    setMessage,
    niche,
    refresh,
    pair,
    runNow,
    schedule,
    cancel,
    togglePlatform,
    disconnect,
  };
}
