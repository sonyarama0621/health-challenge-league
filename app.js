// ==============================
// Supabase setup (EDIT THESE)
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
// Game config
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

const TIER = [
  { name: "Rookie", min: 0, class: "tier-rookie" },
  { name: "Elite", min: 450, class: "tier-elite" },
  { name: "Pro", min: 750, class: "tier-pro" },
  { name: "MVP", min: 1500, class: "tier-mvp" },
  { name: "Champion", min: 1900, class: "tier-champion" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getTier(points) {
  let t = TIER[0];
  for (const tier of TIER) {
    if (points >= tier.min) t = tier;
  }
  return t;
}

// ==============================
// DOM helpers
// ==============================
const $ = (id) => document.getElementById(id);

const authBox = $("auth-box");
const gameBox = $("game-box");
const authMsg = $("auth-msg");

const btnSignup = $("btn-signup");
const btnLogin = $("btn-login");
const btnLogout = $("btn-logout");
const btnSwitchLeague = $("btn-switch-league");

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

const leagueBoard = $("league-board");
const leaderboardList = $("leaderboard-list");
const btnBoardRefresh = $("btn-leaderboard-refresh");

const toast = $("toast");

// mode modal
const modeModal = $("mode-modal");
const btnCloseMode = $("btn-close-mode");
const btnStartSolo = $("btn-start-solo");
const btnCreateLeague = $("btn-create-league");
const btnJoinLeague = $("btn-join-league");
const newLeagueNameInput = $("new-league-name");
const joinCodeInput = $("join-code");

// profile modal
const profileModal = $("profile-modal");
const btnCloseProfile = $("btn-close-profile");
const pmAvatar = $("pm-avatar");
const pmAvatarFallback = $("pm-avatar-fallback");
const pmName = $("pm-name");
const pmTier = $("pm-tier");
const pmStreak = $("pm-streak");
const pmAch = $("pm-ach");
const pmPoints = $("pm-points");

// habit buttons
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
// App state
// ==============================
let currentUser = null;
let myProfile = null;
let currentLeague = null; // leagues row
let todaysCheckins = new Set(); // habit_key logged today for this league/user

// ==============================
// UI
// ==============================
function setAuthMsg(text = "") {
  authMsg.textContent = text;
}

function showToast(message, ok = true) {
  toast.className =
    "fixed bottom-4 right-4 px-5 py-4 rounded-xl shadow-2xl border text-sm " +
    (ok
      ? "bg-emerald-600 border-emerald-400/30"
      : "bg-red-600 border-red-400/30");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function showAuth() {
  gameBox.classList.add("hidden");
  authBox.classList.remove("hidden");
}

function showGame() {
  authBox.classList.add("hidden");
  gameBox.classList.remove("hidden");
}

function openModeModal() {
  modeModal.classList.remove("hidden");
  const params = new URLSearchParams(window.location.search);
  const join = params.get("join");
  if (join) joinCodeInput.value = join.toUpperCase();
}

function closeModeModal() {
  modeModal.classList.add("hidden");
}

function openProfileModal() {
  profileModal.classList.remove("hidden");
}

function closeProfileModal() {
  profileModal.classList.add("hidden");
}

function applyTierToCard(points) {
  const tier = getTier(points);
  tierNameEl.textContent = tier.name;

  playerCard.classList.remove(
    "tier-rookie",
    "tier-elite",
    "tier-pro",
    "tier-mvp",
    "tier-champion"
  );
  playerCard.classList.add(tier.class);
}

function renderMyStats() {
  const points = Number(myProfile?.points || 0);
  const streak = Number(myProfile?.streak || 0);
  const ach = Number(myProfile?.achievements_count || 0);

  statPoints.textContent = points;
  statStreak.textContent = streak;
  statAch.textContent = ach;

  applyTierToCard(points);

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
    return;
  }

  if (currentLeague.is_solo) {
    modeLabel.textContent = "Solo Challenge";
    leagueLabelWrap.classList.add("hidden");
  } else {
    modeLabel.textContent = "League";
    leagueLabelWrap.classList.remove("hidden");
    leagueLabel.textContent = currentLeague.name || "My League";
  }

  if (currentLeague.is_solo) {
    leagueBoard.classList.add("hidden");
    inviteBox.classList.add("hidden");
  } else {
    leagueBoard.classList.remove("hidden");
  }
}

function setWhoAmI() {
  const nm = myProfile?.name || "Player";
  const em = myProfile?.email || currentUser?.email || "";
  whoami.textContent = `${nm} (${em})`;
}

function updateHabitButtonsUI() {
  for (const key of Object.keys(habitButtons)) {
    habitButtons[key].disabled = false;
    habitButtons[key].classList.remove("btn-disabled");
  }

  const stepsLogged =
    todaysCheckins.has("steps_5k") || todaysCheckins.has("steps_10k");

  // disable already logged
  for (const habitKey of todaysCheckins) {
    if (habitButtons[habitKey]) {
      habitButtons[habitKey].disabled = true;
      habitButtons[habitKey].classList.add("btn-disabled");
    }
  }

  // steps are mutually exclusive: if either logged, disable both
  if (stepsLogged) {
    habitButtons.steps_5k.disabled = true;
    habitButtons.steps_10k.disabled = true;
    habitButtons.steps_5k.classList.add("btn-disabled");
    habitButtons.steps_10k.classList.add("btn-disabled");
  }
}

// ==============================
// Data helpers
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
    name: fallbackName || (user.user_metadata?.name || "Player"),
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

async function loadLeagueById(leagueId) {
  const { data, error } = await sb
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();
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

function computeStreakFromDates(dateStrings) {
  const set = new Set(dateStrings);
  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    if (set.has(iso)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
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

// ==============================
// League flows (RPC)
// ==============================
async function rpcCreateLeague(name, solo = false) {
  const { data, error } = await sb.rpc("create_league", {
    league_name: name,
    solo,
  });
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

async function refreshMyProfile() {
  const { data, error } = await sb
    .from("players")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  if (error) throw error;
  myProfile = data;
  renderMyStats();
  setWhoAmI();
}

async function loadLeague() {
  await refreshMyProfile();

  if (!myProfile.current_league_id) {
    currentLeague = null;
    setModeLabels();
    openModeModal();
    return;
  }

  currentLeague = await loadLeagueById(myProfile.current_league_id);
  setModeLabels();

  // invite box only for owner in non-solo leagues
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

  if (!currentLeague.is_solo) {
    await renderLeaderboard();
  }
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

// ==============================
// Leaderboard + profile modal
// ==============================
async function renderLeaderboard() {
  if (!currentLeague?.id) return;

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

  leaderboardList.innerHTML = rows
    .map((p, idx) => {
      const medal =
        idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
      const tier = getTier(p.points);
      const isMe = p.user_id === currentUser.id;

      return `
      <button class="w-full text-left bg-slate-900/60 border border-slate-700 rounded-xl p-4 hover:bg-slate-900 transition ${
        isMe ? "ring-2 ring-amber-400" : ""
      }" data-user="${p.user_id}">
        <div class="flex items-center gap-3">
          <div class="w-10 text-xl font-extrabold text-slate-300">${medal}</div>
          <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
            ${
              p.avatar_url
                ? `<img src="${p.avatar_url}" class="w-full h-full object-cover" />`
                : `<div class="text-slate-500 font-bold">👤</div>`
            }
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold truncate">${p.name || "Player"} ${
        isMe ? '<span class="text-xs text-amber-300">(you)</span>' : ""
      }</div>
            <div class="text-xs text-slate-400">${tier.name} • Streak ${
        p.streak
      } • Ach ${p.achievements_count}</div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-extrabold text-emerald-400">${
              p.points
            }</div>
            <div class="text-xs text-slate-500">points</div>
          </div>
        </div>
      </button>
    `;
    })
    .join("");

  leaderboardList.querySelectorAll("button[data-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-user");
      await openOtherPlayerProfile(uid);
    });
  });
}

async function openOtherPlayerProfile(userId) {
  const { data, error } = await sb
    .from("players")
    .select("user_id,name,points,streak,achievements_count,avatar_url")
    .eq("user_id", userId)
    .single();

  if (error) {
    showToast("Can't view that profile (not in your league).", false);
    return;
  }

  const points = Number(data.points || 0);
  const tier = getTier(points);

  pmName.textContent = data.name || "Player";
  pmTier.textContent = `${tier.name} • ${points} pts`;

  pmStreak.textContent = Number(data.streak || 0);
  pmAch.textContent = Number(data.achievements_count || 0);
  pmPoints.textContent = points;

  if (data.avatar_url) {
    pmAvatar.src = data.avatar_url;
    pmAvatar.classList.remove("hidden");
    pmAvatarFallback.classList.add("hidden");
  } else {
    pmAvatar.classList.add("hidden");
    pmAvatarFallback.classList.remove("hidden");
  }

  openProfileModal();
}

// ==============================
// Habit logging
// ==============================
function attachHabitButton(habitKey, buttonEl) {
  const habit = HABITS[habitKey];

  buttonEl.addEventListener("click", async () => {
    if (!currentLeague?.id) {
      showToast("Choose Solo or join a league first.", false);
      openModeModal();
      return;
    }

    const stepsLogged =
      todaysCheckins.has("steps_5k") || todaysCheckins.has("steps_10k");

    const already =
      todaysCheckins.has(habitKey) || (habit.group === "steps" && stepsLogged);

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
        if (String(error.code) === "23505" || error.status === 409) {
          todaysCheckins.add(habitKey);
          updateHabitButtonsUI();
          showToast(`Already logged: ${habit.label} today ✅`, false);
          return;
        }
        throw error;
      }

      // refresh checkins from DB (important for steps mutual exclusive)
      await loadTodaysCheckins();

      await addPoints(habit.points);
      await recomputeAndSaveStreak();
      updateHabitButtonsUI();

      showToast(`+${habit.points} pts for ${habit.label}! 🎯`, true);

      if (!currentLeague.is_solo) {
        await renderLeaderboard();
      }
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

  setAuthMsg(
    "Signup successful! Check your email, click the verification link, then log in."
  );
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
// Mode modal handlers
// ==============================
btnCloseMode.addEventListener("click", closeModeModal);

btnStartSolo.addEventListener("click", async () => {
  try {
    btnStartSolo.disabled = true;
    await rpcCreateLeague("Solo Challenge", true);
    closeModeModal();
    await loadLeague();
    showToast("Solo mode started ✅");
  } catch (e) {
    console.error(e);
    showToast(e.message || String(e), false);
  } finally {
    btnStartSolo.disabled = false;
  }
});

btnCreateLeague.addEventListener("click", async () => {
  const nm = (newLeagueNameInput.value || "").trim();
  if (!nm) return showToast("Enter a league name first.", false);

  try {
    btnCreateLeague.disabled = true;
    const res = await rpcCreateLeague(nm, false);
    closeModeModal();
    await loadLeague();
    showToast("League created ✅");

    if (res?.invite_code) {
      inviteBox.classList.remove("hidden");
      inviteCodeEl.textContent = res.invite_code;
      inviteLinkEl.value = `${window.location.origin}${window.location.pathname}?join=${res.invite_code}`;
    }
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

    // remove join param
    const url = new URL(window.location.href);
    url.searchParams.delete("join");
    window.history.replaceState({}, "", url.toString());

    closeModeModal();
    await loadLeague();
    showToast("Joined league ✅");
  } catch (e) {
    console.error(e);
    showToast(e.message || String(e), false);
  } finally {
    btnJoinLeague.disabled = false;
  }
});

btnSwitchLeague.addEventListener("click", async () => {
  try {
    const leagues = await listMyLeagues();
    const currentId = myProfile?.current_league_id || "";

    const lines = leagues.map((l) => {
      const tag = l.id === currentId ? " (current)" : "";
      return `${l.id} :: ${l.is_solo ? "SOLO" : "LEAGUE"} :: ${l.name}${tag}`;
    });

    const choice = prompt(
      "Paste a league ID to switch to, OR type JOIN:CODE to join, OR type CREATE:Name to create.\n\n" +
        (lines.length ? "Your leagues:\n" + lines.join("\n") : "You have no leagues yet.")
    );

    if (!choice) return;
    const raw = choice.trim();

    if (raw.toUpperCase().startsWith("JOIN:")) {
      const code = raw.split(":").slice(1).join(":").trim().toUpperCase();
      if (!code) return showToast("Missing code.", false);
      await rpcJoinByCode(code);
      await loadLeague();
      return showToast("Joined league ✅");
    }

    if (raw.toUpperCase().startsWith("CREATE:")) {
      const nm = raw.split(":").slice(1).join(":").trim();
      if (!nm) return showToast("Missing league name.", false);
      await rpcCreateLeague(nm, false);
      await loadLeague();
      return showToast("League created ✅");
    }

    await rpcSetCurrentLeague(raw);
    await loadLeague();
    showToast("Switched ✅");
  } catch (e) {
    console.error(e);
    showToast(e.message || String(e), false);
  }
});

btnCopyInvite?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteLinkEl.value);
    showToast("Invite link copied ✅");
  } catch {
    showToast("Couldn't copy link. Copy it manually.", false);
  }
});

btnBoardRefresh?.addEventListener("click", async () => {
  if (!currentLeague?.id || currentLeague.is_solo) return;
  await renderLeaderboard();
});

btnCloseProfile.addEventListener("click", closeProfileModal);

avatarInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await uploadAvatar(file);
  } catch (err) {
    console.error(err);
    avatarStatus.textContent = `Upload error: ${err.message || err}`;
  }
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

  // prevent duplicate listeners by cloning buttons once per boot
  for (const [k, btn] of Object.entries(habitButtons)) {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    habitButtons[k] = clone;
  }
  for (const [k, btn] of Object.entries(habitButtons)) {
    attachHabitButton(k, btn);
  }

  await loadLeague();

  // if invite link contains ?join=CODE and user has no league set, modal opens prefilled
  const params = new URLSearchParams(window.location.search);
  const join = params.get("join");
  if (join && !myProfile.current_league_id) {
    openModeModal();
  }
}

boot().catch((err) => {
  console.error("boot error:", err);
  showAuth();
  setAuthMsg(`Startup error: ${err.message || err}`);
});
