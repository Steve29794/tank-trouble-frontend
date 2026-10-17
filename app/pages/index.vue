<script setup>
const { api, user, token, logout } = useAuth();
const rooms = ref([]);
const roomCode = ref("");
const roomPassword = ref("");
const maxRounds = ref(0);
const createPassword = ref("");
const error = ref("");
const creating = ref(false);
const refreshing = ref(false);
const joining = ref(false);
onMounted(async () => {
  if (!token.value) return navigateTo("/login");
  try {
    await refreshRooms();
  } catch {
    logout();
  }
});
async function refreshRooms() {
  refreshing.value = true;
  error.value = "";
  try {
    rooms.value = await api("/api/rooms");
  } catch (e) {
    error.value = e?.data?.error || "房间列表刷新失败";
  } finally {
    refreshing.value = false;
  }
}
async function createRoom() {
  creating.value = true;
  error.value = "";
  try {
    const { room } = await api("/api/rooms", { method: "POST", body: { maxRounds: maxRounds.value, password: createPassword.value } });
    await navigateTo("/game/" + room.id);
  } catch (e) {
    error.value = e?.data?.error || "创建失败";
  } finally {
    creating.value = false;
  }
}
async function joinRoom(code = roomCode.value) {
  const id = String(code).trim();
  if (!id) return;
  joining.value = true;
  error.value = "";
  try {
    await api("/api/rooms/" + id + "/join", { method: "POST", body: { password: roomPassword.value } });
    await navigateTo("/game/" + id);
  } catch (e) {
    error.value = e?.data?.error || "加入失败";
  } finally {
    joining.value = false;
  }
}
</script>
<template>
  <main class="lobby">
    <header class="topbar">
      <NuxtLink class="logo" to="/">TANK<span>//</span>TROUBLE</NuxtLink>
      <div class="profile">
        <span class="avatar">{{ user?.username?.slice(0, 1).toUpperCase() }}</span
        ><span>{{ user?.username }}</span
        ><button @click="logout">退出</button>
      </div>
    </header>
    <section class="lobby-head">
      <div>
        <p class="eyebrow">TACTICAL ARENA / LOBBY</p>
        <h1>准备开战</h1>
        <p class="lede">创建一场新的迷宫对战，或加入正在等待的房间。</p>
      </div>
      <div class="live-chip"><span class="status-dot"></span> LIVE NETWORK</div>
    </section>
    <section class="lobby-grid">
      <div class="panel create-panel">
        <div class="panel-label">01 / CREATE ROOM</div>
        <h2>建立你的战场</h2>
        <p>设置房间密码，准备完成后由房主开始回合。</p>
        <label>房间密码<input v-model="createPassword" type="password" minlength="4" maxlength="32" placeholder="4-32 位密码" /></label
        ><label
          >回合上限
          <select v-model="maxRounds">
            <option :value="0">无限回合</option>
            <option :value="3">3 回合</option>
            <option :value="5">5 回合</option>
            <option :value="10">10 回合</option>
          </select></label
        ><button class="primary-button" :disabled="creating || createPassword.length < 4" @click="createRoom">{{ creating ? "创建中…" : "创建房间  →" }}</button>
      </div>
      <div class="panel join-panel">
        <div class="panel-label">02 / JOIN ROOM</div>
        <h2>输入房间号</h2>
        <p>房间需要密码，请向房主索取房间号和密码。</p>
        <div class="join-form">
          <input v-model="roomCode" maxlength="6" inputmode="numeric" placeholder="房间号" @keyup.enter="joinRoom()" /><input
            v-model="roomPassword"
            type="password"
            placeholder="房间密码"
            @keyup.enter="joinRoom()"
          /><button class="outline-button" :disabled="joining" @click="joinRoom()">{{ joining ? "验证中…" : "加入" }}</button>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </section>
    <section class="rooms-section">
      <div class="section-title">
        <div>
          <p class="eyebrow">OPEN ROOMS</p>
          <h2>可加入的房间</h2>
        </div>
        <div class="room-list-tools">
          <span>{{ rooms.length }} 个等待中</span><button class="outline-button small" :disabled="refreshing" @click="refreshRooms">{{ refreshing ? "刷新中…" : "↻ 刷新" }}</button>
        </div>
      </div>
      <div v-if="rooms.length" class="room-list">
        <article v-for="room in rooms" :key="room.id" class="room-row">
          <div class="room-id">#{{ room.id }}</div>
          <div>
            <strong>{{ room.players[0]?.username }} 的房间</strong
            ><small>{{ room.maxRounds ? room.maxRounds + " 回合" : "无限回合" }} · {{ room.requiresPassword ? "密码房间" : "公开房间" }}</small>
          </div>
          <div class="room-slots">
            {{ room.players.length }} / {{ room.maxPlayers }} <span class="slot-track"><i :style="{ width: (room.players.length / room.maxPlayers) * 100 + '%' }"></i></span>
          </div>
          <button class="outline-button small" @click="roomCode = room.id">填写房间号</button>
        </article>
      </div>
      <div v-else class="empty-state">当前没有开放房间，创建一个开始游戏。</div>
    </section>
  </main>
</template>
