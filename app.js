// ===== Supabase client (safe + stable) =====
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BRrrewpR08gLYTPhn7kZTw_WsMDu5g0";

if (!window.supabase) {
  const el = document.getElementById("auth-msg");
  if (el) el.textContent = "Supabase library did not load. Check index.html script tags.";
  throw new Error("Supabase library not loaded");
}

// Avoid “already declared” if file reloads or is included twice
window.__hcl = window.__hcl || {};
window.__hcl.sb =
  window.__hcl.sb || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sb = window.__hcl.sb;

// ===== Helpers =====
const $ = (id) => document.getElementById(id);

function dayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function setAuthMsg(msg) {
  const el = $("auth-msg");
  if (el) el.textContent = msg || "";
}

function toast(msg, ok = true) {
  const el = $("toast");
  if (!el) return alert(msg);

  el.textContent = msg;
  el.className =
    "fixed bottom-4 right-4 px-5 py-4 rounded-xl shadow-2xl border text-sm " +
    (ok
      ? "bg-emerald-700/80 border-emerald-400/40 text-white"
      : "bg-rose-700/80 border-rose-400/40 text-white");

  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2600);
}

function showAuth() {
  $("auth-box")?.classList.remove("hidden");
  $("game-box")?.classList.add("hidden");
}

function showGame() {
  $("auth-box")?.classList.add("hidden");
  $("game-box")?.classList.remove("hidden");
}

function setBtnDisabled(btn, disabled) {
  if (!btn) return;
  btn.disabled = !!disabled;
  btn.classList.toggle("btn-disabled", !!disabled);
}

// ===== League tier logic =====
function getLeague(points) {
  if (points >= 1900) return { name: "Champion", css: "league-rainbow" };
  if (points >= 1500) return { name: "MVP", css: "league-purple" };
  if (points >= 750) return { name: "Pro", css: "league-gold" };
  if (points >= 450) return { name: "Elite", css: "league-silver" };
  return { name: "Rookie", css: "league-bronze" };
}

function updateLeagueUI(points) {
  const league = getLeague(points);

  if ($("league-name")) $("league-name").textContent = league.name;

  const card = $("player-card");
  if (!card) return;

  card.classList.remove(
    "league-bronze",
    "league-silver",
    "league-gold",
    "league-purple",
    "league-rainbow"
  );
  card.classList.add(league.css);
}

// ===== Habits =====
const HABITS = [
  { key: "water", btn: "btn-log-water", points: 5, label: "Water" },
  { key: "protein", btn: "btn-log-protein", points: 8, label: "Protein" },
  { key: "no_sugar", btn: "btn-log-no-sugar", points: 7, label: "No Added Sugar" },
  { key: "no_coke", btn: "btn-log-no-coke", points: 5, label: "No Coke" },
  { key: "workout", btn: "btn-log-workout", points: 12, label: "Workout" },
  { key: "reading", btn: "btn-log-reading", points: 9, label: "Reading" },
  { key: "sleep", btn: "btn-log-sleep", points: 11, label: "Sleep" },
  { key: "steps_5k", btn: "btn-log-steps-5k", points: 6, label: "Steps (5K–9.9K)", group: "steps" },
  { key: "steps_10k", btn: "btn-log-steps-10k", points: 10, label: "Steps (10K+)", group: "steps" },
];

// ===== State =====
let currentUser = null;

// ===== Profile =====
async function ensureProfile(user) {
  const { data: existing, error } = await sb
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (existing) return existing;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: user.user_metadata?.name || "Player",
    points: 0,
    current_streak: 0,
    last_checkin_date: null,
    avatar_url: null,
  };

  const { data: inserted, error: e2 } = await sb
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (e2) throw e2;
  return inserted;
}

