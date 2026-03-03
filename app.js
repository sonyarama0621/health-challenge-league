const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI elements
const authBox = document.getElementById("auth-box");
const gameBox = document.getElementById("game-box");
const authMsg = document.getElementById("auth-msg");
const whoami = document.getElementById("whoami");

const btnSignup = document.getElementById("btn-signup");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");

// Stats
const pointsEl = document.getElementById("points");
const streakEl = document.getElementById("streak");
const bestStreakEl = document.getElementById("best-streak");
const gameMsg = document.getElementById("game-msg");

// Habits buttons
const btnSteps = document.getElementById("btn-steps");
const btnProtein = document.getElementById("btn-protein");
const btnWater = document.getElementById("btn-water");
const btnNoSugar = document.getElementById("btn-no-sugar");
const btnNoCoke = document.getElementById("btn-no-coke");
const btnWorkout = document.getElementById("btn-workout");
const btnReading = document.getElementById("btn-reading");
const btnSleep = document.getElementById("btn-sleep");

// Steps modal
const stepsModal = document.getElementById("steps-modal");
const btnSteps5k = document.getElementById("btn-steps-5k");
const btnSteps10k = document.getElementById("btn-steps-10k");
const btnStepsCancel = document.getElementById("btn-steps-cancel");

// Already modal
const alreadyModal = document.getElementById("already-modal");
const alreadyText = document.getElementById("already-text");
const btnAlreadyClose = document.getElementById("btn-already-close");

function setMsg(text) {
  authMsg.textContent = text || "";
}
function setGameMsg(text) {
  if (gameMsg) gameMsg.textContent = text || "";
}

function showAuth() {
  gameBox.classList.add("hidden");
  authBox.classList.remove("hidden");
}

function renderStats(profile) {
  if (pointsEl) pointsEl.textContent = String(profile.points ?? 0);
  if (streakEl) streakEl.textContent = `${profile.current_streak ?? 0} 🔥`;
  if (bestStreakEl) bestStreakEl.textContent = `Best: ${profile.best_streak ?? 0}`;
}

function showGame(profile) {
  authBox.classList.add("hidden");
  gameBox.classList.remove("hidden");
  whoami.textContent = `${profile.avatar || "👤"} ${profile.name} (${profile.email})`;
  renderStats(profile);
  setGameMsg("");
}

async function ensureProfile(user, fallbackName, fallbackEmoji) {
  const { data: existing, error: selErr } = await supabaseClient
    .from("players")
    .select("user_id,email,name,avatar,points,current_streak,best_streak,last_checkin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: fallbackName || "Player",
    avatar: fallbackEmoji || "👤",
    points: 0,
    current_streak: 0,
    best_streak: 0,
    last_checkin: null,
  };

  const { data: inserted, error: insErr } = await supabaseClient
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (insErr) throw insErr;
  return inserted;
}

// ---------- AUTH ----------
btnSignup.addEventListener("click", async () => {
  setMsg("");
  btnSignup.disabled = true;
  const oldText = btnSignup.textContent;
  btnSignup.textContent = "Working...";

  try {
    const email = document.getElementById("su-email").value.trim().toLowerCase();
    const password = document.getElementById("su-pass").value;
    const name = document.getElementById("su-name").value.trim();
    const emoji = document.getElementById("su-emoji").value.trim();

    if (!email || !password || !name) {
      setMsg("Please enter email, password, and display name.");
      return;
    }

    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://sonyarama0621.github.io/health-challenge-league/",
        data: { name, emoji },
      },
    });

    if (error) {
      setMsg(`Signup error: ${error.message}`);
      return;
    }

    setMsg("Signup submitted ✅ Check your email for the verification link.");
  } catch (e) {
    setMsg(`Unexpected error: ${e?.message || e}`);
  } finally {
    btnSignup.disabled = false;
    btnSignup.textContent = oldText;
  }
});

btnLogin.addEventListener("click", async () => {
  setMsg("");
  btnLogin.disabled = true;
  const oldText = btnLogin.textContent;
  btnLogin.textContent = "Logging in...";

  try {
    const email = document.getElementById("li-email").value.trim().toLowerCase();
    const password = document.getElementById("li-pass").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      setMsg(`Login error: ${error.message}`);
      return;
    }

    const user = data.user;
    if (!user) {
      setMsg("Login failed. Please try again.");
      return;
    }

    const profile = await ensureProfile(
      user,
      user.user_metadata?.name || "Player",
      user.user_metadata?.emoji || "👤"
    );

    showGame(profile);
  } catch (e) {
    setMsg(`Login error: ${e?.message || e}`);
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = oldText;
  }
});

btnLogout.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showAuth();
  setMsg("Logged out.");
});

