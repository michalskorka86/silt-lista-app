import { chromium } from 'playwright';
const [html, pdf] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage();
await p.goto('file://' + html, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
await b.close();
