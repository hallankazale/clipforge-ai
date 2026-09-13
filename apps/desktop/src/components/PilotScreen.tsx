import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bot,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FolderOpen,
  Gauge,
  KeyRound,
  LoaderCircle,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Youtube,
} from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { nichePresets } from '../pilot/presets';
import type { PilotPlatform } from '../pilot/quality';

interface PilotScreenProps {
  onNavigateHome: () => void;
}

interface PilotSettings {
  nicheId: string;
  platforms: PilotPlatform[];
  durationSeconds: 30 | 45 | 60;
  videosPerDay: 1 | 2 | 3;
  minimumQualityScore: number;
  autoRetry: boolean;
  maxRetries: 1 | 2 | 3;
}

const STORAGE_KEY = 'clipforge.pilot.settings.v1';

const defaultSettings: PilotSettings = {
  nicheId: 'terror-misterio',
  platforms: ['YouTube Shorts', 'TikTok'],
  durationSeconds: 60,
  videosPerDay: 2,
  minimumQualityScore: 82,
  autoRetry: true,
  maxRetries: 3,
};

const statusLabel: Record<PilotQueueStatus, string> = {
  queued: 'Na fila',
  processing: 'Produzindo',
  'ready-to-publish': 'Pronto para publicar',
  'manual-review': 'Revisão manual',
  failed: 'Falhou',
  canceled: 'Cancelado',
  published: 'Publicado',
};

function loadSettings(): PilotSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) } as PilotSettings;
  } catch {
    return defaultSettings;
  }
}

