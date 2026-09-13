import { AlertTriangle, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import type { PilotQueueItem, PilotQueueStatus } from '../types';

export const statusLabel: Record<PilotQueueStatus, string> = {
  queued: 'Na fila',
  processing: 'Produzindo',
  'ready-to-publish': 'Pronto',
  'manual-review': 'Revisar',
  failed: 'Falhou',
  canceled: 'Cancelado',
  published: 'Publicado',
};

function StatusIcon({ status }: { status: PilotQueueStatus }) {
  if (status === 'ready-to-publish' || status === 'published') return <CheckCircle2 size={16} />;
  if (status === 'failed') return <XCircle size={16} />;
  if (status === 'manual-review') return <AlertTriangle size={16} />;
  return <Clock3 size={16} />;
}

export function QueueRow({
  item,
  detailed = false,
  onCancel,
}: {
  item: PilotQueueItem;
  detailed?: boolean;
  onCancel?: (item: PilotQueueItem) => void;
}) {
  return (
    <div className={detailed ? 'queue-row detailed' : 'queue-row'}>
      <div className={`status-icon status-${item.status}`}><StatusIcon status={item.status} /></div>
      <div className="queue-copy">
        <strong>{item.title ?? item.settings.niche.label}</strong>
        {detailed && <span>{new Date(item.scheduledFor).toLocaleString('pt-BR')}</span>}
        <small>{statusLabel[item.status]}{item.attempt ? ` · tentativa ${item.attempt}` : ''}</small>
      </div>
      <div className="queue-side">
        {typeof item.qualityScore === 'number' && <b>{item.qualityScore}</b>}
        {detailed && item.status === 'queued' && onCancel && (
          <button onClick={() => onCancel(item)}>Cancelar</button>
        )}
      </div>
    </div>
  );
}
