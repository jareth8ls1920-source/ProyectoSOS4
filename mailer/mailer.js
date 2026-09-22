const nodemailer = require('nodemailer');

/**
 * Configuración del envío de emails según el entorno.
 *
 *  - PRODUCCIÓN (NODE_ENV=production, ej. Heroku): se envía con SendGrid
 *    a través de su SDK oficial (@sendgrid/mail) usando SENDGRID_API_KEY.
 *
 *  - DESARROLLO (local): se envía a Ethereal (https://ethereal.email).
 *    Los emails NO llegan a una casilla real: quedan en la bandeja web de
 *    Ethereal y la URL de previsualización se imprime en consola.
 *      · Si hay ETHEREAL_USER / ETHEREAL_PWD en el .env se usa esa cuenta.
 *      · Si no, se crea una cuenta de prueba automáticamente con
 *        nodemailer.createTestAccount() al enviar el primer mail.
 *
 *  - TEST (NODE_ENV=test): no se conecta a ningún servicio, el mail se
 *    imprime en consola (jsonTransport) para que los tests no dependan de la red.
 *
 * El módulo expone la misma interfaz en todos los casos:
 *   mailer.sendMail(mailOptions, cb)   y   mailer.previewUrl(info)
 */

const FROM_DEFAULT = process.env.MAIL_FROM || 'no-reply@redbicicletas.com';

// ---------------------------------------------------------------------------
// Transporte SendGrid (producción) con la interfaz de nodemailer
// ---------------------------------------------------------------------------
function crearTransporteSendGrid() {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('[mailer] Producción: los emails se envían con SendGrid.');

  return {
    nombre: 'sendgrid',
    sendMail: function (mailOptions, cb) {
      const msg = {
        to: mailOptions.to,
        from: mailOptions.from || FROM_DEFAULT,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
      };
      sgMail.send(msg).then(function (response) {
        cb(null, { messageId: response[0].headers['x-message-id'], response: response[0] });
      }).catch(function (err) {
        const detalle = err.response && err.response.body ? JSON.stringify(err.response.body) : err.message;
        cb(new Error('SendGrid: ' + detalle));
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Transporte Ethereal (desarrollo). Se resuelve de forma perezosa porque la
// creación automática de la cuenta de prueba es asincrónica.
// ---------------------------------------------------------------------------
let etherealPromise = null;

function obtenerTransporteEthereal() {
  if (etherealPromise) return etherealPromise;

  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PWD) {
    console.log('[mailer] Desarrollo: los emails se envían a Ethereal (' + process.env.ETHEREAL_USER + ').');
    etherealPromise = Promise.resolve(nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: process.env.ETHEREAL_USER, pass: process.env.ETHEREAL_PWD },
    }));
  } else {
    console.log('[mailer] Desarrollo: sin ETHEREAL_USER/ETHEREAL_PWD, se crea una cuenta de prueba de Ethereal automáticamente.');
    etherealPromise = nodemailer.createTestAccount().then(function (cuenta) {
      console.log('[mailer] Cuenta Ethereal creada -> usuario: ' + cuenta.user + '  password: ' + cuenta.pass);
      console.log('[mailer] Podés guardarla en el .env como ETHEREAL_USER / ETHEREAL_PWD y ver la bandeja en https://ethereal.email/login');
      return nodemailer.createTransport({
        host: cuenta.smtp.host,
        port: cuenta.smtp.port,
        secure: cuenta.smtp.secure,
        auth: { user: cuenta.user, pass: cuenta.pass },
      });
    }).catch(function (err) {
      console.log('[mailer] No se pudo crear la cuenta de Ethereal (' + err.message + '). Los mails se imprimirán en consola.');
      return crearTransporteConsola();
    });
  }
  return etherealPromise;
}

// ---------------------------------------------------------------------------
// Transporte de consola (tests o fallback sin red)
// ---------------------------------------------------------------------------
function crearTransporteConsola() {
  const transporter = nodemailer.createTransport({ jsonTransport: true });
  const originalSendMail = transporter.sendMail.bind(transporter);
  transporter.sendMail = function (mailOptions, cb) {
    originalSendMail(mailOptions, function (err, info) {
      if (!err && process.env.NODE_ENV !== 'test') {
        console.log('------------------ EMAIL (simulado) ------------------');
        console.log('Para:    ' + mailOptions.to);
        console.log('Asunto:  ' + mailOptions.subject);
        console.log(mailOptions.text);
        console.log('-------------------------------------------------------');
      }
      cb(err, info);
    });
  };
  return transporter;
}

// ---------------------------------------------------------------------------
// Selección del transporte según NODE_ENV
// ---------------------------------------------------------------------------
let transportePromise;

if (process.env.NODE_ENV === 'production') {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('[mailer] ATENCIÓN: NODE_ENV=production sin SENDGRID_API_KEY. Los mails se imprimirán en consola.');
    transportePromise = Promise.resolve(crearTransporteConsola());
  } else {
    transportePromise = Promise.resolve(crearTransporteSendGrid());
  }
} else if (process.env.NODE_ENV === 'test') {
  transportePromise = Promise.resolve(crearTransporteConsola());
} else {
  transportePromise = null; // Ethereal: se crea al enviar el primer mail
}

const mailer = {
  /**
   * Envía un email. Firma compatible con nodemailer: sendMail(opciones, cb).
   */
  sendMail: function (mailOptions, cb) {
    if (!mailOptions.from) mailOptions.from = FROM_DEFAULT;
    const promesa = transportePromise || obtenerTransporteEthereal();
    promesa.then(function (transporter) {
      transporter.sendMail(mailOptions, cb);
    }).catch(cb);
  },

  /**
   * Devuelve la URL de previsualización de Ethereal (si aplica), null en otro caso.
   */
  previewUrl: function (info) {
    try {
      return nodemailer.getTestMessageUrl(info) || null;
    } catch (e) {
      return null;
    }
  },
};

module.exports = mailer;
