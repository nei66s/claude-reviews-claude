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
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
    {
      name: "agent-ts",
      cwd: path.join(__dirname, "agent-ts"),
      script: "npm",
      args: "start",
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3001",
      },
    },
  ],
};
