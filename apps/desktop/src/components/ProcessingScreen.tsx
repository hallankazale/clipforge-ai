import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileAudio,
  FileImage,
  Film,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Square,
  Trophy,
  Video,
} from 'lucide-react';
import { AppSidebar } from './AppSidebar';

interface ProcessingScreenProps {
  metadata: VideoMetadata | null;
  progress: AnalysisProgress | null;
  log: AnalysisProgress[];
  result: AnalysisResult | null;
  error: string | null;
  isRunning: boolean;
  outputPath: string;
  onCancel: () => void;
  onBack: () => void;
}

const stageOrder: AnalysisStage[] = [
  'preparing',
  'audio',
  'frames',
  'scoring',
  'cutting',
  'finalizing',
  'completed',
];

const steps: Array<{ stage: AnalysisStage; title: string; detail: string }> = [
  { stage: 'preparing', title: 'Preparando', detail: 'Validação do vídeo' },
  { stage: 'audio', title: 'Áudio', detail: 'Atividade e silêncio' },
  { stage: 'frames', title: 'Imagem', detail: 'Variação visual' },
  { stage: 'scoring', title: 'Ranking', detail: 'Melhores momentos' },
  { stage: 'cutting', title: 'Cortes', detail: 'Renderização MP4' },
  { stage: 'finalizing', title: 'Finalizando', detail: 'Conferência dos arquivos' },
];

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatClock(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('pt-BR', { hour12: false });
}

