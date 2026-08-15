import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // We intentionally reset list state to null to show a spinner on refetch.
      // Deps are refresh keys/sort, never the reset state itself, so there is no
      // cascading-render risk this rule guards against.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Дизайн-референсы (HTML-прототипы), не production-код.
    "design_handoff_luma_redesign/**",
    "lib/generated/**",
  ]),
]);

export default eslintConfig;
