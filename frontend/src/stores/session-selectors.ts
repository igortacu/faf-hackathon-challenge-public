import { useSessionStore } from "@/stores/session-store";
import type {
  AdminSession,
  AppSession,
  GuestSession,
  KikiWalletState,
} from "@/stores/session-store";
import type { GuestProfile } from "@/types/guest";

export function useSession(): AppSession | null {
  return useSessionStore((state) => state.session);
}

export function useSessionRole(): AppSession["role"] | null {
  return useSessionStore((state) => state.session?.role ?? null);
}

export function useIsAdmin(): boolean {
  return useSessionStore((state) => state.session?.role === "admin");
}

export function useGuestSession(): GuestSession | null {
  return useSessionStore((state) =>
    state.session?.role === "guest" ? state.session : null
  );
}

export function useAdminSession(): AdminSession | null {
  return useSessionStore((state) =>
    state.session?.role === "admin" ? state.session : null
  );
}

export function useGuest(): GuestProfile | null {
  return useSessionStore((state) => state.guest);
}

export function useKikiWallet(): KikiWalletState {
  return useSessionStore((state) => state.kiki);
}

export function useKikiActions() {
  const kikiEarn = useSessionStore((state) => state.kikiEarn);
  const kikiSpend = useSessionStore((state) => state.kikiSpend);
  const kikiRefill = useSessionStore((state) => state.kikiRefill);
  const kikiDrain = useSessionStore((state) => state.kikiDrain);
  return { kikiEarn, kikiSpend, kikiRefill, kikiDrain };
}
