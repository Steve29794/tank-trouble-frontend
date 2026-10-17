<script setup>
const props = defineProps({ roomId: String, token: String });
const config = useRuntimeConfig();
const canvas = ref(null);
const connected = ref(false);
const room = ref(null);
const playerId = ref("");
const state = reactive({ maze: null, players: [], bullets: [], pickups: [], explosions: [] });
const keys = reactive({ w: false, s: false });
let socket;
let frame;
let fire = false;
let mouse = { x: 0, y: 0 };
let renderPlayers = [];
let renderBullets = [];
let lastSnapshotAt = 0;

const isOwner = computed(() => room.value?.ownerId === playerId.value);
function send() {
  const angle = currentAngle();
  if (socket?.readyState === 1) socket.send(JSON.stringify({ type: "input", keys, angle, fire }));
  fire = false;
}
function currentAngle() {
  const me = renderPlayers.find((player) => player.id === playerId.value);
  return me ? Math.atan2(mouse.y - me.y, mouse.x - me.x) : 0;
}
function connect() {
  const httpUrl = new URL(config.public.apiBase);
  const url = new URL((httpUrl.protocol === "https:" ? "wss:" : "ws:") + "//" + httpUrl.host + "/ws");
  url.searchParams.set("room", props.roomId);
  url.searchParams.set("token", props.token);
  socket = new WebSocket(url);
  socket.onopen = () => {
    connected.value = true;
  };
  socket.onclose = () => {
    connected.value = false;
  };
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "hello") {
      room.value = message.room;
      playerId.value = message.playerId;
      state.maze = message.maze;
    }
    if (message.room) room.value = message.room;
    if (message.type === "room_update" && message.room) {
      // 房间成员变化由服务端主动推送，立即刷新右侧玩家列表。
      room.value = message.room;
    }
    if (message.maze) state.maze = message.maze;
    if (message.type === "round_start") {
      renderBullets = [];
      state.bullets = [];
    }
    if (message.type === "state") {
      const now = performance.now();
      const old = new Map(renderPlayers.map((player) => [player.id, player]));
      renderPlayers = message.players.map((player) => {
        const previous = old.get(player.id) || player;
        return { ...player, fromX: previous.x, fromY: previous.y, fromAngle: previous.angle, targetX: player.x, targetY: player.y, targetAngle: player.angle, receivedAt: now };
      });
      lastSnapshotAt = now;
      state.players = renderPlayers;
      state.pickups = message.pickups;
    }
    if (message.type === "projectiles") {
      const now = performance.now();
      const oldBullets = new Map(renderBullets.map((bullet) => [bullet.id, bullet]));
      renderBullets = message.bullets.map((bullet) => {
        const previous = oldBullets.get(bullet.id);
        const bounced = previous && bullet.bounces !== previous.bounces;
        return {
          ...bullet,
          fromX: bounced ? bullet.x : (previous?.targetX ?? bullet.x),
          fromY: bounced ? bullet.y : (previous?.targetY ?? bullet.y),
          targetX: bullet.x,
          targetY: bullet.y,
          receivedAt: now,
        };
      });
      state.bullets = renderBullets;
    }
    if (message.type === "hit") {
      renderBullets = renderBullets.filter((bullet) => bullet.id !== message.bulletId);
      state.bullets = renderBullets;
      renderPlayers = renderPlayers.map((player) => (player.id === message.victimId ? { ...player, alive: false } : player));
      state.players = renderPlayers;
      state.explosions.push({ x: message.x, y: message.y, started: performance.now() });
      setTimeout(() => state.explosions.shift(), 550);
    }
    if (message.type === "bullet_removed") {
      renderBullets = renderBullets.filter((bullet) => bullet.id !== message.bulletId);
      state.bullets = renderBullets;
    }
  };
}
function start() {
  socket?.send(JSON.stringify({ type: "start" }));
}
function getView() {
  const maze = state.maze;
  if (!canvas.value || !maze) return null;
  const width = canvas.value.clientWidth,
    height = canvas.value.clientHeight,
    scale = Math.min((width - 32) / maze.width, (height - 32) / maze.height);
  return { scale, ox: (width - maze.width * scale) / 2, oy: (height - maze.height * scale) / 2 };
}
function aim(event) {
  const view = getView();
  if (!view) return;
  const rect = canvas.value.getBoundingClientRect();
  mouse = { x: (event.clientX - rect.left - view.ox) / view.scale, y: (event.clientY - rect.top - view.oy) / view.scale };
}
function key(value, down) {
  if (value === "w" || value === "s") keys[value] = down;
}
function updateInterpolation(now) {
  const playerBlend = Math.max(0, Math.min(1, (now - lastSnapshotAt) / 115));
  for (const player of renderPlayers) {
    player.x = player.fromX + (player.targetX - player.fromX) * playerBlend;
    player.y = player.fromY + (player.targetY - player.fromY) * playerBlend;
    const delta = Math.atan2(Math.sin(player.targetAngle - player.fromAngle), Math.cos(player.targetAngle - player.fromAngle));
    player.angle = player.fromAngle + delta * playerBlend;
  }
  for (const bullet of renderBullets) {
    const blend = Math.max(0, Math.min(1, (now - bullet.receivedAt) / 33));
    bullet.x = bullet.fromX + (bullet.targetX - bullet.fromX) * blend;
    bullet.y = bullet.fromY + (bullet.targetY - bullet.fromY) * blend;
  }
  state.players = renderPlayers;
  state.bullets = renderBullets;
}
function draw() {
  const el = canvas.value;
  if (!el) return;
  updateInterpolation(performance.now());
  const ctx = el.getContext("2d"),
    dpr = window.devicePixelRatio || 1,
    width = el.clientWidth,
    height = el.clientHeight;
  if (el.width !== width * dpr) {
    el.width = width * dpr;
    el.height = height * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#f7f8f5";
  ctx.fillRect(0, 0, width, height);
  const maze = state.maze;
  if (!maze) {
    ctx.fillStyle = "#6f7b80";
    ctx.font = "14px monospace";
    ctx.fillText("CONNECTING TO ARENA…", 24, 40);
    frame = requestAnimationFrame(draw);
    return;
  }
  const view = getView();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(view.ox, view.oy, maze.width * view.scale, maze.height * view.scale);
  ctx.strokeStyle = "#273036";
  ctx.lineWidth = Math.max(2, view.scale * 0.055);
  ctx.lineCap = "square";
  ctx.beginPath();
  for (const wall of maze.walls || []) {
    ctx.moveTo(view.ox + wall.x1 * view.scale, view.oy + wall.y1 * view.scale);
    ctx.lineTo(view.ox + wall.x2 * view.scale, view.oy + wall.y2 * view.scale);
  }
  ctx.stroke();
  state.explosions.forEach((explosion) => {
    const age = (performance.now() - explosion.started) / 550;
    ctx.strokeStyle = "#e58b45";
    ctx.globalAlpha = 1 - age;
    ctx.beginPath();
    ctx.arc(view.ox + explosion.x * view.scale, view.oy + explosion.y * view.scale, view.scale * (0.2 + age * 0.65), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  state.pickups.forEach((pickup) => {
    ctx.fillStyle = pickup.type === "shield" ? "#49aa7f" : "#d66b36";
    ctx.beginPath();
    ctx.arc(view.ox + pickup.x * view.scale, view.oy + pickup.y * view.scale, view.scale * 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
  state.bullets.forEach((bullet) => {
    ctx.fillStyle = "#cc7d20";
    ctx.beginPath();
    ctx.arc(view.ox + bullet.x * view.scale, view.oy + bullet.y * view.scale, view.scale * 0.045, 0, Math.PI * 2);
    ctx.fill();
  });
  renderPlayers.forEach((player) => {
    if (!player.alive) return;
    ctx.save();
    ctx.translate(view.ox + player.x * view.scale, view.oy + player.y * view.scale);
    ctx.rotate(player.angle);
    ctx.fillStyle = player.id === playerId.value ? "#d1a82d" : "#bd5148";
    ctx.fillRect(-view.scale * 0.18, -view.scale * 0.13, view.scale * 0.36, view.scale * 0.26);
    ctx.fillStyle = "#293238";
    ctx.fillRect(0, -view.scale * 0.035, view.scale * 0.24, view.scale * 0.07);
    if (player.shield) {
      ctx.strokeStyle = "#49aa7f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, view.scale * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
  frame = requestAnimationFrame(draw);
}
onMounted(() => {
  connect();
  const down = (event) => key(event.key.toLowerCase(), true),
    up = (event) => key(event.key.toLowerCase(), false);
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  frame = requestAnimationFrame(draw);
  const timer = setInterval(send, 50);
  onUnmounted(() => {
    clearInterval(timer);
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    socket?.close();
  });
});
</script>
<template>
  <section class="arena-layout">
    <div class="canvas-wrap">
      <canvas
        ref="canvas"
        @mousemove="aim"
        @mousedown="
          aim($event);
          fire = true;
        "
      ></canvas>
      <div class="canvas-hint">W 前进 · S 后退 · 鼠标瞄准 · 左键发射</div>
    </div>
    <aside class="scoreboard">
      <div class="connection"><span :class="['status-dot', { offline: !connected }]" /> {{ connected ? "已连接" : "连接中" }}</div>
      <div class="round-label">
        ROUND {{ room?.round || 0 }} <span>{{ room?.status || "WAITING" }}</span>
      </div>
      <div class="stat-head"><span>玩家</span><span>击杀</span><span>死亡</span><span>K/D</span></div>
      <div class="players">
        <article v-for="player in room?.players || []" :key="player.id" :class="{ mine: player.id === playerId }">
          <span class="player-color"></span>
          <div class="player-name">
            <strong>{{ player.username }} <i v-if="player.id === room?.ownerId">主</i></strong
            ><small>{{ player.connected ? "在线" : "离线" }}</small>
          </div>
          <b class="player-stat">{{ player.kills || 0 }}</b
          ><b class="player-stat">{{ player.deaths || 0 }}</b
          ><b class="player-stat kd">{{ player.kd ?? 0 }}</b>
        </article>
      </div>
      <button v-if="isOwner && room?.status === 'waiting'" class="primary-button" @click="start">开始游戏 →</button>
      <div v-if="room?.status === 'waiting'" class="waiting-note">等待房主开始这一回合</div>
      <div class="rules-mini"><b>战场规则</b><span>炮弹最多存在 10 秒</span><span>每人最多 5 颗炮弹</span><span>击败玩家 +1 分</span></div>
    </aside>
  </section>
</template>
<style>
.arena-layout {
  max-width: 1600px;
  padding-left: 4vw;
  padding-right: 4vw;
}

@media (max-width: 800px) {
  .arena-layout {
    padding-left: 5vw;
    padding-right: 5vw;
  }
}
</style>
