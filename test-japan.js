
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const CHART_URL =
  'https://charts.spotify.com/charts/view/artist-jp-daily/latest';

async function main() {
  console.log('=== SPOTIFY JAPAN - PRUEBA CDP ===');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  let client;

  try {
    const page = await browser.newPage();

    client = await page.createCDPSession();

    await client.send('Network.enable');

    const solicitudes = new Map();
    const lecturas = [];

    let ranking = null;

    client.on('Network.responseReceived', event => {
      const url = event.response.url;

      if (
        !url.includes(
          '/auth/v0/charts/artist-jp-daily/latest'
        )
      ) {
        return;
      }

      const requestId = event.requestId;

      solicitudes.set(requestId, {
        url,
        status: event.response.status,
        mimeType: event.response.mimeType
      });

      console.log('--------------------------');
      console.log('RESPUESTA DETECTADA');
      console.log('HTTP STATUS:', event.response.status);
      console.log('MIME TYPE:', event.response.mimeType);
    });

    client.on('Network.loadingFinished', event => {
      const info = solicitudes.get(event.requestId);

      if (!info) return;

      solicitudes.delete(event.requestId);

      const lectura = (async () => {
        try {
          const resultado = await client.send(
            'Network.getResponseBody',
            { requestId: event.requestId }
          );

          let texto = resultado.body || '';

          if (resultado.base64Encoded) {
            texto = Buffer.from(
              texto,
              'base64'
            ).toString('utf8');
          }

          console.log('--------------------------');
          console.log('CUERPO RECIBIDO');
          console.log('HTTP STATUS:', info.status);
          console.log('TAMAÑO:', texto.length);

          if (info.status !== 200) {
            console.log(
              'Respuesta no exitosa. No se mostrará el cuerpo.'
            );
            return;
          }

          let datos;

          try {
            datos = JSON.parse(texto);
          } catch (error) {
            console.log(
              'JSON VALIDO: NO',
              error.message
            );
            return;
          }

          console.log('JSON VALIDO: SI');
          console.log(
            'CAMPOS:',
            Object.keys(datos).join(', ')
          );

          if (Array.isArray(datos.entries)) {
            ranking = datos;
            console.log('RANKING ENCONTRADO');
          } else {
            console.log(
              'JSON recibido, pero sin entries'
            );
          }

        } catch (error) {
          console.log(
            'ERROR CDP:',
            error.message
          );
        }
      })();

      lecturas.push(lectura);
    });

    client.on('Network.loadingFailed', event => {
      const info = solicitudes.get(event.requestId);

      if (!info) return;

      console.log(
        'SOLICITUD FALLIDA:',
        event.errorText
      );

      solicitudes.delete(event.requestId);
    });

    console.log('Abriendo Spotify Charts...');

    const navegacion = await page.goto(CHART_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log(
      'HTTP PAGINA:',
      navegacion?.status() ?? 'Sin respuesta'
    );

    console.log('Esperando solicitudes...');

    await new Promise(resolve =>
      setTimeout(resolve, 15000)
    );

    await Promise.allSettled(lecturas);

    console.log('==========================');

    if (!ranking) {
      console.log('RESULTADO: NO SE OBTUVO EL RANKING');
      console.log(
        'Revisar los HTTP STATUS y errores CDP.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('RESULTADO: RANKING RECIBIDO');
    console.log(
      'FECHA:',
      ranking.displayChart?.date ?? 'No disponible'
    );
    console.log(
      'TOTAL ARTISTAS:',
      ranking.entries.length
    );

    const xg = ranking.entries.find(item =>
      item.artistMetadata?.artistName === 'XG'
    );

    if (xg) {
      const datos = xg.chartEntryData;

      console.log('--------------------------');
      console.log('XG ENCONTRADO');
      console.log('POSICION:', datos.currentRank);
      console.log(
        'POSICION ANTERIOR:',
        datos.previousRank
      );
      console.log('PEAK:', datos.peakRank);
      console.log(
        'DIAS EN CHART:',
        datos.appearancesOnChart
      );
    } else {
      console.log('XG NO APARECE EN EL RANKING');
    }

  } catch (error) {
    console.log('ERROR GENERAL:', error.message);
    process.exitCode = 1;

  } finally {
    if (client) {
      await client.detach().catch(() => {});
    }

    await browser.close();
    console.log('=== PRUEBA FINALIZADA ===');
  }
}

main().catch(error => {
  console.error('ERROR FATAL:', error.message);
  process.exitCode = 1;
});
