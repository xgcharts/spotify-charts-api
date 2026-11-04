
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function main() {
  console.log('=== SPOTIFY JAPAN ARTISTS TEST ===');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const page = await browser.newPage();

    let ranking = null;
    let solicitudes = 0;

    page.on('response', async (response) => {
      const url = response.url();

      if (
        url.includes(
          '/auth/v0/charts/artist-jp-daily/latest'
        )
      ) {
        solicitudes++;

        console.log('--------------------------');
        console.log('SOLICITUD SPOTIFY DETECTADA');
        console.log('HTTP STATUS:', response.status());
        console.log(
          'CONTENT TYPE:',
          response.headers()['content-type'] || 'No disponible'
        );

        if (response.status() === 200) {
          try {
            const datos = await response.json();

            console.log('JSON VALIDO: SI');
            console.log(
              'CAMPOS:',
              Object.keys(datos).join(', ')
            );

            if (Array.isArray(datos.entries)) {
              ranking = datos;
            } else {
              console.log(
                'La respuesta no contiene entries'
              );
            }

          } catch (error) {
            console.log(
              'ERROR JSON:',
              error.message
            );
          }
        }
      }
    });

    console.log('Abriendo Spotify Charts...');

    const navegacion = await page.goto(
      'https://charts.spotify.com/charts/view/artist-jp-daily/latest',
      {
        waitUntil: 'networkidle2',
        timeout: 60000
      }
    );

    console.log(
      'HTTP PAGINA:',
      navegacion ? navegacion.status() : 'Sin respuesta'
    );

    console.log('Esperando datos...');

    await new Promise(
      resolve => setTimeout(resolve, 15000)
    );

    console.log('--------------------------');
    console.log('SOLICITUDES DETECTADAS:', solicitudes);

    if (!ranking) {
      console.log('RESULTADO: NO SE OBTUVO EL RANKING');
      console.log(
        'Puede requerir autenticacion o devolver otro formato.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('RESULTADO: JSON RECIBIDO');

    console.log(
      'FECHA:',
      ranking.displayChart?.date || 'No disponible'
    );

    console.log(
      'TOTAL ARTISTAS:',
      ranking.entries.length
    );

    const xg = ranking.entries.find(item =>
      item.artistMetadata?.artistName === 'XG'
    );

    if (xg) {
      console.log('--------------------------');
      console.log('XG ENCONTRADO');
      console.log(
        'POSICION:',
        xg.chartEntryData.currentRank
      );
      console.log(
        'POSICION ANTERIOR:',
        xg.chartEntryData.previousRank
      );
      console.log(
        'PEAK:',
        xg.chartEntryData.peakRank
      );
      console.log(
        'DIAS EN CHART:',
        xg.chartEntryData.appearancesOnChart
      );
    } else {
      console.log(
        'XG NO APARECE EN EL RANKING'
      );
    }

  } catch (error) {
    console.log('ERROR GENERAL:', error.message);
    process.exitCode = 1;

  } finally {
    await browser.close();
    console.log('=== PRUEBA FINALIZADA ===');
  }
}

main().catch(error => {
  console.error('ERROR FATAL:', error.message);
  process.exitCode = 1;
});
