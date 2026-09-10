import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import type { Platform } from './contracts';
import { Vault, type TokenAccount } from './vault';
import { request, jsonResponse } from './http';

export function pkceChallenge(verifier: string, platform: Platform): string {
  return createHash('sha256').update(verifier).digest(platform === 'tiktok' ? 'hex' : 'base64url');
}
export class Accounts {
  private connecting = false;
  private refreshes = new Map<string, Promise<string>>();
  constructor(private readonly vault: Vault, private readonly openBrowser: (url: string) => Promise<void>) {}
  async connect(platform: Platform): Promise<void> {
    if (!['youtube', 'tiktok'].includes(platform)) throw new Error('Plataforma inválida.');
    if (this.connecting) throw new Error('Já existe uma conexão em andamento.');
    const c = this.vault.credentials();
    const client = platform === 'youtube' ? c.youtubeClientId : c.tiktokClientKey;
    if (!client || (platform === 'tiktok' && !c.tiktokClientSecret)) throw new Error('Importe as credenciais oficiais do aplicativo antes de conectar a conta.');
    this.connecting = true;
    const state = randomBytes(32).toString('hex'), verifier = randomBytes(48).toString('base64url');
    const server = createServer();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Callback indisponível.');
      const redirect = `http://127.0.0.1:${address.port}/callback/`;
      const authorization = new URL(platform === 'youtube' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://www.tiktok.com/v2/auth/authorize/');
      const params = new URLSearchParams({ response_type: 'code', redirect_uri: redirect, state, code_challenge: pkceChallenge(verifier, platform), code_challenge_method: 'S256' });
      params.set(platform === 'youtube' ? 'client_id' : 'client_key', client);
      params.set('scope', platform === 'youtube' ? 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly' : 'user.info.basic,video.upload');
      if (platform === 'youtube') { params.set('access_type', 'offline'); params.set('prompt', 'consent'); }
      authorization.search = params.toString();
      const codePromise = new Promise<string>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Autorização não concluída em cinco minutos.')), 300_000);
        server.on('request', (req, res) => {
          const url = new URL(req.url || '/', redirect);
          if (req.method !== 'GET' || url.pathname !== '/callback/' || url.searchParams.get('state') !== state) { res.writeHead(400); res.end('Requisicao invalida.'); return; }
          res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
          const code = url.searchParams.get('code');
          if (!code || url.searchParams.has('error')) { res.end('Autorização recusada.'); reject(new Error('Autorização recusada.')); }
          else { res.end('Autorização recebida. Volte ao ClipForge para conferir a conexão.'); resolve(code); }
        });
      });
      // Attach the browser failure to the same awaited race, avoiding an orphaned callback promise.
      const code = await Promise.race([codePromise, this.openBrowser(authorization.toString()).then(() => codePromise)]);
      const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: verifier });
      body.set(platform === 'youtube' ? 'client_id' : 'client_key', client);
      const secret = platform === 'youtube' ? c.youtubeClientSecret : c.tiktokClientSecret;
      if (secret) body.set('client_secret', secret);
      const token = await this.exchange(platform, body);
      let account: TokenAccount;
      if (platform === 'youtube') {
        const channel = await jsonResponse<{ items?: Array<{ id: string; snippet: { title: string } }> }>(await request('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${token.access_token}` } }));
        const item = channel.items?.[0]; if (!item) throw new Error('Nenhum canal do YouTube disponível.');
        account = { id: `youtube:${item.id}`, platform, name: item.snippet.title, ...this.tokenFields(token) };
      } else {
        const user = await jsonResponse<any>(await request('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', { headers: { Authorization: `Bearer ${token.access_token}` } }));
        if (user.error?.code !== 'ok' || !user.data?.user?.open_id) throw new Error('Não foi possível identificar a conta TikTok.');
        account = { id: `tiktok:${user.data.user.open_id}`, platform, name: user.data.user.display_name, ...this.tokenFields(token) };
      }
      await this.vault.saveAccount(account);
    } finally { if (timer) clearTimeout(timer); server.close(); server.closeAllConnections(); this.connecting = false; }
  }
  private tokenFields(token: any): Pick<TokenAccount, 'accessToken' | 'refreshToken' | 'expiresAt'> {
    if (typeof token.access_token !== 'string' || typeof token.refresh_token !== 'string' || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error('Token OAuth incompleto. Reconecte a conta.');
    return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 };
  }
  private async exchange(platform: Platform, body: URLSearchParams): Promise<any> {
    const token = await jsonResponse<any>(await request(platform === 'youtube' ? 'https://oauth2.googleapis.com/token' : 'https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', body }));
    if (token.error) throw new Error('Autorização expirada ou permissões recusadas. Reconecte a conta.');
    const required = platform === 'youtube' ? ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'] : ['video.upload', 'user.info.basic'];
    if (token.scope && required.some(scope => !String(token.scope).split(/[ ,]+/).includes(scope))) throw new Error('As permissões de publicação não foram concedidas.');
    return token;
  }
  token(id: string): Promise<string> {
    const existing = this.refreshes.get(id); if (existing) return existing;
    const op = this.refresh(id).finally(() => this.refreshes.delete(id)); this.refreshes.set(id, op); return op;
  }
  private async refresh(id: string): Promise<string> {
    const account = this.vault.accounts().find(a => a.id === id); if (!account) throw new Error('Conta desconectada.');
    if (account.expiresAt > Date.now() + 120_000) return account.accessToken;
    const c = this.vault.credentials();
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: account.refreshToken });
    body.set(account.platform === 'youtube' ? 'client_id' : 'client_key', (account.platform === 'youtube' ? c.youtubeClientId : c.tiktokClientKey) || '');
    const secret = account.platform === 'youtube' ? c.youtubeClientSecret : c.tiktokClientSecret;
    if (secret) body.set('client_secret', secret);
    const token = await this.exchange(account.platform, body);
    const updated = { ...account, ...this.tokenFields({ ...token, refresh_token: token.refresh_token || account.refreshToken }) };
    await this.vault.saveAccount(updated); return updated.accessToken;
  }
  async disconnect(id: string): Promise<void> {
    const account = this.vault.accounts().find(a => a.id === id); if (!account) return;
    const c = this.vault.credentials();
    const body = account.platform === 'youtube' ? new URLSearchParams({ token: account.refreshToken }) :
      new URLSearchParams({ client_key: c.tiktokClientKey || '', client_secret: c.tiktokClientSecret || '', token: account.accessToken });
    const response = await request(account.platform === 'youtube' ? 'https://oauth2.googleapis.com/revoke' : 'https://open.tiktokapis.com/v2/oauth/revoke/', { method: 'POST', body });
    if (!response.ok) throw new Error('Não foi possível revogar a conexão. Tente novamente.');
    await this.vault.change(s => { s.accounts = s.accounts.filter(a => a.id !== id); });
  }
}
