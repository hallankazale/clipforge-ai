import { useEffect, useState } from 'react';
import type { PilotSettings, PilotSnapshot, StartPilotInput } from '../../electron/pilot/contracts';

const label: Record<string, string> = { queued: 'Na fila', generating: 'Produzindo', review: 'Revisão necessária', ready: 'Aprovado', failed: 'Falhou', canceled: 'Cancelado', waiting: 'Aguardando', uploading: 'Enviando', scheduled: 'Processado / agendado', 'draft-sent': 'Enviado à caixa de entrada', processing: 'Processando na plataforma', uncertain: 'Envio não confirmado — confira a plataforma' };
const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(19, 30, 0, 0); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
export function PilotProductionPanel({ settings }: { settings: PilotSettings }) {
  const api = window.clipforge?.pilot;
  const [snapshot, setSnapshot] = useState<PilotSnapshot>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [scheduledAt, setScheduledAt] = useState(tomorrow);
  const [autoPublishYouTube, setAutomatic] = useState(false);
  const [privacy, setPrivacy] = useState<StartPilotInput['privacy']>('private');
  const [audience, setAudience] = useState('');
  const [batch, setBatch] = useState(false);
  const [costConsent, setCostConsent] = useState(false);
  async function refresh() { if (api) setSnapshot(await api.snapshot()); }
  useEffect(() => {
    if (!api) return;
    let alive = true;
    const update = () => { void api.snapshot().then(value => { if (alive) setSnapshot(value); }).catch(e => { if (alive) setError(String(e.message)); }); };
    update(); const unsubscribe = api.onChange(update);
    return () => { alive = false; unsubscribe(); };
  }, [api]);
  async function run(action: () => Promise<unknown>) {
    setPending(true); setError('');
    try { await action(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'A operação falhou.'); }
    finally { setPending(false); }
  }
  const count = batch ? 7 * settings.videosPerDay : 1;
  return <section className="panel production-panel">
    <div className="pilot-heading"><div><span className="eyebrow">PRODUÇÃO E CONTAS</span><h2>Do roteiro ao vídeo pronto</h2></div><span className="development-badge">Cenas originais + voz IA</span></div>
    {!api && <p role="alert">Abra o aplicativo desktop para produzir e conectar suas contas.</p>}
    {error && <p className="pilot-error" role="alert">{error}</p>}
    <div className="account-grid">
      {(['youtube', 'tiktok'] as const).map(platform => {
        const account = snapshot?.accounts.find(a => a.platform === platform);
        return <article className="account-card" key={platform}><div><strong>{platform === 'youtube' ? 'YouTube' : 'TikTok'}</strong><span>{account?.name || 'Não conectado'}</span></div>
          <button disabled={!api || pending} onClick={() => run(() => account ? api!.disconnect(account.id) : api!.connect(platform))}>{account ? 'Desconectar' : 'Conectar'}</button></article>;
      })}
    </div>
    <p className="pilot-note">YouTube: envio automático dos aprovados; vídeos públicos usam o agendamento da plataforma. TikTok: revise a prévia, envie à caixa de entrada e finalize a publicação no TikTok.</p>
    <button className="pilot-secondary" disabled={!api || pending} onClick={() => run(() => api!.importCredentials())}>Importar credenciais com segurança</button>
    <p className="pilot-note">{snapshot?.configured.openai ? 'Geração por IA configurada.' : 'Geração aguardando chave da OpenAI.'} As credenciais são protegidas pelo sistema e não aparecem na interface. Narração sintética identificada no pacote de publicação.</p>
    <div className="pilot-form-grid">
      <label className="pilot-field pilot-field-wide"><span>Pasta dos vídeos</span><button disabled={pending} onClick={() => run(async () => { const path = await window.clipforge?.selectOutputDirectory(); if (path) setOutputDirectory(path); })}>{outputDirectory || 'Escolher pasta no HD'}</button></label>
      <label className="pilot-field"><span>Primeiro horário (fuso deste computador)</span><input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} /></label>
      <label className="pilot-field"><span>Visibilidade no YouTube</span><select value={privacy} onChange={e => setPrivacy(e.target.value as StartPilotInput['privacy'])}><option value="private">Privado</option><option value="unlisted">Não listado</option><option value="public">Público no horário escolhido</option></select></label>
      <label className="pilot-field"><span>Conteúdo feito para crianças?</span><select value={audience} onChange={e => setAudience(e.target.value)}><option value="">Selecione</option><option value="no">Não</option><option value="yes">Sim</option></select></label>
      <label className="pilot-field"><span>Quantidade</span><select value={batch ? 'week' : 'one'} onChange={e => setBatch(e.target.value === 'week')}><option value="one">Um vídeo</option><option value="week">Sete dias · {7 * settings.videosPerDay} vídeos</option></select></label>
    </div>
    <label className="toggle-card"><input type="checkbox" checked={autoPublishYouTube} onChange={e => setAutomatic(e.target.checked)} /><div><strong>Enviar automaticamente ao YouTube conectado</strong><span>Somente vídeos aprovados. O destino é a conta mostrada acima.</span></div></label>
    <label className="toggle-card"><input type="checkbox" checked={costConsent} onChange={e => setCostConsent(e.target.checked)} /><div><strong>Autorizar geração de {count} vídeo(s) com a API</strong><span>Até {settings.autoRetry ? settings.maxRetries : 1} tentativa(s) por vídeo; até 10 imagens por tentativa. A API cobra pelo uso, incluindo tentativas reprovadas.</span></div></label>
    <button className="primary-action" disabled={!api || pending || !costConsent || !outputDirectory || !audience || !snapshot?.configured.openai || snapshot.jobs.some(j => ['queued', 'generating'].includes(j.status))} onClick={() => run(() => api!.start({ settings, outputDirectory, scheduledAt: new Date(scheduledAt).toISOString(), count, autoPublishYouTube, privacy, madeForKids: audience === 'yes' }))}>Criar {count === 1 ? 'vídeo' : `${count} vídeos`}</button>
    <p className="pilot-note">Mantenha o aplicativo aberto durante produção e envios pendentes. O lote é limitado a sete dias. Cada vídeo tem roteiro, cenas, legendas e relatório salvos no HD. Uma nota alta é uma avaliação editorial, não garantia de alcance.</p>
    <div className="pilot-job-list" aria-live="polite">
      {snapshot?.jobs.length === 0 && <p>Nenhum vídeo produzido. Configure o nicho abaixo e crie o primeiro.</p>}
      {snapshot?.jobs.map(job => <article className="pilot-job" key={job.id}>
        <div className="pilot-heading"><div><strong>{job.plan?.title || 'Novo vídeo'}</strong><p>{label[job.status]} · {job.stage} · tentativa {job.attempt}/{job.settings.maxRetries}</p></div><span>{job.quality ? `${job.quality.gate.score}/100` : 'Ainda não avaliado'}</span></div>
        <p>{new Date(job.scheduledAt).toLocaleString('pt-BR')} · {job.privacy === 'public' ? 'Público' : job.privacy === 'private' ? 'Privado' : 'Não listado'}</p>
        {job.error && <p className="pilot-error">{job.error}</p>}
        {job.quality && <details><summary>Ver avaliação e problemas</summary><p>Técnica: {job.quality.technical.passed ? 'aprovada' : 'reprovada'}</p><ul>{[...job.quality.evidence, ...job.quality.gate.issues.map(i => i.message)].map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}
        {job.publications.map(post => <p key={post.accountId}>{post.platform === 'youtube' ? 'YouTube' : 'TikTok'}: {label[post.status]}{post.remoteId ? ` · ID ${post.remoteId}` : ''}{post.error ? ` · ${post.error}` : ''}</p>)}
        <div className="pilot-job-actions">
          {job.videoPath && <button disabled={pending} onClick={() => run(() => api!.preview(job.id))}>Assistir ao vídeo</button>}
          {job.status === 'ready' && job.publications.some(p => p.platform === 'tiktok' && p.status === 'waiting') && <button disabled={pending} onClick={() => run(() => api!.sendTikTokDraft(job.id))}>Enviar ao TikTok</button>}
          {['queued', 'generating', 'ready'].includes(job.status) && <button disabled={pending} onClick={() => run(() => api!.cancel(job.id))}>Cancelar produção / fila</button>}
        </div>
      </article>)}
    </div>
  </section>;
}