async function getAchievementCount(userId) {
  // If you already created player_achievements, this will work.
  // If not, we gracefully show 0.
  try {
    const { count, error } = await sb
      .from("player_achievements")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

function setAvatarUI(url) {
  const img = $("avatar-img");
  const fallback = $("avatar-fallback");

  if (!img || !fallback) return;

  if (url) {
    img.src = url;
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    fallback.classList.remove("hidden");
  }
}

async function refreshProfileUI() {
  if (!currentUser) return;

  const { data: player, error } = await sb
    .from("players")
    .select("name,email,points,current_streak,last_checkin_date,avatar_url")
    .eq("user_id", currentUser.id)
    .single();

  if (error) throw error;

  if ($("whoami")) $("whoami").textContent = `${player.name} (${player.email})`;
  if ($("stat-points")) $("stat-points").textContent = String(player.points || 0);
  if ($("stat-streak")) $("stat-streak").textContent = String(player.current_streak || 0);

  updateLeagueUI(player.points || 0);
  setAvatarUI(player.avatar_url || null);

  const ach = await getAchievementCount(currentUser.id);
  if ($("stat-achievements")) $("stat-achievements").textContent = String(ach);
}

async function fetchTodayLogs(userId) {
  const today = dayKey();

  const { data, error } = await sb
    .from("checkins")
    .select("habit_key")
    .eq("user_id", userId)
    .eq("checkin_date", today);

  if (error) throw error;
  return new Set((data || []).map((r) => r.habit_key));
}

async function updatePlayerStats(userId, addPoints) {
  const today = dayKey();

  const { data: player, error } = await sb
    .from("players")
    .select("points,current_streak,last_checkin_date")
    .eq("user_id", userId)
    .single();

  if (error) throw error;

  const newPoints = (player.points || 0) + addPoints;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  let newStreak = player.current_streak || 0;

  if (player.last_checkin_date === today) {
    // streak already counted today
  } else if (player.last_checkin_date === yesterdayKey) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  const { error: e2 } = await sb
    .from("players")
    .update({
      points: newPoints,
      current_streak: newStreak,
      last_checkin_date: today,
    })
    .eq("user_id", userId);

  if (e2) throw e2;

  if ($("stat-points")) $("stat-points").textContent = String(newPoints);
  if ($("stat-streak")) $("stat-streak").textContent = String(newStreak);

  updateLeagueUI(newPoints);
}

async function refreshButtons() {
  if (!currentUser) return;

  // enable everything first
  HABITS.forEach((h) => setBtnDisabled($(h.btn), false));

  const logs = await fetchTodayLogs(currentUser.id);

  // disable logged habits
  HABITS.forEach((h) => {
    if (logs.has(h.key)) setBtnDisabled($(h.btn), true);
  });

  // steps: if either is logged, disable both
  if (logs.has("steps_5k") || logs.has("steps_10k")) {
    setBtnDisabled($("btn-log-steps-5k"), true);
    setBtnDisabled($("btn-log-steps-10k"), true);
  }
}

function isConflict409(error) {
  return error && (error.status === 409 || error.code === "23505");
}

async function insertCheckin(userId, habit) {
  const today = dayKey();

  // guard: check already logged today
  const logs = await fetchTodayLogs(userId);

  if (logs.has(habit.key)) {
    toast(`You already logged ${habit.label} today.`, false);
    await refreshButtons();
    return;
  }

  if (habit.group === "steps" && (logs.has("steps_5k") || logs.has("steps_10k"))) {
    toast("You already logged Steps today.", false);
    await refreshButtons();
    return;
  }

  const { error } = await sb.from("checkins").insert({
    user_id: userId,
    habit_key: habit.key,
    points: habit.points,
    checkin_date: today,
    day_key: today,
  });

  if (error) {
    if (isConflict409(error)) {
      toast(`You already logged ${habit.label} today.`, false);
      await refreshButtons();
      return;
    }
    toast("Error logging habit: " + error.message, false);
    return;
  }

  await updatePlayerStats(userId, habit.points);
  toast(`✅ +${habit.points} points!`);
  await refreshButtons();
}

function wireHabitButtons() {
  HABITS.forEach((habit) => {
    const btn = $(habit.btn);
    if (!btn) return;

    btn.onclick = async () => {
      if (!currentUser) {
        toast("Please log in first.", false);
        return;
      }

      if (btn.disabled) {
        toast(`You already logged ${habit.label} today.`, false);
        return;
      }

      await insertCheckin(currentUser.id, habit);
      // optional: refresh leaderboard after a score change
      await renderLeaderboard();
    };
  });
}

// ===== Avatar upload (Supabase Storage bucket: avatars) =====
function cropSquareToCanvas(img, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const side = Math.min(w, h);
  const sx = Math.floor((w - side) / 2);
  const sy = Math.floor((h - side) / 2);

  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

async function handleAvatarUpload(file) {
  if (!currentUser) return;

  const status = $("avatar-status");
  if (status) status.textContent = "Uploading...";

  // Load image to crop
  const img = new Image();
  const url = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const canvas = cropSquareToCanvas(img, 256);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
  URL.revokeObjectURL(url);

  const path = `${currentUser.id}/avatar.png`;

  const { error: upErr } = await sb.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/png" });

  if (upErr) {
    if (status) status.textContent = "Upload failed: " + upErr.message;
    toast("Avatar upload failed: " + upErr.message, false);
    return;
  }

  // Public URL (bucket is public read)
  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  const publicUrl = data?.publicUrl || null;

  const { error: dbErr } = await sb
    .from("players")
    .update({ avatar_url: publicUrl })
    .eq("user_id", currentUser.id);

  if (dbErr) {
    if (status) status.textContent = "Saved image but failed to update profile: " + dbErr.message;
    toast("Saved image but failed to update profile", false);
    return;
  }

  if (status) status.textContent = "✅ Updated!";
  setAvatarUI(publicUrl);
  toast("✅ Profile photo updated!");
}

// ===== Leaderboard =====
function leagueChip(points) {
  const league = getLeague(points);
  const map = {
    "league-bronze": "🟤 Rookie",
    "league-silver": "⚪ Elite",
    "league-gold": "🟡 Pro",
    "league-purple": "🟣 MVP",
    "league-rainbow": "🌈 Champion",
  };
  return map[league.css] || league.name;
}

async function renderLeaderboard() {
  const list = $("leaderboard-list");
  if (!list) return;

  // Fetch top players
  const { data, error } = await sb
    .from("players")
    .select("name,points,avatar_url")
    .order("points", { ascending: false })
    .limit(20);

  if (error) {
    list.innerHTML = `<div class="text-rose-300">Leaderboard error: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="text-slate-400">No players yet.</div>`;
    return;
  }

  list.innerHTML = data.map((p, idx) => {
    const league = getLeague(p.points || 0);
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

    const avatar = p.avatar_url
      ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-xl object-cover border border-slate-600" alt="avatar" />`
      : `<div class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 font-bold">👤</div>`;

    return `
      <div class="flex items-center gap-3 p-4 rounded-xl bg-slate-900/70 border border-slate-700">
        <div class="w-12 text-lg font-extrabold">${medal}</div>
        ${avatar}
        <div class="flex-1 min-w-0">
          <div class="font-bold truncate">${p.name}</div>
          <div class="text-xs text-slate-400">${leagueChip(p.points || 0)}</div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-extrabold text-amber-400">${p.points || 0}</div>
          <div class="text-xs text-slate-500">points</div>
        </div>
        <div class="w-2 h-10 rounded-full ${league.css === "league-bronze" ? "bg-[#cd7f32]" :
          league.css === "league-silver" ? "bg-[#c0c0c0]" :
          league.css === "league-gold" ? "bg-[#ffd700]" :
          league.css === "league-purple" ? "bg-[#a855f7]" : "bg-gradient-to-b from-red-500 via-yellow-400 to-blue-400"}"></div>
      </div>
    `;
  }).join("");
}

// ===== Auth wiring =====
function wireAuth() {
  $("btn-signup")?.addEventListener("click", async () => {
    try {
      setAuthMsg("");

      const email = $("su-email")?.value.trim().toLowerCase();
      const password = $("su-pass")?.value;
      const name = $("su-name")?.value.trim();

      if (!email || !password || !name) {
        setAuthMsg("Please enter email, password, and display name.");
        return;
      }

      const redirectTo = window.location.origin + window.location.pathname;

      const { error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: redirectTo,
        },
      });

      if (error) return setAuthMsg("Signup error: " + error.message);

      setAuthMsg("✅ Signup successful! Check your email to verify, then log in.");
    } catch (e) {
      console.error(e);
      setAuthMsg("Signup crashed: " + (e.message || e));
    }
  });

  $("btn-login")?.addEventListener("click", async () => {
    try {
      setAuthMsg("");

      const email = $("li-email")?.value.trim().toLowerCase();
      const password = $("li-pass")?.value;

      if (!email || !password) {
        setAuthMsg("Please enter email and password.");
        return;
      }

      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) return setAuthMsg("Login error: " + error.message);

      currentUser = data.user;
      if (!currentUser) return setAuthMsg("Login failed: no user returned.");

      await ensureProfile(currentUser);

      showGame();
      wireHabitButtons();

      // avatar input handler
      $("avatar-input")?.addEventListener("change", async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        await handleAvatarUpload(f);
        e.target.value = "";
      });

      $("btn-leaderboard-refresh")?.addEventListener("click", renderLeaderboard);

      await refreshProfileUI();
      await refreshButtons();
      await renderLeaderboard();
    } catch (e) {
      console.error(e);
      setAuthMsg("Login crashed: " + (e.message || e));
    }
  });

  $("btn-logout")?.addEventListener("click", async () => {
    await sb.auth.signOut();
    currentUser = null;
    showAuth();
    setAuthMsg("Logged out.");
  });
}

// ===== Init =====
async function init() {
  wireAuth();
  wireHabitButtons();

  try {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      setAuthMsg("Session error: " + error.message);
      showAuth();
      return;
    }

    const session = data.session;
    if (!session?.user) {
      showAuth();
      return;
    }

    currentUser = session.user;
    await ensureProfile(currentUser);

    showGame();

    // avatar input handler
    $("avatar-input")?.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      await handleAvatarUpload(f);
      e.target.value = "";
    });

    $("btn-leaderboard-refresh")?.addEventListener("click", renderLeaderboard);

    await refreshProfileUI();
    await refreshButtons();
    await renderLeaderboard();
  } catch (e) {
    console.error(e);
    setAuthMsg("Init crashed: " + (e.message || e));
    showAuth();
  }
}

document.addEventListener("DOMContentLoaded", init);
