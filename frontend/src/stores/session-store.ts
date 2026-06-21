import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { issueAdminToken, issueGuestToken } from "@/features/auth/auth-api";
import {
  drainNeed,
  NEED_START,
  refillNeed,
  type NeedKind,
} from "@/features/kiki-burger-quest/lib/kiki-survival";
import {
  earnMeows,
  spendMeows,
} from "@/features/kiki-burger-quest/lib/kiki-wallet";
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

// Kiki's quest-board progress, kept on the session so meows and completed
// quests survive reloads within a stay.
export interface KikiWalletState {
  // Spendable meows.
  meows: number;
  // Lifetime meows earned, used purely for Kiki's level/title.
  lifetimeMeows: number;
  // Survival bars, 0..100. Both start low and drain over time.
  hunger: number;
  thirst: number;
  // Things Kiki has bought, newest first (e.g. "🍔 Krabby burger").
  inventory: string[];
}

const EMPTY_KIKI: KikiWalletState = {
  meows: 0,
  lifetimeMeows: 0,
  hunger: NEED_START,
  thirst: NEED_START,
  inventory: [],
};

interface PersistedSessionState {
  session?: AppSession | null;
  guest?: GuestProfile | null;
  token?: string | null;
  kiki?: KikiWalletState | null;
}

interface SessionState {
  session: AppSession | null;
  guest: GuestProfile | null;
  isAdmin: boolean;
  // JWT issued by the gateway; sent as `Authorization: Bearer` on every API call.
  token: string | null;
  kiki: KikiWalletState;
  selectGuest: (guest: GuestProfile) => Promise<void>;
  loginAdmin: (passcode: string, displayName?: string) => Promise<void>;
  clearSession: () => void;
  clearGuest: () => void;
  // Award meows Kiki won at the Octopus.
  kikiEarn: (amount: number) => void;
  // Spend meows (no-op if unaffordable) and optionally log an inventory item.
  kikiSpend: (price: number, item?: string) => void;
  // Refill one survival bar after eating/drinking.
  kikiRefill: (need: NeedKind, amount?: number) => void;
  // Drain both bars for `seconds` of elapsed real time.
  kikiDrain: (seconds: number) => void;
}

const EMPTY_SESSION_STATE = {
  session: null,
  guest: null,
  isAdmin: false,
  token: null,
  kiki: EMPTY_KIKI,
} satisfies Pick<
  SessionState,
  "session" | "guest" | "isAdmin" | "token" | "kiki"
>;

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
  const kiki = state?.kiki ?? EMPTY_KIKI;

  if (session) {
    return {
      session,
      guest: deriveGuest(session),
      isAdmin: session.role === "admin",
      token: state?.token ?? null,
      kiki,
    };
  }

  if (state?.guest) {
    return {
      ...guestSessionState(state.guest),
      token: state?.token ?? null,
      kiki,
    };
  }

  return { ...EMPTY_SESSION_STATE, kiki };
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

      kikiEarn: (amount) =>
        set((state) => {
          const gained = Math.max(0, amount);
          return {
            kiki: {
              ...state.kiki,
              meows: earnMeows(state.kiki.meows, gained),
              lifetimeMeows: state.kiki.lifetimeMeows + gained,
            },
          };
        }),

      kikiSpend: (price, item) =>
        set((state) => {
          if (state.kiki.meows < price) {
            return state;
          }

          return {
            kiki: {
              ...state.kiki,
              meows: spendMeows(state.kiki.meows, price),
              inventory: item
                ? [item, ...state.kiki.inventory]
                : state.kiki.inventory,
            },
          };
        }),

      kikiRefill: (need, amount) =>
        set((state) => ({
          kiki: {
            ...state.kiki,
            [need]: refillNeed(state.kiki[need], amount),
          },
        })),

      kikiDrain: (seconds) =>
        set((state) => {
          if (seconds <= 0) {
            return state;
          }
          return {
            kiki: {
              ...state.kiki,
              hunger: drainNeed(state.kiki.hunger, seconds),
              thirst: drainNeed(state.kiki.thirst, seconds),
            },
          };
        }),
    }),
    {
      name: "kikis-paradise-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        session: state.session,
        token: state.token,
        kiki: state.kiki,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...migrateSessionState(persisted),
      }),
    }
  )
);
