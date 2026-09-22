const Usuario = require('../models/usuario');
const Token = require('../models/token');

/**
 * GET /token/confirmation/:token
 * Verifica la cuenta del usuario a partir del token recibido por email.
 */
exports.confirmationGet = function (req, res, next) {
  Token.findOne({ token: req.params.token }).then(function (token) {
    if (!token) {
      return res.status(400).send({
        type: 'not-verified',
        msg: 'No encontramos un usuario con este token. Quizá haya expirado y debas solicitar uno nuevo.',
      });
    }

    Usuario.findById(token._userId).then(function (usuario) {
      if (!usuario) {
        return res.status(400).send({ msg: 'No encontramos un usuario con este token.' });
      }
      if (usuario.verificado) {
        return res.redirect('/usuarios');
      }
      usuario.verificado = true;
      usuario.save().then(function () {
        res.redirect('/');
      }).catch(next);
    }).catch(next);
  }).catch(next);
};
