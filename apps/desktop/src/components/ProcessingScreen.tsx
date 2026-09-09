import {
  CheckCircle2,
  Clock3,
  FileAudio,
  FileImage,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Square,
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
  'finalizing',
  'completed',
];

const steps: Array<{
  stage: AnalysisStage;
  title: string;
  detail: string;
}> = [
  { stage: 'preparing', title: 'Preparando', detail: 'Validação e workspace' },
  { stage: 'audio', title: 'Extraindo áudio', detail: 'WAV mono 16 kHz' },
  { stage: 'frames', title: 'Extraindo quadros', detail: 'Amostras visuais' },
  { stage: 'finalizing', title: 'Organizando', detail: 'Arquivos para IA' },
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
  if (!current) return 'pending';
  if (current === 'canceled') return 'pending';

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
              <h2>{result ? 'Pré-análise concluída' : error ? 'A análise foi interrompida' : 'Análise em andamento'}</h2>
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

          <div className="processing-steps">
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
            <h3>Arquivos da análise</h3>
            <p>Os arquivos de trabalho ficam junto ao destino escolhido, evitando usar o SSD como armazenamento principal.</p>

            <div className="artifact-list">
              <div>
                <FileAudio size={20} />
                <span>Áudio para transcrição</span>
                <strong>{result?.audioPath ? 'Pronto' : progress?.stage === 'audio' ? 'Gerando...' : 'Aguardando'}</strong>
              </div>
              <div>
                <FileImage size={20} />
                <span>Quadros para análise visual</span>
                <strong>{result ? 'Prontos' : progress?.stage === 'frames' ? 'Gerando...' : 'Aguardando'}</strong>
              </div>
              <div>
                <FolderOpen size={20} />
                <span>Pasta de trabalho</span>
                <strong title={workspacePath}>{workspacePath ?? 'Será criada ao iniciar'}</strong>
              </div>
            </div>
          </section>
        </div>
      </main>

      <aside className="summary panel processing-summary">
        <div>
          <span className="eyebrow">STATUS DO MOTOR</span>
          <h2>{isRunning ? 'FFmpeg trabalhando' : result ? 'Arquivos preparados' : 'Aguardando'}</h2>
        </div>

        <div className="engine-visual">
          <div className={isRunning ? 'engine-core running' : 'engine-core'}>
            <Video size={38} />
          </div>
          <span>{progress?.message ?? 'Pronto para processar'}</span>
        </div>

        <div className="summary-list">
          <div><span>Destino principal</span><strong>{outputPath}</strong></div>
          <div><span>Workspace</span><strong>{workspacePath ?? 'Aguardando...'}</strong></div>
          <div><span>Motor atual</span><strong>FFmpeg + FFprobe</strong></div>
          <div><span>Próxima fase</span><strong>Transcrição + ranking inteligente</strong></div>
        </div>

        {isRunning ? (
          <button className="cancel-action" onClick={onCancel}>
            <Square size={17} fill="currentColor" />Cancelar análise
          </button>
        ) : (
          <button className="primary-action" onClick={onBack}>
            <RotateCcw size={18} />Voltar ao início
          </button>
        )}

        <p className="summary-note">
          Nesta fase o ClipForge está produzindo dados reais para a IA. Ele ainda não está escolhendo os melhores cortes; essa será a próxima camada do pipeline.
        </p>
      </aside>
    </div>
  );
}
