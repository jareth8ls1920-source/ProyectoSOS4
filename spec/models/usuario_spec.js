const mongoose = require('mongoose');
const Usuario = require('../../models/usuario');
const Token = require('../../models/token');

describe('Modelo Usuario', function () {
  beforeAll(async function () {
    const mongoDB = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/red_bicicletas_m4_test';
    await mongoose.connect(mongoDB);
  });

  afterEach(async function () {
    await Usuario.deleteMany({});
    await Token.deleteMany({});
  });

  afterAll(async function () {
    await mongoose.connection.close();
  });

  it('debe tener los atributos email, password, passwordResetToken, passwordResetTokenExpires y verificado', function () {
    const paths = Object.keys(Usuario.schema.paths);
    expect(paths).toContain('email');
    expect(paths).toContain('password');
    expect(paths).toContain('passwordResetToken');
    expect(paths).toContain('passwordResetTokenExpires');
    expect(paths).toContain('verificado');
  });

  it('guarda el password hasheado y lo valida con validPassword', async function () {
    const u = await Usuario.create({ nombre: 'Test', email: 'test@example.com', password: '123456' });
    expect(u.password).not.toBe('123456');
    expect(u.validPassword('123456')).toBe(true);
    expect(u.validPassword('incorrecto')).toBe(false);
  });

  it('verificado es false por defecto', async function () {
    const u = await Usuario.create({ nombre: 'Test', email: 'test@example.com', password: '123456' });
    expect(u.verificado).toBe(false);
  });

  it('rechaza un email con formato inválido', async function () {
    let error = null;
    try {
      await Usuario.create({ nombre: 'Test', email: 'no-es-un-email', password: '123456' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
    expect(error.errors.email).toBeDefined();
  });

  it('rechaza un email duplicado con un mensaje legible', async function () {
    await Usuario.create({ nombre: 'Uno', email: 'dup@example.com', password: '123456' });
    let error = null;
    try {
      await Usuario.create({ nombre: 'Dos', email: 'dup@example.com', password: '123456' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
    expect(error.errors.email.message).toBe('El email ya existe con otro usuario.');
  });

  it('resetPassword genera un token con expiración y lo asocia al usuario', function (done) {
    Usuario.create({ nombre: 'Test', email: 'reset@example.com', password: '123456' }).then(function (u) {
      u.resetPassword(async function (err) {
        expect(err).toBeFalsy();
        const actualizado = await Usuario.findById(u._id);
        expect(actualizado.passwordResetToken).toBeDefined();
        expect(actualizado.passwordResetTokenExpires.getTime()).toBeGreaterThan(Date.now());
        const token = await Token.findOne({ _userId: u._id });
        expect(token).not.toBeNull();
        expect(token.token).toBe(actualizado.passwordResetToken);
        expect(token.createdAt).toBeDefined();
        done();
      });
    });
  });

  describe('findOneOrCreateByGoogle', function () {
    const perfilGoogle = { id: 'g-123', displayName: 'Usuario Google', emails: [{ value: 'google@example.com' }] };

    it('crea un usuario verificado la primera vez', function (done) {
      Usuario.findOneOrCreateByGoogle(perfilGoogle, function (err, usuario) {
        expect(err).toBeFalsy();
        expect(usuario.googleId).toBe('g-123');
        expect(usuario.email).toBe('google@example.com');
        expect(usuario.nombre).toBe('Usuario Google');
        expect(usuario.verificado).toBe(true);
        done();
      });
    });

    it('devuelve el mismo usuario si ya existe (no lo duplica)', function (done) {
      Usuario.findOneOrCreateByGoogle(perfilGoogle, function (err, primero) {
        Usuario.findOneOrCreateByGoogle(perfilGoogle, async function (err2, segundo) {
          expect(segundo._id.toString()).toBe(primero._id.toString());
          expect(await Usuario.countDocuments({})).toBe(1);
          done();
        });
      });
    });

    it('vincula la cuenta de Google a un usuario registrado con el mismo email', async function () {
      const existente = await Usuario.create({ nombre: 'Local', email: 'google@example.com', password: '123456' });
      await new Promise(function (resolve) {
        Usuario.findOneOrCreateByGoogle(perfilGoogle, function (err, usuario) {
          expect(usuario._id.toString()).toBe(existente._id.toString());
          expect(usuario.googleId).toBe('g-123');
          expect(usuario.verificado).toBe(true);
          resolve();
        });
      });
    });
  });

  describe('findOneOrCreateByFacebook', function () {
    const perfilFacebook = { id: 'fb-456', displayName: 'Usuario Facebook', emails: [{ value: 'facebook@example.com' }] };

    it('crea un usuario verificado con facebookId la primera vez', function (done) {
      Usuario.findOneOrCreateByFacebook(perfilFacebook, function (err, usuario) {
        expect(err).toBeFalsy();
        expect(usuario.facebookId).toBe('fb-456');
        expect(usuario.email).toBe('facebook@example.com');
        expect(usuario.verificado).toBe(true);
        done();
      });
    });

    it('devuelve el mismo usuario si ya existe (no lo duplica)', function (done) {
      Usuario.findOneOrCreateByFacebook(perfilFacebook, function (err, primero) {
        Usuario.findOneOrCreateByFacebook(perfilFacebook, async function (err2, segundo) {
          expect(segundo._id.toString()).toBe(primero._id.toString());
          expect(await Usuario.countDocuments({})).toBe(1);
          done();
        });
      });
    });

    it('funciona aunque Facebook no informe el email', function (done) {
      Usuario.findOneOrCreateByFacebook({ id: 'fb-789', displayName: 'Sin Email' }, function (err, usuario) {
        expect(err).toBeFalsy();
        expect(usuario.facebookId).toBe('fb-789');
        expect(usuario.email).toContain('fb-789@facebook');
        done();
      });
    });
  });
});
