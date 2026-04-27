import { validateSession } from "@/lib/auth";

type ParseResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: Response };

export async function parseJsonBody<T>(request: Request): Promise<ParseResult<T>> {
  try {
    const body = (await request.json()) as T;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid request body" }, { status: 400 }),
    };
  }
}

type AdminContext = { sessionId: string };

export function withAdminAuth<TParams extends Record<string, string> = Record<string, string>>(
  handler: (
    request: Request,
    ctx: AdminContext & { params?: Promise<TParams> },
  ) => Promise<Response>,
) {
  return async (request: Request, routeCtx?: { params: Promise<TParams> }) => {
    const sessionId = await validateSession(request);
    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request, { sessionId, params: routeCtx?.params });
  };
}
