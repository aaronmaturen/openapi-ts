import { describe, expect, it } from 'vitest';

import { defaultConfig } from '../config';

describe('@hey-api/client-angular', () => {
  it('should have correct default configuration', () => {
    expect(defaultConfig.name).toBe('@hey-api/client-angular');
    expect(defaultConfig.output).toBe('client');
    expect(defaultConfig.dependencies).toContain('@hey-api/typescript');
    expect(defaultConfig.config.bundle).toBe(true);
    expect(defaultConfig.config.throwOnError).toBe(false);
  });

  it('should have client tag', () => {
    expect(defaultConfig.tags).toContain('client');
  });

  it('should have a handler function', () => {
    expect(typeof defaultConfig.handler).toBe('function');
  });
});
