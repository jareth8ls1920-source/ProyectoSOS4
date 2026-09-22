const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const Usuario = require('../../models/usuario');
const Bicicleta = require('../../models/bicicleta');

describe('API con JWT', function () {
  let token;

  beforeAll(async function () {
    // app.js ya inicia la conexión; esperamos a que esté lista
    await mongoose.connection.asPromise();
    await Usuario.deleteMany({});
    await Bicicleta.deleteMany({});
    await Usuario.create({ nombre: 'API', email: 'api@example.com', password: 'secreto', verificado: true });
  });

  afterAll(async function () {
    await Usuario.deleteMany({});
    await Bicicleta.deleteMany({});
    await mongoose.connection.close();
  });

  it('POST /api/auth/authenticate con credenciales incorrectas devuelve 401', async function () {
    const res = await request(app)
      .post('/api/auth/authenticate')
      .send({ email: 'api@example.com', password: 'mal' });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  it('POST /api/auth/authenticate con credenciales correctas devuelve un token', async function () {
    const res = await request(app)
      .post('/api/auth/authenticate')
      .send({ email: 'api@example.com', password: 'secreto' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.token).toBeDefined();
    token = res.body.data.token;
  });

  it('POST /api/auth/facebook_token sin access_token devuelve 401 o 503 (si no está configurado)', async function () {
    const res = await request(app).post('/api/auth/facebook_token').send({});
    expect([401, 503]).toContain(res.status);
    expect(res.body.status).toBe('error');
  });

  it('POST /api/auth/facebook_token con un token inválido no autentica', async function () {
    const res = await request(app)
      .post('/api/auth/facebook_token')
      .send({ access_token: 'token-de-facebook-falso' });
    expect([401, 503]).toContain(res.status);
    expect(res.body.status).toBe('error');
    expect(res.body.data).toBeNull();
  });

  it('GET /api/bicicletas sin token devuelve 401 con mensaje de error', async function () {
    const res = await request(app).get('/api/bicicletas');
    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Acceso denegado');
  });

  it('GET /api/bicicletas con token inválido devuelve 401', async function () {
    const res = await request(app).get('/api/bicicletas').set('x-access-token', 'token.falso.123');
    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Token inválido');
  });

  it('POST /api/bicicletas/create y GET /api/bicicletas con token válido', async function () {
    const create = await request(app)
      .post('/api/bicicletas/create')
      .set('x-access-token', token)
      .send({ code: 10, color: 'rojo', modelo: 'urbana', lat: -34.6, lng: -58.4 });
    expect(create.status).toBe(201);
    expect(create.body.bicicleta.color).toBe('rojo');

    const list = await request(app).get('/api/bicicletas').set('x-access-token', token);
    expect(list.status).toBe(200);
    expect(list.body.bicicletas.length).toBe(1);
  });

  it('GET /bicicletas (web) sin sesión redirige a /login', async function () {
    const res = await request(app).get('/bicicletas');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('GET /usuarios (web) sin sesión redirige a /login, pero /usuarios/create es público', async function () {
    const lista = await request(app).get('/usuarios');
    expect(lista.status).toBe(302);
    expect(lista.headers.location).toBe('/login');

    const registro = await request(app).get('/usuarios/create');
    expect(registro.status).toBe(200);
  });
});
