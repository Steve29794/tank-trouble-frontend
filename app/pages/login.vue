<script setup>
const { api, setSession } = useAuth();
const form = reactive({ username: "", password: "" });
const error = ref("");
const loading = ref(false);
async function submit() {
  error.value = "";
  loading.value = true;
  try {
    setSession(await api("/api/auth/login", { method: "POST", body: form }));
    await navigateTo("/");
  } catch (e) {
    error.value = e?.data?.error || "登录失败";
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <main class="auth-shell">
    <section class="auth-card">
      <div class="brand-mark">TT</div>
      <p class="eyebrow">ONLINE ARENA / 01</p>
      <h1>坦克动荡</h1>
      <p class="lede">进入迷宫，利用反弹炮弹取得最后的胜利。</p>
      <form @submit.prevent="submit">
        <label>玩家 ID<input v-model="form.username" autocomplete="username" required placeholder="输入你的昵称" /></label
        ><label>密码<input v-model="form.password" type="password" autocomplete="current-password" required placeholder="至少 6 位" /></label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="primary-button" :disabled="loading">{{ loading ? "正在进入…" : "进入大厅" }}</button>
      </form>
      <NuxtLink class="text-link" to="/register">创建新账号 <span>→</span></NuxtLink>
    </section>
    <aside class="auth-aside">
      <div class="radar"></div>
      <div><span class="status-dot"></span> SERVER ONLINE</div>
      <strong>PRIM MAZE<br />BATTLEFIELD</strong>
      <p>最多 5 名玩家 · 无限回合 · 物理由服务器同步</p>
    </aside>
  </main>
</template>
