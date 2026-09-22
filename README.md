# 🚲 Red Bicicletas — Módulo 4: Deploy en producción

Aplicación web + API REST para administrar una red de bicicletas públicas
(continuación del Módulo 3), preparada para correr en **producción**:
deploy en **Heroku**, base de datos en **MongoDB Atlas**, emails por
**SendGrid**, login con **Google** y **Facebook**, y monitoreo con **New Relic**.

**Stack:** Node.js 22 · Express · MongoDB (Mongoose) · Pug · Passport (local, Google, Facebook) · JWT · Nodemailer/Ethereal · SendGrid · New Relic · Jasmine

| | |
|---|---|
| **Repositorio** | https://github.com/jareth8ls1920-source/ProyectoSOS4 |
| **App en Heroku** | `https://<nombre-app>.herokuapp.com` (ver [Deploy a Heroku](#5-deploy-a-heroku-con-mongo-atlas)) |

---

## Índice

1. [Instalación y ejecución local](#instalación-y-ejecución-local)
2. [Cómo se cumple cada punto de la consigna](#cómo-se-cumple-cada-punto-de-la-consigna)
3. [Variables de entorno](#variables-de-entorno)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Prueba de la API con Postman](#prueba-de-la-api-con-postman)
6. [Tests automatizados](#tests-automatizados)

---

## Instalación y ejecución local

Requisitos: Node.js ≥ 22 y MongoDB corriendo en `localhost:27017`.

```bash
npm install
cp .env.example .env     # completar SESSION_SECRET y SECRET_KEY (el resto es opcional en local)
npm run seed             # crea el usuario admin@redbicicletas.com / admin123 (ya verificado)
npm start                # http://localhost:3000
```

Para desarrollo con recarga automática: `npm run devstart`.

En local **no hace falta configurar nada más**: la app usa el mongo local y
los emails salen por Ethereal (crea la cuenta de prueba sola y muestra en
consola el link para ver cada mail).

---

## Cómo se cumple cada punto de la consigna

### 1. App publicada en Heroku

El proyecto está listo para Heroku:

- [`Procfile`](Procfile) → `web: node ./bin/www`
- [`package.json`](package.json) → `"engines": { "node": "22.x" }` y script `start`
- [`bin/www`](bin/www) escucha en `process.env.PORT` (Heroku asigna el puerto)
- [`app.js`](app.js) → `app.set('trust proxy', 1)` en producción (la app corre detrás del router de Heroku)
- [`app.json`](app.json) describe todas las variables de entorno necesarias

Los pasos completos de deploy están en el [punto 5](#5-deploy-a-heroku-con-mongo-atlas).

### 2. Usuario creado en la base de Mongo (Atlas / Compass)

**Usuario de la base de datos (Atlas → Database Access):**

1. En https://cloud.mongodb.com crear un cluster gratuito (M0).
2. *Security → Database Access → Add New Database User*: authentication
   *Password*, usuario `red_bicicletas`, password generado, rol *Read and write to any database*.
3. *Security → Network Access → Add IP Address → Allow access from anywhere* (`0.0.0.0/0`),
   necesario porque Heroku no tiene IP fija.
4. *Database → Connect → Drivers* → copiar la cadena `mongodb+srv://red_bicicletas:<password>@<cluster>.mongodb.net/red_bicicletas?retryWrites=true&w=majority`.

Esa cadena es el valor de `MONGO_URI` en Heroku (punto 3).

**Usuario de la aplicación en la colección `usuarios`:** se puede crear de tres formas:

- Registrándose en `https://<app>.herokuapp.com/usuarios/create` (llega el email de verificación por SendGrid).
- Con `heroku run npm run seed` → crea `admin@redbicicletas.com` / `admin123` ya verificado ([`seed.js`](seed.js)).
- Desde **MongoDB Compass** o el **visor web de Atlas** (*Browse Collections → usuarios → Insert Document*),
  por ejemplo:

  ```json
  { "nombre": "Admin", "email": "admin@redbicicletas.com", "password": "<hash bcrypt>", "verificado": true }
  ```

  (el password se guarda hasheado con bcrypt, por eso es más cómodo usar el seed o el registro).

Conectándose con Compass a la cadena de Atlas se ven las colecciones
`usuarios`, `bicicletas`, `tokens` y `sessions` (sesiones de `connect-mongo`).

### 3. Variables `NODE_ENV="production"` y `MONGO_URI="<conexión a Atlas>"`

```bash
heroku config:set NODE_ENV=production
heroku config:set MONGO_URI="mongodb+srv://red_bicicletas:<password>@<cluster>.mongodb.net/red_bicicletas?retryWrites=true&w=majority"
```

En [`app.js`](app.js) la conexión se elige así:

```js
const mongoDB = process.env.NODE_ENV === 'test'
  ? (process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/red_bicicletas_m4_test')
  : (process.env.MONGO_URI || 'mongodb://localhost:27017/red_bicicletas_m4');
```

`NODE_ENV=production` además activa: sesiones en Mongo (`connect-mongo`),
`trust proxy` y el envío de emails por SendGrid ([`mailer/mailer.js`](mailer/mailer.js)).
Al arrancar, la app loguea `MongoDB conectado (production): mongodb+srv://red_bicicletas:****@...`.

### 4. Mongo local utilizado correctamente

En desarrollo (`NODE_ENV=development` o sin definir) se usa
`MONGO_URI=mongodb://localhost:27017/red_bicicletas_m4` (por defecto si no está en el `.env`),
y los tests usan una base separada `red_bicicletas_m4_test`.

Verificación con `mongosh`:

```bash
mongosh red_bicicletas_m4 --eval "db.usuarios.find({}, {nombre:1, email:1, verificado:1}).toArray()"
```

### 5. Deploy a Heroku con Mongo Atlas

```bash
# 1. Login y creación de la app
heroku login
heroku create red-bicicletas-jareth          # o el nombre que esté libre

# 2. Variables de entorno (producción)
heroku config:set NODE_ENV=production
heroku config:set MONGO_URI="mongodb+srv://red_bicicletas:<password>@<cluster>.mongodb.net/red_bicicletas?retryWrites=true&w=majority"
heroku config:set SESSION_SECRET="$(openssl rand -hex 32)"
heroku config:set SECRET_KEY="$(openssl rand -hex 32)"
heroku config:set HOST=https://red-bicicletas-jareth.herokuapp.com
heroku config:set SENDGRID_API_KEY="SG.xxxxxxxx" MAIL_FROM="tu-email-verificado@gmail.com"
heroku config:set GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..."
heroku config:set FACEBOOK_APP_ID="..." FACEBOOK_APP_SECRET="..."
heroku config:set NEW_RELIC_LICENSE_KEY="..." NEW_RELIC_APP_NAME="Red Bicicletas"

# 3. Deploy
git push heroku main
heroku run npm run seed        # usuario admin en Atlas
heroku open
heroku logs --tail             # se ve "MongoDB conectado (production): mongodb+srv://..."
```

Con `NODE_ENV=production` y `MONGO_URI` apuntando a Atlas, **la app productiva
usa Mongo Atlas** (y sigue usando el mongo local en desarrollo, sin tocar código).
También se puede deployar con el botón *Deploy to Heroku* gracias a [`app.json`](app.json).

### 6. El ambiente local sigue enviando los mails por Ethereal

[`mailer/mailer.js`](mailer/mailer.js) elige el transporte según `NODE_ENV`:

| Entorno | Transporte |
|---|---|
| `development` (local) | **Ethereal** (`smtp.ethereal.email`). Si hay `ETHEREAL_USER`/`ETHEREAL_PWD` en el `.env` usa esa cuenta; si no, crea una cuenta de prueba con `nodemailer.createTestAccount()` y la imprime en consola. Cada mail enviado imprime su URL de previsualización. |
| `production` (Heroku) | **SendGrid** |
| `test` | Se imprime en consola (sin red) |

Ejemplo de consola al registrarse en local:

```
[mailer] Cuenta Ethereal creada -> usuario: f4h65w7vjx3vgm2x@ethereal.email  password: ********
Email de verificación enviado a jareth@example.com - https://ethereal.email/message/arI81PCz...
```

### 7. Los emails se envían por SendGrid

En producción se usa el SDK oficial [`@sendgrid/mail`](https://www.npmjs.com/package/@sendgrid/mail):

```js
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
sgMail.send({ to, from, subject, text, html });
```

Configuración en SendGrid:

1. Crear cuenta en https://signup.sendgrid.com con un email propio.
2. *Settings → Sender Authentication → Single Sender Verification*: agregar ese
   email como remitente (llega un mail de verificación). Ese email va en `MAIL_FROM`.
3. *Settings → API Keys → Create API Key* (Full Access o *Mail Send*). Ese valor va en `SENDGRID_API_KEY`.

Se envían emails al **registrarse** (link de verificación) y al pedir
**Olvidé mi password** (link de reseteo), en ambos casos apuntando a `HOST`.

### 8. `findOneOrCreateByGoogle` en el modelo de usuario

[`models/usuario.js`](models/usuario.js):

```js
usuarioSchema.statics.findOneOrCreateByGoogle = function (condition, callback) { ... }
```

Busca por `googleId` o por el email del perfil; si el usuario existe lo devuelve
(y le vincula el `googleId` si se había registrado con email/password); si no,
lo crea **verificado** con un password aleatorio. Lo usa la estrategia de Google
en [`config/passport.js`](config/passport.js) (`/auth/google` → `/auth/google/callback`).

Credenciales: https://console.cloud.google.com/apis/credentials → *OAuth client ID*
(Web application) con URI de redirección `<HOST>/auth/google/callback`.

Se agregó también `findOneOrCreateByFacebook` con la misma lógica para el punto 9.

### 9. Validación del token de Facebook

- **Estrategia** `facebook-token` (`passport-facebook-token`) en [`config/passport.js`](config/passport.js).
- **Endpoint** `POST /api/auth/facebook_token` en [`controllers/api/authControllerAPI.js`](controllers/api/authControllerAPI.js)
  (ruta en [`routes/api/auth.js`](routes/api/auth.js)).

Flujo: el cliente obtiene un *access token* con el SDK de Facebook y lo manda
en el body (`access_token`) o en `Authorization: Bearer <token>`. La estrategia
**valida el token contra la Graph API de Facebook**:

| Caso | Respuesta |
|---|---|
| Sin token | `401` `{"status":"error","message":"Acceso denegado: no se envió el access_token de Facebook."}` |
| Token inválido / vencido | `401` `{"status":"error","message":"Token de Facebook inválido: Invalid OAuth access token - Cannot parse access token"}` |
| Token válido | `200` con el usuario (`findOneOrCreateByFacebook`), se inicia la sesión web y se devuelve un **JWT** para la API |
| Sin `FACEBOOK_APP_ID`/`SECRET` | `503` con el aviso de configuración |

La vista de login ([`views/session/login.pug`](views/session/login.pug)) tiene el botón
**Ingresar con Facebook** que usa el SDK JS (`FB.login`) y llama a ese endpoint.

Credenciales: https://developers.facebook.com/apps → crear app → *Facebook Login* →
copiar *App ID* y *App Secret* en `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`.
Para probar desde Postman se puede sacar un token en https://developers.facebook.com/tools/explorer.

### 10. Librería `newrelic` en `app.js`

Primeras líneas de [`app.js`](app.js):

```js
require('dotenv').config();
require('newrelic');
```

La configuración está en [`newrelic.js`](newrelic.js) y toma
`NEW_RELIC_LICENSE_KEY` y `NEW_RELIC_APP_NAME` del entorno. Sin license key
el agente queda deshabilitado (log: `Module disabled in configuration`), así
que en local y en los tests no molesta. En Heroku, con la license key cargada,
la app aparece en https://one.newrelic.com → *APM & Services*.

---

## Variables de entorno

Ver [`.env.example`](.env.example) (comentado). Resumen:

| Variable | Local | Heroku |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `MONGO_URI` | `mongodb://localhost:27017/red_bicicletas_m4` | cadena de Mongo Atlas |
| `SESSION_SECRET`, `SECRET_KEY` | cualquier string | secretos largos |
| `HOST` | `http://localhost:3000` | `https://<app>.herokuapp.com` |
| `ETHEREAL_USER`, `ETHEREAL_PWD` | opcional (se autogenera) | — |
| `SENDGRID_API_KEY`, `MAIL_FROM` | — | API key + remitente verificado |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | opcional | opcional |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | opcional | opcional |
| `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME` | — | license key de New Relic |

---

## Estructura del proyecto

```
├── app.js                      # require('newrelic'), Express, sesión, Passport, rutas y middlewares
├── newrelic.js                 # Configuración del agente de New Relic
├── Procfile                    # Comando de arranque para Heroku
├── app.json                    # Descripción de la app y sus variables para Heroku
├── seed.js                     # Crea un usuario verificado (local o Atlas: heroku run npm run seed)
├── bin/www                     # Arranque del servidor HTTP (PORT de Heroku)
├── config/passport.js          # Estrategias local, Google y Facebook (token)
├── controllers/
│   ├── bicicleta.js, usuario.js, token.js
│   └── api/authControllerAPI.js       # authenticate (JWT) y facebook_token
├── mailer/mailer.js            # Ethereal (desarrollo) / SendGrid (producción)
├── models/usuario.js           # findOneOrCreateByGoogle, findOneOrCreateByFacebook
├── routes/                     # Rutas web y /api
├── views/                      # Pug (login con botones de Google y Facebook)
├── spec/                       # Tests Jasmine
└── postman/RedBicicletas.postman_collection.json
```

---

## Prueba de la API con Postman

Importar [`postman/RedBicicletas.postman_collection.json`](postman/RedBicicletas.postman_collection.json)
y setear la variable `baseUrl` (`http://localhost:3000` o `https://<app>.herokuapp.com`).
La request **1. Autenticar** guarda el JWT en `{{token}}`; las requests **11 y 12**
prueban `POST /api/auth/facebook_token` con un token válido (variable `facebook_access_token`)
y con uno inválido (`401`).

```bash
curl -X POST http://localhost:3000/api/auth/authenticate -H "Content-Type: application/json" -d "{\"email\":\"admin@redbicicletas.com\",\"password\":\"admin123\"}"
```

```bash
curl -X POST http://localhost:3000/api/auth/facebook_token -H "Content-Type: application/json" -d "{\"access_token\":\"token-falso\"}"
```

---

## Tests automatizados

```bash
npm test
```

21 specs (base `MONGO_URI_TEST`): modelo Usuario (hash de password, validaciones,
token de reseteo), `findOneOrCreateByGoogle` y `findOneOrCreateByFacebook`
(creación, no duplicación, vinculación por email), autenticación JWT,
endpoint de Facebook sin token / con token inválido, protección de la API y redirección al login.
