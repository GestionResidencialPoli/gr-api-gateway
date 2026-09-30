# gr-api-gateway

API Gateway para los microservicios de Gestion Residencial (GR). Se ubica delante de `gr-user-microservice`
(y de los servicios que se agreguen despues) y resuelve dos cosas antes de que la peticion llegue al backend:

- **Rate limiting** por IP, con un limite mas estricto para las operaciones sensibles de `/api/v1/auth/*`
  (login, cambio y recuperacion de contrasena). Las comprobaciones de sesion, refresh, logout y SSO no consumen
  ese contador: son parte del flujo normal de navegacion entre frontends y ya requieren una sesion o un codigo
  valido. El contador se guarda en Redis (compartido entre replicas del gateway; un contador en memoria por
  proceso no serviria de limite real si k3s levanta mas de un pod por trafico) y cae automaticamente a un contador
  en memoria del propio proceso si Redis no responde, para que Redis no se convierta en un punto unico de falla.
- **Validacion local de JWT**: lee la cookie `access_token`, verifica la firma HMAC-SHA256 con el mismo
  secreto que usa `gr-user-microservice` y rechaza tokens invalidos o expirados sin llamar al microservicio.

La validacion local solo cubre lo que se puede resolver con el propio token (firma, expiracion, roles). Todo lo
que necesita datos frescos de base de datos (por ejemplo, si el usuario sigue activo) lo sigue resolviendo
`gr-user-microservice`, que valida el JWT de nuevo del lado del backend. El gateway es una primera capa rapida,
no reemplaza esa validacion.

## Stack

- Node 24, TypeScript, Express 5
- pnpm
- `tsx` para desarrollo, `tsc` para build de produccion
- `http-proxy-middleware` para el reverse proxy hacia cada microservicio

## Estructura

```
index.ts                  # entrypoint: levanta el httpServer
src/
  server.ts               # clase Server: arma el Express app (middlewares + rutas)
  config/                 # lectura y validacion de variables de entorno
  lib/                    # utilidades sin estado (TokenService, Logger)
  middlewares/            # authenticate, require-authentication, require-roles, rate limiters, handle-error
  proxies/                # creacion del proxy hacia cada microservicio
  routes/                 # registro de servicios (service-registry) y el router del gateway
  types/                  # augmentation de Express (req.auth)
```

Los servicios controladores (`TokenService`, `Logger`) son clases con solo metodos estaticos, sin estado de
instancia: no hay razon para instanciarlos.

## Agregar un microservicio nuevo

Se agrega una entrada en `src/routes/service-registry.ts` con su `pathPrefix`, su `target` (URL) y las rutas
publicas que no requieren autenticacion. El router del gateway monta rate limiting, verificacion de auth y el
proxy automaticamente para cada entrada del registro.

Servicios registrados hoy:

| Servicio | Prefijos | Variable del destino | Puerto local |
|---|---|---|---|
| gr-user-microservice | `/api/v1/auth`, `/api/v1/apartamentos`, `/api/v1/vigilantes` | `USER_SERVICE_URL` | 8080 |
| gr-wall-microservice | `/api/v1/publicaciones` | `WALL_SERVICE_URL` | 4100 |
| gr-booking-microservice | `/api/v1/zonas-comunes`, `/api/v1/reservas` | `BOOKING_SERVICE_URL` | 4200 |
| gr-gate-microservice | `/api/v1/porteria` | `GATE_SERVICE_URL` | 4300 |

`docker compose up` levanta el stack completo, incluidas las migraciones de cada servicio Node, que crean su propia
base (`gr_wall_db`, `gr_booking_db`, `gr_gate_db`) en el mismo Postgres.

## Entorno local completo con Docker Compose

Desde la raíz de este repositorio, el comando siguiente construye y levanta las bases de datos, los microservicios,
el gateway y todas las interfaces disponibles:

```powershell
docker compose up -d --build
```

Interfaces publicadas en local:

| Interfaz | Puerto |
|---|---:|
| `gr-common-ui` | 3000 |
| `gr-admin-ui` | 3001 |
| `gr-auth-ui` | 3002 |
| `gr-wall-ui` | 3003 |
| `gr-booking-ui` | 3004 |
| `gr-gate-ui` | 3005 |
| `gr-public-ui` | 3006 |
| `gr-billing-ui` | 3007 |

Las URLs de los frontends se resuelven desde el navegador mediante `localhost`; dentro de los contenedores, las
peticiones al backend usan el nombre del servicio `gateway` en la red de Compose.

## Variables de entorno

`CONTACT_SERVICE_URL` (por defecto `http://localhost:4500`) y `BILLING_SERVICE_URL` (por defecto `http://localhost:4400`) apuntan a los servicios nuevos. El gateway permite anónimamente únicamente `POST /api/v1/contacto/solicitudes`; las demás rutas de contacto y todas las financieras requieren sesión.

Ver `.env.example`. `JWT_SECRET` debe ser exactamente el mismo secreto configurado en `gr-user-microservice`
(variable `JWT_SECRET` alla tambien), de al menos 32 caracteres.

## Desarrollo

```bash
pnpm install
cp .env.example .env   # completar JWT_SECRET con el mismo valor que el backend
pnpm dev
```

## Scripts

- `pnpm dev` — desarrollo con recarga automatica
- `pnpm build` / `pnpm start` — build y ejecucion de produccion
- `pnpm lint` / `pnpm lint:fix`
- `pnpm typecheck`

