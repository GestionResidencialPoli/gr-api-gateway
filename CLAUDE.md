# gr-api-gateway — contexto para agentes

API Gateway de Gestion Residencial (GR). Unico punto de entrada publico para todos los microservicios de
backend. Node + Express + TypeScript, patrones inspirados en `beunik-api` (repo externo del autor, usado solo
como guia de estilo): clases con **solo metodos estaticos**, `server.ts` en vez de `app.ts`, sin comentarios
salvo que expliquen un porque no obvio.

## Que hace y que NO hace

- Valida **localmente** la firma/expiracion del `access_token` (cookie, JWT HS256) para autenticar y filtrar por
  rol sin llamar siempre al microservicio de usuarios. No decide nada que necesite datos frescos de base de
  datos (por ejemplo si el usuario sigue activo) — eso lo revalida cada microservicio por su cuenta.
- Aplica rate limiting (global + uno mas estricto en `/api/v1/auth`).
- Reenvia por reverse proxy (`http-proxy-middleware`) segun `src/routes/service-registry.ts`.
- **No** es un load balancer entre replicas de un mismo servicio — eso lo resuelve Kubernetes (el Service que
  apunta al Deployment de cada microservicio). El gateway solo conoce una URL de destino por prefijo; quien
  reparte entre pods es kube-proxy, no este codigo.
- **No** refresca tokens. El flujo de refresh vive en el frontend (`gr-common-ui`, `apiFetch`) y en
  `gr-user-microservice` (`/api/v1/auth/refresh`, unico endpoint que rota el `refresh_token`). `/auth/refresh`
  esta en `publicPaths` para que el gateway no lo bloquee aunque el `access_token` ya este vencido.

## Agregar un microservicio nuevo

Una entrada mas en `src/routes/service-registry.ts`: `name`, `pathPrefixes` (uno o varios, tienen que ser
prefijos que **no** se solapen con los de otro servicio — Express hace matching por prefijo y el primero que
matchee se queda con la request, no hay fallthrough despues de un proxy), `target` (URL, desde `config/index.ts`
y una variable de entorno nueva), `publicPaths` (rutas que no requieren `access_token` valido).

**Gotcha real:** si el prefijo nuevo empieza igual que uno existente (ej. agregar `/api/v1/algo` cuando ya hay un
servicio con `/api/v1` completo), el servicio viejo intercepta todo el trafico del nuevo. Por eso
`user-microservice` NO usa `/api/v1` como prefijo generico, usa sus subrutas reales (`/api/v1/auth`,
`/api/v1/apartamentos`, `/api/v1/vigilantes`) — cada microservicio nuevo necesita su propio prefijo especifico,
nunca uno que otro ya posea como padre.

## Rate limiting en Kubernetes (si esto corre con mas de un pod)

`express-rate-limit` usa `MemoryStore` por defecto: un contador por proceso. Con 2+ replicas del gateway en k3s,
cada pod cuenta aparte — el limite configurado deja de ser exacto (hasta `limite x N` en el peor caso) y un
restart de pod resetea el contador de ese pod a cero. Si esto se replica alguna vez, el store necesita moverse a
Redis (`rate-limit-redis`) para que todas las replicas incrementen el mismo contador. Documentado aqui para que
no se asuma que el limite actual es exacto bajo mas de una replica.

## Flujo de trabajo obligatorio

- Rama por work item: `feature/GR-000-descripcion-breve` (o `fix/`, `refactor/`, `hotfix/`), creada desde
  `develop` (o `main` solo para `hotfix/`). Nunca desde otra rama de trabajo sin fusionar.
- Commits: `tipo(scope): GR-000 descripcion breve`.
- Todo cambio entra por PR. Ramas de trabajo se fusionan con squash a `develop`. Entre ramas permanentes
  (`develop -> qa -> release/* -> main`) siempre merge commit.
- Revision requerida en los rulesets: temporalmente 1 aprobacion (normalmente 2) mientras el equipo es pequeño.
  No autoaprobar el propio PR.
