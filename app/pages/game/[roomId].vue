<script setup>
const route = useRoute();
const { token, user } = useAuth();
const roomId = String(route.params.roomId);
onMounted(() => {
  if (!token.value) navigateTo("/login");
});
</script>
<template>
  <main class="game-page">
    <header class="topbar">
      <NuxtLink class="logo" to="/">TANK<span>//</span>TROUBLE</NuxtLink>
      <div class="room-pill">
        ROOM <b>#{{ roomId }}</b>
      </div>
      <NuxtLink to="/" class="back-link">退出房间</NuxtLink>
    </header>
    <GameCanvas v-if="token" :room-id="roomId" :token="token" :username="user?.username" />
  </main>
</template>
