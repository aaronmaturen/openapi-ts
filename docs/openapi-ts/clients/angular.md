---
title: Angular client
description: Angular client for Hey API. Compatible with all our features.
---

<script setup>
import { embedProject } from '../../embed'
</script>

# Angular

::: warning
Angular client is currently in beta. The interface might change before it becomes stable. We encourage you to leave feedback on [GitHub](https://github.com/hey-api/openapi-ts/issues).
:::

### About

The Angular client leverages [Angular's HttpClient](https://angular.io/api/common/http/HttpClient) and [RxJS](https://rxjs.dev/) to provide a reactive, type-safe HTTP client for Angular applications. It integrates seamlessly with Angular's dependency injection system and supports all modern Angular features.

### Demo

<button class="buttonLink" @click="(event) => embedProject('hey-api-client-angular-example')(event)">
Launch demo
</button>

## Features

- seamless integration with `@hey-api/openapi-ts` ecosystem
- type-safe response data and errors
- response data validation and transformation
- native Angular dependency injection support
- RxJS Observable return types
- full Angular HttpClient integration
- support for Angular interceptors
- minimal learning curve for Angular developers
- support bundling inside the generated output

## Installation

In your [configuration](/openapi-ts/get-started), add `@hey-api/client-angular` to your plugins and you'll be ready to generate client artifacts. :tada:

::: code-group

```js [config]
export default {
  input: 'https://get.heyapi.dev/hey-api/backend',
  output: 'src/client',
  plugins: ['@hey-api/client-angular'], // [!code ++]
};
```

```sh [cli]
npx @hey-api/openapi-ts \
  -i https://get.heyapi.dev/hey-api/backend \
  -o src/client \
  -c @hey-api/client-angular # [!code ++]
```

:::

## Configuration

The Angular client is built as a thin wrapper on top of Angular's HttpClient, extending its functionality to work with Hey API. If you're already familiar with Angular, configuring your client will feel like working directly with Angular services.

When we installed the client above, it created a [`client.gen.ts`](/openapi-ts/output#client) file. You will most likely want to configure the exported `client` instance. There are two ways to do that.

### `setConfig()`

This is the simpler approach. You can call the `setConfig()` method at the beginning of your application or anytime you need to update the client configuration. You can pass any configuration option to `setConfig()`.

```js
import { client } from 'client/client.gen';

client.setConfig({
  baseUrl: 'https://example.com',
});
```

The disadvantage of this approach is that your code may call the `client` instance before it's configured for the first time. Depending on your use case, you might need to use the second approach.

### Runtime API

Since `client.gen.ts` is a generated file, we can't directly modify it. Instead, we can tell our configuration to use a custom file implementing the Runtime API. We do that by specifying the `runtimeConfigPath` option.

```js
export default {
  input: 'https://get.heyapi.dev/hey-api/backend',
  output: 'src/client',
  plugins: [
    {
      name: '@hey-api/client-angular',
      runtimeConfigPath: './src/hey-api.ts', // [!code ++]
    },
  ],
};
```

In our custom file, we need to export a `createClientConfig()` method. This function is a simple wrapper allowing us to override configuration values.

::: code-group

```ts [hey-api.ts]
import type { CreateClientConfig } from './client/client.gen';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: 'https://example.com',
});
```

:::

With this approach, `client.gen.ts` will call `createClientConfig()` before initializing the `client` instance. If needed, you can still use `setConfig()` to update the client configuration later.

### Angular Dependency Injection

The generated `ApiClient` is an Injectable service that can be provided and injected throughout your Angular application:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ApiClient } from './client/client.gen';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    ApiClient, // Provide the generated client
  ],
};
```

Then inject it in your components or services:

```ts
import { Component, inject } from '@angular/core';
import { ApiClient } from './client/client.gen';

@Component({
  selector: 'app-users',
  template: `...`,
})
export class UsersComponent {
  private apiClient = inject(ApiClient);

  users$ = this.apiClient.get<User[], ApiError>({ url: '/users' });
}
```

### `createClient()`

You can also create your own client instance. You can use it to manually send requests or point it to a different domain.

```js
import { createClient } from './client/client';

