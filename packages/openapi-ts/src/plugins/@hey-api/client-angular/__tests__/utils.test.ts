import { describe, expect, it, vi } from 'vitest';

import type { Auth } from '../../client-core/bundle/auth';
import type { Client } from '../bundle/types';
import {
  buildUrl,
  createInterceptors,
  getParseAs,
  mergeConfigs,
  mergeHeaders,
  setAuthParams,
} from '../bundle/utils';

describe('buildUrl', () => {
  const scenarios: Array<{
    options: Parameters<Client['buildUrl']>[0];
    url: string;
  }> = [
    {
      options: {
        path: {
          id: new Date('2025-01-01T00:00:00.000Z'),
        },
        url: '/foo/{id}',
      },
      url: '/foo/2025-01-01T00:00:00.000Z',
    },
    {
      options: {
        path: {
          id: 123,
          name: 'test',
        },
        url: '/users/{id}/items/{name}',
      },
      url: '/users/123/items/test',
    },
    {
      options: {
        path: {
          id: 'special/chars',
        },
        url: '/foo/{id}',
      },
      url: '/foo/special%2Fchars',
    },
    {
      options: {
        query: {
          filter: 'active',
          sort: 'name',
        },
        url: '/items',
      },
      url: '/items?filter=active&sort=name',
    },
    {
      options: {
        query: {
          ids: [1, 2, 3],
        },
        url: '/items',
      },
      url: '/items?ids=1&ids=2&ids=3',
    },
    {
      options: {
        baseUrl: 'https://api.example.com',
        url: '/items',
      },
      url: 'https://api.example.com/items',
    },
    {
      options: {
        baseUrl: 'https://api.example.com/',
        url: '/items',
      },
      url: 'https://api.example.com/items',
    },
  ];

  it.each(scenarios)('builds $url', async ({ options, url }) => {
    expect(buildUrl(options)).toEqual(url);
  });
});

describe('getParseAs', () => {
  const scenarios: Array<{
    content: Parameters<typeof getParseAs>[0];
    parseAs: ReturnType<typeof getParseAs>;
  }> = [
    {
      content: null,
      parseAs: 'json',
    },
    {
      content: 'application/json',
      parseAs: 'json',
    },
    {
      content: 'application/ld+json',
      parseAs: 'json',
    },
    {
      content: 'application/ld+json;charset=utf-8',
      parseAs: 'json',
    },
    {
      content: 'application/ld+json; charset=utf-8',
      parseAs: 'json',
    },
    {
      content: 'multipart/form-data',
      parseAs: 'formData',
    },
    {
      content: 'application/pdf',
      parseAs: 'blob',
    },
    {
      content: 'audio/mp3',
      parseAs: 'blob',
    },
    {
      content: 'image/png',
      parseAs: 'blob',
    },
    {
      content: 'video/mp4',
      parseAs: 'blob',
    },
    {
      content: 'text/html',
      parseAs: 'text',
    },
    {
      content: 'text/plain',
      parseAs: 'text',
    },
    {
      content: 'unsupported',
      parseAs: 'json',
    },
  ];

  it.each(scenarios)(
    'detects $content as $parseAs',
    async ({ content, parseAs }) => {
      expect(getParseAs(content)).toEqual(parseAs);
    },
  );
});

describe('setAuthParams', () => {
  it('sets bearer token in headers', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBe('Bearer foo');
    expect(Object.keys(query).length).toBe(0);
  });

  it('sets access token in query', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          in: 'query',
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBeNull();
    expect(query.baz).toBe('Bearer foo');
  });

  it('sets Authorization header when `in` and `name` are undefined', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('Authorization')).toBe('foo');
    expect(query).toEqual({});
  });

  it('sets first scheme only', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
        {
          in: 'query',
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBe('Bearer foo');
    expect(Object.keys(query).length).toBe(0);
  });

  it('sets first scheme with token', async () => {
    const auth = vi.fn().mockImplementation((auth: Auth) => {
      if (auth.type === 'apiKey') {
        return;
      }
      return 'foo';
    });
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          name: 'baz',
          type: 'apiKey',
        },
        {
          in: 'query',
          name: 'baz',
          scheme: 'bearer',
          type: 'http',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('baz')).toBeNull();
    expect(query.baz).toBe('Bearer foo');
  });

  it('sets an API key in a cookie', async () => {
    const auth = vi.fn().mockReturnValue('foo');
    const headers = new Headers();
    const query: Record<any, unknown> = {};
    await setAuthParams({
      auth,
      headers,
      query,
      security: [
        {
          in: 'cookie',
          name: 'baz',
          type: 'apiKey',
        },
      ],
    });
    expect(auth).toHaveBeenCalled();
    expect(headers.get('Cookie')).toBe('baz=foo');
    expect(query).toEqual({});
  });
});

