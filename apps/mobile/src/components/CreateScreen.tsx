import { CalendarPlus, Gauge, Play } from 'lucide-react';
import { nichePresets } from '../presets';
import type { NichePreset, PilotPlatform } from '../types';
import type { MobilePilotSettings } from '../useMobilePilot';

export function CreateScreen({ niche, settings, connected, busy, onChange, onTogglePlatform, onRunNow, onSchedule }: {
  niche: NichePreset;
  settings: MobilePilotSettings;
  connected: boolean;
  busy: boolean;
  onChange: (next: MobilePilotSettings) => void;
  onTogglePlatform: (platform: PilotPlatform) => void;
  onRunNow: () => void;
  onSchedule: () => void;
}) {
  return (
    <section className="card form-card">
      <div className="section-heading"><div><span>CRIAR CONTEÚDO</span><h1>Configuração do Piloto</h1></div><Gauge size={24} /></div>
      <label className="field"><span>Nicho</span><select value={settings.nicheId} onChange={(event) => {
        const preset = nichePresets.find((item) => item.id === event.target.value);
        onChange({ ...settings, nicheId: event.target.value, durationSeconds: preset?.preferredDurationSeconds ?? settings.durationSeconds });
      }}>{nichePresets.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}</select></label>
      <div className="two-columns">
        <label className="field"><span>Duração</span><select value={settings.durationSeconds} onChange={(event) => onChange({ ...settings, durationSeconds: Number(event.target.value) as 30 | 45 | 60 })}><option value={30}>30s</option><option value={45}>45s</option><option value={60}>60s</option></select></label>
        <label className="field"><span>Por dia</span><select value={settings.videosPerDay} onChange={(event) => onChange({ ...settings, videosPerDay: Number(event.target.value) as 1 | 2 | 3 })}><option value={1}>1 vídeo</option><option value={2}>2 vídeos</option><option value={3}>3 vídeos</option></select></label>
      </div>
      <div className="field"><span>Plataformas</span><div className="chip-row">{(['YouTube Shorts', 'TikTok'] as PilotPlatform[]).map((platform) => <button key={platform} className={settings.platforms.includes(platform) ? 'chip selected' : 'chip'} onClick={() => onTogglePlatform(platform)}>{platform}</button>)}</div></div>
      <label className="range-field"><div><span>Quality Gate</span><strong>{settings.minimumQualityScore}/100</strong></div><input type="range" min={75} max={95} value={settings.minimumQualityScore} onChange={(event) => onChange({ ...settings, minimumQualityScore: Number(event.target.value) })} /></label>
      <label className="toggle-row"><input type="checkbox" checked={settings.autoRetry} onChange={(event) => onChange({ ...settings, autoRetry: event.target.checked })} /><div><strong>Refazer automaticamente</strong><span>Corrige somente o que derrubou a nota.</span></div></label>
      <label className="field"><span>Máximo de tentativas</span><select disabled={!settings.autoRetry} value={settings.maxRetries} onChange={(event) => onChange({ ...settings, maxRetries: Number(event.target.value) as 1 | 2 | 3 })}><option value={1}>1 tentativa</option><option value={2}>2 tentativas</option><option value={3}>3 tentativas</option></select></label>
      <div className="niche-summary"><strong>{niche.label}</strong><span>{niche.tone}</span><small>{niche.contentPillars.join(' · ')}</small></div>
      <button className="primary wide" disabled={!connected || busy || settings.platforms.length === 0} onClick={onRunNow}><Play size={18} />Gerar vídeo agora</button>
      <button className="secondary wide" disabled={!connected || busy || settings.platforms.length === 0} onClick={onSchedule}><CalendarPlus size={18} />Programar próximos 7 dias</button>
    </section>
  );
}
