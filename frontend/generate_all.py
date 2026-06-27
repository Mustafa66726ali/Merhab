# -*- coding: utf-8 -*-
"""
Merhab - Full Frontend Generator
Run: python generate_all.py
"""
import os

BASE = r"d:\Merhab\frontend\src"
os.makedirs(BASE, exist_ok=True)

def w(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK: {path}")

# Helper: replace CLOSE_ with </
def fix(s):
    return s.replace("CLOSE_", "\x3c/")

print("=" * 60)
print("Merhab Frontend Generator")
print("=" * 60)

# ============================================================
# 1. globals.css
# ============================================================
w("app/globals.css", """@tailwind base;
@tailwind components;
@tailwind utilities;
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap');
html { direction: rtl; }
body { font-family: 'Inter','Noto Sans Arabic',sans-serif; background:#12121d; color:#e3e0f1; min-height:100vh; overflow-x:hidden; }
::-webkit-scrollbar { width:6px; }
::-webkit-scrollbar-track { background:#1f1e2a; }
::-webkit-scrollbar-thumb { background:#474557; border-radius:3px; }
.material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; vertical-align:middle; }
""")

# ============================================================
# 2. lib/api.ts
# ============================================================
w("lib/api.ts", """import axios from "axios";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const api = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = "Bearer " + token;
  }
  return config;
});
export default api;
export const authAPI = {
  login: (username: string, password: string) => api.post("/auth/login/", { username, password }),
  me: () => api.get("/auth/me/"),
};
export const eventsAPI = {
  list: (params?: any) => api.get("/events/events/", { params }),
  get: (id: number) => api.get("/events/events/" + id + "/"),
  create: (data: any) => api.post("/events/events/", data),
  update: (id: number, data: any) => api.put("/events/events/" + id + "/", data),
  delete: (id: number) => api.delete("/events/events/" + id + "/"),
};
export const guestsAPI = {
  list: (params?: any) => api.get("/guests/", { params }),
  create: (data: any) => api.post("/guests/", data),
  update: (id: number, data: any) => api.put("/guests/" + id + "/", data),
  delete: (id: number) => api.delete("/guests/" + id + "/"),
};
export const tablesAPI = {
  list: (params?: any) => api.get("/tables/tables/", { params }),
  create: (data: any) => api.post("/tables/tables/", data),
};
export const usersAPI = {
  list: (params?: any) => api.get("/auth/users/", { params }),
};
""")

# ============================================================
# 3. lib/store.ts
# ============================================================
w("lib/store.ts", """import { create } from "zustand";
interface User { id: number; username: string; email: string; first_name: string; last_name: string; role: string; }
interface AuthState {
  user: User | null; isAuthenticated: boolean; isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (user: User, access: string, refresh: string) => void;
  logout: () => void; setLoading: (loading: boolean) => void;
}
export const useAuthStore = create<AuthState>((set) => ({
  user: null, isAuthenticated: false, isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  login: (user, access, refresh) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null, isAuthenticated: false });
  },
  setLoading: (loading) => set({ isLoading: loading }),
}));
""")

print("Core files done.")
print("Generating components...")
