/** @type {import('jest').Config} */
module.exports = {
  rootDir: '../..',
  testMatch: ['<rootDir>/test/e2e/**/*.spec.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
  testTimeout: 120000,
  maxWorkers: 1,
};
