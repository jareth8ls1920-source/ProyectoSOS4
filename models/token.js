const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Modelo de Token.
 *  - _userId:   referencia al usuario asignado (ref: 'Usuario')
 *  - token:     el token propiamente dicho (string aleatorio en hexadecimal)
 *  - createdAt: fecha de creación. Índice TTL: MongoDB elimina el documento
 *               automáticamente 12 horas (43200 s) después de creado.
 */
const tokenSchema = new Schema({
  _userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Usuario',
  },
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
    expires: 43200,
  },
});

module.exports = mongoose.model('Token', tokenSchema);
