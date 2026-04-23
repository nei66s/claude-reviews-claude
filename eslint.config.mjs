import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      ".chocks-local/**",
      "agent-ts/**",
      "prototype-ts/**",
      "chokito-next/**",
      "obsidian-vault/**",
      "Old/**",
      "nova-pasta/**",
      "scripts/**",
      "scratch/**",
      "**/scratch/**",
      "**/scripts/**",
      "src-tauri/**",
      "**/*.demo.ts",
      "**/*.test.ts",
      "app/lib/server/memory/**",
      "app/lib/agent/swarm/**",
      "app/lib/agent/coordination/**",
      "app/lib/server/psychological-profile/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn"
    }
  }
]);
