import { CalendarPlus, CheckCircle2, Clock3, LoaderCircle, Play, RefreshCw, Settings, Sparkles } from 'lucide-react';
import type { NichePreset, PilotQueueItem } from '../types';
import type { MobilePilotSettings } from '../useMobilePilot';
import { QueueRow } from './QueueRow';

export function Dashboard({
  niche,
  settings,
  queue,
  connected,
  busy,
  onRunNow,
  onSchedule,
  onOpenCreate,
  onRefresh,
}: {
  niche: NichePreset;
  settings: MobilePilotSettings;
  queue: PilotQueueItem[];
  connected: boolean;
  busy: boolean;
  onRunNow: () => void;
  onSchedule: () => void;
  onOpenCreate: () => void;
  onRefresh: () => void;
}) {
  const queued = queue.filter((item) => item.status === 'queued').length;
  const active = queue.filter((item) => item.status === 'processing').length;
  const ready = queue.filter((item) => item.status === 'ready-to-publish').length;

  return (
    <>
      <section className="hero-card card">
        <div className="eyebrow"><Sparkles size={15} /> PILOTO IA</div>
        <h1>Seu estúdio de vídeos no bolso.</h1>
        <p>O Android controla tudo. O computador fica responsável por IA, render e Quality Gate.</p>
        <div className="hero-actions">
          <button className="primary" disabled={!connected || busy} onClick={onRunNow}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />}Gerar agora
          </button>
          <button className="secondary" disabled={!connected || busy} onClick={onSchedule}>
            <CalendarPlus size={18} />7 dias
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><Clock3 size={18} /><span>Fila</span><strong>{queued}</strong></article>
        <article className="stat-card"><Sparkles size={18} /><span>Produzindo</span><strong>{active}</strong></article>
        <article className="stat-card"><CheckCircle2 size={18} /><span>Prontos</span><strong>{ready}</strong></article>
      </section>

      <section className="card compact-card">
        <div className="section-heading">
          <div><span>PERFIL ATIVO</span><h2>{niche.emoji} {niche.label}</h2></div>
          <button className="icon-button" onClick={onOpenCreate}><Settings size={17} /></button>
        </div>
        <div className="profile-row"><span>Duração</span><strong>{settings.durationSeconds}s</strong></div>
        <div className="profile-row"><span>Quality Gate</span><strong>{settings.minimumQualityScore}/100</strong></div>
        <div className="profile-row"><span>Plataformas</span><strong>{settings.platforms.join(' + ') || 'Nenhuma'}</strong></div>
      </section>

      <section className="card compact-card">
        <div className="section-heading">
          <div><span>ÚLTIMOS JOBS</span><h2>Produções recentes</h2></div>
          <button className="icon-button" onClick={onRefresh}><RefreshCw size={17} /></button>
        </div>
        {queue.length === 0 && <p className="muted">A fila ainda está vazia.</p>}
        {queue.slice(0, 3).map((item) => <QueueRow item={item} key={item.id} />)}
      </section>
    </>
  );
}
