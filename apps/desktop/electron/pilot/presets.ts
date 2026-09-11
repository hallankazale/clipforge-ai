import type { PilotPlatform } from './quality';

export interface NichePreset {
  id: string;
  label: string;
  emoji: string;
  audience: string;
  tone: string;
  visualStyle: string;
  contentPillars: string[];
  preferredPlatforms: PilotPlatform[];
  preferredDurationSeconds: 30 | 45 | 60;
}

export const nichePresets: NichePreset[] = [
  {
    id: 'terror-misterio',
    label: 'Terror e mistério',
    emoji: '👻',
    audience: 'Pessoas que gostam de suspense, casos estranhos e histórias curtas',
    tone: 'Tenso, intrigante e direto, sem exagerar em afirmações factuais',
    visualStyle: 'Cinemático escuro, contraste alto, movimentos lentos e detalhes atmosféricos',
    contentPillars: ['Casos estranhos', 'Mistérios da internet', 'Lendas urbanas', 'Histórias assustadoras'],
    preferredPlatforms: ['TikTok', 'YouTube Shorts'],
    preferredDurationSeconds: 60,
  },
  {
    id: 'curiosidades',
    label: 'Curiosidades',
    emoji: '🧠',
    audience: 'Público amplo que consome fatos rápidos e surpreendentes',
    tone: 'Curioso, energético e claro',
    visualStyle: 'Limpo, colorido, cortes rápidos e elementos visuais explicativos',
    contentPillars: ['Ciência', 'História', 'Tecnologia', 'Coisas que parecem mentira'],
    preferredPlatforms: ['TikTok', 'YouTube Shorts'],
    preferredDurationSeconds: 45,
  },
  {
    id: 'motivacao',
    label: 'Motivação e desenvolvimento pessoal',
    emoji: '🚀',
    audience: 'Pessoas buscando disciplina, foco e mudança de hábitos',
    tone: 'Inspirador, concreto e sem promessas irreais',
    visualStyle: 'Cinemático claro, cenas de progresso, trabalho e rotina',
    contentPillars: ['Disciplina', 'Hábitos', 'Foco', 'Superação'],
    preferredPlatforms: ['TikTok', 'YouTube Shorts'],
    preferredDurationSeconds: 45,
  },
  {
    id: 'tecnologia-ia',
    label: 'Tecnologia e IA',
    emoji: '🤖',
    audience: 'Pessoas interessadas em tecnologia, ferramentas e automação',
    tone: 'Didático, rápido e confiável',
    visualStyle: 'Futurista limpo, interface, dispositivos e motion graphics discretos',
    contentPillars: ['Ferramentas de IA', 'Automação', 'Apps úteis', 'Tendências de tecnologia'],
    preferredPlatforms: ['YouTube Shorts', 'TikTok'],
    preferredDurationSeconds: 60,
  },
  {
    id: 'fe-crista',
    label: 'Fé cristã e reflexão',
    emoji: '✨',
    audience: 'Pessoas que buscam reflexão bíblica, esperança e mensagens curtas',
    tone: 'Respeitoso, acolhedor e fiel ao texto bíblico',
    visualStyle: 'Elegante, sereno, luz natural e tipografia legível',
    contentPillars: ['Reflexões bíblicas', 'Versículos', 'Família', 'Esperança'],
    preferredPlatforms: ['YouTube Shorts', 'TikTok'],
    preferredDurationSeconds: 60,
  },
];
