import { defineConfig } from 'vitest/config';

// Times are formatted with the device's local clock, as on a phone in Singapore.
// Pin it so tests pass on CI (UTC) and anywhere else.
process.env.TZ = 'Asia/Singapore';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
