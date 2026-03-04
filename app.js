// ===== Supabase client =====
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

// Avoid "already declared" if script loaded twice
window.__hcl_supabase = window.__hcl_supabase || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabase = window.__hcl_supabase;

// ===== UI refs =====
const authBox = document.getElementById("auth-box");
const gameBox = document.getElementById("game-box");
const authMsg = document.getElementById("auth-msg");

const whoami = document.getElementById("whoami");
const btnSignup = document.getElementById("btn-signup");
const btnLogin  = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");

const toast = document.getElementById("toast");

const profileAvatar = document.getElementById("profile-avatar");
const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");
const profileRank = document.getElementById("profile-rank");
const profileStreak = document.getElementById("profile-streak");
const profileAchievements = document.getElementById("profile-achievements");
const profilePoints = document.getElementById("profile-points");
const profileCard = document.getElementById("profile-card");
const profileMsg = document.getElementById("profile-msg");
const avatarFile = document.getElementById("avatar-file");

const habitMsg = document.getElementById("habit-msg");

const leaderboardList = document.getElementById("leaderboard-list");
const btnRefreshLeaderboard = document.getElementById("btn-refresh-leaderboard");

// Habit buttons
const btns = {
  water: document.getElementById("btn-log-water"),
  protein: document.getElementById("btn-log-protein"),
  steps_5k: document.getElementById("btn-log-steps-5k"),
  steps_10k: document.getElementById("btn-log-steps-10k"),
  workout: document.getElementById("btn-log-workout"),
  reading: document.getElementById("btn-log-reading"),
  sleep: document.getElementById("btn-log-sleep"),
  no_sugar: document.getElementById("btn-log-no-sugar"),
  no_coke: document.getElementById("btn-log-no-coke"),
};

const HABITS = {
  water:     { points: 5,  name: "Water" },
  protein:   { points: 8,  name: "Protein" },
  steps_5k:  { points: 6,  name: "Steps 5K–9.9K", group: "steps" },
  steps_10k: { points: 10, name: "Steps 10K+",   group: "steps" },
  workout:   { points: 12, name: "Workout" },
  reading:   { points: 9,  name: "Reading" },
  sleep:     { points: 11, name: "Sleep" },
  no_sugar:  { points: 7,  name: "No Added Sugar" },
  no_coke:   { points: 5,  name: "No Coke" },
};

// ===== helpers =====
function setAuthMsg(text) { if (authMsg) authMsg.textContent = text || ""; }
function setProfileMsg(text) { if (profileMsg) profileMsg.textContent = text || ""; }
function setHabitMsg(text) { if (habitMsg) habitMsg.textContent = text || ""; }

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2500);
}

function showGame() {
  authBox?.classList.add("hidden");
  gameBox?.classList.remove("hidden");
}