// ---------- MODALS ----------
function openStepsModal() {
  stepsModal?.classList.remove("hidden");
}
function closeStepsModal() {
  stepsModal?.classList.add("hidden");
}

function showAlreadyLogged(habitLabel) {
  if (alreadyText) alreadyText.textContent = `You already logged "${habitLabel}" today!`;
  alreadyModal?.classList.remove("hidden");
}
function closeAlreadyLogged() {
  alreadyModal?.classList.add("hidden");
}

btnStepsCancel?.addEventListener("click", closeStepsModal);
btnAlreadyClose?.addEventListener("click", closeAlreadyLogged);

// ---------- HABIT LOGGING + STREAK ----------
function toYMD(d) {
  return d.toISOString().slice(0, 10);
}
function diffDays(aYmd, bYmd) {
  const a = new Date(aYmd + "T00:00:00");
  const b = new Date(bYmd + "T00:00:00");
  return Math.round((a - b) / 86400000);
}

async function logHabit(habitKey, habitLabel, points) {
  setGameMsg("");

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    setGameMsg("You must be logged in.");
    return;
  }

  const today = toYMD(new Date());

  // 1) Insert habit log (unique constraint blocks duplicates per habit/day)
  const { error: insErr } = await supabaseClient
    .from("habit_logs")
    .insert({ user_id: user.id, log_date: today, habit_key: habitKey, points });

  if (insErr) {
    const msg = (insErr.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      showAlreadyLogged(habitLabel);
    } else {
      setGameMsg(`Habit log error: ${insErr.message}`);
    }
    return;
  }

  // 2) Load profile
  const { data: prof, error: profErr } = await supabaseClient
    .from("players")
    .select("user_id,email,name,avatar,points,current_streak,best_streak,last_checkin")
    .eq("user_id", user.id)
    .single();

  if (profErr) {
    setGameMsg(`Profile load error: ${profErr.message}`);
    return;
  }

  // 3) Compute streak:
  // - if last_checkin is today => streak unchanged
  // - if last_checkin is yesterday => streak +1
  // - else => streak = 1 (because they logged at least 1 habit today)
  let newStreak = 1;
  const last = prof.last_checkin; // YYYY-MM-DD or null

  if (last) {
    const days = diffDays(today, last);
    if (days === 0) newStreak = prof.current_streak || 1;
    else if (days === 1) newStreak = (prof.current_streak || 0) + 1;
    else newStreak = 1;
  }

  const newBest = Math.max(prof.best_streak || 0, newStreak);
  const newPoints = (prof.points || 0) + points;

  // 4) Update profile + set last_checkin to today
  const { data: updated, error: upErr } = await supabaseClient
    .from("players")
    .update({
      points: newPoints,
      current_streak: newStreak,
      best_streak: newBest,
      last_checkin: today,
    })
    .eq("user_id", user.id)
    .select("user_id,email,name,avatar,points,current_streak,best_streak,last_checkin")
    .single();

  if (upErr) {
    setGameMsg(`Update error: ${upErr.message}`);
    return;
  }

  showGame(updated);
  setGameMsg(`Logged "${habitLabel}" ✅ +${points} pts`);
}

// ---------- BUTTON WIRING ----------
btnSteps?.addEventListener("click", openStepsModal);

btnSteps5k?.addEventListener("click", async () => {
  closeStepsModal();
  await logHabit("steps_5k", "5K–9.9K Steps", 6);
});

btnSteps10k?.addEventListener("click", async () => {
  closeStepsModal();
  await logHabit("steps_10k", "10K+ Steps", 10);
});

btnProtein?.addEventListener("click", () => logHabit("protein", "Protein Goal", 8));
btnWater?.addEventListener("click", () => logHabit("water", "64+ oz Water", 5));
btnNoSugar?.addEventListener("click", () => logHabit("no_sugar", "No Added Sugar", 7));
btnNoCoke?.addEventListener("click", () => logHabit("no_coke", "No Coke", 5));
btnWorkout?.addEventListener("click", () => logHabit("workout", "30+ min Workout", 12));
btnReading?.addEventListener("click", () => logHabit("reading", "30+ min Reading", 9));
btnSleep?.addEventListener("click", () => logHabit("sleep", "7–8 hrs Sleep", 11));

// Auto-session restore
(async function init() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showAuth();
    setMsg(`Session error: ${error.message}`);
    return;
  }

  const session = data.session;
  if (!session?.user) {
    showAuth();
    return;
  }

  try {
    const user = session.user;
    const profile = await ensureProfile(
      user,
      user.user_metadata?.name || "Player",
      user.user_metadata?.emoji || "👤"
    );
    showGame(profile);
  } catch (e) {
    showAuth();
    setMsg(`Session error: ${e?.message || e}`);
  }
})();
