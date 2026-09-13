import type { ReactNode } from 'react';
import { Home, ListVideo, Settings, Sparkles } from 'lucide-react';

export type MobileTab = 'home' | 'create' | 'queue' | 'connection';

function NavButton({ icon, label, active, badge, onClick }: {
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}>
      <span className="nav-icon">{icon}{Boolean(badge) && <i>{badge}</i>}</span>
      <span>{label}</span>
    </button>
  );
}

export function BottomNav({ tab, onChange, queueBadge }: {
  tab: MobileTab;
  onChange: (tab: MobileTab) => void;
  queueBadge: number;
}) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <NavButton icon={<Home size={20} />} label="Início" active={tab === 'home'} onClick={() => onChange('home')} />
      <NavButton icon={<Sparkles size={20} />} label="Criar" active={tab === 'create'} onClick={() => onChange('create')} />
      <NavButton icon={<ListVideo size={20} />} label="Fila" active={tab === 'queue'} badge={queueBadge} onClick={() => onChange('queue')} />
      <NavButton icon={<Settings size={20} />} label="Conexão" active={tab === 'connection'} onClick={() => onChange('connection')} />
    </nav>
  );
}
