// Fuerza el entorno de test para que app.js use la base de datos de pruebas
process.env.NODE_ENV = 'test';
require('dotenv').config();