function showAuth() {
  gameBox?.classList.add("hidden");
  authBox?.classList.remove("hidden");
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Rank tier (your ranges)
function getRank(points) {
  if (points >= 1900) return { name: "Champion", cls: "rank-champ" };
  if (points >= 1500) return { name: "MVP",      cls: "rank-mvp" };
  if (points >= 750)  return { name: "Pro",      cls: "rank-pro" };
  if (points >= 450)  return { name: "Elite",    cls: "rank-elite" };
  return { name: "Rookie", cls: "rank-rookie" };
}

function applyRankOutline(points) {
  const r = getRank(points);
  profileCard?.classList.remove("rank-rookie", "rank-elite", "rank-pro", "rank-mvp", "rank-champ");
  profileCard?.classList.add(r.cls);
  profileCard?.classList.add("border-2");
  if (profileRank) profileRank.textContent = `Rank: ${r.name}`;
}

// ===== profile / db =====
async function ensureProfile(user, fallbackName, fallbackEmoji) {
  const { data: existing, error } = await supabase
    .from("players")
    .select("user_id,email,name,avatar,avatar_url,points,current_streak,last_checkin_date,achievements_count")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (existing) return existing;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: fallbackName || "Player",
    avatar: (fallbackEmoji || "👤").slice(0, 4),
    points: 0,
    current_streak: 0,
    achievements_count: 0,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (insErr) throw insErr;
  return inserted;
}

function setProfileUI(profile) {
  if (whoami) whoami.textContent = `${profile.name} (${profile.email})`;

  if (profileName) profileName.textContent = profile.name || "Player";
  if (profileEmail) profileEmail.textContent = profile.email || "";
  if (profilePoints) profilePoints.textContent = String(profile.points ?? 0);
  if (profileStreak) profileStreak.textContent = String(profile.current_streak ?? 0);
  if (profileAchievements) profileAchievements.textContent = String(profile.achievements_count ?? 0);

  applyRankOutline(profile.points ?? 0);

  const url = profile.avatar_url || "";
  if (profileAvatar) {
    if (url) profileAvatar.src = url;
    else profileAvatar.removeAttribute("src");
  }
}

async function fetchMyProfile(userId) {
  const { data, error } = await supabase
    .from("players")
    .select("user_id,email,name,avatar,avatar_url,points,current_streak,last_checkin_date,achievements_count")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

// ===== avatar upload (square crop) =====
async function fileToSquareBlob(file, size = 512) {
  const img = new Image();
  const url = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const minSide = Math.min(img.width, img.height);
  const sx = Math.floor((img.width - minSide) / 2);
  const sy = Math.floor((img.height - minSide) / 2);

  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
  URL.revokeObjectURL(url);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob;
}

async function uploadAvatar(userId, file) {
  setProfileMsg("Uploading...");

  const blob = await fileToSquareBlob(file, 512);
  const path = `${userId}/avatar.jpg`;

  const { error: upErr } = await supabase
    .storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: updErr } = await supabase
    .from("players")
    .update({ avatar_url: publicUrl })
    .eq("user_id", userId);

  if (updErr) throw updErr;

  setProfileMsg("✅ Profile photo updated!");
  return publicUrl;
}

// ===== habits / streak logic =====
function setButtonDisabled(btn, disabled) {
  if (!btn) return;
  btn.disabled = disabled;
  btn.classList.toggle("btn-disabled", disabled);
}

async function getTodaysLoggedHabits(userId) {
  const date = todayISODate();
  const { data, error } = await supabase
    .from("checkins")
    .select("habit_key")
    .eq("user_id", userId)
    .eq("checkin_date", date);

  if (error) throw error;
  return new Set((data || []).map(r => r.habit_key));
}

function enforceStepsMutualExclusion(logged) {
  const has5k = logged.has("steps_5k");
  const has10k = logged.has("steps_10k");
  if (has5k) setButtonDisabled(btns.steps_10k, true);
  if (has10k) setButtonDisabled(btns.steps_5k, true);
}

async function refreshHabitButtons(userId) {
  const logged = await getTodaysLoggedHabits(userId);

  // enable all first
  Object.keys(btns).forEach(k => setButtonDisabled(btns[k], false));

  // disable already-logged habits
  logged.forEach(hk => {
    if (btns[hk]) setButtonDisabled(btns[hk], true);
  });

  // steps mutually exclusive
  enforceStepsMutualExclusion(logged);

  return logged;
}

async function updateStreakAfterCheckin(userId) {
  const profile = await fetchMyProfile(userId);
  const today = todayISODate();
  const last = profile.last_checkin_date; // YYYY-MM-DD or null

  let newStreak = profile.current_streak ?? 0;

  if (!last) {
    newStreak = 1;
  } else if (last === today) {
    newStreak = newStreak || 1;
  } else {
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const y = yd.getFullYear();
    const m = String(yd.getMonth() + 1).padStart(2, "0");
    const d = String(yd.getDate()).padStart(2, "0");
    const yesterday = `${y}-${m}-${d}`;

    newStreak = (last === yesterday) ? (newStreak + 1) : 1;
  }

  const { error } = await supabase
    .from("players")
    .update({ current_streak: newStreak, last_checkin_date: today })
    .eq("user_id", userId);

  if (error) throw error;
  return newStreak;
}

async function logHabit(userId, habitKey) {
  setHabitMsg("");

  const logged = await getTodaysLoggedHabits(userId);

  // UI guard
  if (logged.has(habitKey)) {
    showToast(`You already logged ${HABITS[habitKey].name} today ✅`);
    return;
  }
  if (HABITS[habitKey].group === "steps") {
    const other = habitKey === "steps_5k" ? "steps_10k" : "steps_5k";
    if (logged.has(other)) {
      showToast(`You already logged a Steps goal today ✅`);
      return;
    }
  }

  // Insert checkin (DB also enforces uniqueness)
  const points = HABITS[habitKey].points;

  const { error: insErr } = await supabase
    .from("checkins")
    .insert({ user_id: userId, habit_key: habitKey, points });

  if (insErr) {
    showToast(`You already logged ${HABITS[habitKey].name} today ✅`);
    return;
  }

  // Add points
  const profile = await fetchMyProfile(userId);
  const newPoints = (profile.points ?? 0) + points;

  const { error: updErr } = await supabase
    .from("players")
    .update({ points: newPoints })
    .eq("user_id", userId);

  if (updErr) throw updErr;

  // streak updates when at least one habit logged today
  const newStreak = await updateStreakAfterCheckin(userId);

  // refresh UI
  const updated = await fetchMyProfile(userId);
  setProfileUI(updated);

  await refreshHabitButtons(userId);
  await renderLeaderboard();

  showToast(`+${points} pts • 🔥 Streak: ${newStreak}`);
}

// ===== leaderboard =====
function leaderboardCardClass(points) {
  const r = getRank(points);
  return r.cls === "rank-champ" ? "rank-champ" : `${r.cls} border-2`;
}

async function renderLeaderboard() {
  const { data, error } = await supabase
    .from("players")
    .select("user_id,name,avatar_url,points,current_streak,achievements_count")
    .order("points", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (!data || data.length === 0) {
    if (leaderboardList) leaderboardList.innerHTML = `<div class="text-slate-500">No players yet.</div>`;
    return;
  }

  if (!leaderboardList) return;

  leaderboardList.innerHTML = data.map((p, idx) => {
    const rank = getRank(p.points ?? 0);
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
    const cls = leaderboardCardClass(p.points ?? 0);

    const avatar = p.avatar_url
      ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-lg object-cover bg-slate-900 border border-slate-700" />`
      : `<div class="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700"></div>`;

    return `
      <div class="bg-slate-900/40 border border-slate-700 rounded-2xl p-4 ${cls}">
        <div class="flex items-center gap-3">
          <div class="text-lg font-extrabold w-10">${medal}</div>
          ${avatar}
          <div class="min-w-0 flex-1">
            <div class="font-bold truncate">${p.name || "Player"}</div>
            <div class="text-xs text-slate-400">${rank.name} • 🔥 ${p.current_streak ?? 0} streak</div>
          </div>
          <div class="text-right">
            <div class="text-xl font-extrabold text-amber-400">${p.points ?? 0}</div>
            <div class="text-xs text-slate-500">pts</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ===== Auth handlers =====
btnSignup?.addEventListener("click", async () => {
  setAuthMsg("");

  const email = document.getElementById("su-email")?.value.trim().toLowerCase();
  const password = document.getElementById("su-pass")?.value;
  const name = document.getElementById("su-name")?.value.trim();
  const emoji = document.getElementById("su-emoji")?.value.trim();

  if (!email || !password || !name) {
    setAuthMsg("Please enter email, password, and display name.");
    return;
  }

  const redirectTo = window.location.origin + window.location.pathname;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: { name, emoji }
    }
  });

  if (error) {
    setAuthMsg(`Signup error: ${error.message}`);
    return;
  }

  setAuthMsg("Signup successful! Check your email to verify, then come back and log in.");
});

btnLogin?.addEventListener("click", async () => {
  setAuthMsg("");

  const email = document.getElementById("li-email")?.value.trim().toLowerCase();
  const password = document.getElementById("li-pass")?.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthMsg(`Login error: ${error.message}`);
    return;
  }

  const user = data.user;
  if (!user) {
    setAuthMsg("Login failed. Please try again.");
    return;
  }

  try {
    const name = user.user_metadata?.name || "Player";
    const emoji = user.user_metadata?.emoji || "👤";
    const profile = await ensureProfile(user, name, emoji);

    showGame();
    setProfileUI(profile);

    await renderLeaderboard();
    await refreshHabitButtons(user.id);

  } catch (e) {
    setAuthMsg(`Profile error: ${e.message || e}`);
  }
});

btnLogout?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showAuth();
  setAuthMsg("Logged out.");
});

// Avatar upload handler
avatarFile?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    setProfileMsg("Please log in again.");
    return;
  }

  try {
    const url = await uploadAvatar(user.id, file);
    if (profileAvatar) profileAvatar.src = url;
    showToast("Avatar updated ✅");
  } catch (err) {
    setProfileMsg(`Upload error: ${err.message || err}`);
  } finally {
    e.target.value = "";
  }
});

// Habit button listeners
Object.keys(btns).forEach((key) => {
  btns[key]?.addEventListener("click", async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return showToast("Please log in again.");
    await logHabit(user.id, key);
  });
});

btnRefreshLeaderboard?.addEventListener("click", async () => {
  await renderLeaderboard();
});

// Auto-session restore
(async function init() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user) {
    showAuth();
    return;
  }

  try {
    const user = session.user;
    const name = user.user_metadata?.name || "Player";
    const emoji = user.user_metadata?.emoji || "👤";
    const profile = await ensureProfile(user, name, emoji);

    showGame();
    setProfileUI(profile);

    await renderLeaderboard();
    await refreshHabitButtons(user.id);

  } catch (e) {
    showAuth();
    setAuthMsg(`Session error: ${e.message || e}`);
  }
})();
