import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';

import { bearerToken, safeEqual } from './auth';
import { sync } from './routes/sync';

/** What Cloudflare gives the Worker: the database and the secret key. */
export type Env = {
  DB: D1Database;
  /** The personal key (docs/decisoes.md §9). Set with `wrangler secret put APP_TOKEN`. */
  APP_TOKEN: string;
};

const app = new Hono<{ Bindings: Env }>();

// The web app runs on another address, so the browser asks first (CORS).
// Allowing any origin is fine: without the key, nothing is readable.
app.use(
  '*',
  cors({ origin: '*', allowMethods: ['POST', 'OPTIONS'], allowHeaders: ['Authorization', 'Content-Type'] })
);

// Every route needs the personal key. No key on the server = nothing works.
app.use('*', async (c, next) => {
  const token = bearerToken(c.req.header('Authorization'));
  if (!c.env.APP_TOKEN || !token || !safeEqual(token, c.env.APP_TOKEN)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

// A page of 500 rows is well under 1 MB; anything bigger isn't from the app.
app.use('*', bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => c.json({ error: 'too_large' }, 413) }));

app.route('/sync', sync);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

export default app;
