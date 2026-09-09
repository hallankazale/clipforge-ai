import {
  Clock3,
  FolderOpen,
  History,
  Home,
  Scissors,
  Settings,
  Upload,
} from 'lucide-react';

export type AppSection = 'home' | 'processing';

interface AppSidebarProps {
  active: AppSection;
  onNavigate: (section: AppSection) => void;
}

export function AppSidebar({ active, onNavigate }: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">C</div>
        <div>
          <strong>ClipForge AI</strong>
          <span>v0.3.0</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Navegação principal">
        <button
          className={`nav-item ${active === 'home' ? 'active' : ''}`}
          onClick={() => onNavigate('home')}
        >
          <Home size={19} />Início
        </button>
        <button className="nav-item"><FolderOpen size={19} />Projetos</button>
        <button
          className={`nav-item ${active === 'processing' ? 'active' : ''}`}
          onClick={() => onNavigate('processing')}
        >
          <Clock3 size={19} />Processamento
        </button>
        <button className="nav-item"><Scissors size={19} />Cortes</button>
        <button className="nav-item"><Upload size={19} />Exportação</button>
        <button className="nav-item"><History size={19} />Histórico</button>
        <button className="nav-item"><Settings size={19} />Configurações</button>
      </nav>

      <div className="storage-mini">
        <span>Armazenamento preferido</span>
        <strong>HDD (D:)</strong>
        <div className="storage-bar"><i /></div>
        <small>Arquivos finais e análise no HD</small>
      </div>
    </aside>
  );
}
