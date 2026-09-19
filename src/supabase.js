import { createClient } from '@supabase/supabase-js';
import { createAuthAwareFetch } from './utils/authFetch';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id')) {
  console.warn(
    'Supabase credentials missing or using placeholders. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Fetch com retry para contornar oscilações de rede, falhas de QUIC/HTTP3 e 'Failed to fetch'
const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 300) => {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (err) {
    if (retries > 0 && (err.name === 'TypeError' || err.message?.includes('Failed to fetch'))) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
};

const resolvedUrl = supabaseUrl || 'https://placeholder.supabase.co';

// `supabase` é referenciado só em tempo de chamada, depois de criado.
const authAwareFetch = createAuthAwareFetch({
  baseFetch: fetchWithRetry,
  supabaseUrl: resolvedUrl,
  refreshSession: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    return error ? null : data?.session ?? null;
  },
  onSessionDead: () => supabase.auth.signOut({ scope: 'local' }),
});

export const supabase = createClient(
  resolvedUrl,
  supabaseAnonKey || 'placeholder',
  {
    global: {
      fetch: authAwareFetch,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
