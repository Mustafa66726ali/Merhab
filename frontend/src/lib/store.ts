import { create } from "zustand";

interface Membership {
  id: number;
  member_role: string;
  role_label: string;
  perm_scan_qr: boolean;
  perm_edit_guests: boolean;
  perm_send_messages: boolean;
  coordinator_label?: string;
  assigned_event_ids?: number[];
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone?: string;
  recovery_email_enabled?: boolean;
  two_factor_enabled?: boolean;
  platform?: PlatformInfo;
  membership?: Membership;
}

interface PlatformInfo {
  id: number;
  name: string;
  logo_url?: string;
}

interface AuthState {
  user: User | null;
  platform: PlatformInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setPlatform: (platform: PlatformInfo | null) => void;
  login: (user: User, access: string, refresh: string, platform?: PlatformInfo | null) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

function persistUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem("user_info", JSON.stringify(user));
  } else {
    localStorage.removeItem("user_info");
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  platform: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => {
    persistUser(user);
    set({ user, isAuthenticated: !!user });
  },
  setPlatform: (platform) => {
    if (typeof window !== "undefined") {
      if (platform) {
        localStorage.setItem("platform_info", JSON.stringify(platform));
      } else {
        localStorage.removeItem("platform_info");
      }
    }
    set({ platform });
  },
  login: (user, access, refresh, platform = null) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    persistUser(user);
    if (platform) {
      localStorage.setItem("platform_info", JSON.stringify(platform));
    } else {
      localStorage.removeItem("platform_info");
    }
    set({ user, platform, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("platform_info");
    localStorage.removeItem("user_info");
    set({ user: null, platform: null, isAuthenticated: false });
  },
  setLoading: (loading) => set({ isLoading: loading }),
}));
