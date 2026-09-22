const Bicicleta = require('../models/bicicleta');

exports.bicicleta_list = function (req, res, next) {
  Bicicleta.find({}).then(function (bicis) {
    res.render('bicicletas/index', { bicis: bicis });
  }).catch(next);
};

exports.bicicleta_create_get = function (req, res) {
  res.render('bicicletas/create');
};

exports.bicicleta_create_post = function (req, res, next) {
  const bici = new Bicicleta({
    code: req.body.code,
    color: req.body.color,
    modelo: req.body.modelo,
    ubicacion: [req.body.lat, req.body.lng],
  });
  bici.save().then(function () {
    res.redirect('/bicicletas');
  }).catch(next);
};

exports.bicicleta_update_get = function (req, res, next) {
  Bicicleta.findById(req.params.id).then(function (bici) {
    res.render('bicicletas/update', { bici: bici });
  }).catch(next);
};

exports.bicicleta_update_post = function (req, res, next) {
  Bicicleta.findByIdAndUpdate(req.params.id, {
    code: req.body.code,
    color: req.body.color,
    modelo: req.body.modelo,
    ubicacion: [req.body.lat, req.body.lng],
  }).then(function () {
    res.redirect('/bicicletas');
  }).catch(next);
};

exports.bicicleta_delete_post = function (req, res, next) {
  Bicicleta.findByIdAndDelete(req.body.id).then(function () {
    res.redirect('/bicicletas');
  }).catch(next);
};
