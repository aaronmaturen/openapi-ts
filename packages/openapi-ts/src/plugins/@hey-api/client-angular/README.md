# @hey-api/client-angular

Angular client plugin for `@hey-api/openapi-ts` that generates type-safe API clients using Angular's HttpClient.

## Features

- 🅰️ **Native Angular Integration** - Built as an Injectable service using Angular's HttpClient
- 📡 **RxJS Observables** - All methods return Observables for seamless Angular integration
- 🔒 **Type Safety** - Full TypeScript support with generated types
- 🔐 **Authentication Support** - Multiple auth strategies including interceptors
- 🎯 **Dependency Injection** - Works with Angular's DI system out of the box
- 🧪 **Testing Ready** - Compatible with Angular's HTTP testing utilities
- 🔄 **Interceptors** - Support for both Angular HTTP interceptors and custom interceptors

## Installation

```bash
npm install @hey-api/openapi-ts @hey-api/client-angular --save-dev
```

## Configuration

Add the plugin to your `openapi-ts.config.ts`:

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-angular',
  input: 'path/to/openapi.json',
  output: 'src/api',
  plugins: [
    '@hey-api/typescript',
    {
      name: '@hey-api/client-angular',
      throwOnError: false,
    },
    '@hey-api/sdk',
  ],
});
```

## Basic Usage

### 1. Generate the Client

```bash
npx openapi-ts
```

### 2. Type-Safe Requests

All HTTP methods accept generic type parameters for response data (`TData`) and error types (`TError`):

```typescript
// Type-safe request with explicit types
const response$ = client.get<User[], ApiError>({
  url: '/users',
});

// The Observable will emit data with the correct types
response$.subscribe({
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

### 3. Use in Your Angular Component

```typescript
import { Component, inject } from '@angular/core';
import { ApiClient } from './api';

@Component({
  selector: 'app-users',
  template: `
    <div *ngIf="loading">Loading...</div>
    <div *ngFor="let user of users">
      {{ user.name }}
    </div>
  `,
})
export class UsersComponent {
  private apiClient = inject(ApiClient);
  users: User[] = [];
  loading = false;

  ngOnInit() {
    this.loading = true;
    this.apiClient.get<User[], ApiError>({ url: '/users' }).subscribe({
      next: (response) => {
        this.users = response.data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load users:', error);
        this.loading = false;
      },
    });
  }
}
```

### 3. With Async Pipe

```typescript
@Component({
  selector: 'app-users',
  template: `
    <div *ngFor="let user of users$ | async">
      {{ user.name }}
    </div>
  `,
})
export class UsersComponent {
  private apiClient = inject(ApiClient);

  users$ = this.apiClient
    .get<User[], ApiError>({ url: '/users' })
    .pipe(map((response) => response.data));
}
```

## Authentication

### Option 1: Using Auth Function

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { ApiClient } from './api';
import { AuthService } from './auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: ApiClient,
      useFactory: () => {
        const authService = inject(AuthService);

        return new ApiClient({
          baseUrl: 'https://api.example.com',
          auth: async (security) => {
            return authService.getAccessToken();
          },
        });
      },
      deps: [AuthService],
    },
  ],
};
```

### Option 2: Using Angular HTTP Interceptors

```typescript
// auth.interceptor.ts
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

// app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    // ... other providers
  ],
};
```

### Option 3: Custom Interceptors

```typescript
const apiClient = inject(ApiClient);

// Add request interceptor
apiClient.interceptors.request.use(async (request, options) => {
  const token = await inject(AuthService).getToken();
  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };
  return request;
});

