<script setup>
const props = defineProps({ roomId: String, token: String });
const config = useRuntimeConfig();
const canvas = ref(null);
const connected = ref(false);
const room = ref(null);
const playerId = ref("");
const state = reactive({ maze: null, players: [], bullets: [], pickups: [], traps: [], explosions: [], lasers: [], laserAims: [] });
const keys = reactive({ w: false, s: false });
let socket;
let frame;
let fire = false;
let placeTrap = false;
let mouse = { x: 0, y: 0 };
let hasMouse = false;
let renderPlayers = [];
let renderBullets = [];
let lastSnapshotAt = 0;
const pickupImages = new Map();
const weaponNames = { laser: "激光", fragmentBomb: "碎片炸弹", wifi: "WIFI 弹", gatling: "加特林", tracking: "追踪导弹" };

const isOwner = computed(() => room.value?.ownerId === playerId.value);
function send() {
  const angle = currentAngle();
  if (socket?.readyState === 1) {
    socket.send(JSON.stringify({ type: "input", keys, angle, aimAngle: angle, ...(hasMouse ? { aimX: mouse.x, aimY: mouse.y } : {}), fire, placeTrap }));
  }
  placeTrap = false;
}
function currentAngle() {
  const me = renderPlayers.find((player) => player.id === playerId.value);
  return me ? Math.atan2(mouse.y - me.y, mouse.x - me.x) : 0;
}
function connect() {
  const httpUrl = new URL(config.public.apiBase);
  // const url = new URL((httpUrl.protocol === "https:" ? "wss:" : "ws:") + "//" + httpUrl.host + "/ws");
  const wsProto = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  const wsPath = httpUrl.pathname.replace(/\/$/, "") + "/ws";
  const url = new URL(`${wsProto}//${httpUrl.host}${wsPath}`);

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
      state.traps = [];
      state.lasers = [];
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
      state.traps = message.traps || [];
      state.laserAims = message.laserAims || [];
    }
    if (message.type === "lasers") {
      state.lasers = message.beams || [];
    }
    if (message.type === "laser_aims") {
      state.laserAims = message.aims || [];
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
  hasMouse = true;
}
function key(value, down, repeat = false) {
  if (value === "w" || value === "s") keys[value] = down;
  if (value === "e" && down && !repeat) placeTrap = true;
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
  state.lasers.forEach((laser) => {
    ctx.save();
    ctx.globalAlpha = laser.alpha ?? 1;
    ctx.strokeStyle = "#f04444";
    ctx.lineWidth = Math.max(2, view.scale * 0.035);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const segment of laser.segments) {
      ctx.moveTo(view.ox + segment.x1 * view.scale, view.oy + segment.y1 * view.scale);
      ctx.lineTo(view.ox + segment.x2 * view.scale, view.oy + segment.y2 * view.scale);
    }
    ctx.stroke();
    ctx.restore();
  });
  state.pickups.forEach((pickup) => {
    const image = pickupImages.get(pickup.type);
    const size = view.scale * 0.42;
    if (image?.complete && image.naturalWidth) {
      ctx.drawImage(image, view.ox + pickup.x * view.scale - size / 2, view.oy + pickup.y * view.scale - size / 2, size, size);
    } else {
      ctx.fillStyle = "#d66b36";
      ctx.beginPath();
      ctx.arc(view.ox + pickup.x * view.scale, view.oy + pickup.y * view.scale, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  state.traps.forEach((trap) => {
    const image = pickupImages.get("trap");
    if (!image?.complete || !image.naturalWidth) return;
    const size = view.scale * 0.35;
    ctx.save();
    ctx.globalAlpha = trap.opacity;
    ctx.drawImage(image, view.ox + trap.x * view.scale - size / 2, view.oy + trap.y * view.scale - size / 2, size, size);
    ctx.restore();
  });
  state.bullets.forEach((bullet) => {
    const x = view.ox + bullet.x * view.scale;
    const y = view.oy + bullet.y * view.scale;
    if (bullet.kind === "shard") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bullet.angle || Math.atan2(bullet.vy, bullet.vx));
      ctx.fillStyle = "#e95d8e";
      ctx.beginPath();
      ctx.moveTo(view.scale * 0.065, 0);
      ctx.lineTo(-view.scale * 0.04, -view.scale * 0.035);
      ctx.lineTo(-view.scale * 0.03, view.scale * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    if (bullet.kind === "wifi" || bullet.kind === "tracking") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
      ctx.fillStyle = bullet.kind === "wifi" ? "#55c7d9" : "#79c95b";
      ctx.beginPath();
      ctx.moveTo(view.scale * 0.12, 0);
      ctx.lineTo(-view.scale * 0.075, -view.scale * 0.065);
      ctx.lineTo(-view.scale * 0.055, view.scale * 0.065);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = bullet.kind === "fragmentBomb" ? "#e95d8e" : "#4a4a4a";
    ctx.beginPath();
    ctx.arc(x, y, view.scale * (bullet.kind === "fragmentBomb" ? 0.085 : bullet.kind === "gatling" ? 0.025 : 0.045), 0, Math.PI * 2);
    ctx.fill();
  });
  renderPlayers.forEach((player) => {
    if (!player.alive) return;
    const centerX = view.ox + player.x * view.scale;
    const centerY = view.oy + player.y * view.scale;
    if (player.weapon === "laser") {
      ctx.save();
      ctx.strokeStyle = "rgba(235, 73, 69, 0.75)";
      ctx.lineWidth = Math.max(1, view.scale * 0.018);
      ctx.setLineDash([view.scale * 0.09, view.scale * 0.07]);
      ctx.beginPath();
      for (const segment of state.laserAims.find((aim) => aim.id === player.id)?.segments || []) {
        ctx.moveTo(view.ox + segment.x1 * view.scale, view.oy + segment.y1 * view.scale);
        ctx.lineTo(view.ox + segment.x2 * view.scale, view.oy + segment.y2 * view.scale);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(player.angle);
    ctx.fillStyle = player.color || (player.id === playerId.value ? "#d1a82d" : "#bd5148");
    ctx.fillRect(-view.scale * 0.18, -view.scale * 0.13, view.scale * 0.36, view.scale * 0.26);
    ctx.fillStyle = "#293238";
    ctx.fillRect(0, -view.scale * 0.035, view.scale * 0.24, view.scale * 0.07);
    ctx.restore();

    const labelY = view.oy + player.y * view.scale - view.scale * 0.21;
    const fontSize = Math.max(10, Math.min(14, view.scale * 0.14));
    ctx.save();
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelWidth = ctx.measureText(player.username).width + 10;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(centerX - labelWidth / 2, labelY - fontSize * 0.72, labelWidth, fontSize * 1.45);
    ctx.strokeStyle = player.color || "#59636a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(centerX - labelWidth / 2, labelY - fontSize * 0.72, labelWidth, fontSize * 1.45);
    ctx.fillStyle = player.color || "#293238";
    ctx.fillText(player.username, centerX, labelY);
    ctx.restore();
  });
  frame = requestAnimationFrame(draw);
}
onMounted(() => {
  for (const [type, asset] of Object.entries({
    laser: "laser",
    fragmentBomb: "fragment-bomb",
    wifi: "wifi-shell",
    gatling: "gatling",
    tracking: "tracking-missile",
    trap: "trap-mine",
  })) {
    const image = new Image();
    const basePath = config.app.baseURL || "/";
    image.src = `${basePath.replace(/\/?$/, "/")}assets/pickups/${asset}.svg`;
    pickupImages.set(type, image);
  }
  connect();
  const down = (event) => key(event.key.toLowerCase(), true, event.repeat),
    up = (event) => key(event.key.toLowerCase(), false, event.repeat);
  const releaseFire = () => {
    fire = false;
  };
  const releaseOnBlur = () => {
    fire = false;
    keys.w = false;
    keys.s = false;
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("mouseup", releaseFire);
  window.addEventListener("blur", releaseOnBlur);
  frame = requestAnimationFrame(draw);
  const timer = setInterval(send, 50);
  onUnmounted(() => {
    clearInterval(timer);
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("mouseup", releaseFire);
    window.removeEventListener("blur", releaseOnBlur);
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
        @mouseup="fire = false"
      ></canvas>
      <div class="canvas-hint">W / S 移动 · 鼠标瞄准 · 按住左键攻击 · E 放置陷阱</div>
    </div>
    <aside class="scoreboard">
      <div class="connection"><span :class="['status-dot', { offline: !connected }]" /> {{ connected ? "已连接" : "连接中" }}</div>
      <div class="round-label">
        ROUND {{ room?.round || 0 }} <span>{{ room?.status || "WAITING" }}</span>
      </div>
      <div class="stat-head"><span>玩家</span><span>击杀</span><span>死亡</span><span>K/D</span></div>
      <div class="players">
        <article v-for="player in room?.players || []" :key="player.id" :class="{ mine: player.id === playerId }">
          <span class="player-color" :style="{ backgroundColor: player.color }"></span>
          <div class="player-name">
            <strong>{{ player.username }} <i v-if="player.id === room?.ownerId">主</i></strong
            ><small
              >{{ player.connected ? "在线" : "离线"
              }}<template v-if="player.weapon && player.weapon !== 'normal'"> · {{ weaponNames[player.weapon] }} x{{ player.weaponAmmo }}</template
              ><template v-if="player.trapAmmo"> · 地雷 x{{ player.trapAmmo }}</template></small
            >
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
