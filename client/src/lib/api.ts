import { CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/http';
import { Capacitor } from '@capacitor/core';

const API_URL = import.meta.env.VITE_API_URL || 'https://lyricsensei.com';

interface ApiOptions extends Omit<HttpOptions, 'url'> {
  url: string;
}

async function apiRequest<T = any>(options: ApiOptions): Promise<T> {
  const isNative = Capacitor.isNativePlatform();

  // Use native HTTP for mobile, fetch for web
  if (isNative) {
    console.log('[API Native] Request:', options.method, options.url);

    try {
      const response: HttpResponse = await CapacitorHttp.request({
        ...options,
        url: `${API_URL}${options.url}`,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      console.log('[API Native] Response:', response.status);

      if (response.status >= 400) {
        throw new Error(`${response.status}: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error) {
      console.error('[API Native] Error:', error);
      throw error;
    }
  } else {
    // Web: use regular fetch
    console.log('[API Web] Request:', options.method, options.url);

    const response = await fetch(`${API_URL}${options.url}`, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.data ? JSON.stringify(options.data) : undefined,
      credentials: 'include'
    });

    console.log('[API Web] Response:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(`${response.status}: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }
}

// API Methods
export const api = {
  // GET request
  get: <T = any>(url: string, params?: Record<string, any>): Promise<T> => {
    const queryString = params 
      ? '?' + new URLSearchParams(params).toString()
      : '';
    
    return apiRequest<T>({
      url: url + queryString,
      method: 'GET'
    });
  },

  // POST request
  post: <T = any>(url: string, data?: any): Promise<T> => {
    return apiRequest<T>({
      url,
      method: 'POST',
      data
    });
  },

  // PUT request
  put: <T = any>(url: string, data?: any): Promise<T> => {
    return apiRequest<T>({
      url,
      method: 'PUT',
      data
    });
  },

  // DELETE request
  delete: <T = any>(url: string): Promise<T> => {
    return apiRequest<T>({
      url,
      method: 'DELETE'
    });
  },

  // PATCH request
  patch: <T = any>(url: string, data?: any): Promise<T> => {
    return apiRequest<T>({
      url,
      method: 'PATCH',
      data
    });
  }
};
