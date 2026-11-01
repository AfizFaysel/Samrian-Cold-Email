import { NextResponse } from "next/server";

import { PublicError } from "../modules/public-error";
import { errorReporter } from "../observability/runtime";

export function errorResponse(error: unknown, fallback: string, route: string) {
  if (error instanceof PublicError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  errorReporter.capture(error, { route, action: fallback });
  return NextResponse.json({ error: fallback }, { status: 500 });
}
