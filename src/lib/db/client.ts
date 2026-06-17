// Cliente PostgREST minimalista contra Supabase (schema "historico").
// Mismo patrón que la app de remolques (fetch + anon key), pero apuntando
// al schema dedicado de esta app mediante las cabeceras Accept/Content-Profile.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://thwtfrwjmivugxvwtore.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRod3RmcndqbWl2dWd4dnd0b3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODE3ODMsImV4cCI6MjA5MzI1Nzc4M30.oRhvGsK9nU9iGlNJvWWnWoXd16wtxDIySD4m-L_rM3M";

// Schema dedicado de esta app. Debe estar en "Exposed schemas" de Supabase.
const SCHEMA = "historico";

const baseHeaders: Record<string, string> = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Accept-Profile": SCHEMA,
  "Content-Profile": SCHEMA,
  "Content-Type": "application/json",
};

export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      ...baseHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `DB Error [${response.status}] for ${endpoint}: ${errorText}`,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
