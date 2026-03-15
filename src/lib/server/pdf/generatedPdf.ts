import puppeteer from 'puppeteer';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function generatePdf(
  data: Record<string, string>,
  templateName = 'laporan.html'
): Promise<Uint8Array<ArrayBufferLike>> {
  const templatePath = resolve(process.cwd(), 'src/lib/server/pdf/templates', templateName);
  let html = await readFile(templatePath, 'utf-8');

 	for (const [key, value] of Object.entries(data)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

 	const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

 	try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

 		return await page.pdf({
      format: 'A4',
      printBackground: true
    });
  } finally {
    await browser.close();
  }
}