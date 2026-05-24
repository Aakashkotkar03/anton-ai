module.exports = {
  root: true,

  env: {
    browser: true,
    node: true,
    es2022: true,
    jest: true,
  },

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },

  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],

  plugins: ['react', 'react-hooks'],

  settings: {
    react: {
      version: 'detect',
    },
  },

  rules: {
    // --- Security (RULE 3) ---
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // --- Code quality ---
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],

    // --- React ---
    'react/prop-types': 'off',
    'react/jsx-no-target-blank': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },

  overrides: [
    {
      // Electron main process files — Node.js environment, no React
      files: ['electron/**/*.js'],
      env: {
        browser: false,
        node: true,
      },
      rules: {
        'no-console': 'off',
      },
    },
  ],

  ignorePatterns: ['dist/', 'release/', 'engines/', 'node_modules/'],
};
