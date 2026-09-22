require('dotenv').config();

// New Relic (APM). Debe cargarse antes que cualquier otro módulo (express,
// mongoose, etc.) para que pueda instrumentarlos. Se configura en newrelic.js
// y con las variables NEW_RELIC_LICENSE_KEY / NEW_RELIC_APP_NAME.
require('newrelic');

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const passport = require('./config/passport');
const Usuario = require('./models/usuario');
const Token = require('./models/token');

const indexRouter = require('./routes/index');
const usuariosRouter = require('./routes/usuarios');
const bicicletasRouter = require('./routes/bicicletas');
const tokenRouter = require('./routes/token');
const bicicletasAPIRouter = require('./routes/api/bicicletas');
const usuariosAPIRouter = require('./routes/api/usuarios');
const authAPIRouter = require('./routes/api/auth');

const app = express();

app.set('secretKey', process.env.SECRET_KEY || 'clave_secreta_por_defecto');

// En Heroku la app corre detrás de un proxy/balanceador: hay que confiar en
// él para que req.protocol, req.ip y las cookies de sesión funcionen bien.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ---------------------------------------------------------------------------
// Conexión a MongoDB
//   - producción (Heroku): MONGO_URI apunta al cluster de Mongo Atlas
//   - desarrollo:          MONGO_URI (o por defecto) apunta al mongod local
//   - test:                MONGO_URI_TEST, base separada para los tests
// ---------------------------------------------------------------------------
const mongoDB = process.env.NODE_ENV === 'test'
  ? (process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/red_bicicletas_m4_test')
  : (process.env.MONGO_URI || 'mongodb://localhost:27017/red_bicicletas_m4');

mongoose.connect(mongoDB).then(function () {
  console.log('MongoDB conectado (' + (process.env.NODE_ENV || 'development') + '): ' + ocultarCredenciales(mongoDB));
}).catch(function (err) {
  console.error('Error de conexión a MongoDB:', err.message);
});

// ---------------------------------------------------------------------------
// Sesión (almacenada en MongoDB en producción, en memoria en desarrollo/test)
// ---------------------------------------------------------------------------
let store;
if (process.env.NODE_ENV === 'production') {
  store = MongoStore.create({ mongoUrl: mongoDB });
} else {
  store = new session.MemoryStore();
}

app.use(session({
  cookie: { maxAge: 240 * 60 * 60 * 1000 }, // 10 días
  store: store,
  saveUninitialized: true,
  resave: true,
  secret: process.env.SESSION_SECRET || 'red_bicicletas_!!!***???',
}));

// ---------------------------------------------------------------------------
// Configuración de vistas y middlewares
// ---------------------------------------------------------------------------
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
app.use(passport.session());

// Deja al usuario logueado y la configuración de login social disponibles en todas las vistas
app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.googleHabilitado = Boolean(passport._strategy('google'));
  res.locals.facebookAppId = passport._strategy('facebook-token') ? process.env.FACEBOOK_APP_ID : null;
  next();
});

// ---------------------------------------------------------------------------
// Rutas de sesión (login / logout / recupero de password)
// ---------------------------------------------------------------------------
app.get('/login', function (req, res) {
  res.render('session/login', { info: null });
});

app.post('/login', function (req, res, next) {
  passport.authenticate('local', function (err, usuario, info) {
    if (err) return next(err);
    if (!usuario) return res.render('session/login', { info: info });
    req.logIn(usuario, function (err) {
      if (err) return next(err);
      return res.redirect('/');
    });
  })(req, res, next);
});

app.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) return next(err);
    res.redirect('/');
  });
});

app.get('/forgotPassword', function (req, res) {
  res.render('session/forgotPassword');
});

app.post('/forgotPassword', function (req, res, next) {
  Usuario.findOne({ email: req.body.email }).then(function (usuario) {
    if (!usuario) {
      return res.render('session/forgotPassword', { info: { message: 'No existe el email para un usuario existente.' } });
    }
    usuario.resetPassword(function (err) {
      if (err) return next(err);
      res.render('session/forgotPasswordMessage');
    });
  }).catch(next);
});

