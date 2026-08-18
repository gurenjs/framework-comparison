import { type ChildProcess, spawn } from "node:child_process";

/**
 * Talks to a running Wasp server over its RPC endpoints.
 *
 * This file exists because Wasp 0.25 documents no way to test server-side code
 * ("Wasp currently does not provide a way to test your server-side code, but we
 * will be adding support soon." — web/docs/project/testing.md at tag v0.25.0).
 * SPEC §6 still requires the scenarios to be covered, so they are covered from
 * outside, and SPEC.md registers that this code is reported as External
 * verification LOC rather than as Test LOC: it measures this harness, not
 * Wasp's test API, which is what every other implementation's Test LOC measures.
 *
 * Nothing here is added to package.json. The RPC envelope is superjson's, but
 * for the scalar and plain-object arguments these scenarios use, `{ json: args }`
 * is exactly what superjson emits, so the harness needs no dependency and the
 * published Direct dependencies figure stays the one `wasp new` produced.
 */

// Addressed as an explicit IPv4 literal, never as `localhost`: the client dev
// server and the API server can end up on the same port number in different
// address families, and a name would then reach whichever the resolver prefers.
const HOST = "127.0.0.1";
const PORT = Number(process.env.WASP_VERIFICATION_PORT ?? 3555);
const BASE = `http://${HOST}:${PORT}`;

let server: ChildProcess | undefined;

export type Session = { token: string; name: string; email: string };

async function post(
  path: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

/** Calls a Wasp operation. Returns the deserialized payload or throws status. */
export async function call(
  operation: string,
  args: unknown = {},
  token?: string,
): Promise<any> {
  const { status, body } = await post(
    `/operations/${operation}`,
    { json: args },
    token,
  );
  if (status >= 400) {
    const error = new Error(body?.message ?? `HTTP ${status}`) as Error & {
      status: number;
      data?: unknown;
    };
    error.status = status;
    error.data = body?.data;
    throw error;
  }
  return body?.json;
}

export async function callStatus(
  operation: string,
  args: unknown = {},
  token?: string,
): Promise<number> {
  try {
    await call(operation, args, token);
    return 200;
  } catch (error) {
    return (error as { status?: number }).status ?? 500;
  }
}

export async function signup(
  email: string,
  password: string,
  name: string,
): Promise<number> {
  const { status } = await post("/auth/username/signup", {
    username: email,
    password,
    name,
  });
  return status;
}

export async function login(
  email: string,
  password: string,
): Promise<Session> {
  const { status, body } = await post("/auth/username/login", {
    username: email,
    password,
  });
  if (status >= 400 || !body?.sessionId) {
    throw new Error(`login failed with ${status}`);
  }
  return { token: body.sessionId, name: "", email };
}

export async function logout(token: string): Promise<number> {
  const { status } = await post("/auth/logout", {}, token);
  return status;
}

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "never answered";

  while (Date.now() < deadline) {
    try {
      // An unauthenticated operations call: any Wasp API answers it with a JSON
      // body, which is also how we confirm the port belongs to the API server
      // and not to something else that happens to be listening.
      const response = await fetch(`${BASE}/operations/get-posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: {} }),
      });
      const body = await response.json();
      if (response.ok && body?.json?.posts !== undefined) {
        return;
      }
      lastError = `answered ${response.status} but not with a Wasp payload`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`server on ${BASE} not ready: ${lastError}`);
}

export async function startServer(): Promise<void> {
  server = spawn(
    "npx",
    ["--yes", "@wasp.sh/wasp-cli@0.25.0", "start"],
    {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, PORT: String(PORT) },
      stdio: "ignore",
      detached: true,
    },
  );
  await waitForServer(180_000);
}

export async function stopServer(): Promise<void> {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}
