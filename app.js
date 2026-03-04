// ===== Supabase client =====
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE";

window.__hcl = window.__hcl || {};
window.__hcl.sb =
  window.__hcl.sb || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sb = window.__hcl.sb;

// ===== helpers =====
const $ = (id) => document.getElementById(id);

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
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

// ===== habits =====
const HABITS = [
  { key: "water", btn: "btn-log-water", points: 5 },
  { key: "protein", btn: "btn-log-protein", points: 8 },
  { key: "steps_5k", btn: "btn-log-steps-5k", points: 6, group: "steps" },
  { key: "steps_10k", btn: "btn-log-steps-10k", points: 10, group: "steps" },
  { key: "workout", btn: "btn-log-workout", points: 12 },
  { key: "reading", btn: "btn-log-reading", points: 9 },
  { key: "sleep", btn: "btn-log-sleep", points: 11 },
  { key: "no_sugar", btn: "btn-log-no-sugar", points: 7 },
  { key: "no_coke", btn: "btn-log-no-coke", points: 5 },
];

// ===== state =====
let currentUser = null;

// ===== profile =====
async function ensureProfile(user) {
  const { data, error } = await sb
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: user.user_metadata?.name || "Player",
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

// ===== fetch today's logs =====
async function fetchTodayLogs(userId) {
  const today = todayKey();

  const { data, error } = await sb
    .from("checkins")
    .select("habit_key")
    .eq("user_id", userId)
    .eq("checkin_date", today);

  if (error) throw error;

  return new Set(data.map((x) => x.habit_key));
}

// ===== log habit =====
async function logHabit(userId, habit) {
  const today = todayKey();

  const existing = await fetchTodayLogs(userId);

  if (existing.has(habit.key)) {
    toast("You already logged that habit today.", false);
    return;
  }

  if (habit.group === "steps") {
    if (existing.has("steps_5k") || existing.has("steps_10k")) {
      toast("You already logged your steps today.", false);
      return;
    }
  }

  const { error } = await sb.from("checkins").insert({
    user_id: userId,
    habit_key: habit.key,
    points: habit.points,
    checkin_date: today, // ✅ required column
    day_key: today
  });

  if (error) {
    toast("Error logging habit: " + error.message, false);
    return;
  }

  await updatePlayerStats(userId, habit.points);

  toast(`+${habit.points} points!`);
  await refreshUI();
}

// ===== update player points + streak =====
async function updatePlayerStats(userId, points) {
  const { data: player } = await sb
    .from("players")
    .select("*")
    .eq("user_id", userId)
    .single();

  const newPoints = (player.points || 0) + points;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const today = todayKey();

  let newStreak = player.current_streak || 0;

  if (player.last_checkin_date === today) {
    // already counted
  } else if (player.last_checkin_date === yesterdayKey) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  await sb
    .from("players")
    .update({
      points: newPoints,
      current_streak: newStreak,
      last_checkin_date: today,
    })
    .eq("user_id", userId);
}

// ===== UI refresh =====
async function refreshUI() {
  if (!currentUser) return;

  const logs = await fetchTodayLogs(currentUser.id);

  HABITS.forEach((habit) => {
    const btn = $(habit.btn);
    if (!btn) return;

    btn.disabled = logs.has(habit.key);

    if (habit.group === "steps") {
      if (logs.has("steps_5k") || logs.has("steps_10k")) {
        btn.disabled = true;
      }
    }
  });
}

// ===== attach habit buttons =====
function wireHabitButtons() {
  HABITS.forEach((habit) => {
    const btn = $(habit.btn);
    if (!btn) return;

    btn.onclick = () => logHabit(currentUser.id, habit);
  });
}

// ===== auth =====
function wireAuth() {
  $("btn-signup")?.addEventListener("click", async () => {
    const email = $("su-email").value.trim();
    const password = $("su-pass").value;
    const name = $("su-name").value;

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.href,
      },
    });

    if (error) setAuthMsg(error.message);
    else setAuthMsg("Check your email to confirm your account.");
  });

  $("btn-login")?.addEventListener("click", async () => {
    const email = $("li-email").value.trim();
    const password = $("li-pass").value;

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthMsg(error.message);
      return;
    }

    currentUser = data.user;

    const profile = await ensureProfile(currentUser);

    $("whoami").textContent = `${profile.name} (${profile.email})`;

    showGame();

    wireHabitButtons();
    await refreshUI();
  });

  $("btn-logout")?.addEventListener("click", async () => {
    await sb.auth.signOut();
    currentUser = null;
    showAuth();
  });
}

// ===== init =====
async function init() {
  wireAuth();

  const { data } = await sb.auth.getSession();

  if (data.session?.user) {
    currentUser = data.session.user;

    const profile = await ensureProfile(currentUser);

    $("whoami").textContent = `${profile.name} (${profile.email})`;

    showGame();

    wireHabitButtons();
    await refreshUI();
  } else {
    showAuth();
  }
}

document.addEventListener("DOMContentLoaded", init);
