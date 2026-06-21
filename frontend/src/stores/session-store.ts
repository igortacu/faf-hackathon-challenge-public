import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { issueAdminToken, issueGuestToken } from "@/features/auth/auth-api";
import type { GuestProfile } from "@/types/guest";

export type GuestSession = {
  role: "guest";
  guest: GuestProfile;
};

export type AdminSession = {
  role: "admin";
  displayName: string;
  passcode: string;
};

export type AppSession = GuestSession | AdminSession;

interface PersistedSessionState {
  session?: AppSession | null;
  guest?: GuestProfile | null;
  token?: string | null;
}

interface SessionState {
  session: AppSession | null;
  guest: GuestProfile | null;
  isAdmin: boolean;
  // JWT issued by the gateway; sent as `Authorization: Bearer` on every API call.
  token: string | null;
  selectGuest: (guest: GuestProfile) => Promise<void>;
  loginAdmin: (passcode: string, displayName?: string) => Promise<void>;
  clearSession: () => void;
  clearGuest: () => void;
}

const EMPTY_SESSION_STATE = {
  session: null,
  guest: null,
  isAdmin: false,
  token: null,
} satisfies Pick<SessionState, "session" | "guest" | "isAdmin" | "token">;

function guestSessionState(guest: GuestProfile) {
  const session: GuestSession = { role: "guest", guest };

  return {
    session,
    guest,
    isAdmin: false,
  };
}

function adminSessionState(displayName: string, passcode: string) {
  return {
    session: { role: "admin", displayName, passcode } satisfies AdminSession,
    guest: null,
    isAdmin: true,
  };
}

function deriveGuest(session: AppSession | null): GuestProfile | null {
  return session?.role === "guest" ? session.guest : null;
}

function migrateSessionState(persisted: unknown): Partial<SessionState> {
  const state = persisted as PersistedSessionState | null;
  const session = state?.session ?? null;

  if (session) {
    return {
      session,
      guest: deriveGuest(session),
      isAdmin: session.role === "admin",
      token: state?.token ?? null,
    };
  }

  if (state?.guest) {
    return { ...guestSessionState(state.guest), token: state?.token ?? null };
  }

  return EMPTY_SESSION_STATE;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...EMPTY_SESSION_STATE,

      // Identity selection: the gateway issues a guest token that fixes this
      // identity for the session. The token is set together with the session so
      // the first authenticated API call already carries it.
      selectGuest: async (guest) => {
        const token = await issueGuestToken(guest.id);
        set({ ...guestSessionState(guest), token });
      },

      // Server-side passcode validation: issueAdminToken rejects (401) on a bad
      // passcode, so the caller can surface the error and stay on the login.
      loginAdmin: async (passcode, displayName = "Admin") => {
        const token = await issueAdminToken(passcode);
        set({ ...adminSessionState(displayName, passcode), token });
      },

      clearSession: () => set(EMPTY_SESSION_STATE),

      clearGuest: () => set(EMPTY_SESSION_STATE),
    }),
    {
      name: "kikis-paradise-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ session: state.session, token: state.token }),
      merge: (persisted, current) => ({
        ...current,
        ...migrateSessionState(persisted),
      }),
    }
  )
);
