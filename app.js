// ==============================
// Supabase setup
// ==============================
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

if (!window.supabase) {
  alert("Supabase library did not load. Check index.html script tags.");
  throw new Error("Supabase library not loaded");
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==============================
// Config
// ==============================
const HABITS = {
  water: { points: 5, label: "Water", group: null },
  protein: { points: 8, label: "Protein", group: null },
  steps_5k: { points: 6, label: "Steps 5K-9.9K", group: "steps" },
  steps_10k: { points: 10, label: "Steps 10K+", group: "steps" },
  workout: { points: 12, label: "Workout", group: null },
  reading: { points: 9, label: "Reading", group: null },
  sleep: { points: 11, label: "Sleep", group: null },
  no_sugar: { points: 7, label: "No Added Sugar", group: null },
  no_coke: { points: 5, label: "No Coke", group: null },
};

const TIERS = [
  { name: "Rookie", min: 0, class: "tier-rookie" },
  { name: "Elite", min: 450, class: "tier-elite" },
  { name: "Pro", min: 750, class: "tier-pro" },
  { name: "MVP", min: 1500, class: "tier-mvp" },
  { name: "Champion", min: 1900, class: "tier-champion" },
];

function getTier(points) {
  let t = TIERS[0];
  for (const tier of TIERS) if (points >= tier.min) t = tier;
  return t;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ==============================
// DOM
// ==============================
const $ = (id) => document.getElementById(id);

const authBox = $("auth-box");
const gameBox = $("game-box");
const authMsg = $("auth-msg");

const btnSignup = $("btn-signup");
const btnLogin = $("btn-login");
const btnLogout = $("btn-logout");

const whoami = $("whoami");
const modeLabel = $("mode-label");
const leagueLabelWrap = $("league-label-wrap");
const leagueLabel = $("league-label");

const inviteBox = $("invite-box");
const inviteCodeEl = $("invite-code");
const inviteLinkEl = $("invite-link");
const btnCopyInvite = $("btn-copy-invite");

const playerCard = $("player-card");
const tierNameEl = $("tier-name");
const statPoints = $("stat-points");
const statStreak = $("stat-streak");
const statAch = $("stat-achievements");

const avatarImg = $("avatar-img");
const avatarFallback = $("avatar-fallback");
const avatarInput = $("avatar-input");
const avatarStatus = $("avatar-status");

const leaguesList = $("leagues-list");
const leaguesEmpty = $("leagues-empty");
const btnLeaguesRefresh = $("btn-leagues-refresh");
const btnCreateLeague = $("btn-create-league");
const btnJoinLeague = $("btn-join-league");
const btnStartSolo = $("btn-start-solo");
const newLeagueNameInput = $("new-league-name");
const joinCodeInput = $("join-code");

const leagueBoard = $("league-board");
const leaderboardList = $("leaderboard-list");
const btnBoardRefresh = $("btn-leaderboard-refresh");

const toast = $("toast");

// Tutorial
const btnStartTour = $("btn-start-tour");
const tourOverlay = $("tour-overlay");
const tourText = $("tour-text");
const btnTourNext = $("btn-tour-next");
const btnTourSkip = $("btn-tour-skip");
const sectionProfile = $("section-profile");
const sectionLeagues = $("section-leagues");
const sectionPlay = $("section-play");

// Habit buttons
let habitButtons = {
  water: $("btn-log-water"),
  protein: $("btn-log-protein"),
  steps_5k: $("btn-log-steps-5k"),
  steps_10k: $("btn-log-steps-10k"),
  workout: $("btn-log-workout"),
  reading: $("btn-log-reading"),
  sleep: $("btn-log-sleep"),
  no_sugar: $("btn-log-no-sugar"),
  no_coke: $("btn-log-no-coke"),
};

// ==============================
// State
// ==============================
let currentUser = null;
let myProfile = null;
let currentLeague = null;
let todaysCheckins = new Set();

// ==============================
// UI helpers
// ==============================
function setAuthMsg(text = "") { authMsg.textContent = text; }

function showToast(message, ok = true) {
  toast.className =
    "fixed bottom-4 right-4 px-5 py-4 rounded-xl shadow-2xl border text-sm " +
    (ok ? "bg-emerald-600 border-emerald-400/30" : "bg-red-600 border-red-400/30");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3200);
}

function showAuth() {
  gameBox.classList.add("hidden");
  authBox.classList.remove("hidden");
}

function showGame() {
  authBox.classList.add("hidden");
  gameBox.classList.remove("hidden");
}

function setWhoAmI() {
  const nm = myProfile?.name || "Player";
  const em = myProfile?.email || currentUser?.email || "";
  whoami.textContent = `${nm} (${em})`;
}

function applyTier(points) {
  const tier = getTier(points);
  tierNameEl.textContent = tier.name;
  playerCard.classList.remove("tier-rookie","tier-elite","tier-pro","tier-mvp","tier-champion");
  playerCard.classList.add(tier.class);
}

function renderMyStats() {
  const points = Number(myProfile?.points || 0);
  const streak = Number(myProfile?.streak || 0);
  const ach = Number(myProfile?.achievements_count || 0);

  statPoints.textContent = points;
  statStreak.textContent = streak;
  statAch.textContent = ach;

  applyTier(points);

  const url = myProfile?.avatar_url || "";
  if (url) {
    avatarImg.src = url;
    avatarImg.classList.remove("hidden");
    avatarFallback.classList.add("hidden");
  } else {
    avatarImg.classList.add("hidden");
    avatarFallback.classList.remove("hidden");
  }
}

function setModeLabels() {
  if (!currentLeague) {
    modeLabel.textContent = "—";
    leagueLabelWrap.classList.add("hidden");
    inviteBox.classList.add("hidden");
    leagueBoard.classList.add("hidden");
    return;
  }

  if (currentLeague.is_solo) {
    modeLabel.textContent = "Solo Challenge";
    leagueLabelWrap.classList.add("hidden");
    inviteBox.classList.add("hidden");
    leagueBoard.classList.add("hidden");
  } else {
    modeLabel.textContent = "League";
    leagueLabelWrap.classList.remove("hidden");
    leagueLabel.textContent = currentLeague.name || "My League";
    leagueBoard.classList.remove("hidden");
  }
}

function updateHabitButtonsUI() {
  // reset
  for (const k of Object.keys(habitButtons)) {
    habitButtons[k].disabled = false;
    habitButtons[k].classList.remove("btn-disabled");
  }

  // disable already logged
  for (const habitKey of todaysCheckins) {
    if (habitButtons[habitKey]) {
      habitButtons[habitKey].disabled = true;
      habitButtons[habitKey].classList.add("btn-disabled");
    }
  }

  // steps mutual exclusive
  const stepsLogged = todaysCheckins.has("steps_5k") || todaysCheckins.has("steps_10k");
  if (stepsLogged) {
    habitButtons.steps_5k.disabled = true;
    habitButtons.steps_10k.disabled = true;
    habitButtons.steps_5k.classList.add("btn-disabled");
    habitButtons.steps_10k.classList.add("btn-disabled");
  }
}

// ==============================
// Supabase helpers
// ==============================
async function ensureProfile(user, fallbackName) {
  const { data: existing, error: selErr } = await sb
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: fallbackName || user.user_metadata?.name || "Player",
    points: 0,
    streak: 0,
    achievements_count: 0,
    current_league_id: null,
  };

  const { data: inserted, error: insErr } = await sb
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (insErr) throw insErr;
  return inserted;
}

