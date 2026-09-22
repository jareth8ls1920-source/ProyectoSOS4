'use strict';

/**
 * Configuración del agente de New Relic (APM).
 *
 * Se carga con `require('newrelic')` en la primera línea útil de app.js.
 * Los valores sensibles vienen por variables de entorno (en Heroku se
 * configuran con `heroku config:set`):
 *
 *   NEW_RELIC_LICENSE_KEY  -> license key de la cuenta de New Relic
 *   NEW_RELIC_APP_NAME     -> nombre con el que aparece la app en el panel
 *
 * Si no hay license key (por ejemplo en desarrollo o en los tests) el agente
 * queda deshabilitado y no intenta conectarse a New Relic.
 */
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Red Bicicletas'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  agent_enabled: Boolean(process.env.NEW_RELIC_LICENSE_KEY) && process.env.NEW_RELIC_ENABLED !== 'false',
  distributed_tracing: {
    enabled: true,
  },
  logging: {
    // En Heroku el filesystem es efímero: se loguea a stdout.
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'stdout',
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*',
    ],
  },
};