app.get('/resetPassword/:token', function (req, res, next) {
  Token.findOne({ token: req.params.token }).then(function (token) {
    if (!token) {
      return res.status(400).send({
        type: 'not-verified',
        msg: 'No existe un usuario asociado al token. Verifique que su token no haya expirado.',
      });
    }
    Usuario.findById(token._userId).then(function (usuario) {
      if (!usuario) {
        return res.status(400).send({ msg: 'No existe un usuario asociado al token.' });
      }
      res.render('session/resetPassword', { errors: {}, usuario: usuario });
    }).catch(next);
  }).catch(next);
});

app.post('/resetPassword', function (req, res, next) {
  if (req.body.password !== req.body.confirm_password) {
    res.render('session/resetPassword', {
      errors: { confirm_password: { message: 'No coincide con el password ingresado' } },
      usuario: new Usuario({ email: req.body.email }),
    });
    return;
  }

  Usuario.findOne({ email: req.body.email }).then(function (usuario) {
    if (!usuario) {
      return res.render('session/resetPassword', {
        errors: { email: { message: 'No existe un usuario con ese email' } },
        usuario: new Usuario({ email: req.body.email }),
      });
    }
    usuario.password = req.body.password;
    usuario.passwordResetToken = undefined;
    usuario.passwordResetTokenExpires = undefined;
    usuario.save().then(function () {
      res.redirect('/login');
    }).catch(function (err) {
      res.render('session/resetPassword', { errors: err.errors || {}, usuario: new Usuario({ email: req.body.email }) });
    });
  }).catch(next);
});

// ---------------------------------------------------------------------------
// Google OAuth 2.0 (flujo web). Si no hay credenciales, avisa en el login.
// ---------------------------------------------------------------------------
function googleConfigurado(req, res, next) {
  if (passport._strategy('google')) return next();
  res.render('session/login', { info: { message: 'Login con Google no configurado: faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.' } });
}

app.get('/auth/google', googleConfigurado, passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

app.get('/auth/google/callback', googleConfigurado, passport.authenticate('google', {
  successRedirect: '/',
  failureRedirect: '/login',
}));

// ---------------------------------------------------------------------------
// Rutas de la aplicación
// ---------------------------------------------------------------------------
app.use('/', indexRouter);
app.use('/token', tokenRouter);
// Rutas protegidas: si no está logueado, redirige al login.
// El registro (/usuarios/create) queda público para poder crear la cuenta.
app.use('/usuarios', soloRegistroPublico, usuariosRouter);
app.use('/bicicletas', loggedIn, bicicletasRouter);

// API REST (protegida con JWT)
app.use('/api/auth', authAPIRouter);
app.use('/api/bicicletas', validarUsuario, bicicletasAPIRouter);
app.use('/api/usuarios', validarUsuario, usuariosAPIRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// ---------------------------------------------------------------------------
// Middlewares de autorización
// ---------------------------------------------------------------------------

/**
 * Verifica que exista un usuario logueado en la sesión (Passport).
 * Si no, redirige al login. Se usa para proteger las rutas web.
 */
function loggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    console.log('Usuario sin loguearse, redirigiendo a /login');
    res.redirect('/login');
  }
}

/**
 * Permite /usuarios/create sin sesión (alta de cuenta); el resto de /usuarios
 * (listado, edición, borrado) exige estar logueado.
 */
function soloRegistroPublico(req, res, next) {
  if (req.path === '/create') return next();
  return loggedIn(req, res, next);
}

/**
 * Valida el JWT enviado en el header `x-access-token`.
 * Se usa para proteger la API. Si el token es inválido o no existe,
 * responde 401 con un mensaje de error.
 */
function validarUsuario(req, res, next) {
  const token = req.headers['x-access-token'] ||
    (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, ''));

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Acceso denegado: no se envió el token de autenticación (header x-access-token).',
      data: null,
    });
  }

  jwt.verify(token, req.app.get('secretKey'), function (err, decoded) {
    if (err) {
      return res.status(401).json({ status: 'error', message: 'Token inválido o expirado: ' + err.message, data: null });
    }
    req.body.userId = decoded.id;
    console.log('JWT verificado para el usuario: ' + decoded.id);
    next();
  });
}

/**
 * Oculta usuario:password de una URI de conexión para poder loguearla.
 */
function ocultarCredenciales(uri) {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:****@');
}

module.exports = app;
