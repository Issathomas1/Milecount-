import { createHandler } from './handler.mjs';

// JWT verification is performed against Supabase Auth in the handler. This also
// supports the project's publishable API key and asymmetric access tokens.
Deno.serve(createHandler({ env: name => Deno.env.get(name) }));
