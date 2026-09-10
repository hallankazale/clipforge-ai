import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bot,
  CalendarClock,
  CheckCircle2,
  Gauge,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
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

  const niche = useMemo(
    () => nichePresets.find((item) => item.id === settings.nicheId) ?? nichePresets[0],
    [settings.nicheId],
  );

  useEffect(() => {
    setSaved(false);
  }, [settings]);

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

  return (
    <div className="app-shell pilot-shell">
      <AppSidebar active="pilot" onNavigate={(section) => section === 'home' && onNavigateHome()} />

      <main className="workspace pilot-workspace">
        <section className="panel pilot-hero">
          <div>
            <div className="eyebrow"><Bot size={16} /> PILOTO AUTOMÁTICO</div>
            <h1>Seu canal trabalhando com <span>controle de qualidade.</span></h1>
            <p>Escolha o nicho e as regras. O ClipForge só poderá liberar um vídeo para publicação depois de passar pelo Quality Gate.</p>
          </div>
          <div className="pilot-orb"><Sparkles size={34} /></div>
        </section>

        <section className="panel account-panel">
          <div className="pilot-heading">
            <div>
              <span className="eyebrow">CONTAS CONECTADAS</span>
              <h2>Canais de publicação</h2>
            </div>
            <span className="development-badge">OAuth em desenvolvimento</span>
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
          <p className="pilot-note">As senhas nunca serão armazenadas pelo ClipForge. A conexão será feita pela autorização oficial de cada plataforma.</p>
        </section>

        <section className="panel pilot-config-panel">
          <div className="pilot-heading">
            <div>
              <span className="eyebrow">ESTRATÉGIA</span>
              <h2>Configuração do canal</h2>
            </div>
          </div>

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
                {nichePresets.map((item) => (
                  <option value={item.id} key={item.id}>{item.emoji} {item.label}</option>
                ))}
              </select>
            </label>

            <label className="pilot-field">
              <span>Duração</span>
              <select
                value={settings.durationSeconds}
                onChange={(event) => setSettings((current) => ({ ...current, durationSeconds: Number(event.target.value) as 30 | 45 | 60 }))}
              >
                <option value={30}>30 segundos</option>
                <option value={45}>45 segundos</option>
                <option value={60}>60 segundos</option>
              </select>
            </label>

            <label className="pilot-field">
              <span>Vídeos por dia</span>
              <select
                value={settings.videosPerDay}
                onChange={(event) => setSettings((current) => ({ ...current, videosPerDay: Number(event.target.value) as 1 | 2 | 3 }))}
              >
                <option value={1}>1 vídeo</option>
                <option value={2}>2 vídeos</option>
                <option value={3}>3 vídeos</option>
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
              <button
                className={settings.platforms.includes(platform) ? 'pilot-platform selected' : 'pilot-platform'}
                onClick={() => togglePlatform(platform)}
                key={platform}
              >
                <CheckCircle2 size={17} />{platform}
              </button>
            ))}
          </div>
        </section>

        <section className="panel quality-panel">
          <div className="pilot-heading">
            <div>
              <span className="eyebrow"><ShieldCheck size={15} /> QUALITY GATE</span>
              <h2>Não publicar conteúdo abaixo do padrão</h2>
            </div>
            <strong className="quality-target">Meta {settings.minimumQualityScore}/100</strong>
          </div>

          <div className="quality-controls">
            <label className="score-control">
              <span>Nota mínima para liberar publicação</span>
              <input
                type="range"
                min={75}
                max={95}
                value={settings.minimumQualityScore}
                onChange={(event) => setSettings((current) => ({ ...current, minimumQualityScore: Number(event.target.value) }))}
              />
              <strong>{settings.minimumQualityScore}</strong>
            </label>

            <label className="toggle-card">
              <input
                type="checkbox"
                checked={settings.autoRetry}
                onChange={(event) => setSettings((current) => ({ ...current, autoRetry: event.target.checked }))}
              />
              <div><strong>Refazer automaticamente</strong><span>Corrige somente o componente que derrubou a nota.</span></div>
            </label>

            <label className="pilot-field retry-field">
              <span>Máximo de tentativas</span>
              <select
                disabled={!settings.autoRetry}
                value={settings.maxRetries}
                onChange={(event) => setSettings((current) => ({ ...current, maxRetries: Number(event.target.value) as 1 | 2 | 3 }))}
              >
                <option value={1}>1 tentativa</option>
                <option value={2}>2 tentativas</option>
                <option value={3}>3 tentativas</option>
              </select>
            </label>
          </div>

          <div className="quality-metrics-grid">
            {['Hook', 'Roteiro', 'Consistência visual', 'Ritmo', 'Voz', 'Legendas', 'Originalidade', 'Formato'].map((metric) => (
              <div key={metric}><Gauge size={16} /><span>{metric}</span><strong>avaliado</strong></div>
            ))}
          </div>
        </section>

        <section className="panel pipeline-panel">
          <div className="pilot-heading">
            <div>
              <span className="eyebrow">PIPELINE PREMIUM</span>
              <h2>Como cada vídeo será produzido</h2>
            </div>
          </div>

          <div className="pilot-pipeline">
            {[
              ['1', 'Pesquisa', 'Ideias e ângulos'],
              ['2', 'Roteiro', 'Hook + história'],
              ['3', 'Storyboard', 'Cena por cena'],
              ['4', 'Produção', 'Voz + visuais'],
              ['5', 'Edição', 'Ritmo + legendas'],
              ['6', 'Quality Gate', 'Aprova ou refaz'],
              ['7', 'Fila', 'Horário e canal'],
              ['8', 'Publicação', 'Plataforma oficial'],
            ].map(([number, title, detail]) => (
              <div className="pipeline-step" key={number}>
                <span>{number}</span><strong>{title}</strong><small>{detail}</small>
              </div>
            ))}
          </div>
        </section>
      </main>

      <aside className="summary panel pilot-summary">
        <div>
          <span className="eyebrow">PLANO DO PILOTO</span>
          <h2>{niche.emoji} {niche.label}</h2>
        </div>

        <div className="summary-list">
          <div><span>Plataformas</span><strong>{settings.platforms.join(', ') || 'Nenhuma'}</strong></div>
          <div><span>Produção</span><strong>{settings.videosPerDay} vídeo(s)/dia</strong></div>
          <div><span>Duração</span><strong>{settings.durationSeconds}s</strong></div>
          <div><span>Qualidade mínima</span><strong>{settings.minimumQualityScore}/100</strong></div>
          <div><span>Regeneração</span><strong>{settings.autoRetry ? `Até ${settings.maxRetries} tentativa(s)` : 'Manual'}</strong></div>
        </div>

        <div className="quality-rule-box">
          <BadgeCheck size={20} />
          <div><strong>Regra principal</strong><span>Vídeo reprovado não entra na fila de publicação.</span></div>
        </div>

        <button className="primary-action" onClick={saveSettings} disabled={settings.platforms.length === 0}>
          <Save size={18} />{saved ? 'Configuração salva' : 'Salvar configuração'}
        </button>

        {saved && <p className="saved-message"><CheckCircle2 size={15} /> Plano salvo neste computador.</p>}

        <div className="pilot-status-list">
          <div><RefreshCw size={16} /><span>Gerador de conteúdo</span><strong>próxima fase</strong></div>
          <div><CalendarClock size={16} /><span>Fila automática</span><strong>próxima fase</strong></div>
          <div><ShieldCheck size={16} /><span>Quality Gate</span><strong>base pronta</strong></div>
        </div>
      </aside>
    </div>
  );
}