// Add error interceptor for token refresh
apiClient.interceptors.error.use(async (error, response, request, options) => {
  if (response.status === 401) {
    // Try to refresh token
    const newToken = await inject(AuthService).refreshToken();
    if (newToken) {
      // Retry the request with new token
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      };
      return apiClient.request<any, ApiError>(options);
    }
  }
  return error;
});
```

## Advanced Usage

### Configuration Options

```typescript
const apiClient = new ApiClient({
  // Base URL for all requests
  baseUrl: 'https://api.example.com',

  // Throw errors instead of returning them
  throwOnError: true,

  // Default headers
  headers: {
    'X-Custom-Header': 'value',
  },

  // Response parsing
  parseAs: 'json', // 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'auto'

  // Response style
  responseStyle: 'fields', // 'fields' | 'data'

  // Authentication function
  auth: async (security) => {
    return 'your-auth-token';
  },

  // Request validator
  requestValidator: async (request) => {
    // Validate request before sending
  },

  // Response validator
  responseValidator: async (response) => {
    // Validate response data
  },

  // Response transformer
  responseTransformer: async (data) => {
    // Transform response data
    return data;
  },
});
```

### Working with Signals (Angular 16+)

```typescript
import { signal, computed } from '@angular/core';

@Component({
  selector: 'app-users',
  template: `
    <div *ngIf="loading()">Loading...</div>
    <div *ngFor="let user of users()">{{ user.name }}</div>
    <div>Total: {{ userCount() }}</div>
  `,
})
export class UsersComponent {
  private apiClient = inject(ApiClient);

  users = signal<User[]>([]);
  loading = signal(false);
  userCount = computed(() => this.users().length);

  loadUsers() {
    this.loading.set(true);

    this.apiClient.get<User[], ApiError>({ url: '/users' }).subscribe({
      next: (response) => {
        this.users.set(response.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
```

### Error Handling

```typescript
// Global error handler
@Injectable()
export class ApiErrorHandler {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  handleError(error: any): void {
    if (error.status === 401) {
      this.router.navigate(['/login']);
      this.snackBar.open('Please login to continue', 'Close');
    } else if (error.status === 403) {
      this.snackBar.open('You do not have permission', 'Close');
    } else {
      this.snackBar.open('An error occurred', 'Close');
    }
  }
}

// In component
this.apiClient.get<User[], ApiError>({ url: '/users' }).subscribe({
  next: (response) => (this.users = response.data),
  error: (error) => this.errorHandler.handleError(error),
});
```

### File Uploads

```typescript
uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return this.apiClient.post<UploadResponse, ApiError>({
    url: '/upload',
    body: formData,
    headers: {
      // Let browser set Content-Type with boundary
      'Content-Type': null
    }
  });
}
```

### Cancelling Requests

```typescript
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-users',
})
export class UsersComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private apiClient = inject(ApiClient);

  loadUsers() {
    this.apiClient
      .get({ url: '/users' })
      .pipe(takeUntil(this.destroy$))
      .subscribe((response) => {
        // Handle response
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## Testing

The client works seamlessly with Angular's testing utilities:

```typescript
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ApiClient } from './api';

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

  it('should handle errors', () => {
    client.get<User[], ApiError>({ url: '/users' }).subscribe({
      next: () => fail('should have failed'),
      error: (error) => {
        expect(error.status).toBe(500);
      },
    });

    const req = httpMock.expectOne('/users');
    req.flush('Server error', { status: 500, statusText: 'Server Error' });
  });
});
```

## Best Practices

1. **Use Dependency Injection**: Always inject the ApiClient rather than creating instances manually
2. **Handle Errors**: Implement proper error handling for all API calls
3. **Unsubscribe**: Use `takeUntil`, `async` pipe, or other strategies to prevent memory leaks
4. **Type Safety**: Leverage the generated types for better IDE support and compile-time checks
5. **Testing**: Write tests for your API interactions using Angular's HTTP testing utilities

## Migration from Other Clients

If you're migrating from another client (e.g., fetch, axios), the main differences are:

1. Methods return Observables instead of Promises
2. Use `.subscribe()` instead of `.then()/.catch()`
3. Leverage RxJS operators for data transformation
4. Integration with Angular's change detection is automatic

```typescript
// Before (Promise-based)
const response = await client.get('/users');
const users = response.data;

// After (Observable-based)
client.get<User[], ApiError>({ url: '/users' }).subscribe((response) => {
  const users = response.data;
});

// Or with async pipe
users$ = client
  .get<User[], ApiError>({ url: '/users' })
  .pipe(map((response) => response.data));
```

## License

This plugin is part of the @hey-api/openapi-ts project. See the main project for license information.
