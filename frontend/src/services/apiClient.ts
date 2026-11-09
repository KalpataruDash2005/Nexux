import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// In-memory cache for GET requests to eliminate duplicate/burst roundtrips
interface CacheEntry {
  response: AxiosResponse<any>;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<AxiosResponse<any>>>();

// Cache TTL configuration per endpoint pattern (in milliseconds)
const CACHE_TTL_RULES: { pattern: RegExp; ttl: number }[] = [
  { pattern: /\/students\/me/, ttl: 60_000 },
  { pattern: /\/workspaces(\/|$|\?)/, ttl: 30_000 },
  { pattern: /\/tasks\/summary/, ttl: 30_000 },
  { pattern: /\/tasks(\?|$)/, ttl: 15_000 },
  { pattern: /\/placement\/dashboard/, ttl: 60_000 },
];

export const clearApiCache = (pattern?: RegExp) => {
  if (!pattern) {
    memoryCache.clear();
    inFlightRequests.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (pattern.test(key)) {
      memoryCache.delete(key);
    }
  }
};

const getCacheTtl = (url: string): number => {
  for (const rule of CACHE_TTL_RULES) {
    if (rule.pattern.test(url)) {
      return rule.ttl;
    }
  }
  return 0; // Don't cache unconfigured endpoints
};

// Centralized session expiry handling: any 401 clears the session and returns
// the user to the login page instead of surfacing raw auth errors.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isAuthEndpoint = typeof error?.config?.url === 'string'
      && error.config.url.includes('/auth/');
    if (status === 401 && !isAuthEndpoint) {
      const hadSession = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      clearApiCache();
      if (hadSession) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

// Store original methods
const originalGet = apiClient.get.bind(apiClient);
const originalPost = apiClient.post.bind(apiClient);
const originalPut = apiClient.put.bind(apiClient);
const originalDelete = apiClient.delete.bind(apiClient);
const originalPatch = apiClient.patch.bind(apiClient);

// Override GET with transparent deduplication and caching
apiClient.get = ((url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<any>> => {
  const token = localStorage.getItem('token') || 'anon';
  const paramStr = config?.params ? JSON.stringify(config.params) : '';
  const cacheKey = `${token}:${url}:${paramStr}`;

  // 1. Serve from fresh memory cache (sub-millisecond instant return)
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return Promise.resolve({
      ...cached.response,
      data: JSON.parse(JSON.stringify(cached.response.data)),
    });
  }

  // 2. In-flight request deduplication (collapses simultaneous GETs into 1 network flight)
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight.then((res) => ({
      ...res,
      data: JSON.parse(JSON.stringify(res.data)),
    }));
  }

  // 3. Dispatch single network flight
  const requestPromise = originalGet(url, config)
    .then((res) => {
      inFlightRequests.delete(cacheKey);
      const ttl = getCacheTtl(url);
      if (ttl > 0 && res.status === 200) {
        memoryCache.set(cacheKey, {
          response: res,
          expiresAt: Date.now() + ttl,
        });
      }
      return res;
    })
    .catch((err) => {
      inFlightRequests.delete(cacheKey);
      throw err;
    });

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
}) as any;

// Invalidate cache on mutations to guarantee data consistency
apiClient.post = ((url: string, data?: any, config?: AxiosRequestConfig) => {
  clearApiCache();
  return originalPost(url, data, config);
}) as any;

apiClient.put = ((url: string, data?: any, config?: AxiosRequestConfig) => {
  clearApiCache();
  return originalPut(url, data, config);
}) as any;

apiClient.delete = ((url: string, config?: AxiosRequestConfig) => {
  clearApiCache();
  return originalDelete(url, config);
}) as any;

apiClient.patch = ((url: string, data?: any, config?: AxiosRequestConfig) => {
  clearApiCache();
  return originalPatch(url, data, config);
}) as any;

export default apiClient;
