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

type RouteContext<TParams> = { params: Promise<TParams> };

export function withAdminAuth<TParams extends Record<string, string> = Record<string, string>>(
  handler: (request: Request, ctx: RouteContext<TParams>) => Promise<Response>,
) {
  return async (request: Request, routeCtx?: RouteContext<TParams>) => {
    const sessionId = await validateSession(request);
    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Static routes have no params object; their handlers never read ctx.params.
    return handler(request, routeCtx ?? ({} as RouteContext<TParams>));
  };
}
