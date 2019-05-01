module.exports = {
  env: {
    commonjs: true,
    browser: false,
    es6: true,
    node: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'no-console': 0,
    'max-len': [2, { code: 160, tabWidth: 2, ignoreUrls: true, ignoreStrings: true }],
  },
};
