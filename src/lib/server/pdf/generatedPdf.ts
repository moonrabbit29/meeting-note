import puppeteer from 'puppeteer';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function generatePdf(
  data: Record<string, string>,
  templateName = 'laporan.html'
): Promise<Uint8Array<ArrayBufferLike>> {
  const templatePath = resolve(process.cwd(), 'src/lib/server/pdf/templates', templateName);
  let html: string;

  try {
    html = await readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error('Failed to load PDF template', {
      templateName,
      templatePath,
      error
    });
    throw error;
  }

 	for (const [key, value] of Object.entries(data)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  let browser;

  try {
    browser = await puppeteer.launch({
    	headless: true,
    	args: ['--no-sandbox', '--disable-setuid-sandbox']
  	});
  } catch (error) {
    console.error('Failed to launch Puppeteer for PDF generation', {
      templateName,
      templatePath,
      error
    });
    throw error;
  }

 	try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

 		return await page.pdf({
      format: 'A4',
      printBackground: true
    });
  } catch (error) {
    console.error('Failed while rendering PDF in Puppeteer', {
      templateName,
      templatePath,
      keyCount: Object.keys(data).length,
      error
    });
    throw error;
  } finally {
    await browser.close();
  }
}