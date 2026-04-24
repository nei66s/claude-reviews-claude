/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "app",
      cwd: __dirname,
      script: "npm",
      args: "start",
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        BACKEND_URL: "http://127.0.0.1:3000",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
        BACKEND_URL: "http://127.0.0.1:3000",
      },
    },
    {
      name: "room-worker",
      cwd: __dirname,
      script: "node",
      args: "room-worker.mjs",
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
