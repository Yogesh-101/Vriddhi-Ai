import { createClient } from '@supabase/supabase-js';

// Load Supabase credentials from Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ==========================================
// MOCK SUPABASE CLIENT USING EXPRESS BACKEND
// ==========================================
class MockSupabaseQueryBuilder {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private getHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vriddhi_auth_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  select(columns: string = '*') {
    let currentPromise = fetch(`/api/db/${this.tableName}`, {
      headers: this.getHeaders()
    })
      .then(res => res.json())
      .then(json => ({ data: json.data || [], error: null }));

    const chainable = {
      then: (onfulfilled: any, onrejected?: any) => currentPromise.then(onfulfilled, onrejected),
      catch: (onrejected: any) => currentPromise.catch(onrejected),
      finally: (onfinally: any) => currentPromise.finally(onfinally),
      eq: (column: string, value: any) => {
        currentPromise = currentPromise.then(({ data }) => ({
          data: data.filter((item: any) => item[column] === value),
          error: null
        }));
        return chainable;
      },
      order: (column: string, { ascending = true } = {}) => {
        currentPromise = currentPromise.then(({ data }) => {
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
        currentPromise = currentPromise.then(({ data }) => ({
          data: data.slice(0, num),
          error: null
        }));
        return chainable;
      }
    };

    return chainable as any;
  }

  async insert(values: any | any[]) {
    const response = await fetch(`/api/db/${this.tableName}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(values)
    });
    const json = await response.json();
    return { data: json.data, error: json.error };
  }

  update(values: any) {
    const queryObj = {
      eq: async (column: string, value: any) => {
        const response = await fetch(`/api/db/${this.tableName}/${column}/${encodeURIComponent(value)}`, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify(values)
        });
        const json = await response.json();
        return { data: json.data, error: json.error, count: json.count };
      }
    };
    return queryObj;
  }

  delete() {
    const queryObj = {
      eq: async (column: string, value: any) => {
        const response = await fetch(`/api/db/${this.tableName}/${column}/${encodeURIComponent(value)}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        const json = await response.json();
        return { data: json.data, error: json.error };
      }
    };
    return queryObj;
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
        body: JSON.stringify({ email, password, options })
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
        body: JSON.stringify({ email, password, role })
      });
      const json = await response.json();
      if (json.error) return { data: { user: null }, error: new Error(json.error) };
      return { data: json.data, error: null };
    },
    signOut: async () => {
      return { error: null };
    }
  };
}

// Export active Supabase client. If credentials are empty, use Mock Client.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (new MockSupabaseClient() as any);
