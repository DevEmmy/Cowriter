import { NextResponse } from "next/server";
import { authed } from "@/lib/api";
import { aiConfigured, aiProviderName } from "@/lib/ai/provider";

export const GET = authed(async () => NextResponse.json({ configured: aiConfigured(), provider: aiProviderName() }));
