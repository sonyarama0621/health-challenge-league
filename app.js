// =============================
// SUPABASE CONNECTION
// =============================
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================
// UI HELPERS
// =============================
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = document.createElement("div");
  el.className =
    "fixed bottom-6 right-6 bg-slate-900 border border-slate-700 px-4 py-3 rounded-xl shadow-lg z-[9999]";
  el.innerHTML = `<div class="text-sm text-slate-200">${msg}</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function tierFromPoints(points) {
  const p = Number(points || 0);
  if (p >= 1900) return { name: "Champion", border: "border-4 border-white" };
  if (p >= 1500) return { name: "MVP", border: "border-4 border-purple-500" };
  if (p >= 750) return { name: "Pro", border: "border-4 border-yellow-400" };
  if (p >= 450) return { name: "Elite", border: "border-4 border-slate-300" };
  return { name: "Rookie", border: "border-4 border-amber-700" };
}

// rainbow-ish using gradient ring (simple MVP)
function applyTierBorder(points) {
  const tier = tierFromPoints(points);
  const card = $("profile-card");

  card.classList.remove(
    "border-amber-700",
    "border-slate-300",
    "border-yellow-400",
    "border-purple-500",
    "border-white",
    "border-4"
  );

  if (tier.name === "Champion") {
    card.classList.add("border-4");
    card.style.borderImage =
      "linear-gradient(90deg, #f59e0b, #ef4444, #a855f7, #22c55e, #3b82f6) 1";
  } else {
    card.style.borderImage = "";
    card.classList.add(...tier.border.split(" "));
  }

  $("league-tier").textContent = `Current League Tier: ${tier.name}`;
}

// =============================
// AUTH UI
// =============================
function setAuthMsg(msg) {
  $("auth-msg").textContent = msg || "";
}

function showAuth() {
  $("auth-box").classList.remove("hidden");
  $("app-shell").classList.add("hidden");
  $("btn-logout").classList.add("hidden");
}

function showApp() {
  $("auth-box").classList.add("hidden");
  $("app-shell").classList.remove("hidden");
  $("btn-logout").classList.remove("hidden");
}

// =============================
// GLOBAL STATE
// =============================
let currentUser = null;
let playerProfile = null;

let achievements = [];
let unlockedAchievementCodes = [];

let myLeagues = [];
let activeLeagueId = null;
let mode = "solo"; // "solo" or "league"

// =============================
// AUTH HANDLERS
// =============================
$("btn-signup").addEventListener("click", async () => {
  setAuthMsg("");

  const email = $("su-email").value.trim().toLowerCase();
  const password = $("su-pass").value;
  const name = $("su-name").value.trim();
  const emoji = $("su-emoji").value.trim();

  if (!email || !password || !name) {
    setAuthMsg("Please enter email, password, and display name.");
    return;
  }

  const redirectTo = window.location.origin + window.location.pathname;

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: { name, emoji },
    },
  });

  if (error) {
    setAuthMsg(`Signup error: ${error.message}`);
    return;
  }

  setAuthMsg("Signup successful! Check your email to verify, then log in.");
});

$("btn-login").addEventListener("click", async () => {
  setAuthMsg("");

  const email = $("li-email").value.trim().toLowerCase();
  const password = $("li-pass").value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthMsg(`Login error: ${error.message}`);
    return;
  }

  if (!data.user) {
    setAuthMsg("Login failed. Please try again.");
    return;
  }

  await onLogin(data.user);
});

$("btn-logout").addEventListener("click", async () => {
  await sb.auth.signOut();
  currentUser = null;
  playerProfile = null;
  showAuth();
});

// =============================
// PROFILE + DATA LOAD
// =============================
async function ensureProfile(user) {
  const { data: existing, error: selErr } = await sb
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing;

  const fallbackName = user.user_metadata?.name || "Player";
  const fallbackEmoji = user.user_metadata?.emoji || "👤";

  const { data: inserted, error: insErr } = await sb
    .from("players")
    .insert({
      user_id: user.id,
      email: user.email,
      name: fallbackName,
      avatar: fallbackEmoji,
      points: 0,
      streak: 0,
    })
    .select()
    .single();

  if (insErr) throw insErr;
  return inserted;
}

async function loadAchievements() {
  const { data } = await sb.from("achievements").select("*");
  achievements = data || [];
}

async function loadUnlockedAchievements() {
  const { data } = await sb
    .from("user_achievements")
    .select("achievement_code")
    .eq("user_id", currentUser.id);

  unlockedAchievementCodes = (data || []).map((x) => x.achievement_code);
  $("badge-achievements").textContent = unlockedAchievementCodes.length;
}

async function loadMyLeagues() {
  // league_members -> leagues
  const { data, error } = await sb
    .from("league_members")
    .select("league_id, leagues:league_id (id, name, code, owner_id)")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(error);
    myLeagues = [];
    return;
  }

  myLeagues = (data || [])
    .map((row) => row.leagues)
    .filter(Boolean);

  $("dash-leagues").textContent = `${myLeagues.length} joined`;
  renderLeaguesList();
}

function renderAchievementsPage() {
  const wrap = $("achievements-list");
  wrap.innerHTML = "";

  // show unlocked first
  const unlocked = achievements.filter((a) =>
    unlockedAchievementCodes.includes(a.code)
  );

  const locked = achievements.filter(
    (a) => !unlockedAchievementCodes.includes(a.code)
  );

  const all = [...unlocked, ...locked];

  if (!all.length) {
    wrap.innerHTML =
      `<div class="text-slate-300">No achievements loaded yet.</div>`;
    return;
  }

  all.forEach((a) => {
    const isUnlocked = unlockedAchievementCodes.includes(a.code);
    const card = document.createElement("div");
    card.className =
      "bg-slate-900 border border-slate-700 rounded-2xl p-5";
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <div class="text-2xl">${a.icon || "🏆"}</div>
          <div class="text-lg font-bold mt-2">${a.name}</div>
          <div class="text-slate-300 text-sm mt-1">${a.description || ""}</div>
        </div>
        <div class="text-xs px-2 py-1 rounded-lg ${
          isUnlocked
            ? "bg-emerald-500 text-slate-900 font-bold"
            : "bg-slate-800 text-slate-300"
        }">
          ${isUnlocked ? "Unlocked" : "Locked"}
        </div>
      </div>
    `;
    wrap.appendChild(card);
  });
}

