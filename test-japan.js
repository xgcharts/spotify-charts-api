
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    let ranking = null;

    page.on('response', async response => {
      const url = response.url();

      if (
        url.includes('/auth/v0/charts/artist-jp-daily/latest') &&
        response.status() === 200
      ) {
        try {
          ranking = await response.json();
        } catch (error) {
          console.log('No se pudo leer el JSON');
        }
      }
    });

    await page.goto(
      'https://charts.spotify.com/charts/view/artist-jp-daily/latest',
      { waitUntil: 'networkidle2', timeout: 60000 }
    );

    await new Promise(resolve => setTimeout(resolve, 10000));

    if (!ranking) {
      console.log('No se obtuvo el ranking.');
      console.log('Spotify podría requerir autenticación.');
      process.exitCode = 1;
      return;
    }

    const xg = ranking.entries.find(
      item => item.artistMetadata?.artistName === 'XG'
    );

    console.log('FECHA:', ranking.displayChart?.date);
    console.log('ARTISTAS:', ranking.entries.length);

    if (xg) {
      console.log('XG POSICIÓN:', xg.chartEntryData.currentRank);
      console.log('XG PEAK:', xg.chartEntryData.peakRank);
      console.log('XG DÍAS:', xg.chartEntryData.appearancesOnChart);
    } else {
      console.log('XG no aparece en el ranking recibido.');
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