async function refreshMyProfile() {
  const { data, error } = await sb
    .from("players")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();
  if (error) throw error;
  myProfile = data;
}

async function loadLeagueById(id) {
  const { data, error } = await sb.from("leagues").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function getMyRoleInLeague(leagueId) {
  const { data, error } = await sb
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (error) throw error;
  return data?.role || "member";
}

async function listMyLeagues() {
  const { data: mem, error: memErr } = await sb
    .from("league_members")
    .select("league_id")
    .eq("user_id", currentUser.id);
  if (memErr) throw memErr;

  const ids = (mem || []).map((r) => r.league_id);
  if (ids.length === 0) return [];

  const { data: leagues, error: lErr } = await sb
    .from("leagues")
    .select("*")
    .in("id", ids);
  if (lErr) throw lErr;

  return leagues || [];
}

// RPCs you already set up
async function rpcCreateLeague(name, solo = false) {
  const { data, error } = await sb.rpc("create_league", { league_name: name, solo });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
async function rpcJoinByCode(code) {
  const { data, error } = await sb.rpc("join_league_by_code", { code });
  if (error) throw error;
  return data;
}
async function rpcSetCurrentLeague(lid) {
  const { error } = await sb.rpc("set_current_league", { lid });
  if (error) throw error;
}

async function loadTodaysCheckins() {
  todaysCheckins = new Set();
  if (!currentLeague?.id) return;

  const d = todayISO();
  const { data, error } = await sb
    .from("checkins")
    .select("habit_key")
    .eq("user_id", currentUser.id)
    .eq("league_id", currentLeague.id)
    .eq("checkin_date", d);

  if (error) {
    console.error("loadTodaysCheckins error:", error);
    return;
  }
  (data || []).forEach((row) => todaysCheckins.add(row.habit_key));
}

async function addPoints(pointsToAdd) {
  const currentPoints = Number(myProfile?.points || 0);
  const newPoints = Math.max(0, currentPoints + pointsToAdd);

  const { data, error } = await sb
    .from("players")
    .update({ points: newPoints })
    .eq("user_id", currentUser.id)
    .select()
    .single();

  if (error) throw error;
  myProfile = data;
  renderMyStats();
}

// streak recompute from checkins (1+ habit/day counts)
function computeStreakFromDates(dateStrings) {
  const set = new Set(dateStrings);
  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    if (set.has(iso)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

async function recomputeAndSaveStreak() {
  if (!currentLeague?.id) return;

  const { data, error } = await sb
    .from("checkins")
    .select("checkin_date")
    .eq("user_id", currentUser.id)
    .eq("league_id", currentLeague.id);

  if (error) {
    console.error("streak select error:", error);
    return;
  }

  const dates = (data || []).map((r) => r.checkin_date);
  const newStreak = computeStreakFromDates(dates);

  const { data: updated, error: updErr } = await sb
    .from("players")
    .update({ streak: newStreak })
    .eq("user_id", currentUser.id)
    .select()
    .maybeSingle();

  if (!updErr && updated) {
    myProfile = updated;
    renderMyStats();
  }
}

// ==============================
// Leagues UI
// ==============================
function renderLeaguesList(leagues) {
  leaguesList.innerHTML = "";
  if (!leagues || leagues.length === 0) {
    leaguesEmpty.classList.remove("hidden");
    return;
  }
  leaguesEmpty.classList.add("hidden");

  // Sort: solo first, then leagues
  const sorted = [...leagues].sort((a,b) => Number(a.is_solo) - Number(b.is_solo));

  for (const l of sorted) {
    const isCurrent = myProfile?.current_league_id === l.id;
    const badge = l.is_solo ? "SOLO" : "LEAGUE";

    const btn = document.createElement("button");
    btn.className =
      "w-full text-left p-4 rounded-xl border transition " +
      (isCurrent
        ? "bg-slate-900 border-amber-400/60 ring-2 ring-amber-400/40"
        : "bg-slate-900/60 border-slate-700 hover:bg-slate-900");
    btn.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="font-extrabold truncate">${l.name || "Untitled"}</div>
          <div class="text-xs text-slate-400">${badge}${l.is_solo ? " • just you" : " • private invite-only"}</div>
        </div>
        <div class="text-xs px-2 py-1 rounded-lg ${l.is_solo ? "bg-emerald-500/20 text-emerald-300" : "bg-indigo-500/20 text-indigo-300"}">
          ${isCurrent ? "Current" : "Switch"}
        </div>
      </div>
    `;

    btn.addEventListener("click", async () => {
      await rpcSetCurrentLeague(l.id);
      await loadLeague();
      showToast("Switched ✅");
    });

    leaguesList.appendChild(btn);
  }
}

// ==============================
// Leaderboard
// ==============================
async function renderLeaderboard() {
  if (!currentLeague?.id || currentLeague.is_solo) return;

  leaderboardList.innerHTML = `<div class="text-slate-400">Loading leaderboard...</div>`;

  const { data: mem, error: memErr } = await sb
    .from("league_members")
    .select("user_id")
    .eq("league_id", currentLeague.id);

  if (memErr) {
    console.error(memErr);
    leaderboardList.innerHTML = `<div class="text-red-300">Unable to load league members.</div>`;
    return;
  }

  const userIds = (mem || []).map((r) => r.user_id);
  if (userIds.length === 0) {
    leaderboardList.innerHTML = `<div class="text-slate-400">No members yet.</div>`;
    return;
  }

  const { data: players, error: pErr } = await sb
    .from("players")
    .select("user_id,name,points,streak,achievements_count,avatar_url")
    .in("user_id", userIds);

  if (pErr) {
    console.error(pErr);
    leaderboardList.innerHTML = `<div class="text-red-300">Unable to load players.</div>`;
    return;
  }

  const rows = (players || []).map((p) => ({
    ...p,
    points: Number(p.points || 0),
    streak: Number(p.streak || 0),
    achievements_count: Number(p.achievements_count || 0),
  }));

  rows.sort((a, b) => b.points - a.points);

  leaderboardList.innerHTML = rows.map((p, idx) => {
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
    const tier = getTier(p.points);
    const isMe = p.user_id === currentUser.id;

    return `
      <div class="w-full text-left bg-slate-900/60 border border-slate-700 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 text-xl font-extrabold text-slate-300">${medal}</div>
          <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
            ${p.avatar_url ? `<img src="${p.avatar_url}" class="w-full h-full object-cover" />` : `<div class="text-slate-500 font-bold">👤</div>`}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold truncate">${p.name || "Player"} ${isMe ? '<span class="text-xs text-amber-300">(you)</span>' : ""}</div>
            <div class="text-xs text-slate-400">${tier.name} • Streak ${p.streak} • Ach ${p.achievements_count}</div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-extrabold text-emerald-400">${p.points}</div>
            <div class="text-xs text-slate-500">points</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ==============================
// League loader (and auto-solo)
// ==============================
async function loadLeague() {
  await refreshMyProfile();

  // Auto create Solo if user has no leagues at all
  const leagues = await listMyLeagues();
  renderLeaguesList(leagues);

  if (!myProfile.current_league_id) {
    if (leagues.length === 0) {
      // Create Solo automatically
      await rpcCreateLeague("Solo Challenge", true);
      await refreshMyProfile();
    } else {
      // If they have leagues, set current to first one
      await rpcSetCurrentLeague(leagues[0].id);
      await refreshMyProfile();
    }
  }

  currentLeague = await loadLeagueById(myProfile.current_league_id);
  setModeLabels();

  // Invite box (owner-only + not solo)
  if (!currentLeague.is_solo) {
    const role = await getMyRoleInLeague(currentLeague.id);
    if (role === "owner" && currentLeague.invite_code) {
      inviteBox.classList.remove("hidden");
      inviteCodeEl.textContent = currentLeague.invite_code;
      inviteLinkEl.value = `${window.location.origin}${window.location.pathname}?join=${currentLeague.invite_code}`;
    } else {
      inviteBox.classList.add("hidden");
    }
  }

  await loadTodaysCheckins();
  updateHabitButtonsUI();
  await renderLeaderboard();

  // Refresh leagues list highlight
  const leagues2 = await listMyLeagues();
  renderLeaguesList(leagues2);
}

// ==============================
// Habit logging
// ==============================
function attachHabitButton(habitKey, buttonEl) {
  const habit = HABITS[habitKey];

  buttonEl.addEventListener("click", async () => {
    if (!currentLeague?.id) {
      showToast("Pick a mode first (Solo or League).", false);
      return;
    }

    const stepsLogged = todaysCheckins.has("steps_5k") || todaysCheckins.has("steps_10k");
    const already = todaysCheckins.has(habitKey) || (habit.group === "steps" && stepsLogged);

    if (already) {
      showToast(`Already logged: ${habit.label} today ✅`, false);
      return;
    }

    try {
      const payload = {
        user_id: currentUser.id,
        league_id: currentLeague.id,
        habit_key: habitKey,
        checkin_date: todayISO(),
        points: habit.points,
      };

      const { error } = await sb.from("checkins").insert(payload);

      if (error) {
        // 409/unique = already logged
        if (String(error.code) === "23505" || error.status === 409) {
          todaysCheckins.add(habitKey);
          updateHabitButtonsUI();
          showToast(`Already logged: ${habit.label} today ✅`, false);
          return;
        }
        throw error;
      }

      await loadTodaysCheckins();
      await addPoints(habit.points);
      await recomputeAndSaveStreak();
      updateHabitButtonsUI();

      showToast(`+${habit.points} pts for ${habit.label}! 🎯`, true);

      if (!currentLeague.is_solo) await renderLeaderboard();
    } catch (e) {
      console.error("Error logging habit:", e);
      showToast(`Error logging habit: ${e.message || e}`, false);
    }
  });
}

// ==============================
// Avatar upload
// ==============================
async function uploadAvatar(file) {
  avatarStatus.textContent = "Uploading...";
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${currentUser.id}/avatar.${ext}`;

  const { error: upErr } = await sb.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (upErr) throw upErr;

  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { data: updated, error: updErr } = await sb
    .from("players")
    .update({ avatar_url: publicUrl })
    .eq("user_id", currentUser.id)
    .select()
    .single();

  if (updErr) throw updErr;

  myProfile = updated;
  renderMyStats();
  avatarStatus.textContent = "Saved ✅";
  setTimeout(() => (avatarStatus.textContent = ""), 2500);
}

// ==============================
// Auth handlers
// ==============================
btnSignup.addEventListener("click", async () => {
  setAuthMsg("");
  const email = $("su-email").value.trim().toLowerCase();
  const password = $("su-pass").value;
  const name = $("su-name").value.trim();

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
      data: { name },
    },
  });

  if (error) {
    setAuthMsg(`Signup error: ${error.message}`);
    return;
  }

  setAuthMsg("Signup successful! Check your email, click the verification link, then log in.");
});

btnLogin.addEventListener("click", async () => {
  setAuthMsg("");
  const email = $("li-email").value.trim().toLowerCase();
  const password = $("li-pass").value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthMsg(`Login error: ${error.message}`);
    return;
  }
  if (!data?.user) {
    setAuthMsg("Login failed. Please try again.");
    return;
  }

  await boot();
});

btnLogout.addEventListener("click", async () => {
  await sb.auth.signOut();
  currentUser = null;
  myProfile = null;
  currentLeague = null;
  showAuth();
  setAuthMsg("Logged out.");
});

// ==============================
// Leagues buttons
// ==============================
btnLeaguesRefresh.addEventListener("click", async () => {
  const leagues = await listMyLeagues();
  renderLeaguesList(leagues);
  showToast("Leagues refreshed ✅");
});

btnCreateLeague.addEventListener("click", async () => {
  const nm = (newLeagueNameInput.value || "").trim();
  if (!nm) return showToast("Enter a league name first.", false);

  try {
    btnCreateLeague.disabled = true;
    await rpcCreateLeague(nm, false);
    await loadLeague();
    showToast("League created ✅");
  } catch (e) {
    console.error(e);
    showToast(e.message || String(e), false);
  } finally {
    btnCreateLeague.disabled = false;
  }
});

btnJoinLeague.addEventListener("click", async () => {
  const code = (joinCodeInput.value || "").trim().toUpperCase();
  if (!code) return showToast("Enter an invite code.", false);

  try {
    btnJoinLeague.disabled = true;
    await rpcJoinByCode(code);

    // Remove join param if present
    const url = new URL(window.location.href);
    url.searchParams.delete("join");
    window.history.replaceState({}, "", url.toString());

    await loadLeague();
    showToast("Joined league ✅");
  } catch (e) {
    console.error(e);
    showToast(e.message || String(e), false);
  } finally {
    btnJoinLeague.disabled = false;
  }
});

btnStartSolo.addEventListener("click", async () => {
  try {
    btnStartSolo.disabled = true;
    await rpcCreateLeague("Solo Challenge", true);
    await loadLeague();
    showToast("Switched to Solo ✅");
  } catch (e) {
    console.error(e);
    showToast(e.message || String(e), false);
  } finally {
    btnStartSolo.disabled = false;
  }
});

btnCopyInvite?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteLinkEl.value);
    showToast("Invite link copied ✅");
  } catch {
    showToast("Couldn't copy link. Copy manually.", false);
  }
});

btnBoardRefresh?.addEventListener("click", async () => {
  await renderLeaderboard();
});

// ==============================
// Tutorial
// ==============================
let tourStep = 0;
const tourSteps = [
  { el: sectionProfile, text: "This is your Profile: photo, tier, points, streak, achievements." },
  { el: sectionLeagues, text: "This is Leagues: create/join private leagues, or switch to Solo anytime." },
  { el: sectionPlay, text: "This is Play: log habits once per day. Logging at least 1 habit counts toward your streak." },
];

function clearTourSpotlights() {
  [sectionProfile, sectionLeagues, sectionPlay].forEach(el => el.classList.remove("tour-spotlight"));
}

function showTour(stepIdx) {
  clearTourSpotlights();
  tourStep = stepIdx;

  const step = tourSteps[tourStep];
  step.el.classList.add("tour-spotlight");
  tourText.textContent = step.text;

  tourOverlay.classList.remove("hidden");
}

function endTour() {
  clearTourSpotlights();
  tourOverlay.classList.add("hidden");
  localStorage.setItem("hcl_tour_seen", "true");
}

btnStartTour.addEventListener("click", () => showTour(0));
btnTourSkip.addEventListener("click", endTour);
btnTourNext.addEventListener("click", () => {
  if (tourStep >= tourSteps.length - 1) return endTour();
  showTour(tourStep + 1);
});

// ==============================
// Boot
// ==============================
async function boot() {
  const { data: sess } = await sb.auth.getSession();
  const session = sess.session;

  if (!session?.user) {
    showAuth();
    return;
  }

  currentUser = session.user;
  myProfile = await ensureProfile(currentUser, currentUser.user_metadata?.name || "Player");

  showGame();
  setWhoAmI();
  renderMyStats();

  // avoid duplicate listeners by cloning habit buttons
  for (const [k, btn] of Object.entries(habitButtons)) {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    habitButtons[k] = clone;
  }
  for (const [k, btn] of Object.entries(habitButtons)) {
    attachHabitButton(k, btn);
  }

  avatarInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await uploadAvatar(file); }
    catch (err) {
      console.error(err);
      avatarStatus.textContent = `Upload error: ${err.message || err}`;
    }
  });

  // Auto-join from invite link (?join=CODE)
  const params = new URLSearchParams(window.location.search);
  const join = params.get("join");
  if (join) {
    try {
      await rpcJoinByCode(join.trim().toUpperCase());
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url.toString());
    } catch (e) {
      console.error(e);
      showToast("Invite code invalid or league full.", false);
    }
  }

  await loadLeague();

  // Show tutorial once
  if (!localStorage.getItem("hcl_tour_seen")) {
    setTimeout(() => showTour(0), 600);
  }
}

boot().catch((err) => {
  console.error("boot error:", err);
  showAuth();
  setAuthMsg(`Startup error: ${err.message || err}`);
});