function stepState(step: AnalysisStage, current: AnalysisStage | undefined) {
  if (!current || current === 'canceled') return 'pending';
  const currentIndex = stageOrder.indexOf(current);
  const stepIndex = stageOrder.indexOf(step);
  if (current === 'completed' || stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export function ProcessingScreen({
  metadata,
  progress,
  log,
  result,
  error,
  isRunning,
  outputPath,
  onCancel,
  onBack,
}: ProcessingScreenProps) {
  const percentage = progress?.percent ?? (result ? 100 : 0);
  const workspacePath = result?.workspacePath ?? progress?.workspacePath;

  async function openCutsFolder(): Promise<void> {
    if (!result?.cutsDirectory || !window.clipforge) return;
    await window.clipforge.openDirectory(result.cutsDirectory);
  }

  async function copyPublication(cut: RenderedCut): Promise<void> {
    const text = [
      cut.publication.title,
      '',
      cut.publication.description,
    ].join('\n');
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="app-shell processing-shell">
      <AppSidebar active="processing" onNavigate={(section) => section === 'home' && onBack()} />

      <main className="workspace processing-workspace">
        <section className="panel processing-video-card">
          <div className="processing-video-preview">
            <div className="preview-icon"><Video size={44} /></div>
            <div>
              <span>VÍDEO EM ANÁLISE</span>
              <strong>{metadata?.fileName ?? 'Nenhum vídeo selecionado'}</strong>
            </div>
          </div>

          <div className="video-facts">
            <div><Clock3 size={17} /><span>Duração</span><strong>{metadata ? formatDuration(metadata.durationSeconds) : 'N/D'}</strong></div>
            <div><Video size={17} /><span>Resolução</span><strong>{metadata?.width && metadata.height ? `${metadata.width} × ${metadata.height}` : 'N/D'}</strong></div>
            <div><Sparkles size={17} /><span>Codec</span><strong>{metadata?.videoCodec?.toUpperCase() ?? 'N/D'}</strong></div>
          </div>
        </section>

        <section className="panel live-progress-card">
          <div className="processing-title-row">
            <div>
              <span className="eyebrow">PROCESSAMENTO LOCAL</span>
              <h2>{result ? 'Vídeos recortados e prontos' : error ? 'A análise foi interrompida' : 'Análise em andamento'}</h2>
            </div>
            <strong className="progress-number">{percentage}%</strong>
          </div>

          <div className="live-progress-track" aria-label={`Progresso ${percentage}%`}>
            <i style={{ width: `${percentage}%` }} />
          </div>

          <div className="current-operation">
            {isRunning ? <LoaderCircle className="spin" size={20} /> : <CheckCircle2 size={20} />}
            <div>
              <strong>{error ?? progress?.message ?? 'Aguardando início da análise'}</strong>
              <span>{progress?.detail ?? 'O ClipForge mostrará cada operação aqui em tempo real.'}</span>
            </div>
          </div>

          <div className="processing-steps processing-steps-six">
            {steps.map((step, index) => {
              const state = stepState(step.stage, progress?.stage ?? (result ? 'completed' : undefined));
              return (
                <div className={`processing-step ${state}`} key={step.stage}>
                  <div className="step-circle">
                    {state === 'done' ? <CheckCircle2 size={20} /> : state === 'active' ? <LoaderCircle className="spin" size={19} /> : index + 1}
                  </div>
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </div>
              );
            })}
          </div>
        </section>

        {result && (
          <section className="panel cuts-result-panel">
            <div className="cuts-result-header">
              <div>
                <span className="eyebrow"><Trophy size={15} /> PACOTES PRONTOS PARA PUBLICAR</span>
                <h2>{result.cuts.length} vídeo(s) com análise de publicação</h2>
                <p>{result.cutDurationMinutes} min por corte · {result.platforms.join(', ')}</p>
              </div>
              <button className="open-folder-action" onClick={openCutsFolder}>
                <FolderOpen size={18} />Abrir pasta dos cortes<ExternalLink size={14} />
              </button>
            </div>

            <div className="cuts-list">
              {result.cuts.map((cut) => (
                <article className="cut-card publication-card" key={cut.id}>
                  <div className="cut-rank"><Film size={18} />#{cut.rank}</div>
                  <div className="cut-main">
                    <div className="publication-title-row">
                      <strong>{cut.publication.title}</strong>
                      <span className={`viral-badge viral-${cut.publication.viralLabel.toLowerCase().replace(' ', '-')}`}>
                        {cut.publication.viralScore}/100 · {cut.publication.viralLabel}
                      </span>
                    </div>
                    <span>{cut.platform} · {formatDuration(cut.startSeconds)} → {formatDuration(cut.startSeconds + cut.durationSeconds)}</span>
                    <p className="publication-description">{cut.publication.description}</p>
                    <div className="hashtags-row">
                      {cut.publication.hashtags.map((hashtag) => <span key={hashtag}>{hashtag}</span>)}
                    </div>
                    <small title={cut.filePath}>{cut.filePath}</small>
                    <small className="captions-note">Legendas automáticas: aguardando módulo local de transcrição.</small>
                  </div>
                  <button className="copy-publication-action" onClick={() => copyPublication(cut)} title="Copiar título, descrição e hashtags">
                    <Copy size={16} />Copiar publicação
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="processing-columns">
          <section className="panel activity-panel">
            <div className="processing-section-heading">
              <div>
                <h3>O que está sendo feito agora</h3>
                <span className="live-dot">Atualização em tempo real</span>
              </div>
            </div>

            <div className="activity-log">
              {log.length === 0 && <p className="empty-log">Aguardando atividade do motor de vídeo...</p>}
              {log.slice(-14).map((entry, index) => (
                <div className="activity-row" key={`${entry.timestamp}-${index}`}>
                  <time>{formatClock(entry.timestamp)}</time>
                  <span className="activity-stage">{entry.stage}</span>
                  <div>
                    <strong>{entry.message}</strong>
                    {entry.detail && <small>{entry.detail}</small>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel artifacts-panel">
            <h3>Arquivos do projeto</h3>
            <p>Os arquivos pesados ficam no destino escolhido, evitando usar o SSD como armazenamento principal.</p>

            <div className="artifact-list">
              <div><FileAudio size={20} /><span>Áudio de análise</span><strong>{result?.audioPath ? 'Pronto' : progress?.stage === 'audio' ? 'Gerando...' : 'Aguardando'}</strong></div>
              <div><FileImage size={20} /><span>Quadros de análise</span><strong>{result ? 'Prontos' : progress?.stage === 'frames' ? 'Gerando...' : 'Aguardando'}</strong></div>
              <div><Film size={20} /><span>Vídeos finais</span><strong>{result ? `${result.cuts.length} MP4` : progress?.stage === 'cutting' ? 'Renderizando...' : 'Aguardando'}</strong></div>
              <div><FolderOpen size={20} /><span>Pasta de trabalho</span><strong title={workspacePath}>{workspacePath ?? 'Será criada ao iniciar'}</strong></div>
            </div>
          </section>
        </div>
      </main>

      <aside className="summary panel processing-summary">
        <div>
          <span className="eyebrow">STATUS DO MOTOR</span>
          <h2>{isRunning ? 'ClipForge trabalhando' : result ? 'Cortes prontos' : 'Aguardando'}</h2>
        </div>

        <div className="engine-visual">
          <div className={isRunning ? 'engine-core running' : 'engine-core'}><Video size={38} /></div>
          <span>{progress?.message ?? 'Pronto para processar'}</span>
        </div>

        <div className="summary-list">
          <div><span>Destino principal</span><strong>{outputPath}</strong></div>
          <div><span>Pasta dos cortes</span><strong>{result?.cutsDirectory ?? 'Aguardando...'}</strong></div>
          <div><span>Motor</span><strong>FFmpeg + ranking local</strong></div>
          <div><span>Saída</span><strong>{result ? `${result.cuts.length} vídeo(s) MP4` : 'Aguardando...'}</strong></div>
        </div>

        {isRunning ? (
          <button className="cancel-action" onClick={onCancel}><Square size={17} fill="currentColor" />Cancelar análise</button>
        ) : result ? (
          <button className="primary-action" onClick={openCutsFolder}><FolderOpen size={18} />Abrir vídeos recortados</button>
        ) : (
          <button className="primary-action" onClick={onBack}><RotateCcw size={18} />Voltar ao início</button>
        )}

        <p className="summary-note">
          Nota viral, título, descrição e hashtags são calculados offline. A próxima camada local de transcrição vai gerar legendas e textos realmente baseados no conteúdo falado.
        </p>
      </aside>
    </div>
  );
}
