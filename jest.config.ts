// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts','js','json'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  setupFiles: ['dotenv/config']  // si quieres cargar .env.test automáticamente
};

export default config;
