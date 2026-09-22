const Usuario = require('../../models/usuario');
const Token = require('../../models/token');
const jwt = require('jsonwebtoken');
const passport = require('../../config/passport');

/** Firma un JWT con el id del usuario (expira en 1 hora). */
function firmarToken(usuario) {
  return jwt.sign(
    { id: usuario._id },
    process.env.SECRET_KEY || 'clave_secreta_por_defecto',
    { expiresIn: '1h' }
  );
}

/** Extrae el mensaje de error que devuelve la Graph API de Facebook. */
function mensajeErrorFacebook(err) {
  try {
    if (err.oauthError && err.oauthError.data) {
      const data = JSON.parse(err.oauthError.data);
      if (data.error && data.error.message) return data.error.message;
    }
  } catch (e) { /* ignorar: se usa el mensaje genérico */ }
  return err.message;
}

/**
 * POST /api/auth/authenticate
 * Recibe email + password y, si son válidos, devuelve un JWT firmado
 * con SECRET_KEY que expira en 1 hora.
 */
module.exports = {
  authenticate: function (req, res, next) {
    Usuario.findOne({ email: req.body.email }).then(function (userInfo) {
      if (!userInfo) {
        return res.status(401).json({
          status: 'error',
          message: 'Credenciales inválidas. Usuario inexistente.',
          data: null,
        });
      }
      if (!userInfo.validPassword(req.body.password)) {
        return res.status(401).json({
          status: 'error',
          message: 'Credenciales inválidas. Password incorrecto.',
          data: null,
        });
      }
      const token = firmarToken(userInfo);
      res.status(200).json({
        status: 'success',
        message: 'Usuario encontrado.',
        data: { usuario: { email: userInfo.email, nombre: userInfo.nombre }, token: token },
      });
    }).catch(next);
  },

  /**
   * POST /api/auth/facebook_token
   *
   * Validación del token de Facebook. Recibe el access token que el cliente
   * obtuvo con el SDK de Facebook (body `access_token`, query `access_token`
   * o header `Authorization: Bearer <token>`) y lo valida con la estrategia
   * `facebook-token` contra la Graph API:
   *   - token inválido / vencido -> 401 con el mensaje de error de Facebook
   *   - token válido             -> se busca o crea el usuario
   *                                 (Usuario.findOneOrCreateByFacebook),
   *                                 se inicia la sesión web y se devuelve un JWT
   *                                 para usar la API.
   */
  facebookToken: function (req, res, next) {
    if (!passport._strategy('facebook-token')) {
      return res.status(503).json({
        status: 'error',
        message: 'Login con Facebook no configurado: faltan FACEBOOK_APP_ID / FACEBOOK_APP_SECRET.',
        data: null,
      });
    }

    const tokenRecibido = req.body.access_token || req.query.access_token ||
      (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, ''));
    if (!tokenRecibido) {
      return res.status(401).json({
        status: 'error',
        message: 'Acceso denegado: no se envió el access_token de Facebook.',
        data: null,
      });
    }

    passport.authenticate('facebook-token', { session: true }, function (err, usuario) {
      if (err) {
        return res.status(401).json({
          status: 'error',
          message: 'Token de Facebook inválido: ' + mensajeErrorFacebook(err),
          data: null,
        });
      }
      if (!usuario) {
        return res.status(401).json({ status: 'error', message: 'Token de Facebook inválido.', data: null });
      }
      // Inicia también la sesión web para que el botón de la vista de login funcione
      req.logIn(usuario, function (loginErr) {
        if (loginErr) return next(loginErr);
        res.status(200).json({
          status: 'success',
          message: 'Usuario autenticado con Facebook.',
          data: { usuario: { email: usuario.email, nombre: usuario.nombre }, token: firmarToken(usuario) },
        });
      });
    })(req, res, next);
  },

  /**
   * POST /api/auth/forgotPassword
   * Genera el token de reseteo y envía el email.
   */
  forgotPassword: function (req, res, next) {
    Usuario.findOne({ email: req.body.email }).then(function (usuario) {
      if (!usuario) {
        return res.status(404).json({ message: 'No existe el usuario' });
      }
      usuario.resetPassword(function (err) {
        if (err) return next(err);
        res.status(200).json({ message: 'Se envió un email para restablecer el password' });
      });
    }).catch(next);
  },

  /**
   * POST /api/auth/resetPassword/:token
   * (usa el mismo mecanismo de Token del flujo web)
   */
  resetPassword: function (req, res, next) {
    Token.findOne({ token: req.params.token }).then(function (token) {
      if (!token) return res.status(400).json({ message: 'Token inválido o expirado' });
      Usuario.findById(token._userId).then(function (usuario) {
        if (!usuario) return res.status(400).json({ message: 'Usuario no encontrado' });
        usuario.password = req.body.password;
        usuario.passwordResetToken = undefined;
        usuario.passwordResetTokenExpires = undefined;
        usuario.save().then(function () {
          res.status(200).json({ message: 'Password actualizado' });
        }).catch(next);
      }).catch(next);
    }).catch(next);
  },
};
