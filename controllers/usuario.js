const Usuario = require('../models/usuario');

exports.usuario_list = function (req, res, next) {
  Usuario.find({}).then(function (usuarios) {
    res.render('usuarios/index', { usuarios: usuarios });
  }).catch(next);
};

exports.usuario_create_get = function (req, res) {
  res.render('usuarios/create', { errors: {}, usuario: new Usuario() });
};

exports.usuario_create_post = function (req, res) {
  if (req.body.password !== req.body.confirm_password) {
    res.render('usuarios/create', {
      errors: { confirm_password: { message: 'No coincide con el password ingresado' } },
      usuario: new Usuario({ nombre: req.body.nombre, email: req.body.email }),
    });
    return;
  }

  Usuario.create({
    nombre: req.body.nombre,
    email: req.body.email,
    password: req.body.password,
  }).then(function (nuevoUsuario) {
    nuevoUsuario.enviar_email_bienvenida();
    res.redirect('/usuarios');
  }).catch(function (err) {
    res.render('usuarios/create', {
      errors: err.errors || {},
      usuario: new Usuario({ nombre: req.body.nombre, email: req.body.email }),
    });
  });
};

exports.usuario_update_get = function (req, res, next) {
  Usuario.findById(req.params.id).then(function (usuario) {
    res.render('usuarios/update', { errors: {}, usuario: usuario });
  }).catch(next);
};

exports.usuario_update_post = function (req, res, next) {
  const update_values = { nombre: req.body.nombre };
  Usuario.findByIdAndUpdate(req.params.id, update_values, { runValidators: true }).then(function () {
    res.redirect('/usuarios');
  }).catch(function (err) {
    console.log(err);
    res.render('usuarios/update', {
      errors: err.errors || {},
      usuario: new Usuario({ nombre: req.body.nombre, email: req.body.email }),
    });
  });
};

exports.usuario_delete_post = function (req, res, next) {
  Usuario.findByIdAndDelete(req.body.id).then(function () {
    res.redirect('/usuarios');
  }).catch(next);
};