export function PilotScreen({ onNavigateHome }: PilotScreenProps) {
  const [settings, setSettings] = useState<PilotSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [openAiConfigured, setOpenAiConfigured] = useState(false);
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);
  const [queue, setQueue] = useState<PilotQueueItem[]>([]);
  const [progress, setProgress] = useState<PilotProgress | null>(null);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function refreshQueue(): Promise<void> {
    const items = await window.clipforge?.listPilotQueue();
    if (items) setQueue(items);
  }

  useEffect(() => {
    setSaved(false);
  }, [settings]);

  useEffect(() => {
    let mounted = true;
    const api = window.clipforge;
    if (!api) return undefined;

    void api.getPilotSecretStatus().then((status) => {
      if (!mounted) return;
      setOpenAiConfigured(status.openaiConfigured);
      setEncryptionAvailable(status.encryptionAvailable);
    });
    void api.listPilotQueue().then((items) => mounted && setQueue(items));

    const offProgress = api.onPilotProgress((next) => {
      if (!mounted) return;
      setProgress(next);
      setActiveQueueId(next.queueItemId);
    });
    const offComplete = api.onPilotComplete((result) => {
      if (!mounted) return;
      setProgress(null);
      setActiveQueueId(null);
      setActionMessage(`Vídeo concluído com nota ${result.qualityScore}/100.`);
      void refreshQueue();
    });
    const offError = api.onPilotError((error) => {
      if (!mounted) return;
      setProgress(null);
      setActiveQueueId(null);
      setActionMessage(error.error);
      void refreshQueue();
    });

    return () => {
      mounted = false;
      offProgress();
      offComplete();
      offError();
    };
  }, []);

  function togglePlatform(platform: PilotPlatform): void {
    setSettings((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
  }

  function saveSettings(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
  }

  async function saveApiKey(): Promise<void> {
    const api = window.clipforge;
    if (!api || !apiKey.trim()) return;
    setBusy(true);
    const result = await api.savePilotOpenAiKey(apiKey);
    setBusy(false);
    if (!result.ok) {
      setActionMessage(result.error ?? 'Não foi possível salvar a chave.');
      return;
    }
    setApiKey('');
    setOpenAiConfigured(true);
    setActionMessage('Chave da OpenAI protegida pelo armazenamento seguro do sistema.');
  }

  async function removeApiKey(): Promise<void> {
    const api = window.clipforge;
    if (!api) return;
    await api.removePilotOpenAiKey();
    setOpenAiConfigured(false);
    setApiKey('');
    setActionMessage('Chave removida deste computador.');
  }

  async function generateNow(): Promise<void> {
    const api = window.clipforge;
    if (!api) return;
    saveSettings();
    setBusy(true);
    setActionMessage('');
    const result = await api.generatePilotNow(payload);
    setBusy(false);
    if (!result.ok || !result.item) {
      setActionMessage(result.error ?? 'Não foi possível iniciar a produção.');
      return;
    }
    setActiveQueueId(result.item.id);
    setActionMessage('Produção iniciada. O Quality Gate decide se o vídeo pode seguir.');
    await refreshQueue();
  }

  async function scheduleWeek(): Promise<void> {
    const api = window.clipforge;
    if (!api) return;
    saveSettings();
    setBusy(true);
    const result = await api.schedulePilotWeek(payload);
    setBusy(false);
    if (!result.ok) {
      setActionMessage(result.error ?? 'Não foi possível criar a fila.');
      return;
    }
    setActionMessage(`${result.items?.length ?? 0} vídeo(s) programado(s) para os próximos 7 dias.`);
    await refreshQueue();
  }

  async function cancelActive(): Promise<void> {
    if (!activeQueueId) return;
    await window.clipforge?.cancelPilot(activeQueueId);
  }

  return (
    <div className="app-shell pilot-shell">
      <AppSidebar active="pilot" onNavigate={(section) => section === 'home' && onNavigateHome()} />

      <main className="workspace pilot-workspace">
        <section className="panel pilot-hero">
          <div>
            <div className="eyebrow"><Bot size={16} /> PILOTO AUTOMÁTICO</div>
            <h1>Seu canal trabalhando com <span>controle de qualidade.</span></h1>
            <p>Escolha o nicho e as regras. O ClipForge gera roteiro, cenas, voz, legendas e vídeo final antes de liberar qualquer conteúdo.</p>
          </div>
          <div className="pilot-orb"><Sparkles size={34} /></div>
        </section>

        <section className="panel pilot-secret-panel">
          <div className="pilot-heading">
            <div>
              <span className="eyebrow"><KeyRound size={15} /> MOTOR DE IA</span>
              <h2>OpenAI</h2>
            </div>
            <span className={openAiConfigured ? 'development-badge ready' : 'development-badge'}>
              {openAiConfigured ? 'Configurada' : 'Configuração necessária'}
            </span>
          </div>
          <p className="pilot-note">A chave é criptografada pelo sistema operacional e nunca é gravada no repositório. O ClipForge não mostra novamente a chave salva.</p>
          {!encryptionAvailable && (
            <div className="pilot-alert">O armazenamento seguro do Windows não está disponível. O ClipForge recusará salvar a chave em texto puro.</div>
          )}
          <div className="pilot-key-row">
            <input
              type="password"
              value={apiKey}
              disabled={!encryptionAvailable || busy}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={openAiConfigured ? '•••••••• chave já protegida ••••••••' : 'Cole sua chave da OpenAI'}
              autoComplete="off"
            />
            <button onClick={() => void saveApiKey()} disabled={!apiKey.trim() || !encryptionAvailable || busy}>
              <ShieldCheck size={17} />Salvar com segurança
            </button>
            {openAiConfigured && (
              <button className="secondary-action" onClick={() => void removeApiKey()} disabled={busy}>
                <Trash2 size={16} />Remover
              </button>
            )}
          </div>
        </section>

        <section className="panel account-panel">
          <div className="pilot-heading">
            <div>
              <span className="eyebrow">CONTAS DE PUBLICAÇÃO</span>
              <h2>Canais oficiais</h2>
            </div>
            <span className="development-badge">OAuth separado da produção</span>
          </div>
          <div className="account-grid">
            <article className="account-card">
              <Youtube size={28} />
              <div><strong>YouTube</strong><span>Não conectado</span></div>
              <button disabled>Conectar</button>
            </article>
            <article className="account-card">
              <div className="tiktok-mark">♪</div>
              <div><strong>TikTok</strong><span>Não conectado</span></div>
              <button disabled>Conectar</button>
            </article>
          </div>
          <p className="pilot-note">A produção automática já funciona sem armazenar senhas. A publicação só será ativada com OAuth oficial das plataformas.</p>
        </section>

        <section className="panel pilot-config-panel">
          <div className="pilot-heading"><div><span className="eyebrow">ESTRATÉGIA</span><h2>Configuração do canal</h2></div></div>
          <div className="pilot-form-grid">
            <label className="pilot-field pilot-field-wide">
              <span>Nicho</span>
              <select
                value={settings.nicheId}
                onChange={(event) => {
                  const next = nichePresets.find((item) => item.id === event.target.value);
                  setSettings((current) => ({
                    ...current,
                    nicheId: event.target.value,
                    durationSeconds: next?.preferredDurationSeconds ?? current.durationSeconds,
                  }));
                }}
              >
                {nichePresets.map((item) => <option value={item.id} key={item.id}>{item.emoji} {item.label}</option>)}
              </select>
            </label>
            <label className="pilot-field">
              <span>Duração</span>
              <select value={settings.durationSeconds} onChange={(event) => setSettings((current) => ({ ...current, durationSeconds: Number(event.target.value) as 30 | 45 | 60 }))}>
                <option value={30}>30 segundos</option><option value={45}>45 segundos</option><option value={60}>60 segundos</option>
              </select>
            </label>
            <label className="pilot-field">
              <span>Vídeos por dia</span>
              <select value={settings.videosPerDay} onChange={(event) => setSettings((current) => ({ ...current, videosPerDay: Number(event.target.value) as 1 | 2 | 3 }))}>
                <option value={1}>1 vídeo</option><option value={2}>2 vídeos</option><option value={3}>3 vídeos</option>
              </select>
            </label>
          </div>
          <div className="niche-profile">
            <div><span>Público</span><strong>{niche.audience}</strong></div>
            <div><span>Tom</span><strong>{niche.tone}</strong></div>
            <div><span>Visual</span><strong>{niche.visualStyle}</strong></div>
            <div><span>Pilares</span><strong>{niche.contentPillars.join(' · ')}</strong></div>
          </div>
          <div className="platform-choice-row">
            {(['YouTube Shorts', 'TikTok'] as PilotPlatform[]).map((platform) => (
              <button className={settings.platforms.includes(platform) ? 'pilot-platform selected' : 'pilot-platform'} onClick={() => togglePlatform(platform)} key={platform}>
                <CheckCircle2 size={17} />{platform}
              </button>
            ))}
          </div>
        </section>

        <section className="panel quality-panel">
          <div className="pilot-heading">
            <div><span className="eyebrow"><ShieldCheck size={15} /> QUALITY GATE</span><h2>Não publicar conteúdo abaixo do padrão</h2></div>
            <strong className="quality-target">Meta {settings.minimumQualityScore}/100</strong>
          </div>
          <div className="quality-controls">
            <label className="score-control">
              <span>Nota mínima para liberar publicação</span>
              <input type="range" min={75} max={95} value={settings.minimumQualityScore} onChange={(event) => setSettings((current) => ({ ...current, minimumQualityScore: Number(event.target.value) }))} />
              <strong>{settings.minimumQualityScore}</strong>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={settings.autoRetry} onChange={(event) => setSettings((current) => ({ ...current, autoRetry: event.target.checked }))} />
              <div><strong>Refazer automaticamente</strong><span>Corrige somente o componente que derrubou a nota.</span></div>
            </label>
            <label className="pilot-field retry-field">
              <span>Máximo de tentativas</span>
              <select disabled={!settings.autoRetry} value={settings.maxRetries} onChange={(event) => setSettings((current) => ({ ...current, maxRetries: Number(event.target.value) as 1 | 2 | 3 }))}>
                <option value={1}>1 tentativa</option><option value={2}>2 tentativas</option><option value={3}>3 tentativas</option>
              </select>
            </label>
          </div>
          <div className="quality-metrics-grid">
            {['Hook', 'Roteiro', 'Consistência visual', 'Ritmo', 'Voz', 'Legendas', 'Originalidade', 'Formato'].map((metric) => (
              <div key={metric}><Gauge size={16} /><span>{metric}</span><strong>avaliado</strong></div>
            ))}
          </div>
        </section>

        {(progress || actionMessage) && (
          <section className="panel pilot-live-panel">
            <div className="pilot-heading">
              <div><span className="eyebrow">PRODUÇÃO AO VIVO</span><h2>{progress ? progress.message : actionMessage}</h2></div>
              {progress && <strong className="quality-target">{progress.percent}%</strong>}
            </div>
            {progress && (
              <>
                <div className="pilot-progress-track"><i style={{ width: `${progress.percent}%` }} /></div>
                {progress.detail && <p className="pilot-note">{progress.detail}</p>}
                <button className="secondary-action" onClick={() => void cancelActive()}><Trash2 size={16} />Cancelar produção</button>
              </>
            )}
          </section>
        )}

        <section className="panel pilot-queue-panel">
          <div className="pilot-heading">
            <div><span className="eyebrow"><CalendarClock size={15} /> FILA PERSISTENTE</span><h2>Próximas produções</h2></div>
            <button className="secondary-action" onClick={() => void refreshQueue()}><RefreshCw size={16} />Atualizar</button>
          </div>
          <div className="pilot-queue-list">
            {queue.length === 0 && <p className="pilot-note">Nenhum vídeo programado ainda.</p>}
            {queue.slice(0, 8).map((item) => (
              <article className="pilot-queue-item" key={item.id}>
                <div>
                  <strong>{item.title ?? item.settings.niche.label}</strong>
                  <span>{new Date(item.scheduledFor).toLocaleString('pt-BR')} · {statusLabel[item.status]}</span>
                </div>
                <div className="pilot-queue-actions">
                  {typeof item.qualityScore === 'number' && <b>{item.qualityScore}/100</b>}
                  {item.workspacePath && <button title="Abrir arquivos" onClick={() => void window.clipforge?.openDirectory(item.workspacePath!)}><FolderOpen size={16} /></button>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel pipeline-panel">
          <div className="pilot-heading"><div><span className="eyebrow">PIPELINE REAL</span><h2>Como cada vídeo é produzido</h2></div></div>
          <div className="pilot-pipeline">
            {[
              ['1', 'Estratégia', 'Nicho e ângulo'], ['2', 'Roteiro', 'Hook + história'], ['3', 'Storyboard', 'Cena por cena'],
              ['4', 'Produção', 'Voz + imagens'], ['5', 'Edição', 'FFmpeg + legendas'], ['6', 'Quality Gate', '8 métricas'],
              ['7', 'Fila', 'Horário persistente'], ['8', 'Publicação', 'Aguardando OAuth'],
            ].map(([number, title, detail]) => (
              <div className="pipeline-step" key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></div>
            ))}
          </div>
        </section>
      </main>

      <aside className="summary panel pilot-summary">
        <div><span className="eyebrow">PLANO DO PILOTO</span><h2>{niche.emoji} {niche.label}</h2></div>
        <div className="summary-list">
          <div><span>Plataformas</span><strong>{settings.platforms.join(', ') || 'Nenhuma'}</strong></div>
          <div><span>Produção</span><strong>{settings.videosPerDay} vídeo(s)/dia</strong></div>
          <div><span>Duração</span><strong>{settings.durationSeconds}s</strong></div>
          <div><span>Qualidade mínima</span><strong>{settings.minimumQualityScore}/100</strong></div>
          <div><span>Regeneração</span><strong>{settings.autoRetry ? `Até ${settings.maxRetries} tentativa(s)` : 'Manual'}</strong></div>
        </div>
        <div className="quality-rule-box"><BadgeCheck size={20} /><div><strong>Regra principal</strong><span>Vídeo reprovado não entra na etapa de publicação.</span></div></div>
        <button className="primary-action" onClick={() => void generateNow()} disabled={!openAiConfigured || settings.platforms.length === 0 || busy || Boolean(activeQueueId)}>
          {busy || activeQueueId ? <LoaderCircle size={18} className="spin" /> : <Play size={18} />}{activeQueueId ? 'Produzindo...' : 'Gerar vídeo agora'}
        </button>
        <button className="secondary-action pilot-schedule-button" onClick={() => void scheduleWeek()} disabled={!openAiConfigured || settings.platforms.length === 0 || busy}>
          <CalendarPlus size={18} />Programar próximos 7 dias
        </button>
        <button className="secondary-action" onClick={saveSettings}><Save size={17} />{saved ? 'Configuração salva' : 'Salvar configuração'}</button>
        {saved && <p className="saved-message"><CheckCircle2 size={15} /> Plano salvo neste computador.</p>}
        <div className="pilot-status-list">
          <div><CheckCircle2 size={16} /><span>Gerador de conteúdo</span><strong>ativo</strong></div>
          <div><CalendarClock size={16} /><span>Fila automática</span><strong>ativa</strong></div>
          <div><ShieldCheck size={16} /><span>Quality Gate</span><strong>ativo</strong></div>
          <div><RefreshCw size={16} /><span>Publicação OAuth</span><strong>pendente</strong></div>
        </div>
      </aside>
    </div>
  );
}