const myClient = createClient({
  baseUrl: 'https://example.com',
});
```

You can also pass this instance to any SDK function through the `client` option. This will override the default instance from `client.gen.ts`.

```js
const response = await getFoo({
  client: myClient,
});
```

### SDKs

Alternatively, you can pass the client configuration options to each SDK function. This is useful if you don't want to create a client instance for one-off use cases.

```js
const response = await getFoo({
  baseUrl: 'https://example.com', // override default configuration
});
```

## Interceptors

The Angular client supports both Angular's native HTTP interceptors and custom interceptors.

### Angular HTTP Interceptors

You can use Angular's standard HTTP interceptors with the client:

```ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authToken = inject(AuthService).getToken();

  if (authToken) {
    req = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${authToken}`),
    });
  }

  return next(req);
};

// In your app configuration
import { provideHttpClient, withInterceptors } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))],
};
```

### Custom Interceptors

The client also provides its own interceptor system for request, response, and error handling:

::: code-group

```js [request]
import { client } from 'client/client.gen';

client.interceptors.request.use(async (request, options) => {
  // Modify the request before it's sent
  options.headers = {
    ...options.headers,
    'X-Custom-Header': 'value',
  };
  return request;
});
```

```js [response]
import { client } from 'client/client.gen';

client.interceptors.response.use(async (response, request, options) => {
  // Process the response
  console.log('Response received:', response);
  return response;
});
```

```js [error]
import { client } from 'client/client.gen';

client.interceptors.error.use(async (error, response, request, options) => {
  if (response.status === 401) {
    // Handle unauthorized error
    // e.g., redirect to login or refresh token
  }
  return error;
});
```

:::

## Auth

The SDKs include auth mechanisms for every endpoint. You will want to configure the `auth` field to pass the right token for each request. The `auth` field can be a string or a function returning a string or Promise&lt;string&gt; representing the token. The returned value will be attached only to requests that require auth.

```js
import { client } from 'client/client.gen';

client.setConfig({
  auth: async () => {
    // Can be async for token refresh scenarios
    const token = await getAuthToken();
    return token;
  },
  baseUrl: 'https://example.com',
});
```

If you're not using SDKs or generating auth, using Angular HTTP interceptors is the recommended approach for configuring auth for each request.

## Build URL

If you need to access the compiled URL, you can use the `buildUrl()` method. It's loosely typed by default to accept almost any value; in practice, you will want to pass a type hint.

```ts
type FooData = {
  path: {
    fooId: number;
  };
  query?: {
    bar?: string;
  };
  url: '/foo/{fooId}';
};

const url = client.buildUrl<FooData>({
  path: {
    fooId: 1,
  },
  query: {
    bar: 'baz',
  },
  url: '/foo/{fooId}',
});
console.log(url); // prints '/foo/1?bar=baz'
```

## Type-Safe Requests

All HTTP methods accept generic type parameters for response data (`TData`) and error types (`TError`):

```ts
// Type-safe request with explicit types
const users$ = client.get<User[], ApiError>({
  url: '/users',
});

// The Observable will emit data with the correct types
users$.subscribe({
  next: (response) => {
    // response.data is typed as User[]
    console.log(response.data);
  },
  error: (response) => {
    // response.error is typed as ApiError
    console.error(response.error);
  },
});
```

## RxJS Integration

All methods return RxJS Observables, allowing you to leverage the full power of reactive programming:

```ts
import { Component } from '@angular/core';
import { catchError, map, retry, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-example',
  template: `...`,
})
export class ExampleComponent {
  private apiClient = inject(ApiClient);

  // Transform responses
  userNames$ = this.apiClient
    .get<User[], ApiError>({ url: '/users' })
    .pipe(map((response) => response.data.map((user) => user.name)));

  // Handle errors gracefully
  data$ = this.apiClient.get<DataItem[], ApiError>({ url: '/data' }).pipe(
    retry(3),
    catchError((error) => {
      console.error('Failed after 3 retries:', error);
      return of([]);
    }),
  );

  // Chain multiple requests
  userDetails$ = this.userId$.pipe(
    switchMap((id) =>
      this.apiClient.get<User, ApiError>({ url: `/users/${id}` }),
    ),
    switchMap((user) =>
      this.apiClient.get<UserDetails, ApiError>({
        url: `/users/${user.data.id}/details`,
      }),
    ),
  );
}
```

## Testing

The Angular client works seamlessly with Angular's testing utilities:

```ts
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ApiClient } from './client/client.gen';

describe('ApiClient', () => {
  let client: ApiClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiClient],
    });

    client = TestBed.inject(ApiClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch users', () => {
    const mockUsers = [{ id: 1, name: 'Test User' }];

    client.get<User[], ApiError>({ url: '/users' }).subscribe((response) => {
      expect(response.data).toEqual(mockUsers);
    });

    const req = httpMock.expectOne('/users');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockUsers });
  });
});
```

<!--@include: ../../examples.md-->
<!--@include: ../../sponsors.md-->
