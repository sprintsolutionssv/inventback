# Backend API CRM (Express + TypeScript + PostgreSQL)

Readme para construir aplicación con **Express**, **TypeScript** y **PostgreSQL** enfocada a CRM, con:

* Configuración global (Singleton) basada en archivos `.env` por entorno.
* Gestor de conexiones (Singleton) con patrón Estrategia para soportar múltiples motores (PostgreSQL, MongoDB, etc.).
* Autenticación JWT: generación y verificación de tokens.
* Logging centralizado (Singleton) usando **Winston** con múltiples transportes y rotación de archivos.
* Servidor Express integrado con morgan y manejo de errores global.
* Documentación de la API con Swagger/OpenAPI.

---

## 📋 Prerrequisitos

* Node.js v22.14.0
* npm
* Servidor PostgreSQL accesible (o cualquier otro motor según estrategias registradas)

---

## ⚙️ Instalación

1. Clona el repositorio:

   ```bash
   git clone <url> backend
   cd backend
   ```

2. Instala dependencias de producción:

   ```bash
   npm install express pg dotenv cors helmet morgan jsonwebtoken winston winston-daily-rotate-file swagger-ui-express swagger-jsdoc
   ```

3. Instala dependencias de desarrollo:

   ```bash
   npm install --save-dev typescript ts-node-dev tsconfig-paths dotenv-cli nodemon @types/node @types/express @types/jsonwebtoken @types/pg @types/morgan @types/swagger-ui-express
   ```

4. Copia los archivos de entorno y ajusta credenciales:

   ```bash
   cp .env.development.example .env.development
   cp .env.qa.example .env.qa
   cp .env.production.example .env.production
   cp .env.test.example .env.test
   ```

---

## ⚙️ Variables de Entorno

Coloca en cada archivo `.env.<entorno>`:

```ini
NODE_ENV=development       # development | qa | production | test
DB_HOST=localhost          # Host de la base de datos
DB_PORT=5432               # Puerto DB
DB_USER=miusuario          # Usuario DB
DB_PASSWORD=mipass         # Contraseña DB
DB_NAME=db_dev             # Nombre de la base de datos
JWT_SECRET=secretkey       # Secreto para JWT
PORT=3000                  # Puerto de la API
```

> Para testing, ajusta `NODE_ENV=test` y copia esas variables en `.env.test`.
---

## 📁 Estructura de Carpetas

```
backend/
├── src/
│   ├── config/
│   │   └── Config.ts            # Configuración global (Singleton)
│   ├── connection/
│   │   ├── IConnectionStrategy.ts
│   │   ├── PostgreSQLStrategy.ts
│   │   └── ConnectionManager.ts # Gestor de conexiones (Singleton + Estrategias)
│   ├── logger/
│   │   └── Logger.ts            # Logger centralizado (Singleton)
│   ├── models/
│   │   ├── EstadoModel.ts       # Modelo para estados (usado desde Swagger)
│   │   ├── PersonaModel.ts      # Modelo para CRUD de personas
│   │   └── EmpresaModel.ts      # Modelo para CRUD de empresas
│   ├── routes/
│   │   ├── estadoRoutes.ts      # Rutas de estados (documentadas en Swagger)
│   │   ├── personaRoutes.ts     # Rutas de personas (CRUD)
│   │   ├── empresaRoutes.ts     # Rutas de empresas (CRUD)
│   │   └── index.ts             # Centralizador de rutas
│   ├── utils/
│   │   └── route.ts             # Helper para manejo de errores en rutas
│   ├── swagger.ts               # Configuración de Swagger/OpenAPI
│   └── index.ts                 # Bootstrap de la aplicación
├── tests/
│   ├── persona.test.ts
│   └── empresa.test.ts
├── .env.development
├── .env.qa
├── .env.production
├── .env.test
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 🔧 Configuración Global (`src/config/Config.ts`)

* Implementa **Singleton** para exponer las variables como propiedades `readonly`.
* Carga automáticamente `.env.<NODE_ENV>` y permite override con `process.env`.
* Valida campos críticos y arroja errores amigables si faltan.
* Construye `DATABASE_URL` interno a partir de `DB_*`.
* Logea al iniciar el entorno y validación de parámetros.

---

## 🔌 Gestor de Conexiones (`src/connection`)

* **IConnectionStrategy**: interfaz común para cada motor.
* **PostgreSQLStrategy**: maneja conexión, reconexión y cierre de un `Pool` de `pg`.
* **ConnectionManager** (Singleton): registra estrategias con `registerStrategy(name, strategy)`, evita duplicados y expone `getConnection(name)` y `closeAllConnections()`.
* Al iniciar (`bootstrap`), registra `postgres`, prueba la conexión y aborta si falla.

---

## 📋 Logger Centralizado (`src/logger/Logger.ts`)

* Basado en **Winston** (Singleton).

* Transportes:

  * **Console**: pretty-print en `development`, JSON en `qa|production`.
  * **DailyRotateFile**: rotación diaria de logs de error (20m, 14d).

* Formato: JSON estructurado + `timestamp`, manejo de `exceptions` y `rejections`.

* Diferente nivel (`debug|info|warn`) según entorno.

---

## 📖 Documentación con Swagger

1. Arranca el servidor (`npm run dev` o `npm start`).
2. Abre en tu navegador:

   ```
   http://localhost:<PORT>/docs
   ```

Allí encontrarás la UI de Swagger con todos los endpoints y esquemas definidos.

---

## 🛑 Manejo de Errores Globales

* Captura `uncaughtException` y `unhandledRejection`:

  ```ts
  process.on('uncaughtException', err => logger.error('Uncaught Exception', { message: err.message, stack: err.stack }));
  process.on('unhandledRejection', reason => logger.error('Unhandled Rejection', { reason }));
  ```