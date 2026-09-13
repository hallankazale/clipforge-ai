import { CheckCircle2, LoaderCircle, Monitor, ShieldCheck, Smartphone, Wifi, WifiOff } from 'lucide-react';

export function ConnectionScreen({ serverInput, connected, pairedUrl, busy, onServerInput, onPair, onDisconnect }: {
  serverInput: string;
  connected: boolean;
  pairedUrl?: string;
  busy: boolean;
  onServerInput: (value: string) => void;
  onPair: () => void;
  onDisconnect: () => void;
}) {
  return (
    <section className="card connection-card">
      <div className="pair-icon"><Monitor size={30} /><span><Wifi size={17} /></span></div>
      <span className="eyebrow">CONEXÃO COM O PC</span>
      <h1>Parear ClipForge</h1>
      <p>O computador e o celular precisam estar na mesma rede Wi‑Fi nesta primeira versão.</p>
      <label className="field"><span>Endereço do PC</span><input value={serverInput} onChange={(event) => onServerInput(event.target.value)} inputMode="url" placeholder="http://192.168.0.10:43170" /></label>
      <div className="security-note"><ShieldCheck size={18} /><div><strong>Sua chave de IA fica no PC</strong><span>O Android recebe só um token de controle revogável.</span></div></div>
      <button className="primary wide" disabled={busy || !serverInput.trim()} onClick={onPair}>{busy ? <LoaderCircle className="spin" size={18} /> : <Smartphone size={18} />}Parear com este PC</button>
      {pairedUrl && <button className="danger-link" onClick={onDisconnect}>Remover este computador</button>}
      <div className="connection-state">{connected ? <><CheckCircle2 size={18} /><span>Conectado a {pairedUrl}</span></> : <><WifiOff size={18} /><span>Sem conexão ativa</span></>}</div>
    </section>
  );
}
