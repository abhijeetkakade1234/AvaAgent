import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", ".husky/**"],
  },
  js.configs.recommended,
  {
    files: [
      "src/**/*.js",
      "plugins/**/*.js",
      ".agents/**/*.js",
      "test/**/*.js",
      "eslint.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
