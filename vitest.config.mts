import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    env: {
      JWT_SECRET: "test-jwt-secret-de-al-menos-32-caracteres",
    },
  },
});
