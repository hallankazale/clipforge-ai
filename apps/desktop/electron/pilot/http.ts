/** Never include response bodies or URLs in errors: they may contain OAuth tokens. */
export async function request(url: string, init: RequestInit = {}, timeout = 120_000): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(timeout), ...(init.signal ? [init.signal] : [])]) });
  } catch { throw new Error('Falha de conexão ou tempo esgotado.'); }
}
export async function jsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`O serviço recusou a operação (HTTP ${response.status}). Verifique credenciais, saldo e permissões.`);
  return await response.json() as T;
}
export function assertUploadHost(url: string, hosts: string[]): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (parsed.port && parsed.port !== '443') || !hosts.includes(parsed.hostname)) throw new Error('Destino de upload não autorizado.');
}