function renderLeaguesList() {
  const list = $("leagues-list");
  const empty = $("leagues-empty");
  list.innerHTML = "";
  $("league-detail").classList.add("hidden");

  if (!myLeagues.length) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  myLeagues.forEach((lg) => {
    const row = document.createElement("div");
    row.className =
      "bg-slate-900 border border-slate-700 rounded-2xl p-5 flex items-center justify-between";
    row.innerHTML = `
      <div>
        <div class="text-xl font-extrabold">${lg.name}</div>
        <div class="text-slate-300 text-sm mt-1">Invite code: <span class="font-bold">${lg.code}</span></div>
      </div>
      <div class="flex gap-2">
        <button class="btn-open-league px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold" data-id="${lg.id}">
          Open
        </button>
      </div>
    `;
    list.appendChild(row);
  });

  document.querySelectorAll(".btn-open-league").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await openLeague(btn.dataset.id);
    });
  });
}

async function refreshProfileBadges() {
  $("whoami").textContent = `${playerProfile.name} (${playerProfile.email})`;
  $("profile-name").textContent = playerProfile.name;
  $("badge-points").textContent = playerProfile.points || 0;
  $("badge-streak").textContent = playerProfile.streak || 0;

  applyTierBorder(playerProfile.points || 0);

  // avatar img
  if (playerProfile.avatar_url) {
    $("avatar-img").src = playerProfile.avatar_url;
  } else {
    // fallback placeholder
    $("avatar-img").src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23111827'/%3E%3Ctext x='50%25' y='55%25' font-size='72' text-anchor='middle' fill='%239CA3AF'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
  }
}

// =============================
// MODE UI
// =============================
function setMode(newMode) {
  mode = newMode;
  $("mode-label").textContent = mode === "solo" ? "Solo" : "League";
  $("dash-mode").textContent = mode === "solo" ? "Solo" : "League";

  $("dash-mode-sub").textContent =
    mode === "solo"
      ? "Solo = no leaderboard. Just track your progress."
      : "League = your points are shown to your league members only.";
}

$("btn-open-mode").addEventListener("click", async () => {
  // Simple chooser (MVP)
  const choice = prompt(
    "Type one option:\nsolo\nleague\n\n(If you pick league, go to the Leagues page to open a league.)",
    mode
  );
  if (!choice) return;

  const c = choice.trim().toLowerCase();
  if (c === "solo") setMode("solo");
  if (c === "league") setMode("league");
});

// =============================
// NAVIGATION
// =============================
function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  const id = `page-${name}`;
  $(id).classList.remove("hidden");

  if (name === "achievements") renderAchievementsPage();
}

