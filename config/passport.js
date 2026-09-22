const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookTokenStrategy = require('passport-facebook-token');
const Usuario = require('../models/usuario');

/**
 * Estrategia local: autenticación con email + password.
 *  - Si el email no existe -> credenciales incorrectas.
 *  - Si el password no coincide -> credenciales incorrectas.
 *  - Si el usuario no verificó su cuenta -> se le pide que la verifique.
 */
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  function (email, password, done) {
    Usuario.findOne({ email: email }).then(function (usuario) {
      if (!usuario) {
        return done(null, false, { message: 'Email no existente o incorrecto.' });
      }
      if (!usuario.validPassword(password)) {
        return done(null, false, { message: 'Password incorrecto.' });
      }
      if (!usuario.verificado) {
        return done(null, false, { message: 'La cuenta no ha sido verificada. Revisa tu email.' });
      }
      return done(null, usuario);
    }).catch(done);
  }
));

/**
 * Estrategia Google OAuth 2.0 (flujo web: /auth/google -> /auth/google/callback).
 * Sólo se registra si hay credenciales (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
 * Con el perfil que devuelve Google se llama a Usuario.findOneOrCreateByGoogle.
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: (process.env.HOST || 'http://localhost:3000') + '/auth/google/callback',
    },
    function (accessToken, refreshToken, profile, cb) {
      Usuario.findOneOrCreateByGoogle(profile, function (err, user) {
        return cb(err, user);
      });
    }
  ));
  console.log('[passport] Estrategia Google habilitada.');
} else {
  console.log('[passport] Estrategia Google deshabilitada (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
}

/**
 * Estrategia Facebook por token (`facebook-token`).
 *
 * El cliente (la vista de login con el SDK JS de Facebook, o Postman) obtiene
 * un access token de Facebook y lo manda a POST /api/auth/facebook_token
 * (body `access_token` o header `Authorization: Bearer <token>`).
 * La estrategia VALIDA ese token contra la Graph API de Facebook: si es
 * inválido o vencido, Facebook responde con error y Passport devuelve 401;
 * si es válido, obtiene el perfil y se llama a Usuario.findOneOrCreateByFacebook.
 *
 * Sólo se registra si hay credenciales (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET).
 */
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookTokenStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      fbGraphVersion: 'v19.0',
      profileFields: ['id', 'displayName', 'emails', 'name'],
    },
    function (accessToken, refreshToken, profile, done) {
      Usuario.findOneOrCreateByFacebook(profile, function (err, user) {
        return done(err, user);
      });
    }
  ));
  console.log('[passport] Estrategia Facebook (token) habilitada.');
} else {
  console.log('[passport] Estrategia Facebook deshabilitada (faltan FACEBOOK_APP_ID / FACEBOOK_APP_SECRET).');
}

/**
 * serializeUser: decide qué dato del usuario se guarda en la sesión.
 * Guardamos únicamente el _id para mantener la sesión liviana.
 */
passport.serializeUser(function (user, cb) {
  cb(null, user.id);
});

/**
 * deserializeUser: a partir del id guardado en la sesión, recupera el usuario
 * completo de la base de datos y lo deja disponible en req.user.
 */
passport.deserializeUser(function (id, cb) {
  Usuario.findById(id).then(function (usuario) {
    cb(null, usuario);
  }).catch(cb);
});

module.exports = passport;
