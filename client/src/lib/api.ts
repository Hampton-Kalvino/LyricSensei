import { Capacitor } from '@capacitor/core';

const API_URL = import.meta.env.VITE_API_URL || 'https://lyricsensei.com';

async function apiRequest<T = any>(method: string, url: string, data?: any): Promise<T> {
  const isNative = Capacitor.isNativePlatform();

  // Use native HTTP for mobile, fetch for web
  if (isNative) {
    console.log('[API Native] Request:', method, url);

    try {
      const response = await fetch(`${API_URL}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        credentials: 'include'
      });

      console.log('[API Native] Response:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(`${response.status}: ${JSON.stringify(error)}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[API Native] Error:', error);
      throw error;
    }
  } else {
    // Web: use regular fetch
    console.log('[API Web] Request:', method, url);

    const response = await fetch(`${API_URL}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
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
    
    return apiRequest<T>('GET', url + queryString);
  },

  // POST request
  post: <T = any>(url: string, data?: any): Promise<T> => {
    return apiRequest<T>('POST', url, data);
  },

  // PUT request
  put: <T = any>(url: string, data?: any): Promise<T> => {
    return apiRequest<T>('PUT', url, data);
  },

  // DELETE request
  delete: <T = any>(url: string): Promise<T> => {
    return apiRequest<T>('DELETE', url);
  },

  // PATCH request
  patch: <T = any>(url: string, data?: any): Promise<T> => {
    return apiRequest<T>('PATCH', url, data);
  }
};
