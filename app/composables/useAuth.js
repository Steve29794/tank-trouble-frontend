export function useAuth() {
  const token = useState("auth-token", () => (import.meta.client ? localStorage.getItem("tank-token") : ""));
  const user = useState("auth-user", () => (import.meta.client ? JSON.parse(localStorage.getItem("tank-user") || "null") : null));
  const config = useRuntimeConfig();
  const api = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (token.value) headers.Authorization = "Bearer " + token.value;
    return await $fetch(config.public.apiBase + path, { ...options, headers });
  };
  const setSession = (data) => {
    token.value = data.token;
    user.value = data.user;
    if (import.meta.client) {
      localStorage.setItem("tank-token", data.token);
      localStorage.setItem("tank-user", JSON.stringify(data.user));
    }
  };
  const hydrateSession = () => {
    if (!import.meta.client) return;
    if (!token.value) token.value = localStorage.getItem("tank-token") || "";
    if (!user.value) {
      try {
        user.value = JSON.parse(localStorage.getItem("tank-user") || "null");
      } catch {
        user.value = null;
      }
    }
  };
  const logout = () => {
    token.value = "";
    user.value = null;
    if (import.meta.client) {
      localStorage.removeItem("tank-token");
      localStorage.removeItem("tank-user");
    }
    navigateTo("/login");
  };
  return { token, user, api, setSession, hydrateSession, logout };
}
