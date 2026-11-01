import { serve } from "inngest/next";
import { inngest, readInngestEndpoint } from "../../../../inngest/client";
import { functions } from "../../../../inngest/functions/index";

const handlers = serve({
  client: inngest,
  functions,
});

function adapt(handler: typeof handlers.GET) {
  return (request: Request, context: unknown) => {
    const endpoint = readInngestEndpoint();
    if (endpoint === "disabled") return Response.json({ error: "Not found" }, { status: 404 });
    if (endpoint === "misconfigured") {
      return Response.json({ error: "Job endpoint is not configured" }, { status: 503 });
    }
    return handler(request as Parameters<typeof handler>[0], context);
  };
}

export const GET = adapt(handlers.GET);
export const POST = adapt(handlers.POST);
export const PUT = adapt(handlers.PUT);
