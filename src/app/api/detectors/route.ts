import { NextResponse } from "next/server";
import { authed } from "@/lib/api";
import { detectorStatus } from "@/lib/detectors";

export const GET = authed(async () => NextResponse.json({ detectors: detectorStatus().map(({ id, name, configured, envKey, signup }) => ({ id, name, configured, envKey, signup })) }));
