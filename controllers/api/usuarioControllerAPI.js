const Usuario = require('../../models/usuario');

exports.usuarios_list = function (req, res) {
  Usuario.find({}).select('-password').then(function (usuarios) {
    res.status(200).json({ usuarios: usuarios });
  }).catch(function (err) {
    res.status(500).json({ message: err.message });
  });
};

exports.usuarios_create = function (req, res) {
  const usuario = new Usuario({
    nombre: req.body.nombre,
    email: req.body.email,
    password: req.body.password,
  });
  usuario.save().then(function (saved) {
    res.status(201).json({ usuario: { _id: saved._id, nombre: saved.nombre, email: saved.email } });
  }).catch(function (err) {
    res.status(400).json({ message: err.message });
  });
};

exports.usuario_reservar = function (req, res) {
  Usuario.findById(req.body.id).then(function (usuario) {
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    usuario.reservar(req.body.bici_id, req.body.desde, req.body.hasta, function (err, reserva) {
      if (err) return res.status(500).json({ message: err.message });
      res.status(200).json({ reserva: reserva });
    });
  }).catch(function (err) {
    res.status(500).json({ message: err.message });
  });
};
