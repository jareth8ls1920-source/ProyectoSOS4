const Bicicleta = require('../../models/bicicleta');

exports.bicicleta_list = function (req, res) {
  Bicicleta.find({}).then(function (bicis) {
    res.status(200).json({ bicicletas: bicis });
  }).catch(function (err) {
    res.status(500).json({ message: err.message });
  });
};

exports.bicicleta_create = function (req, res) {
  const bici = new Bicicleta({
    code: req.body.code,
    color: req.body.color,
    modelo: req.body.modelo,
    ubicacion: [req.body.lat, req.body.lng],
  });
  bici.save().then(function (saved) {
    res.status(201).json({ bicicleta: saved });
  }).catch(function (err) {
    res.status(500).json({ message: err.message });
  });
};

exports.bicicleta_update = function (req, res) {
  Bicicleta.findByIdAndUpdate(req.body.id, {
    code: req.body.code,
    color: req.body.color,
    modelo: req.body.modelo,
    ubicacion: [req.body.lat, req.body.lng],
  }, { new: true }).then(function (bici) {
    if (!bici) return res.status(404).json({ message: 'Bicicleta no encontrada' });
    res.status(200).json({ bicicleta: bici });
  }).catch(function (err) {
    res.status(500).json({ message: err.message });
  });
};

exports.bicicleta_delete = function (req, res) {
  Bicicleta.findByIdAndDelete(req.body.id).then(function (bici) {
    if (!bici) return res.status(404).json({ message: 'Bicicleta no encontrada' });
    res.status(204).send();
  }).catch(function (err) {
    res.status(500).json({ message: err.message });
  });
};
