const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reservaSchema = new Schema({
  desde: Date,
  hasta: Date,
  bicicleta: { type: mongoose.Schema.Types.ObjectId, ref: 'Bicicleta' },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
});

// Cantidad de días de la reserva (inclusive)
reservaSchema.methods.diasDeReserva = function () {
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((new Date(this.hasta) - new Date(this.desde)) / msPorDia) + 1;
};

module.exports = mongoose.model('Reserva', reservaSchema);
