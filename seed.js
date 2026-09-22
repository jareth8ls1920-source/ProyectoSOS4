/**
 * Crea (o actualiza) un usuario verificado en la base de datos apuntada por
 * MONGO_URI, para poder iniciar sesión sin pasar por el email de verificación.
 *
 * Sirve tanto para el mongo local como para Mongo Atlas / Heroku:
 *
 *   npm run seed
 *   heroku run npm run seed
 *
 * Datos por defecto (se pueden cambiar con variables de entorno):
 *   SEED_NOMBRE=Admin  SEED_EMAIL=admin@redbicicletas.com  SEED_PASSWORD=admin123
 */
require('dotenv').config();

const mongoose = require('mongoose');
const Usuario = require('./models/usuario');

const mongoDB = process.env.MONGO_URI || 'mongodb://localhost:27017/red_bicicletas_m4';
const datos = {
  nombre: process.env.SEED_NOMBRE || 'Admin',
  email: process.env.SEED_EMAIL || 'admin@redbicicletas.com',
  password: process.env.SEED_PASSWORD || 'admin123',
};

mongoose.connect(mongoDB).then(async function () {
  console.log('Conectado a ' + mongoDB.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:****@'));

  let usuario = await Usuario.findOne({ email: datos.email });
  if (usuario) {
    usuario.nombre = datos.nombre;
    usuario.password = datos.password; // se re-hashea en el pre('save')
    usuario.verificado = true;
    await usuario.save();
    console.log('Usuario actualizado: ' + usuario.email);
  } else {
    usuario = await Usuario.create({ ...datos, verificado: true });
    console.log('Usuario creado: ' + usuario.email);
  }
  console.log('Password: ' + datos.password);
  await mongoose.connection.close();
}).catch(function (err) {
  console.error('Error:', err.message);
  process.exit(1);
});
