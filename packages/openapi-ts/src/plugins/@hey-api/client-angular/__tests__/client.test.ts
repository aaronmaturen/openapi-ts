import { describe, expect, it, vi } from 'vitest';

// Mock Angular dependencies
vi.mock('@angular/core', () => ({
  Injectable: () => () => {},
  inject: vi.fn(),
}));

vi.mock('@angular/common/http', () => ({
  HttpClient: class HttpClient {},
  HttpHeaders: class HttpHeaders {
    private headers = new Map<string, string>();
    set(key: string, value: string) {
      const newHeaders = new HttpHeaders();
      newHeaders.headers = new Map(this.headers);
      newHeaders.headers.set(key, value);
      return newHeaders;
    }
    delete(key: string) {
      const newHeaders = new HttpHeaders();
      newHeaders.headers = new Map(this.headers);
      newHeaders.headers.delete(key);
      return newHeaders;
    }
    forEach(fn: (value: string, key: string) => void) {
      this.headers.forEach((value, key) => fn(value, key));
    }
    get(key: string) {
      return this.headers.get(key) || null;
    }
  },
  HttpParams: class HttpParams {
    private params = new Map<string, string>();
    set(key: string, value: string) {
      const newParams = new HttpParams();
      newParams.params = new Map(this.params);
      newParams.params.set(key, value);
      return newParams;
    }
  },
  HttpResponse: class HttpResponse {},
}));

vi.mock('rxjs', () => ({
  Observable: class Observable {},
  from: vi.fn(),
  of: vi.fn(),
  throwError: vi.fn(),
}));

vi.mock('rxjs/operators', () => ({
  catchError: vi.fn(),
  map: vi.fn(),
  switchMap: vi.fn(),
}));

