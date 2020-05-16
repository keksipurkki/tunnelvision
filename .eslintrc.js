const common = {
  "no-console": "off",
  "semi": "error",
};

const jsRules = {
  ...common
};

const tsRules = {
  ...common
};

module.exports = {
  root: true,
  overrides: [
    {
      files: ["*.js", "**/*.js"],
      env: {
        es6: true,
        node: true,
      },
      parser: "espree",
      parserOptions: {
        sourceType: "script",
        ecmaVersion: 2018,
      },
      rules: jsRules,
    },
    {
      files: "**/*.ts",
      parser: "@typescript-eslint/parser",
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2018
      },
      rules: tsRules
    },
    {
      files: ["public_html/**/*"],
      env: {
        browser: true
      }
    }
  ],
};