document.querySelectorAll(".navbtn").forEach((btn) => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

// =============================
// HABITS: log once/day + steps mutual exclusive
// =============================
function disableButton(btn) {
  btn.disabled = true;
  btn.classList.add("opacity-50", "cursor-not-allowed");
}

function enableButton(btn) {
  btn.disabled = false;
  btn.classList.remove("opacity-50", "cursor-not-allowed");
}

async function checkTodayLogged() {
  // disable buttons that are already logged today
  const day = todayKey();

  const { data, error } = await sb
    .from("checkins")
    .select("habit_key")
    .eq("user_id", currentUser.id)
    .eq("checkin_date", day);

  if (error) {
    console.error(error);
    return;
  }

  const logged = new Set((data || []).map((x) => x.habit_key));

  document.querySelectorAll(".habit-btn").forEach((btn) => {
    const hk = btn.dataset.habit;
    if (logged.has(hk)) disableButton(btn);
    else enableButton(btn);
  });

  // steps mutual exclusive
  const steps5 = document.querySelector(`.habit-btn[data-habit="steps_5k"]`);
  const steps10 = document.querySelector(`.habit-btn[data-habit="steps_10k"]`);

  if (logged.has("steps_5k")) disableButton(steps10);
  if (logged.has("steps_10k")) disableButton(steps5);
}

async function updateStreakAfterLogging() {
  // streak counts if at least 1 habit logged per day
  // if missed a day => resets
  // simple implementation: check if logged today and logged yesterday, etc
  // We'll compute current streak by walking backwards.

  const { data, error } = await sb
    .from("checkins")
    .select("checkin_date")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(error);
    return;
  }

  const days = new Set((data || []).map((x) => x.checkin_date));
  // days are "YYYY-MM-DD"
  let streak = 0;
  let d = new Date();

  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // update profile
  playerProfile.streak = streak;
  await sb.from("players").update({ streak }).eq("user_id", currentUser.id);
  $("badge-streak").textContent = streak;
}

async function logHabit(habitKey, points) {
  const day = todayKey();

  // check already logged
  const { data: existing, error: exErr } = await sb
    .from("checkins")
    .select("id")
    .eq("user_id", currentUser.id)
    .eq("habit_key", habitKey)
    .eq("checkin_date", day);

  if (exErr) {
    toast(`Error: ${exErr.message}`);
    return;
  }

  if ((existing || []).length) {
    toast(`You already logged ${habitKey} today.`);
    return;
  }

  const { error } = await sb.from("checkins").insert({
    user_id: currentUser.id,
    habit_key: habitKey,
    checkin_date: day,
    points: Number(points || 0),
  });

  if (error) {
    toast(`Error logging habit: ${error.message}`);
    return;
  }

  // update points
  const newPoints = Number(playerProfile.points || 0) + Number(points || 0);
  playerProfile.points = newPoints;

  await sb.from("players").update({ points: newPoints }).eq("user_id", currentUser.id);

  $("badge-points").textContent = newPoints;
  applyTierBorder(newPoints);

  toast(`✅ Logged ${habitKey} (+${points})`);

  await checkTodayLogged();
  await updateStreakAfterLogging();

  // check achievements (simple MVP checks)
  await checkAchievements();
  await loadUnlockedAchievements();
}

document.querySelectorAll(".habit-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (btn.disabled) {
      toast("You already logged that today.");
      return;
    }

    // steps mutual exclusive
    if (btn.dataset.steps === "1") {
      const hk = btn.dataset.habit;
      if (hk === "steps_5k") disableButton(document.querySelector(`.habit-btn[data-habit="steps_10k"]`));
      if (hk === "steps_10k") disableButton(document.querySelector(`.habit-btn[data-habit="steps_5k"]`));
    }

    await logHabit(btn.dataset.habit, btn.dataset.points);
  });
});

