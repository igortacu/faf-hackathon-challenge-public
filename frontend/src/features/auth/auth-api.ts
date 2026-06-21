import axios from "axios";

import { env } from "@/config/env";

// Talks to the gateway's session-auth endpoints (mounted at the root, not under
// /api). The gateway issues signed JWTs that fix the caller's identity for the
// session; every other API call then carries the token in the Authorization
// header (see api-client.ts).
const authClient = axios.create({ baseURL: env.gatewayUrl });

export async function issueGuestToken(guestId: string): Promise<string> {
  const { data } = await authClient.post<{ token: string }>("/auth/guest", {
    guest_id: guestId,
  });
  return data.token;
}

export async function issueAdminToken(passcode: string): Promise<string> {
  const { data } = await authClient.post<{ token: string }>("/auth/admin", {
    passcode,
  });
  return data.token;
}
