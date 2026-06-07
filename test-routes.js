const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const routes = [
  '/',
  '/orders',
  '/customers',
  '/buchhaltung',
  '/buchhaltung/ausgaben',
  '/buchhaltung/belege',
  '/buchhaltung/bwa',
  '/buchhaltung/rechnungen',
  '/buchhaltung/zahlung',
  '/finanzen',
  '/items',
  '/kalender',
  '/kommunikation',
  '/kontrolle',
  '/kunden-auftraege',
  '/lager',
  '/lieferanten',
  '/marketing',
  '/performance',
  '/print-queue',
  '/quotes',
  '/scan',
  '/start',
  '/status',
  '/warendurchlauf'
];

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  let results = [];
  console.log("Starting verification of 25 critical routes on http://localhost:3000...\n");

  for (const route of routes) {
    const url = `http://localhost:3000${route}`;
    try {
      // Goto route, wait until network is idle or 10s timeout
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      const status = response ? response.status() : 'Unknown';
      const isOk = status === 200 || status === 304;

      // Check for common error indicators in Next.js
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      const hasErrorBoundary = bodyText.includes('Application error: a client-side exception has occurred') || 
                               bodyText.includes('Internal Server Error') || 
                               bodyText.includes('500');
                               
      let kachelnCount = await page.locator('button, a.bg-white').count();
      let hasData = !bodyText.includes('Keine Daten') && !bodyText.includes('Keine Aufträge') && !bodyText.includes('Keine Ergebnisse');

      const pass = isOk && !hasErrorBoundary;
      
      results.push({
        route,
        status,
        pass,
        title,
        notes: pass ? `Loaded OK. Found ~${kachelnCount} interactive elements.` : 'Failed or Error Boundary triggered.'
      });

      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${route} (Status: ${status})`);
      if (!pass) {
        console.log(`       -> Title: ${title}`);
        console.log(`       -> Snippet: ${bodyText.substring(0, 100).replace(/\n/g, ' ')}`);
      }
    } catch (e) {
      console.log(`[ERROR] ${route} -> ${e.message}`);
      results.push({
        route,
        status: 'Error',
        pass: false,
        title: 'Error',
        notes: e.message
      });
    }
  }

  await browser.close();

  // Create markdown report
  let md = `# Browser Verifikation: 25 kritische Routen\n\n`;
  md += `| Route | Status | Pass/Fail | Bemerkung/Fehler |\n`;
  md += `|---|---|---|---|\n`;
  
  for (const r of results) {
    md += `| \`${r.route}\` | ${r.status} | ${r.pass ? '✅ PASS' : '❌ FAIL'} | ${r.notes} |\n`;
  }
  
  fs.writeFileSync('C:/Users/Traube/.gemini/antigravity-ide/brain/de704915-452f-4b30-b27e-77bf88dc3ffc/browser_verification_report.md', md);
  console.log('\nReport saved to browser_verification_report.md');
}

run();
