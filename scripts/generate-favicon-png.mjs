/**
 * Generate static/favicon-48.png from static/favicon.svg for Google/Naver search result icon.
 * Run: node scripts/generate-favicon-png.mjs
 * Requires: npm install -D sharp
 */
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'static', 'favicon.svg');
const outPath = join(root, 'static', 'favicon-48.png');

const svg = await readFile(svgPath);
await sharp(svg)
	.resize(48, 48)
	.png()
	.toFile(outPath);
console.log('Generated static/favicon-48.png (48×48) for search result favicon.');
console.log('Re-deploy the site and request re-indexing in Google Search Console / Naver Search Advisor if needed.');
