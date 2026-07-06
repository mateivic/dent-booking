import { defineConfig } from "@playwright/test";

export default defineConfig({
  use: {
    baseURL: "http://mendident.lvh.me:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  timeout: 60_000,
  reporter: "list",
});
