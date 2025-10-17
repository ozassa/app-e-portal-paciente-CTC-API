module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/server.ts',
    '!src/scripts/**',
    '!src/prisma/seed.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 15000,
  maxWorkers: 1,
};