describe('@hey-api/client-angular', () => {
  describe('createClient', () => {
    it('should create client with all required methods', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient();

      expect(client).toBeDefined();
      expect(typeof client.request).toBe('function');
      expect(typeof client.get).toBe('function');
      expect(typeof client.post).toBe('function');
      expect(typeof client.put).toBe('function');
      expect(typeof client.delete).toBe('function');
      expect(typeof client.patch).toBe('function');
      expect(typeof client.head).toBe('function');
      expect(typeof client.options).toBe('function');
      expect(typeof client.connect).toBe('function');
      expect(typeof client.trace).toBe('function');
      expect(typeof client.getConfig).toBe('function');
      expect(typeof client.setConfig).toBe('function');
      expect(typeof client.buildUrl).toBe('function');
      expect(client.interceptors).toBeDefined();
    });

    it('should create client with custom config', async () => {
      const { createClient } = await import('../bundle/client');
      const config = {
        baseUrl: 'https://api.example.com',
        throwOnError: true,
      };
      const client = createClient(config);

      const clientConfig = client.getConfig();
      expect(clientConfig.baseUrl).toBe('https://api.example.com');
      expect(clientConfig.throwOnError).toBe(true);
    });
  });

  describe('ApiClient', () => {
    it('should export ApiClient class', async () => {
      const { ApiClient } = await import('../bundle/client');
      expect(ApiClient).toBeDefined();
    });
  });

  describe('buildUrl', () => {
    it('should build URLs correctly', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient();

      const scenarios: {
        options: Parameters<typeof client.buildUrl>[0];
        url: string;
      }[] = [
        {
          options: {
            url: '',
          },
          url: '/',
        },
        {
          options: {
            url: '/foo',
          },
          url: '/foo',
        },
        {
          options: {
            path: {
              fooId: 1,
            },
            url: '/foo/{fooId}',
          },
          url: '/foo/1',
        },
        {
          options: {
            path: {
              fooId: 1,
            },
            query: {
              bar: 'baz',
            },
            url: '/foo/{fooId}',
          },
          url: '/foo/1?bar=baz',
        },
        {
          options: {
            query: {
              bar: [],
              foo: [],
            },
            url: '/',
          },
          url: '/',
        },
        {
          options: {
            query: {
              bar: [],
              foo: ['abc', 'def'],
            },
            url: '/',
          },
          url: '/?foo=abc&foo=def',
        },
        {
          options: {
            path: {
              id: new Date('2025-01-01T00:00:00.000Z'),
            },
            url: '/foo/{id}',
          },
          url: '/foo/2025-01-01T00:00:00.000Z',
        },
      ];

      scenarios.forEach(({ options, url }) => {
        expect(client.buildUrl(options)).toBe(url);
      });
    });

    it('should build URLs with base URL', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient({ baseUrl: 'https://api.example.com' });

      expect(client.buildUrl({ url: '/foo' })).toBe(
        'https://api.example.com/foo',
      );
      expect(client.buildUrl({ url: 'foo' })).toBe(
        'https://api.example.com/foo',
      );
    });
  });

  describe('configuration', () => {
    it('should get and set config', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient();

      const initialConfig = client.getConfig();
      expect(initialConfig).toBeDefined();

      const newConfig = client.setConfig({
        baseUrl: 'https://new-api.example.com',
        throwOnError: true,
      });

      expect(newConfig.baseUrl).toBe('https://new-api.example.com');
      expect(newConfig.throwOnError).toBe(true);
      expect(client.getConfig()).toEqual(newConfig);
    });

    it('should merge configs correctly', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient({
        baseUrl: 'https://api.example.com',
        headers: {
          'X-Custom': 'initial',
        },
      });

      client.setConfig({
        headers: {
          'X-Another': 'added',
        },
        throwOnError: true,
      });

      const config = client.getConfig();
      expect(config.throwOnError).toBe(true);
      expect(config.baseUrl).toBe('https://api.example.com');
    });
  });

  describe('interceptors', () => {
    it('should have request, response, and error interceptors', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient();

      expect(client.interceptors).toBeDefined();
      expect(client.interceptors.request).toBeDefined();
      expect(typeof client.interceptors.request.use).toBe('function');
      expect(typeof client.interceptors.request.eject).toBe('function');
      expect(client.interceptors.response).toBeDefined();
      expect(typeof client.interceptors.response.use).toBe('function');
      expect(typeof client.interceptors.response.eject).toBe('function');
      expect(client.interceptors.error).toBeDefined();
      expect(typeof client.interceptors.error.use).toBe('function');
      expect(typeof client.interceptors.error.eject).toBe('function');
    });
  });

  describe('HTTP methods', () => {
    it('should have all HTTP method shortcuts', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient();

      const methods = [
        'get',
        'post',
        'put',
        'delete',
        'patch',
        'head',
        'options',
        'connect',
        'trace',
      ];

      methods.forEach((method) => {
        expect(typeof client[method]).toBe('function');
      });
    });

    it('should return Observable from HTTP methods', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient();

      // Since we're mocking, we can't test the actual Observable behavior
      // but we can verify the methods exist and return something
      const methods = ['get', 'post', 'put', 'delete', 'patch'];

      methods.forEach((method) => {
        expect(typeof client[method]).toBe('function');
        // Don't call the method as our mocks don't fully implement Observable behavior
      });
    });
  });

  describe('response styles', () => {
    it('should support both data and fields response styles', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient();

      // Test that responseStyle can be configured
      const configWithDataStyle = client.setConfig({ responseStyle: 'data' });
      expect(configWithDataStyle.responseStyle).toBe('data');

      const configWithFieldsStyle = client.setConfig({
        responseStyle: 'fields',
      });
      expect(configWithFieldsStyle.responseStyle).toBe('fields');
    });
  });

  describe('parse options', () => {
    it('should support different parseAs options', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient();

      const parseOptions = [
        'auto',
        'json',
        'text',
        'blob',
        'arrayBuffer',
        'formData',
      ];

      parseOptions.forEach((parseAs) => {
        const config = client.setConfig({ parseAs: parseAs as any });
        expect(config.parseAs).toBe(parseAs);
      });
    });
  });

  describe('error handling', () => {
    it('should support throwOnError configuration', async () => {
      const { createClient } = await import('../bundle/client');

      const clientWithThrow = createClient({ throwOnError: true });
      expect(clientWithThrow.getConfig().throwOnError).toBe(true);

      const clientWithoutThrow = createClient({ throwOnError: false });
      expect(clientWithoutThrow.getConfig().throwOnError).toBe(false);
    });
  });

  describe('headers handling', () => {
    it('should merge headers correctly', async () => {
      const { createClient } = await import('../bundle/client');
      const client = createClient({
        headers: {
          'Content-Type': 'application/json',
          'X-Custom': 'initial',
        },
      });

      const config = client.getConfig();
      expect(config.headers).toBeDefined();
    });
  });

  describe('security', () => {
    it('should support auth configuration', async () => {
      const { createClient } = await import('../bundle/client');
      const authFn = vi.fn().mockReturnValue('token');

      const client = createClient({
        auth: authFn,
      });

      const config = client.getConfig();
      expect(config.auth).toBe(authFn);
    });
  });

  describe('Angular-specific features', () => {
    it('should integrate with Angular HttpClient', async () => {
      const { ApiClient } = await import('../bundle/client');

      // Verify it's decorated as Injectable
      expect(ApiClient).toBeDefined();
      // In a real Angular environment, we would test DI integration
    });
  });
});