// =============================
// ACHIEVEMENTS CHECK (MVP)
// =============================
async function checkAchievements() {
  // counts for common habits
  const { data, error } = await sb
    .from("checkins")
    .select("habit_key")
    .eq("user_id", currentUser.id);

  if (error) return;

  const logs = data || [];
  const total = logs.length;

  const countBy = (key) => logs.filter((x) => x.habit_key === key).length;

  for (const a of achievements) {
    if (unlockedAchievementCodes.includes(a.code)) continue;

    // total based patterns (based on your screenshot's codes)
    if (a.code === "habits_25" && total >= 25) await unlockAchievement(a);
    if (a.code === "habits_100" && total >= 100) await unlockAchievement(a);
    if (a.code === "logs_50" && total >= 50) await unlockAchievement(a);

    if (a.code === "water_25" && countBy("water") >= 25) await unlockAchievement(a);
    if (a.code === "water_50" && countBy("water") >= 50) await unlockAchievement(a);
    if (a.code === "workout_25" && countBy("workout") >= 25) await unlockAchievement(a);
    if (a.code === "protein_50" && countBy("protein") >= 50) await unlockAchievement(a);
    if (a.code === "reading_25" && countBy("reading") >= 25) await unlockAchievement(a);
    if (a.code === "sleep_25" && countBy("sleep") >= 25) await unlockAchievement(a);

    // streak achievements (based on profile streak)
    const s = Number(playerProfile.streak || 0);
    if (a.code === "streak_10" && s >= 10) await unlockAchievement(a);
    if (a.code === "streak_20" && s >= 20) await unlockAchievement(a);
  }
}

async function unlockAchievement(a) {
  const { error } = await sb.from("user_achievements").insert({
    user_id: currentUser.id,
    achievement_code: a.code,
  });

  if (error) {
    // ignore duplicate insert errors
    return;
  }

  unlockedAchievementCodes.push(a.code);
  $("badge-achievements").textContent = unlockedAchievementCodes.length;

  // popup
  toast(`${a.icon || "🏆"} Achievement Unlocked: ${a.name}`);
}

