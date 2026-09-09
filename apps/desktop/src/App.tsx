import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileVideo2,
  FolderOpen,
  Gauge,
  Link2,
  LoaderCircle,
  Monitor,
  Play,
  Sparkles,
  Video,
} from 'lucide-react';
import { AppSidebar, type AppSection } from './components/AppSidebar';
import { ProcessingScreen } from './components/ProcessingScreen';

type DurationOption = 1 | 5 | 10;
type Platform = 'Instagram' | 'TikTok' | 'Reels' | 'YouTube';

const platforms: Array<{ name: Platform; detail: string }> = [
  { name: 'Instagram', detail: '1080 × 1920' },
  { name: 'TikTok', detail: '1080 × 1920' },
  { name: 'Reels', detail: '1080 × 1920' },
  { name: 'YouTube', detail: '1920 × 1080' },
];

const durations: Array<{ value: DurationOption; title: string; detail: string }> = [
  { value: 1, title: '1 minuto', detail: 'Clipes curtos e dinâmicos' },
  { value: 5, title: '5 minutos', detail: 'Equilíbrio entre contexto e foco' },
  { value: 10, title: '10 minutos', detail: 'Mais contexto e profundidade' },
];

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'Tamanho indisponível';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex >= 2 ? 1 : 0)} ${units[unitIndex]}`;
}

function App() {
  const [section, setSection] = useState<AppSection>('home');
  const [duration, setDuration] = useState<DurationOption>(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['Instagram']);
  const [sourceUrl, setSourceUrl] = useState('');
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'probing' | 'ready' | 'error'>('idle');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState('D:\\Videos\\ClipForge\\Exportados');

  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [analysisLog, setAnalysisLog] = useState<AnalysisProgress[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);

  const summaryFormats = useMemo(
    () => selectedPlatforms.join(', ') || 'A definir',
    [selectedPlatforms],
  );

  const sourceSummary = sourceUrl.trim()
    ? 'Link de vídeo'
    : videoMetadata?.fileName ?? 'Nenhum vídeo selecionado';

  useEffect(() => {
    const bridge = window.clipforge;
    if (!bridge) return undefined;

    const unsubscribeProgress = bridge.onAnalysisProgress((progress) => {
      setAnalysisProgress(progress);
      setAnalysisLog((current) => [...current.slice(-49), progress]);
    });

    const unsubscribeComplete = bridge.onAnalysisComplete((result) => {
      setAnalysisResult(result);
      setAnalysisError(null);
      setIsAnalysisRunning(false);
    });

    const unsubscribeError = bridge.onAnalysisError((payload) => {
      setAnalysisError(payload.error);
      setIsAnalysisRunning(false);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, []);

  function togglePlatform(platform: Platform): void {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  async function chooseOutputDirectory(): Promise<void> {
    const selected = await window.clipforge?.selectOutputDirectory();
    if (selected) setOutputPath(selected);
  }

  async function chooseVideo(): Promise<void> {
    if (!window.clipforge) {
      setVideoStatus('error');
      setVideoError('A ponte segura do Electron não está disponível. Execute pelo aplicativo desktop.');
      return;
    }

    setVideoStatus('probing');
    setVideoError(null);

    const result = await window.clipforge.selectVideoFile();

    if (!result.ok) {
      if (result.canceled) {
        setVideoStatus(videoMetadata ? 'ready' : 'idle');
        return;
      }

      setVideoStatus('error');
      setVideoError(result.error ?? 'Não foi possível ler o vídeo.');
      return;
    }

    setSourceUrl('');
    setVideoMetadata(result.metadata);
    setVideoStatus('ready');
    resetAnalysisState();
  }

  function updateSourceUrl(value: string): void {
    setSourceUrl(value);
    if (value.trim()) {
      setVideoMetadata(null);
      setVideoStatus('idle');
      setVideoError(null);
      resetAnalysisState();
    }
  }

  function resetAnalysisState(): void {
    setAnalysisJobId(null);
    setAnalysisProgress(null);
    setAnalysisLog([]);
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsAnalysisRunning(false);
  }

  async function startAnalysis(): Promise<void> {
    const bridge = window.clipforge;
    if (!bridge) {
      setVideoError('A ponte segura do Electron não está disponível.');
      return;
    }

    if (!videoMetadata) {
      setVideoError(
        sourceUrl.trim()
          ? 'A análise direta por link será ligada na próxima etapa. Por enquanto, selecione um vídeo local.'
          : 'Selecione um vídeo antes de iniciar a análise.',
      );
      return;
    }

    setAnalysisProgress(null);
    setAnalysisLog([]);
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsAnalysisRunning(true);
    setSection('processing');

    const result = await bridge.startAnalysis({
      filePath: videoMetadata.filePath,
      outputPath,
    });

    if (!result.ok) {
      setAnalysisError(result.error);
      setIsAnalysisRunning(false);
      return;
    }

    setAnalysisJobId(result.jobId);
  }

  async function cancelAnalysis(): Promise<void> {
    if (!analysisJobId || !window.clipforge) return;
    await window.clipforge.cancelAnalysis(analysisJobId);
  }

  function returnHome(): void {
    if (isAnalysisRunning) return;
    setSection('home');
  }

  if (section === 'processing') {
    return (
      <ProcessingScreen
        metadata={videoMetadata}
        progress={analysisProgress}
        log={analysisLog}
        result={analysisResult}
        error={analysisError}
        isRunning={isAnalysisRunning}
        outputPath={outputPath}
        onCancel={cancelAnalysis}
        onBack={returnHome}
      />
    );
  }

  return (
    <div className="app-shell">
      <AppSidebar active="home" onNavigate={setSection} />

      <main className="workspace">
        <section className="hero panel">
          <div>
            <div className="eyebrow"><Sparkles size={15} /> CORTE INTELIGENTE COM IA</div>
            <h1>Clipes melhores, <span>menos trabalho.</span></h1>
            <p>Envie um vídeo ou cole um link. O ClipForge analisa o conteúdo e prepara os melhores momentos para cada plataforma.</p>
          </div>
          <div className="hero-orb"><Play size={34} fill="currentColor" /></div>
        </section>

        <section className="panel form-panel">
          <header className="section-header">
            <div>
              <span className="step">1</span>
              <h2>Adicione seu vídeo</h2>
            </div>
            <small>Arquivo local ou link</small>
          </header>

          <div className="source-grid">
            <button
              type="button"
              className={`source-card upload-card ${videoStatus === 'ready' ? 'source-ready' : ''}`}
              onClick={chooseVideo}
              disabled={videoStatus === 'probing'}
            >
              {videoStatus === 'probing' ? <LoaderCircle className="spin" size={33} /> : <Video size={33} />}
              <strong>{videoStatus === 'probing' ? 'Lendo vídeo...' : 'Enviar vídeo'}</strong>
              <span>
                {videoMetadata
                  ? videoMetadata.fileName
                  : 'Clique para selecionar um vídeo no computador'}
              </span>
              {videoStatus === 'ready' && <small className="ready-label"><CheckCircle2 size={14} /> FFprobe concluído</small>}
            </button>

            <div className="source-card">
              <Link2 size={33} />
              <strong>Colar link</strong>
              <span>YouTube ou outra origem compatível</span>
              <input
                className="text-input"
                value={sourceUrl}
                onChange={(event) => updateSourceUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {videoError && (
            <div className="status-message error-message" role="alert">
              <AlertCircle size={18} />
              <span>{videoError}</span>
            </div>
          )}

          {videoMetadata && (
            <section className="metadata-card" aria-label="Informações do vídeo selecionado">
              <div className="metadata-heading">
                <div>
                  <FileVideo2 size={21} />
                  <div>
                    <strong>{videoMetadata.fileName}</strong>
                    <span>{videoMetadata.filePath}</span>
                  </div>
                </div>
                <span className="engine-badge">FFprobe</span>
              </div>

              <div className="metadata-grid">
                <div><Clock3 size={17} /><span>Duração</span><strong>{formatDuration(videoMetadata.durationSeconds)}</strong></div>
                <div><Monitor size={17} /><span>Resolução</span><strong>{videoMetadata.width && videoMetadata.height ? `${videoMetadata.width} × ${videoMetadata.height}` : 'N/D'}</strong></div>
                <div><Gauge size={17} /><span>FPS</span><strong>{videoMetadata.fps ? videoMetadata.fps.toFixed(2) : 'N/D'}</strong></div>
                <div><Video size={17} /><span>Codec</span><strong>{videoMetadata.videoCodec?.toUpperCase() ?? 'N/D'}</strong></div>
                <div><FileVideo2 size={17} /><span>Tamanho</span><strong>{formatFileSize(videoMetadata.sizeBytes)}</strong></div>
              </div>
            </section>
          )}

          <div className="config-block">
            <div className="block-title"><span className="step">2</span><h2>Cortes inteligentes</h2></div>
            <div className="option-grid duration-grid">
              {durations.map((item) => (
                <button
                  key={item.value}
                  className={`option-card ${duration === item.value ? 'selected' : ''}`}
                  onClick={() => setDuration(item.value)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="config-block">
            <div className="block-title"><span className="step">3</span><h2>Formato de saída</h2></div>
            <div className="option-grid platform-grid">
              {platforms.map((platform) => (
                <button
                  key={platform.name}
                  className={`option-card ${selectedPlatforms.includes(platform.name) ? 'selected' : ''}`}
                  onClick={() => togglePlatform(platform.name)}
                >
                  <strong>{platform.name}</strong>
                  <span>{platform.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="config-block">
            <div className="block-title"><span className="step">4</span><h2>Local de salvamento</h2></div>
            <div className="path-row">
              <FolderOpen size={20} />
              <code>{outputPath}</code>
              <button onClick={chooseOutputDirectory}>Alterar...</button>
            </div>
            <p className="hint">O ClipForge usará esta unidade também para os arquivos pesados da pré-análise, evitando gravar o pipeline no SSD.</p>
          </div>
        </section>
      </main>

      <aside className="summary panel">
        <div>
          <span className="eyebrow">RESUMO DO PROJETO</span>
          <h2>{videoMetadata ? 'Vídeo reconhecido' : 'Pronto para analisar'}</h2>
        </div>

        <div className="summary-list">
          <div><span>Fonte</span><strong>{sourceSummary}</strong></div>
          {videoMetadata && <div><span>Vídeo</span><strong>{formatDuration(videoMetadata.durationSeconds)} · {formatFileSize(videoMetadata.sizeBytes)}</strong></div>}
          <div><span>Duração dos cortes</span><strong>{duration} min</strong></div>
          <div><span>Formatos</span><strong>{summaryFormats}</strong></div>
          <div><span>Destino</span><strong>{outputPath}</strong></div>
        </div>

        <button
          className="primary-action"
          disabled={(!videoMetadata && !sourceUrl.trim()) || isAnalysisRunning}
          onClick={startAnalysis}
        >
          <Play size={18} fill="currentColor" />Iniciar análise
        </button>
        <p className="summary-note">Agora o botão inicia um pipeline real: validação, extração de áudio e geração de quadros com progresso em tempo real.</p>
      </aside>
    </div>
  );
}

export default App;
