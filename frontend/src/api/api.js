const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(API_BASE_URL + '/api/users/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await readResponse(response);

        if (!response.ok || !data.success || !data.accessToken) {
          clearAccessToken();
          return null;
        }

        setAccessToken(data.accessToken);
        return data;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    return { success: false, message: 'The server returned an unreadable response.' };
  }
}

async function request(path, options = {}, mayRetry = true) {
  const { method = 'GET', body, headers: suppliedHeaders = {} } = options;
  const headers = new Headers(suppliedHeaders);

  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);

  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  try {
    const response = await fetch(API_BASE_URL + path, {
      method,
      headers,
      body: requestBody,
      credentials: 'include',
    });
    const data = await readResponse(response);

    if (!response.ok) {
      if (
        mayRetry &&
        response.status === 403 &&
        data.message === 'Access token expired.'
      ) {
        const refreshed = await refreshSession();
        if (refreshed?.accessToken) return request(path, options, false);
      }

      return {
        data: null,
        error: {
          status: response.status,
          message: data.message || 'The request failed.',
        },
      };
    }

    return { data, error: null };
  } catch {
    return {
      data: null,
      error: {
        status: 0,
        message: 'Could not reach the server. Check your connection and try again.',
      },
    };
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body, headers) => request(path, { method: 'POST', body, headers }),
  patch: (path, body, headers) => request(path, { method: 'PATCH', body, headers }),
  delete: (path, headers) => request(path, { method: 'DELETE', headers }),
};
