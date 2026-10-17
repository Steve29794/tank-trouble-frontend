<script setup>
const { api, setSession } = useAuth();
const form = reactive({ username: "", password: "", confirm: "" });
const error = ref("");
const loading = ref(false);
async function submit() {
  if (form.password !== form.confirm) {
    error.value = "两次密码不一致";
    return;
  }
  error.value = "";
  loading.value = true;
  try {
    setSession(await api("/api/auth/register", { method: "POST", body: { username: form.username, password: form.password } }));
    await navigateTo("/");
  } catch (e) {
    error.value = e?.data?.error || "注册失败";
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <main class="auth-shell">
    <section class="auth-card">
      <div class="brand-mark">TT</div>
      <p class="eyebrow">NEW PILOT / 01</p>
      <h1>创建账号</h1>
      <p class="lede">保留你的战绩，随时回到战场。</p>
      <form @submit.prevent="submit">
        <label
          >玩家 ID<input
            v-model="form.username"
            required
            minlength="3"
            maxlength="20"
            pattern="[A-Za-z0-9_]{3,20}"
            title="仅允许 3-20 位英文字母、数字或下划线"
            placeholder="3-20 位字母、数字或下划线" /></label
        ><label>密码<input v-model="form.password" type="password" required minlength="6" placeholder="至少 6 位" /></label
        ><label>确认密码<input v-model="form.confirm" type="password" required placeholder="再次输入密码" /></label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="primary-button" :disabled="loading">{{ loading ? "正在创建…" : "创建并进入" }}</button>
      </form>
      <NuxtLink class="text-link" to="/login">已有账号？返回登录 <span>→</span></NuxtLink>
    </section>
    <aside class="auth-aside">
      <div class="grid-art"></div>
      <strong>FIND YOUR<br />ANGLE</strong>
      <p>每一面墙都可能成为你的武器。</p>
    </aside>
  </main>
</template>
