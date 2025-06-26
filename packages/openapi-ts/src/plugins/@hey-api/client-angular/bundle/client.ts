import type { HttpResponse } from '@angular/common/http';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { from, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import type {
  Client,
  Config,
  RequestOptions,
  RequestResult,
  ResponseStyle,
} from './types';
import {
  buildUrl,
  createConfig,
  createInterceptors,
  mergeConfigs,
  mergeHeaders,
  setAuthParams,
} from './utils';

@Injectable({
  providedIn: 'root',
})
export class ApiClient implements Client {
  private readonly http = inject(HttpClient);
  private _config: Config;
  private interceptors = createInterceptors<
    RequestOptions,
    HttpResponse<any>,
    unknown,
    RequestOptions
  >();

  constructor(config: Config = {}) {
    this._config = mergeConfigs(createConfig(), config);
  }

  getConfig(): Config {
    return { ...this._config };
  }

  setConfig(config: Config): Config {
    this._config = mergeConfigs(this._config, config);
    return this.getConfig();
  }

  buildUrl<
    TData extends {
      body?: unknown;
      path?: Record<string, unknown>;
      query?: Record<string, unknown>;
      url: string;
    },
  >(options: Pick<TData, 'url'> & Partial<TData>): string {
    return buildUrl({ ...this._config, ...options });
  }

  private async prepareRequest(options: RequestOptions): Promise<{
    body?: any;
    headers: HttpHeaders;
    options: any;
    params: HttpParams;
    url: string;
  }> {
    const opts = {
      ...this._config,
      ...options,
      headers: mergeHeaders(this._config.headers, options.headers),
    };

    if (opts.security) {
      await setAuthParams({
        ...opts,
        security: opts.security,
      });
    }

    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }

    let body = opts.body;
    if (body && opts.bodySerializer) {
      body = opts.bodySerializer(body);
    }

    // Convert headers to Angular HttpHeaders
    let httpHeaders = new HttpHeaders();
    opts.headers.forEach((value, key) => {
      httpHeaders = httpHeaders.set(key, value);
    });

    // Remove Content-Type header if body is empty
    if (body === undefined || body === '') {
      httpHeaders = httpHeaders.delete('Content-Type');
    }

    // Build URL with path parameters
    const url = buildUrl(opts);

    // Convert query parameters to Angular HttpParams
    let httpParams = new HttpParams();
    if (opts.query) {
      Object.entries(opts.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }

    return {
      body,
      headers: httpHeaders,
      options: opts,
      params: httpParams,
      url,
    };
  }

  request<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'> &
      Pick<Required<RequestOptions<TResponseStyle, ThrowOnError>>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return from(this.prepareRequest(options)).pipe(
      switchMap(async ({ body, headers, options: opts, params, url }) => {
        // Apply request interceptors
        let interceptedRequest = opts;
        for (const fn of this.interceptors.request._fns) {
          if (fn) {
            interceptedRequest = await fn(interceptedRequest, opts);
          }
        }

        const httpOptions = {
          headers,
          observe: 'response' as const,
          params,
          responseType: this.getResponseType(opts.parseAs) as any,
        };

        // Make the HTTP request
        return this.http
          .request(opts.method!, url, {
            ...httpOptions,
            body,
          })
          .pipe(
            switchMap(async (response: HttpResponse<any>) => {
              // Apply response interceptors
              let interceptedResponse = response;
              for (const fn of this.interceptors.response._fns) {
                if (fn) {
                  interceptedResponse = await fn(
                    interceptedResponse,
                    interceptedRequest,
                    opts,
                  );
                }
              }

              const result = {
                request: interceptedRequest,
                response: interceptedResponse,
              };

              if (interceptedResponse.ok) {
                if (
                  interceptedResponse.status === 204 ||
                  interceptedResponse.headers.get('Content-Length') === '0'
                ) {
                  return opts.responseStyle === 'data'
                    ? {}
                    : {
                        data: {},
                        ...result,
                      };
                }

                let data = interceptedResponse.body;

                if (opts.parseAs === 'json') {
                  if (opts.responseValidator) {
                    await opts.responseValidator(data);
                  }

                  if (opts.responseTransformer) {
                    data = await opts.responseTransformer(data);
                  }
                }

                return opts.responseStyle === 'data'
                  ? data
                  : {
                      data,
                      ...result,
                    };
              }

              // Handle error response
              const error =
                interceptedResponse.body || interceptedResponse.statusText;
              throw error;
            }),
            catchError(async (error) => {
              // Apply error interceptors
              let finalError = error;
              for (const fn of this.interceptors.error._fns) {
                if (fn) {
                  finalError = await fn(error, error, interceptedRequest, opts);
                }
              }

              finalError = finalError || {};

              if (opts.throwOnError) {
                return throwError(() => finalError);
              }

              return of(
                opts.responseStyle === 'data'
                  ? undefined
                  : {
                      error: finalError,
                      request: interceptedRequest,
                      response: error,
                    },
              );
            }),
          );
      }),
    );
  }

  private getResponseType(parseAs?: string): string {
    switch (parseAs) {
      case 'arrayBuffer':
        return 'arraybuffer';
      case 'blob':
        return 'blob';
      case 'text':
        return 'text';
      case 'json':
      case 'auto':
      default:
        return 'json';
    }
  }

  // HTTP method shortcuts
  connect<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'CONNECT',
    });
  }

  delete<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'DELETE',
    });
  }

  get<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'GET',
    });
  }

  head<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'HEAD',
    });
  }

  options<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'OPTIONS',
    });
  }

  patch<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'PATCH',
    });
  }

  post<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'POST',
    });
  }

  put<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'PUT',
    });
  }

  trace<
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = 'fields',
  >(
    options: Omit<RequestOptions<TResponseStyle, ThrowOnError>, 'method'>,
  ): RequestResult<TData, TError, ThrowOnError, TResponseStyle> {
    return this.request<TData, TError, ThrowOnError, TResponseStyle>({
      ...options,
      method: 'TRACE',
    });
  }
}

// Factory function for compatibility with generated code
export const createClient = (config: Config = {}): Client => {
  const client = new ApiClient(config);

  // Create client object with proper interface
  return {
    buildUrl: client.buildUrl.bind(client),
    connect: client.connect.bind(client),
    delete: client.delete.bind(client),
    get: client.get.bind(client),
    getConfig: client.getConfig.bind(client),
    head: client.head.bind(client),
    interceptors: client.interceptors,
    options: client.options.bind(client),
    patch: client.patch.bind(client),
    post: client.post.bind(client),
    put: client.put.bind(client),
    request: client.request.bind(client),
    setConfig: client.setConfig.bind(client),
    trace: client.trace.bind(client),
  };
};
