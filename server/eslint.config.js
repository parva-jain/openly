// ESLint flat config (ESLint 9). Lints TypeScript with typescript-eslint,
// and disables rules that would conflict with Prettier's formatting.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // Allow intentionally-unused args/vars prefixed with _ (e.g. the trailing
      // `_next` Express requires to recognize an error handler).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
