import { useState } from 'react';
import { Bot, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { BottomNav, type MobileTab } from './components/BottomNav';
import { ConnectionScreen } from './components/ConnectionScreen';
import { CreateScreen } from './components/CreateScreen';
import { Dashboard } from './components/Dashboard';
import { QueueScreen } from './components/QueueScreen';
import { useMobilePilot } from './useMobilePilot';

export default function App() {
  const [tab, setTab] = useState<MobileTab>('home');
  const pilot = useMobilePilot();
  const queued = pilot.queue.filter((item) => item.status === 'queued').length;
  const active = pilot.queue.filter((item) => item.status === 'processing').length;

  async function runNow(): Promise<void> {
    if (await pilot.runNow()) setTab('queue');
  }

  async function schedule(): Promise<void> {
    if (await pilot.schedule()) setTab('queue');
  }

  async function pair(): Promise<void> {
    if (await pilot.pair()) setTab('home');
  }

  return (
    <div className="mobile-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-mark"><Bot size={22} /></div>
          <div><strong>ClipForge AI</strong><span>Android · v0.7</span></div>
        </div>
        <div className={pilot.connected ? 'connection-pill online' : 'connection-pill'}>
          {pilot.connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          {pilot.connected ? 'PC online' : 'offline'}
        </div>
      </header>

      <main className="mobile-content">
        {pilot.message && <button className="notice" onClick={() => pilot.setMessage('')}>{pilot.message}</button>}

        {!pilot.config && tab !== 'connection' && (
          <section className="empty-state card">
            <Smartphone size={36} />
            <h1>Leve o ClipForge para o celular</h1>
            <p>Pareie uma vez com o computador e use o Android como painel principal.</p>
            <button className="primary" onClick={() => setTab('connection')}>Conectar ao computador</button>
          </section>
        )}

        {tab === 'home' && pilot.config && (
          <Dashboard
            niche={pilot.niche}
            settings={pilot.settings}
            queue={pilot.queue}
            connected={pilot.connected}
            busy={pilot.busy}
            onRunNow={() => void runNow()}
            onSchedule={() => void schedule()}
            onOpenCreate={() => setTab('create')}
            onRefresh={() => void pilot.refresh()}
          />
        )}

        {tab === 'create' && (
          <CreateScreen
            niche={pilot.niche}
            settings={pilot.settings}
            connected={pilot.connected}
            busy={pilot.busy}
            onChange={pilot.setSettings}
            onTogglePlatform={pilot.togglePlatform}
            onRunNow={() => void runNow()}
            onSchedule={() => void schedule()}
          />
        )}

        {tab === 'queue' && <QueueScreen queue={pilot.queue} onRefresh={() => void pilot.refresh()} />}

        {tab === 'connection' && (
          <ConnectionScreen
            serverInput={pilot.serverInput}
            connected={pilot.connected}
            pairedUrl={pilot.config?.baseUrl}
            busy={pilot.busy}
            onServerInput={pilot.setServerInput}
            onPair={() => void pair()}
            onDisconnect={pilot.disconnect}
          />
        )}
      </main>

      <BottomNav tab={tab} onChange={setTab} queueBadge={queued + active} />
    </div>
  );
}
