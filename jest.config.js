module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 99,
      lines: 95,
      statements: 95
    }
  },
  testTimeout: 10000,
  verbose: true,
  transform: {
    '^.+\.ts$': ['ts-jest', {
      tsconfig: 'tests/tsconfig.json'
    }]
  }
};