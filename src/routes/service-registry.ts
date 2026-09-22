import config from "../config";

export interface ServiceRoute {
  name: string;
  pathPrefix: string;
  target: string;
  publicPaths: string[];
}

const serviceRegistry: ServiceRoute[] = [
  {
    name: "user-microservice",
    pathPrefix: "/api/v1",
    target: config.userServiceUrl,
    publicPaths: [
      "/api/v1/auth/login",
      "/api/v1/auth/refresh",
      "/api/v1/auth/logout",
      "/api/v1/auth/password-reset",
      "/api/v1/auth/password-reset/confirm",
    ],
  },
];

export default serviceRegistry;
