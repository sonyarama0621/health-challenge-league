// ===== Supabase client (safe + stable) =====
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BRrrewpR08gLYTPhn7kZTw_WsMDu5g0";

if (!window.supabase) {
  const el = document.getElementById("auth-msg");
  if (el) el.textContent = "Supabase library did not load. Check index.html script tags.";
  throw new Error("Supabase library not loaded");
}

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
    "fixed bottom-4 right-4 px-4 py-3 rounded-xl shadow-xl text-sm border " +
    (ok
      ? "bg-emerald-700/80 border-emerald-400/40"
      : "bg-rose-700/80 border-rose-400/40");

  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2500);
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

// ===== Habits (must match IDs in index.html) =====
const HABITS = [
  { key: "water", btn: "btn-log-water", points: 5, label: "Water" },
  { key: "protein", btn: "btn-log-protein", points: 8, label: "Protein" },
  { key: "no_sugar", btn: "btn-log-no-sugar", points: 7, label: "No Added Sugar" },
  { key: "no_coke", btn: "btn-log-no-coke", points: 5, label: "No Coke" },
  { key: "workout", btn: "btn-log-workout", points: 12, label: "Workout" },
  { key: "reading", btn: "btn-log-reading", points: 9, label: "Reading" },
  { key: "sleep", btn: "btn-log-sleep", points: 11, label: "Sleep" },
  { key: "steps_5k", btn: "btn-log-steps-5k", points: 6, label: "Steps (5K-9.9K)", group: "steps" },
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
  };

  const { data: inserted, error: e2 } = await sb
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (e2) throw e2;
  return inserted;
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
    // already counted streak today
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
}

async function refreshButtons() {
  if (!currentUser) return;

  HABITS.forEach((h) => setBtnDisabled($(h.btn), false));

  const logs = await fetchTodayLogs(currentUser.id);

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
  // Supabase JS returns PostgREST error objects; 409 commonly appears as "status"
  return error && (error.status === 409 || error.code === "23505");
}

async function insertCheckin(userId, habit) {
  const today = dayKey();

  // Client-side guard (nice UX)
  const logs = await fetchTodayLogs(userId);

  if (logs.has(habit.key)) {
    toast(`You already logged ${habit.label} today.`, false);
    await refreshButtons();
    return;
  }

  if (habit.group === "steps" && (logs.has("steps_5k") || logs.has("steps_10k"))) {
    toast("You already logged your Steps today.", false);
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

  // ✅ Handle duplicate/unique constraint gracefully
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
      if (!currentUser) return toast("Please log in first.", false);

      if (btn.disabled) {
        toast(`You already logged ${habit.label} today.`, false);
        return;
      }

      await insertCheckin(currentUser.id, habit);
    };
  });
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

      const profile = await ensureProfile(currentUser);

      if ($("whoami")) $("whoami").textContent = `${profile.name} (${profile.email})`;
      if ($("stat-points")) $("stat-points").textContent = String(profile.points || 0);
      if ($("stat-streak")) $("stat-streak").textContent = String(profile.current_streak || 0);

      showGame();
      wireHabitButtons();
      await refreshButtons();
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

    const profile = await ensureProfile(currentUser);

    if ($("whoami")) $("whoami").textContent = `${profile.name} (${profile.email})`;
    if ($("stat-points")) $("stat-points").textContent = String(profile.points || 0);
    if ($("stat-streak")) $("stat-streak").textContent = String(profile.current_streak || 0);

    showGame();
    await refreshButtons();
  } catch (e) {
    console.error(e);
    setAuthMsg("Init crashed: " + (e.message || e));
    showAuth();
  }
}

document.addEventListener("DOMContentLoaded", init);