describe('mergeHeaders', () => {
  it('merges headers correctly', () => {
    const headers1 = new Headers({ 'X-Custom': 'value1' });
    const headers2 = { 'X-Another': 'value2' };
    const headers3 = new Headers({ 'X-Third': 'value3' });

    const merged = mergeHeaders(headers1, headers2, headers3);

    expect(merged.get('X-Custom')).toBe('value1');
    expect(merged.get('X-Another')).toBe('value2');
    expect(merged.get('X-Third')).toBe('value3');
  });

  it('overwrites duplicate headers', () => {
    const headers1 = new Headers({ 'X-Custom': 'value1' });
    const headers2 = { 'X-Custom': 'value2' };

    const merged = mergeHeaders(headers1, headers2);

    expect(merged.get('X-Custom')).toBe('value2');
  });

  it('removes headers with null value', () => {
    const headers1 = new Headers({ 'X-Custom': 'value1' });
    const headers2 = { 'X-Custom': null };

    const merged = mergeHeaders(headers1, headers2);

    expect(merged.get('X-Custom')).toBeNull();
  });

  it('handles array values', () => {
    const headers = { 'X-Custom': ['value1', 'value2'] };

    const merged = mergeHeaders(headers);

    // Headers API concatenates multiple values with append
    expect(merged.get('X-Custom')).toBe('value1, value2');
  });

  it('stringifies object values', () => {
    const headers = { 'X-Custom': { foo: 'bar' } };

    const merged = mergeHeaders(headers);

    expect(merged.get('X-Custom')).toBe('{"foo":"bar"}');
  });

  it('handles undefined headers', () => {
    const headers1 = new Headers({ 'X-Custom': 'value1' });
    const merged = mergeHeaders(headers1, undefined);

    expect(merged.get('X-Custom')).toBe('value1');
  });
});

describe('mergeConfigs', () => {
  it('merges configs correctly', () => {
    const config1 = {
      baseUrl: 'https://api.example.com',
      headers: new Headers({ 'X-Custom': 'value1' }),
    };
    const config2 = {
      headers: { 'X-Another': 'value2' },
      throwOnError: true,
    };

    const merged = mergeConfigs(config1, config2);

    expect(merged.baseUrl).toBe('https://api.example.com');
    expect(merged.throwOnError).toBe(true);
    expect(merged.headers.get('X-Custom')).toBe('value1');
    expect(merged.headers.get('X-Another')).toBe('value2');
  });

  it('removes trailing slash from baseUrl', () => {
    const config1 = { baseUrl: 'https://api.example.com/' };
    const config2 = {};

    const merged = mergeConfigs(config1, config2);

    expect(merged.baseUrl).toBe('https://api.example.com');
  });
});

describe('createInterceptors', () => {
  it('creates interceptor objects', () => {
    const interceptors = createInterceptors();

    expect(interceptors.request).toBeDefined();
    expect(interceptors.response).toBeDefined();
    expect(interceptors.error).toBeDefined();
  });

  it('allows adding and using interceptors', () => {
    const interceptors = createInterceptors();
    const requestFn = vi.fn();
    const responseFn = vi.fn();
    const errorFn = vi.fn();

    const requestId = interceptors.request.use(requestFn);
    const responseId = interceptors.response.use(responseFn);
    const errorId = interceptors.error.use(errorFn);

    expect(typeof requestId).toBe('number');
    expect(typeof responseId).toBe('number');
    expect(typeof errorId).toBe('number');

    // Test internal _fns array
    expect(interceptors.request._fns).toContain(requestFn);
    expect(interceptors.response._fns).toContain(responseFn);
    expect(interceptors.error._fns).toContain(errorFn);
  });

  it('allows ejecting interceptors', () => {
    const interceptors = createInterceptors();
    const requestFn = vi.fn();

    const id = interceptors.request.use(requestFn);
    interceptors.request.eject(id);

    // The function should be set to null, not removed
    expect(interceptors.request._fns[id]).toBe(null);
  });
});
