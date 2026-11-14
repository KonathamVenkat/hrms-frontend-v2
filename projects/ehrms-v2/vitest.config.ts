import { defineConfig } from 'vitest/config';

// Many component specs compile their template on first use, which takes longer than Vitest's
// default 5 s when the machine is busy; a slower limit stops those runs failing on timing alone.
export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
