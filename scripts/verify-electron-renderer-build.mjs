import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const indexPath = path.resolve(process.cwd(), 'dist', 'index.html');
const html = await readFile(indexPath, 'utf8');

const absoluteAssetPattern = /(?:src|href)=["']\/assets\//i;
const relativeAssetPattern = /(?:src|href)=["']\.\/assets\//i;

if (absoluteAssetPattern.test(html)) {
  console.error('Renderer inválido para Electron: dist/index.html contém /assets/... absoluto.');
  process.exit(1);
}

if (!relativeAssetPattern.test(html)) {
  console.error('Renderer inválido para Electron: nenhum asset relativo ./assets/... foi encontrado.');
  process.exit(1);
}

console.log('Renderer Electron validado: assets relativos encontrados em dist/index.html.');
