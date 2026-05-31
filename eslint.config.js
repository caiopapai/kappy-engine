// eslint.config.js
// ESLint v9 flat config.
// Plugins:
//   - eslint:recommended        → erros comuns de JS
//   - eslint-plugin-n           → boas práticas Node.js (substituto do plugin-node)
//   - eslint-plugin-security    → vulnerabilidades comuns

import js          from "@eslint/js";
import pluginN     from "eslint-plugin-n";
import pluginSec   from "eslint-plugin-security";
import globals     from "globals";

export default [
  // ── Base recomendada ────────────────────────────────────────
  js.configs.recommended,

  // ── Configuração global ─────────────────────────────────────
  {
    languageOptions: {
      ecmaVersion:  2022,
      sourceType:   "module",
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },

    plugins: {
      n:        pluginN,
      security: pluginSec,
    },

    rules: {
      // ── Erros que quase sempre são bugs ──────────────────────
      "no-console":           "warn",       // usar logger OTLP, não console
      "no-debugger":          "error",
      "no-unused-vars": ["error", {
        vars:               "all",
        args:               "after-used",
        argsIgnorePattern:  "^_",   // _next, _req, _type, _tickers, etc.
        varsIgnorePattern:  "^_",
        ignoreRestSiblings: true,
      }],
      "no-undef":             "error",
      "no-var":               "error",      // sempre const/let
      "prefer-const":         "error",
      "no-duplicate-imports": "error",

      // ── Qualidade de código ───────────────────────────────────
      "eqeqeq":               ["error", "always", { null: "ignore" }],
      "curly":                ["error", "all"],
      "no-eval":              "error",
      "no-implied-eval":      "error",
      "no-new-func":          "error",
      "no-return-await":      "error",
      "require-await":        "error",
      "no-throw-literal":     "error",
      "prefer-promise-reject-errors": "error",

      // ── Node.js (eslint-plugin-n) ─────────────────────────────
      "n/no-missing-import":  "off",        // resolvido pelo Jest moduleNameMapper
      "n/no-unpublished-import": "off",
      "n/no-unsupported-features/es-syntax": ["error", {
        version: ">=18.0.0",
        ignores: ["modules"],
      }],
      "n/prefer-global/buffer":  ["error", "always"],
      "n/prefer-global/process": ["error", "always"],
      "n/no-process-exit":       "warn",

      // ── Segurança (eslint-plugin-security) ───────────────────
      "security/detect-object-injection":           "warn",
      "security/detect-non-literal-regexp":         "warn",
      "security/detect-unsafe-regex":               "error",
      "security/detect-buffer-noassert":            "error",
      "security/detect-child-process":              "warn",
      "security/detect-disable-mustache-escape":    "error",
      "security/detect-eval-with-expression":       "error",
      "security/detect-new-buffer":                 "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-possible-timing-attacks":    "warn",
      "security/detect-pseudoRandomBytes":          "warn",

      // ── Formatação consistente ────────────────────────────────
      "semi":                    ["error", "always"],
      "quotes":                  ["error", "double", { avoidEscape: true }],
      "indent":                  ["error", 2, { SwitchCase: 1 }],
      "comma-dangle":            ["error", "always-multiline"],
      "object-curly-spacing":    ["error", "always"],
      "array-bracket-spacing":   ["error", "never"],
      "keyword-spacing":         ["error", { before: true, after: true }],
      "space-infix-ops":         "error",
      "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],
      "eol-last":                ["error", "always"],
      "no-trailing-spaces":      "error",
      "max-len":                 ["warn", {
        code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true,
      }],

      // ── Async/Await ───────────────────────────────────────────
      "no-async-promise-executor":  "error",
      "no-promise-executor-return": "error",
    },
  },

  // ── Relaxar regras nos testes ────────────────────────────────
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "no-console":     "off",
      "require-await":  "off",
      "max-len":        "off",
      "security/detect-object-injection": "off",
    },
  },

  // ── Ignorar ficheiros gerados ────────────────────────────────
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**"],
  },
];