// ===== Supabase client (safe against double-load) =====
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

window.__hcl = window.__hcl || {};
window.__hcl.sb =
  window.__hcl.sb || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sb = window.__hcl.sb;

// ===== Helpers =====
const $ = (id) => document.getElementById(id);

function todayKeyUTC() {
  // consistent “day key” for everyone (prevents timezone weirdness)
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toast(msg, isOk = true) {
  const el = $("toast");
  if (!el) {
    alert(msg);
    return;
  }
  el.textContent = msg;
  el.className =
    "fixed bottom-4 right-4 px-4 py-3 rounded-xl shadow-xl text-sm border " +
    (isOk ? "bg-emerald-700/80 border-emerald-400/40" : "bg-rose-700/80 border-rose-400/40");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

function setAuthMsg(msg) {
  const el = $("auth-msg");
  if (el) el.textContent = msg || "";
}

function showAuth() {
  $("auth-box")?.classList.remove("hidden");
  $("game-box")?.classList.add("hidden");
}

function showGame() {
  $("auth-box")?.classList.add("hidden");
  $("game-box")?.classList.remove("hidden");
}

// ===== Habits config =====
const HABITS = [
  { key: "water", label: "Log Water", points: 5, group: null, btn: "btn-log-water" },
  { key: "protein", label: "Log Protein", points: 8, group: null, btn: "btn-log-protein" },
  { key: "steps_5k", label: "Log Steps 5K–9.9K", points: 6, group: "steps", btn: "btn-log-steps-5k" },
  { key: "steps_10k", label: "Log Steps 10K+", points: 10, group: "steps", btn: "btn-log-steps-10k" },
  { key: "workout", label: "Log Workout", points: 12, group: null, btn: "btn-log-workout" },
  { key: "reading", label: "Log Reading", points: 9, group: null, btn: "btn-log-reading" },
  { key: "sleep", label: "Log Sleep", points: 11, group: null, btn: "btn-log-sleep" },
  { key: "no_sugar", label: "Log No Added Sugar", points: 7, group: null, btn: "btn-log-no-sugar" },
  { key: "no_coke", label: "Log No Coke", points: 5, group: null, btn: "btn-log-no-coke" },
];

function setBtnDisabled(btnEl, disabled) {
  if (!btnEl) return;
  btnEl.disabled = !!disabled;
  btnEl.classList.toggle("btn-disabled", !!disabled);
}

// ===== DB helpers =====
async function ensureProfile(user) {
  const { data: existing, error: e1 } = await sb
    .from("players")
    .select("user_id,email,name,avatar_url,points,current_streak")
    .eq("user_id", user.id)
    .maybeSingle();

  if (e1) throw e1;
  if (existing) return existing;

  const name = user.user_metadata?.name || "Player";
  const profile = {
    user_id: user.id,
    email: user.email,
    name,
    points: 0,
    current_streak: 0,
  };

  const { data: inserted, error: e2 } = await sb
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (e2) throw e2;
  return inserted;
}

async function fetchTodayCheckins(userId) {
  const day = todayKeyUTC();
  const { data, error } = await sb
    .from("checkins")
    .select("habit_key")
    .eq("user_id", userId)
    .eq("day_key", day);

  if (error) throw error;
  return new Set((data || []).map((r) => r.habit_key));
}

async function logHabit({ userId, habitKey, points, group }) {
  const day = todayKeyUTC();

  // 1) Prevent duplicate habit today
  // Also prevent both step options in same day (group = 'steps')
  const todays = await fetchTodayCheckins(userId);

  if (todays.has(habitKey)) {
    return { ok: false, reason: "already_logged" };
  }

  if (group === "steps") {
    if (todays.has("steps_5k") || todays.has("steps_10k")) {
      return { ok: false, reason: "steps_already_logged" };
    }
  }

  // 2) Insert checkin row
  const { error: e1 } = await sb.from("checkins").insert({
    user_id: userId,
    day_key: day,
    habit_key: habitKey,
    points: points,
  });
  if (e1) throw e1;

  // 3) Update points
  const { data: player, error: e2 } = await sb
    .from("players")
    .select("points,current_streak,last_streak_day")
    .eq("user_id", userId)
    .single();
  if (e2) throw e2;

  const lastDay = player.last_streak_day || null;

  // streak rules:
  // - streak counts if you log at least 1 habit that day
  // - if you miss a day, reset to 0, then today becomes 1
  // - if you already logged something today, don’t increment again
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(
    yesterday.getUTCDate()
  ).padStart(2, "0")}`;

  let newStreak = player.current_streak || 0;

  if (lastDay === day) {
    // already counted streak today (don’t increment)
  } else if (lastDay === yKey) {
    newStreak = newStreak + 1;
  } else {
    newStreak = 1;
  }

  const newPoints = (player.points || 0) + points;

  const { error: e3 } = await sb
    .from("players")
    .update({ points: newPoints, current_streak: newStreak, last_streak_day: day })
    .eq("user_id", userId);

  if (e3) throw e3;

  return { ok: true, newPoints, newStreak, todays: await fetchTodayCheckins(userId) };
}

// ===== UI wiring =====
let currentUser = null;

function setProfileUI(profile) {
  const who = $("whoami");
  if (who) who.textContent = `${profile.name} (${profile.email})`;

  const streakEl = $("stat-streak");
  const ptsEl = $("stat-points");
  if (streakEl) streakEl.textContent = String(profile.current_streak || 0);
  if (ptsEl) ptsEl.textContent = String(profile.points || 0);
}

async function refreshDisabledButtons() {
  if (!currentUser) return;

  // Always enable everything first (so you never get stuck)
  for (const h of HABITS) setBtnDisabled($(h.btn), false);

  // Then disable the ones already logged today
  const todays = await fetchTodayCheckins(currentUser.id);

  for (const h of HABITS) {
    if (todays.has(h.key)) {
      setBtnDisabled($(h.btn), true);
    }
  }

  // Steps: if either steps option logged, disable both
  if (todays.has("steps_5k") || todays.has("steps_10k")) {
    setBtnDisabled($("btn-log-steps-5k"), true);
    setBtnDisabled($("btn-log-steps-10k"), true);
  }
}

function wireHabitButtons() {
  for (const h of HABITS) {
    const btn = $(h.btn);
    if (!btn) continue;

    // remove any previous handler (in case of hot reload / double attach)
    btn.onclick = null;

    btn.onclick = async () => {
      if (!currentUser) {
        toast("Please log in first.", false);
        return;
      }

      // If disabled, show popup message too
      if (btn.disabled) {
        if (h.group === "steps") toast("You already logged your steps goal today.", false);
        else toast(`You already logged ${h.label.replace("Log ", "")} today.`, false);
        return;
      }

      try {
        const result = await logHabit({
          userId: currentUser.id,
          habitKey: h.key,
          points: h.points,
          group: h.group,
        });

        if (!result.ok) {
          if (result.reason === "steps_already_logged") toast("You already logged your steps goal today.", false);
          else toast("You already logged that habit today.", false);

          await refreshDisabledButtons();
          return;
        }

        // Update stats on screen
        const ptsEl = $("stat-points");
        const streakEl = $("stat-streak");
        if (ptsEl) ptsEl.textContent = String(result.newPoints);
        if (streakEl) streakEl.textContent = String(result.newStreak);

        toast(`✅ +${h.points} points!`);

        await refreshDisabledButtons();
      } catch (e) {
        console.error(e);
        toast(`Error logging habit: ${e.message || e}`, false);
      }
    };
  }
}

// ===== Auth wiring =====
function wireAuthButtons() {
  $("btn-signup")?.addEventListener("click", async () => {
    setAuthMsg("");

    const email = $("su-email")?.value.trim().toLowerCase();
    const password = $("su-pass")?.value;
    const name = $("su-name")?.value.trim();
    const emoji = $("su-emoji")?.value.trim();

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

    setAuthMsg("Signup successful! Check your email to verify, then come back and log in.");
  });

  $("btn-login")?.addEventListener("click", async () => {
    setAuthMsg("");

    const email = $("li-email")?.value.trim().toLowerCase();
    const password = $("li-pass")?.value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthMsg(`Login error: ${error.message}`);
      return;
    }

    currentUser = data.user;
    if (!currentUser) {
      setAuthMsg("Login failed. Please try again.");
      return;
    }

    try {
      const profile = await ensureProfile(currentUser);
      showGame();
      setProfileUI(profile);

      wireHabitButtons();
      await refreshDisabledButtons();
    } catch (e) {
      console.error(e);
      setAuthMsg(`Profile error: ${e.message || e}`);
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
  wireAuthButtons();
  wireHabitButtons(); // in case buttons exist already

  const { data } = await sb.auth.getSession();
  const session = data.session;

  if (!session?.user) {
    showAuth();
    return;
  }

  currentUser = session.user;

  try {
    const profile = await ensureProfile(currentUser);
    showGame();
    setProfileUI(profile);

    wireHabitButtons();
    await refreshDisabledButtons();
  } catch (e) {
    console.error(e);
    showAuth();
    setAuthMsg(`Session error: ${e.message || e}`);
  }
}

document.addEventListener("DOMContentLoaded", init);
