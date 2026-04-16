// src/middleware/apiMiddleware.ts

type FetchInterceptor = (url: string, options: RequestInit) => Promise<{ url: string; options: RequestInit }> | { url: string; options: RequestInit };
type ResponseInterceptor = (response: Response) => Promise<Response> | Response;
type ErrorInterceptor = (error: any) => Promise<any> | any;

export class FetchMiddleware {
  private requestInterceptors: FetchInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  // Register a request interceptor
  useRequest(interceptor: FetchInterceptor) {
    this.requestInterceptors.push(interceptor);
  }

  // Register a response interceptor
  useResponse(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  // Register an error interceptor
  useError(interceptor: ErrorInterceptor) {
    this.errorInterceptors.push(interceptor);
  }

  // The core fetch wrapper
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    let currentUrl = url;
    let currentOptions = { ...options };

    try {
      // 1. Execute Request Interceptors
      for (const interceptor of this.requestInterceptors) {
        const result = await interceptor(currentUrl, currentOptions);
        currentUrl = result.url;
        currentOptions = result.options;
      }

      // 2. Perform the actual fetch
      let response = await fetch(currentUrl, currentOptions);

      // 3. Execute Response Interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      return response;

    } catch (error) {
      // 4. Execute Error Interceptors
      let finalError = error;
      for (const interceptor of this.errorInterceptors) {
        finalError = await interceptor(finalError) || finalError;
      }
      throw finalError; // Rethrow to let the component handle it if needed
    }
  }
}

// Export a singleton instance for global use
export const api = new FetchMiddleware();
