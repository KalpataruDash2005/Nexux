import axios from 'axios';

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
      if (hadSession) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;