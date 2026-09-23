import config from "../config";

export interface ServiceRoute {
  name: string;
  pathPrefixes: string[];
  target: string;
  publicPaths: string[];
}

const serviceRegistry: ServiceRoute[] = [
  {
    name: "user-microservice",
    pathPrefixes: ["/api/v1/auth", "/api/v1/apartamentos", "/api/v1/vigilantes"],
    target: config.userServiceUrl,
    publicPaths: [
      "/api/v1/auth/csrf",
      "/api/v1/auth/login",
      "/api/v1/auth/refresh",
      "/api/v1/auth/logout",
      "/api/v1/auth/password-reset",
      "/api/v1/auth/password-reset/confirm",
      "/api/v1/auth/admin-sso/exchange",
    ],
  },
  {
    name: "wall-microservice",
    pathPrefixes: ["/api/v1/publicaciones"],
    target: config.wallServiceUrl,
    publicPaths: [],
  },
];

export default serviceRegistry;
