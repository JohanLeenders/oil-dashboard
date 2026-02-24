import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Convenience helper: returns a query builder for the given table.
 * Takes an already-created Supabase client (synchronous, no await needed).
 * Used by testing API routes. Added Wave 10 to unblock pre-existing routes.
 *
 * Usage: const client = await createClient()
 *        const { data } = await fromTable(client, 'my_table').select('*')
 */
// fromTable() is a thin pass-through. Supabase client.from() returns a complex
// generic that varies per table; type safety is enforced at each call site.
export function fromTable(client: { from: (table: string) => any }, table: string) { // eslint-disable-line
  return client.from(table);
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}
