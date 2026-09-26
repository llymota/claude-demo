import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth serves sign-in, sign-up, sessions, and Polar checkout, portal and webhooks
// (POST /api/auth/polar/webhooks) from this one route.
const handler = () => toNextJsHandler(auth());

export const GET = (req: Request) => handler().GET(req);
export const POST = (req: Request) => handler().POST(req);
