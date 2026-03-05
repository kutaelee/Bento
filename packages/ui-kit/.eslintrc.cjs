module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@nimbus/ui",
            message: "모듈 경계 위반: ui-kit은 @nimbus/ui를 import할 수 없습니다 (ui -> ui-kit 단방향).",
          },
          {
            name: "@nimbus/ui/**",
            message: "모듈 경계 위반: ui-kit은 @nimbus/ui 하위 경로 import도 금지됩니다.",
          },
        ],
        patterns: [
          {
            group: ["**/packages/ui/**", "**/ui/**"],
            message: "모듈 경계 위반: ui-kit에서 ui 패키지 경로 import 금지.",
          },
        ],
      },
    ],
  },
};
