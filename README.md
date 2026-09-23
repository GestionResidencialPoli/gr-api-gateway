# gr-api-gateway

API Gateway para los microservicios de Gestion Residencial (GR). Se ubica delante de `gr-user-microservice`
(y de los servicios que se agreguen despues) y resuelve dos cosas antes de que la peticion llegue al backend:

- **Rate limiting** por IP, con un limite mas estricto para `/api/v1/auth/*`.
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

## Variables de entorno

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

