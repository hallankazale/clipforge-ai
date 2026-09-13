import { ListVideo, RefreshCw } from 'lucide-react';
import type { PilotQueueItem } from '../types';
import { QueueRow } from './QueueRow';

export function QueueScreen({ queue, onRefresh }: {
  queue: PilotQueueItem[];
  onRefresh: () => void;
}) {
  return (
    <section className="card queue-card">
      <div className="section-heading">
        <div><span>FILA</span><h1>Produções</h1></div>
        <button className="icon-button" onClick={onRefresh}><RefreshCw size={17} /></button>
      </div>
      {queue.length === 0 ? (
        <div className="empty-mini"><ListVideo size={30} /><p>Nenhum vídeo na fila.</p></div>
      ) : (
        <div className="queue-list">{queue.map((item) => <QueueRow item={item} detailed key={item.id} />)}</div>
      )}
    </section>
  );
}
