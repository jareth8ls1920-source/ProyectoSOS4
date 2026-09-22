const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Reserva = require('./reserva');
const Token = require('./token');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mailer = require('../mailer/mailer');

const saltRounds = 10;

// Validador de email (formato básico)
const validateEmail = function (email) {
  const re = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(email);
};

const usuarioSchema = new Schema({
  nombre: {
    type: String,
    trim: true,
    required: [true, 'El nombre es obligatorio'],
  },
  email: {
    type: String,
    trim: true,
    required: [true, 'El email es obligatorio'],
    lowercase: true,
    unique: true,
    validate: [validateEmail, 'Por favor, ingrese un email válido'],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/],
  },
  password: {
    type: String,
    required: [true, 'El password es obligatorio'],
  },
  passwordResetToken: String,
  passwordResetTokenExpires: Date,
  verificado: {
    type: Boolean,
    default: false,
  },
  googleId: String,
  facebookId: String,
});

// Mensaje personalizado cuando se viola la restricción unique
usuarioSchema.plugin(require('./plugins/uniqueValidator'), {
  message: 'El {PATH} ya existe con otro usuario.',
});

// Antes de guardar, si el password cambió, se hashea con bcrypt
usuarioSchema.pre('save', function (next) {
  if (this.isModified('password')) {
    this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  next();
});

// Compara el password en texto plano contra el hash guardado
usuarioSchema.methods.validPassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

// Reservar una bicicleta
usuarioSchema.methods.reservar = function (biciId, desde, hasta, cb) {
  const reserva = new Reserva({
    usuario: this._id,
    bicicleta: biciId,
    desde: desde,
    hasta: hasta,
  });
  console.log(reserva);
  reserva.save().then(function (r) { cb(null, r); }).catch(cb);
};

// Envía el email de bienvenida con el link de verificación de cuenta
usuarioSchema.methods.enviar_email_bienvenida = function (cb) {
  const token = new Token({
    _userId: this.id,
    token: crypto.randomBytes(16).toString('hex'),
  });
  const email_destination = this.email;

  token.save().then(function () {
    const host = process.env.HOST || 'http://localhost:3000';
    const mailOptions = {
      from: 'no-reply@redbicicletas.com',
      to: email_destination,
      subject: 'Verificación de cuenta - Red Bicicletas',
      text:
        'Hola,\n\n' +
        'Gracias por registrarte en Red Bicicletas. ' +
        'Por favor, para verificar su cuenta haga click en este enlace:\n\n' +
        host + '/token/confirmation/' + token.token + '\n',
      html:
        '<h2>¡Bienvenido a Red Bicicletas!</h2>' +
        '<p>Gracias por registrarte. Para verificar tu cuenta haz click en el siguiente enlace:</p>' +
        '<p><a href="' + host + '/token/confirmation/' + token.token + '">Verificar mi cuenta</a></p>' +
        '<p>Si no te registraste en Red Bicicletas, ignora este mensaje.</p>',
    };

    mailer.sendMail(mailOptions, function (err, info) {
      if (err) {
        return console.log(err.message);
      }
      console.log('Email de verificación enviado a ' + email_destination + ' - ' + (mailer.previewUrl(info) || ''));
      if (cb) cb();
    });
  }).catch(function (err) {
    console.log(err.message);
  });
};

// Genera el token de reseteo de password y envía el email correspondiente
usuarioSchema.methods.resetPassword = function (cb) {
  const token = new Token({
    _userId: this.id,
    token: crypto.randomBytes(16).toString('hex'),
  });
  const email_destination = this.email;
  const usuario = this;

  // Guardamos también el token y su expiración en el propio usuario (1 hora)
  usuario.passwordResetToken = token.token;
  usuario.passwordResetTokenExpires = Date.now() + 3600000;

  token.save().then(function () {
    return usuario.save();
  }).then(function () {
    const host = process.env.HOST || 'http://localhost:3000';
    const mailOptions = {
      from: 'no-reply@redbicicletas.com',
      to: email_destination,
      subject: 'Reseteo de password - Red Bicicletas',
      text:
        'Hola,\n\n' +
        'Recibimos una solicitud para restablecer tu password. ' +
        'Por favor, haga click en este enlace para resetear el password de su cuenta:\n\n' +
        host + '/resetPassword/' + token.token + '\n\n' +
        'El enlace expira en 1 hora.\n',
      html:
        '<h2>Reseteo de password</h2>' +
        '<p>Recibimos una solicitud para restablecer tu password. Haz click en el siguiente enlace:</p>' +
        '<p><a href="' + host + '/resetPassword/' + token.token + '">Restablecer mi password</a></p>' +
        '<p>El enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.</p>',
    };

    mailer.sendMail(mailOptions, function (err, info) {
      if (err) {
        return cb(err);
      }
      console.log('Email de reseteo enviado a ' + email_destination + ' - ' + (mailer.previewUrl(info) || ''));
      cb(null);
    });
  }).catch(cb);
};

/**
 * Obtiene el email principal de un perfil de Passport (Google / Facebook).
 * Si el proveedor no lo informa, se arma uno sintético para no romper
 * la restricción `required` + `unique` del schema.
 */
function emailDelPerfil(profile, proveedor) {
  if (profile.emails && profile.emails.length && profile.emails[0].value) {
    return profile.emails[0].value;
  }
  return profile.id + '@' + proveedor + '.sin-email.app';
}

/**
 * Busca o crea un usuario a partir del perfil de Google (OAuth 2.0).
 *
 * Se busca por googleId o por el email del perfil (si el usuario ya se había
 * registrado con email + password, se vincula la cuenta de Google). Si no
 * existe, se crea verificado, con un password aleatorio (nunca lo va a usar
 * porque entra con Google).
 *
 * Firma con callback (err, usuario) como la usa passport-google-oauth20.
 */
usuarioSchema.statics.findOneOrCreateByGoogle = function findOneOrCreateByGoogle(condition, callback) {
  const self = this;
  const email = emailDelPerfil(condition, 'google');

  self.findOne({
    $or: [
      { googleId: condition.id },
      { email: email },
    ],
  }).then(function (result) {
    if (result) {
      // Vincula el googleId si el usuario existía sólo con email/password
      if (!result.googleId) {
        result.googleId = condition.id;
        result.verificado = true;
        return result.save().then(function (saved) { callback(null, saved); });
      }
      return callback(null, result);
    }
    const values = {
      googleId: condition.id,
      email: email,
      nombre: condition.displayName || 'SIN NOMBRE',
      verificado: true,
      password: crypto.randomBytes(16).toString('hex'),
    };
    self.create(values).then(function (created) {
      callback(null, created);
    }).catch(callback);
  }).catch(callback);
};

/**
 * Busca o crea un usuario a partir del perfil de Facebook.
 *
 * Se usa desde la estrategia `facebook-token` (config/passport.js): el
 * cliente obtiene un access token con el SDK de Facebook y la API lo valida
 * contra Graph API; con el perfil resultante se busca por facebookId o email.
 *
 * Firma con callback (err, usuario) como la usa passport-facebook-token.
 */
usuarioSchema.statics.findOneOrCreateByFacebook = function findOneOrCreateByFacebook(condition, callback) {
  const self = this;
  const email = emailDelPerfil(condition, 'facebook');

  self.findOne({
    $or: [
      { facebookId: condition.id },
      { email: email },
    ],
  }).then(function (result) {
    if (result) {
      if (!result.facebookId) {
        result.facebookId = condition.id;
        result.verificado = true;
        return result.save().then(function (saved) { callback(null, saved); });
      }
      return callback(null, result);
    }
    const values = {
      facebookId: condition.id,
      email: email,
      nombre: condition.displayName || 'SIN NOMBRE',
      verificado: true,
      password: crypto.randomBytes(16).toString('hex'),
    };
    self.create(values).then(function (created) {
      callback(null, created);
    }).catch(callback);
  }).catch(callback);
};

module.exports = mongoose.model('Usuario', usuarioSchema);
