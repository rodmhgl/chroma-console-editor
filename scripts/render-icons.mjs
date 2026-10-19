// Renders the app icons in public/ from their SVG marks: `npm run render-icons`. Run after editing either SVG.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const ICONS = [
  { svg: 'public/icon.svg', png: 'public/icon-192.png', size: 192 },
  { svg: 'public/icon.svg', png: 'public/icon-512.png', size: 512 },
  { svg: 'public/icon-maskable.svg', png: 'public/icon-maskable-512.png', size: 512 },
  { svg: 'public/icon-maskable.svg', png: 'public/apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
for (const { svg, png, size } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const markup = readFileSync(svg, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`);
  await page.screenshot({ path: png, omitBackground: true });
  await page.close();
  console.log(`${png} (${size}×${size})`);
}
await browser.close();