// =============================
// AVATAR UPLOAD (uses your existing storage setup)
// =============================
$("btn-upload-avatar").addEventListener("click", async () => {
  $("avatar-msg").textContent = "";

  const file = $("avatar-file").files?.[0];
  if (!file) {
    $("avatar-msg").textContent = "Please choose a file first.";
    return;
  }

  try {
    const uid = currentUser.id;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${uid}/avatar.${ext}`;

    // upload (upsert)
    const { error: upErr } = await sb.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (upErr) throw upErr;

    // public URL (bucket is public in your screenshot)
    const { data: pub } = sb.storage.from("avatars").getPublicUrl(path);

    const url = pub.publicUrl;

    // save to players
    const { error: profErr } = await sb
      .from("players")
      .update({ avatar_url: url })
      .eq("user_id", uid);

    if (profErr) throw profErr;

    playerProfile.avatar_url = url;
    $("avatar-img").src = url;

    $("avatar-msg").textContent = "✅ Updated!";
  } catch (e) {
    $("avatar-msg").textContent = `Upload error: ${e.message || e}`;
  }
});

// =============================
// LEAGUES: create / join / open / leaderboard
// =============================
$("btn-create-league").addEventListener("click", async () => {
  const name = prompt("League name (example: Sonya’s Squad)");
  if (!name) return;

  // create random code
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const { data: league, error } = await sb
    .from("leagues")
    .insert({
      name,
      code,
      owner_id: currentUser.id,
    })
    .select()
    .single();

  if (error) {
    toast(`Create league error: ${error.message}`);
    return;
  }

  // join as owner
  const { error: memErr } = await sb.from("league_members").insert({
    league_id: league.id,
    user_id: currentUser.id,
    role: "owner",
  });

  if (memErr) {
    toast(`Join error: ${memErr.message}`);
    return;
  }

  toast(`✅ League created. Invite code: ${league.code}`);
  await loadMyLeagues();
  await openLeague(league.id);
});

$("btn-join-league").addEventListener("click", async () => {
  const code = prompt("Enter invite code");
  if (!code) return;

  const clean = code.trim().toUpperCase();

  const { data: league, error } = await sb
    .from("leagues")
    .select("*")
    .eq("code", clean)
    .maybeSingle();

  if (error || !league) {
    toast("League not found. Check the code.");
    return;
  }

  // enforce max 20 players
  const { count } = await sb
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", league.id);

  if (Number(count || 0) >= 20) {
    toast("This league is full (20 players).");
    return;
  }

  // insert membership (ignore duplicates)
  const { error: memErr } = await sb.from("league_members").insert({
    league_id: league.id,
    user_id: currentUser.id,
    role: "member",
  });

  if (memErr) {
    // if already joined
    toast("You’re already in this league.");
  } else {
    toast("✅ Joined league!");
  }

  await loadMyLeagues();
  await openLeague(league.id);
});

$("btn-close-league").addEventListener("click", () => {
  $("league-detail").classList.add("hidden");
  activeLeagueId = null;
});

$("btn-update-league-name").addEventListener("click", async () => {
  if (!activeLeagueId) return;

  const newName = $("league-name-input").value.trim();
  if (!newName) return;

  const { error } = await sb
    .from("leagues")
    .update({ name: newName })
    .eq("id", activeLeagueId)
    .eq("owner_id", currentUser.id);

  if (error) {
    $("league-msg").textContent = `Error: ${error.message}`;
    return;
  }

  $("league-msg").textContent = "✅ Updated league name.";
  await loadMyLeagues();
  await openLeague(activeLeagueId);
});

async function openLeague(leagueId) {
  activeLeagueId = leagueId;

  const { data: league, error } = await sb
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (error) {
    toast(`Open league error: ${error.message}`);
    return;
  }

  $("league-title").textContent = league.name;
  $("league-code").textContent = league.code;
  $("league-detail").classList.remove("hidden");

  // owner tools
  if (league.owner_id === currentUser.id) {
    $("league-owner-tools").classList.remove("hidden");
  } else {
    $("league-owner-tools").classList.add("hidden");
  }

  await renderLeagueLeaderboard(leagueId);

  // auto switch mode to league when opening
  setMode("league");
}

async function renderLeagueLeaderboard(leagueId) {
  const wrap = $("league-board");
  wrap.innerHTML = "";

  const { data, error } = await sb
    .from("league_members")
    .select("user_id, role, players: user_id (name, points, streak, avatar_url)")
    .eq("league_id", leagueId);

  if (error) {
    wrap.innerHTML = `<div class="text-slate-300">Error loading leaderboard.</div>`;
    return;
  }

  const rows = (data || [])
    .map((x) => ({
      user_id: x.user_id,
      role: x.role,
      name: x.players?.name || "Player",
      points: x.players?.points || 0,
      streak: x.players?.streak || 0,
      avatar_url: x.players?.avatar_url || "",
      tier: tierFromPoints(x.players?.points || 0).name,
    }))
    .sort((a, b) => Number(b.points) - Number(a.points));

  rows.forEach((r, idx) => {
    const div = document.createElement("div");
    div.className =
      "bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center justify-between";
    div.innerHTML = `
      <button class="flex items-center gap-3 text-left btn-open-player" data-user="${r.user_id}">
        <img class="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-900" src="${
          r.avatar_url ||
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23111827'/%3E%3Ctext x='50%25' y='55%25' font-size='34' text-anchor='middle' fill='%239CA3AF'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E"
        }" />
        <div>
          <div class="font-extrabold text-lg">${idx + 1}. ${r.name}</div>
          <div class="text-slate-300 text-sm">${r.tier}${r.role === "owner" ? " • Owner" : ""}</div>
        </div>
      </button>

      <div class="text-right">
        <div class="text-2xl font-extrabold text-amber-400">${r.points}</div>
        <div class="text-slate-300 text-sm">points</div>
      </div>
    `;
    wrap.appendChild(div);
  });

  document.querySelectorAll(".btn-open-player").forEach((b) => {
    b.addEventListener("click", async () => {
      await openPlayerModal(b.dataset.user);
    });
  });
}

// =============================
// PLAYER MODAL
// =============================
$("btn-close-player").addEventListener("click", () => {
  $("player-modal").classList.add("hidden");
});

async function openPlayerModal(userId) {
  // player
  const { data: p, error } = await sb
    .from("players")
    .select("name, points, streak, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !p) {
    toast("Could not load player profile.");
    return;
  }

  // achievements count
  const { count } = await sb
    .from("user_achievements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  $("modal-avatar").src =
    p.avatar_url ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23111827'/%3E%3Ctext x='50%25' y='55%25' font-size='34' text-anchor='middle' fill='%239CA3AF'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";

  $("modal-name").textContent = p.name;
  $("modal-tier").textContent = `Tier: ${tierFromPoints(p.points || 0).name}`;

  $("modal-streak").textContent = p.streak || 0;
  $("modal-points").textContent = p.points || 0;
  $("modal-ach").textContent = Number(count || 0);

  $("player-modal").classList.remove("hidden");
}

// =============================
// LOGIN FLOW
// =============================
async function onLogin(user) {
  currentUser = user;

  showApp();

  playerProfile = await ensureProfile(user);

  await loadAchievements();
  await loadUnlockedAchievements();
  await loadMyLeagues();

  await refreshProfileBadges();
  await checkTodayLogged();
  await updateStreakAfterLogging();

  // default experience
  setMode("solo");
  showPage("dashboard");
}

// =============================
// SESSION RESTORE
// =============================
(async function init() {
  const { data } = await sb.auth.getSession();
  const session = data.session;

  if (!session?.user) {
    showAuth();
    return;
  }

  await onLogin(session.user);
})();
