import { useMemo, useState } from 'react';
import {
  Clock3,
  FolderOpen,
  History,
  Home,
  Link2,
  Play,
  Scissors,
  Settings,
  Sparkles,
  Upload,
  Video,
} from 'lucide-react';

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

function App() {
  const [duration, setDuration] = useState<DurationOption>(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['Instagram']);
  const [sourceName, setSourceName] = useState<string>('Nenhum vídeo selecionado');
  const [sourceUrl, setSourceUrl] = useState('');
  const [outputPath, setOutputPath] = useState('D:\\Videos\\ClipForge\\Exportados');

  const summaryFormats = useMemo(
    () => selectedPlatforms.join(', ') || 'A definir',
    [selectedPlatforms],
  );

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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>ClipForge AI</strong>
            <span>v0.1.0</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          <button className="nav-item active"><Home size={19} />Início</button>
          <button className="nav-item"><FolderOpen size={19} />Projetos</button>
          <button className="nav-item"><Clock3 size={19} />Processamento</button>
          <button className="nav-item"><Scissors size={19} />Cortes</button>
          <button className="nav-item"><Upload size={19} />Exportação</button>
          <button className="nav-item"><History size={19} />Histórico</button>
          <button className="nav-item"><Settings size={19} />Configurações</button>
        </nav>

        <div className="storage-mini">
          <span>Armazenamento preferido</span>
          <strong>HDD (D:)</strong>
          <div className="storage-bar"><i /></div>
          <small>Arquivos finais no HD</small>
        </div>
      </aside>

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
            <label className="source-card upload-card">
              <input
                type="file"
                accept="video/*"
                onChange={(event) => setSourceName(event.target.files?.[0]?.name ?? 'Nenhum vídeo selecionado')}
              />
              <Video size={33} />
              <strong>Enviar vídeo</strong>
              <span>{sourceName}</span>
            </label>

            <div className="source-card">
              <Link2 size={33} />
              <strong>Colar link</strong>
              <span>YouTube ou outra origem compatível</span>
              <input
                className="text-input"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

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
            <p className="hint">Recomendado: salve os vídeos finais no HDD para preservar espaço e reduzir gravações pesadas no SSD.</p>
          </div>
        </section>
      </main>

      <aside className="summary panel">
        <div>
          <span className="eyebrow">RESUMO DO PROJETO</span>
          <h2>Pronto para analisar</h2>
        </div>

        <div className="summary-list">
          <div><span>Fonte</span><strong>{sourceUrl ? 'Link' : sourceName}</strong></div>
          <div><span>Duração dos cortes</span><strong>{duration} min</strong></div>
          <div><span>Formatos</span><strong>{summaryFormats}</strong></div>
          <div><span>Destino</span><strong>{outputPath}</strong></div>
        </div>

        <button className="primary-action"><Play size={18} fill="currentColor" />Iniciar análise</button>
        <p className="summary-note">Durante o processamento, a próxima tela exibirá cada etapa, progresso e atividade da IA em tempo real.</p>
      </aside>
    </div>
  );
}

export default App;
