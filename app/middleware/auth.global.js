export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;

  const { token, hydrateSession } = useAuth();
  hydrateSession();
  const authPages = ["/login", "/register"];
  const isAuthPage = authPages.includes(to.path);

  if (!token.value && !isAuthPage) return navigateTo("/login");
  if (token.value && isAuthPage) return navigateTo("/");
});
