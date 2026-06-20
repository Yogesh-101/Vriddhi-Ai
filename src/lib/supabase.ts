import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const AUTH_EXPIRED_EVENT = 'vriddhi:auth-expired';

function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('vriddhi_auth_token');
  localStorage.removeItem('vriddhi_auth_user');
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vriddhi_auth_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseDbResponse(res: Response) {
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (res.status === 401 || res.status === 403) {
    clearStoredAuth();
    return { data: null, error: new Error(json.error || 'Session expired. Please log in again.') };
  }

  if (!res.ok) {
    return { data: null, error: new Error(json.error || `Request failed (${res.status})`) };
  }

  return { data: json.data ?? [], error: null };
}

class MockSupabaseQueryBuilder {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_columns: string = '*') {
    let currentPromise = fetch(`/api/db/${this.tableName}`, {
      headers: getAuthHeaders(),
    }).then(parseDbResponse);

    const chainable = {
      then: (onfulfilled: any, onrejected?: any) => currentPromise.then(onfulfilled, onrejected),
      catch: (onrejected: any) => currentPromise.catch(onrejected),
      finally: (onfinally: any) => currentPromise.finally(onfinally),
      eq: (column: string, value: any) => {
        currentPromise = currentPromise.then(({ data, error }) => {
          if (error || !data) return { data: null, error };
          return {
            data: data.filter((item: any) => item[column] === value),
            error: null,
          };
        });
        return chainable;
      },
      order: (column: string, { ascending = true } = {}) => {
        currentPromise = currentPromise.then(({ data, error }) => {
          if (error || !data) return { data: null, error };
          const sorted = [...data].sort((a: any, b: any) => {
            if (a[column] < b[column]) return ascending ? -1 : 1;
            if (a[column] > b[column]) return ascending ? 1 : -1;
            return 0;
          });
          return { data: sorted, error: null };
        });
        return chainable;
      },
      limit: (num: number) => {
        currentPromise = currentPromise.then(({ data, error }) => {
          if (error || !data) return { data: null, error };
          return { data: data.slice(0, num), error: null };
        });
        return chainable;
      },
    };

    return chainable as any;
  }

  async insert(values: any | any[]) {
    const response = await fetch(`/api/db/${this.tableName}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(values),
    });
    return parseDbResponse(response);
  }

  update(values: any) {
    return {
      eq: async (column: string, value: any) => {
        const response = await fetch(
          `/api/db/${this.tableName}/${column}/${encodeURIComponent(value)}`,
          {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(values),
          }
        );
        const result = await parseDbResponse(response);
        return { ...result, count: result.data?.length ?? 0 };
      },
    };
  }

  delete() {
    return {
      eq: async (column: string, value: any) => {
        const response = await fetch(
          `/api/db/${this.tableName}/${column}/${encodeURIComponent(value)}`,
          {
            method: 'DELETE',
            headers: getAuthHeaders(),
          }
        );
        return parseDbResponse(response);
      },
    };
  }
}

class MockSupabaseClient {
  from(table: string) {
    return new MockSupabaseQueryBuilder(table);
  }

  auth = {
    signUp: async ({ email, password, options }: any) => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, options }),
      });
      const json = await response.json();
      if (json.error) return { data: { user: null }, error: new Error(json.error) };
      return { data: json.data, error: null };
    },
    signInWithPassword: async ({ email, password, options }: any) => {
      const role = options?.data?.role;
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      const json = await response.json();
      if (json.error) return { data: { user: null }, error: new Error(json.error) };
      return { data: json.data, error: null };
    },
    signOut: async () => {
      clearStoredAuth();
      return { error: null };
    },
  };
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (new MockSupabaseClient() as any);
