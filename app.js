const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- UI ----------
const authBox = document.getElementById("auth-box");
const gameBox = document.getElementById("game-box");
const authMsg = document.getElementById("auth-msg");
const whoami = document.getElementById("whoami");

const btnSignup = document.getElementById("btn-signup");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");

const pointsEl = document.getElementById("points");
const streakEl = document.getElementById("streak");
const bestStreakEl = document.getElementById("best-streak");
const gameMsg = document.getElementById("game-msg");

const todayCountEl = document.getElementById("today-count");
const todayListEl = document.getElementById("today-list");

const achvCountEl = document.getElementById("achv-count");
const achvEarnedEl = document.getElementById("achv-earned");

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

// Achievement toast
const achvToast = document.getElementById("achv-toast");
const achvToastIcon = document.getElementById("achv-toast-icon");
const achvToastName = document.getElementById("achv-toast-name");
const achvToastDesc = document.getElementById("achv-toast-desc");
const achvToastClose = document.getElementById("achv-toast-close");

// Mini-game
const btnMinigame = document.getElementById("btn-minigame");
const minigameStatus = document.getElementById("minigame-status");
const minigameMsg = document.getElementById("minigame-msg");

const minigameModal = document.getElementById("minigame-modal");
const scrambleText = document.getElementById("scramble-text");
const minigameInput = document.getElementById("minigame-input");
const minigameModalMsg = document.getElementById("minigame-modal-msg");
const btnMinigameSubmit = document.getElementById("btn-minigame-submit");
const btnMinigameCancel = document.getElementById("btn-minigame-cancel");

// ---------- HABITS ----------
const HABITS = [
  { key: "steps", label: "Steps", points: "6/10", emoji: "🚶" },
  { key: "protein", label: "Protein", points: 8, emoji: "🥩" },
  { key: "water", label: "Water", points: 5, emoji: "💧" },
  { key: "no_sugar", label: "No Sugar", points: 7, emoji: "🍬" },
  { key: "no_coke", label: "No Coke", points: 5, emoji: "🥤" },
  { key: "workout", label: "Workout", points: 12, emoji: "💪" },
  { key: "reading", label: "Reading", points: 9, emoji: "📚" },
  { key: "sleep", label: "Sleep", points: 11, emoji: "😴" },
];

// Logged today set
let todaysHabits = new Set(); // includes habit_keys; also includes "steps" if any step logged
let currentProfile = null;

// Achievements caches
let allAchievements = [];
let earnedAchievementCodes = new Set();

// Mini-game config
const MINIGAME_KEY = "scramble_v1";
const MINIGAME_POINTS = 20;
const WORD_BANK = [
  "protein", "hydration", "workout", "streak", "league",
  "sleep", "reading", "discipline", "momentum", "victory",
  "healthy", "challenge", "habit", "focus", "energy"
];

// ---------- helpers ----------
function setMsg(text) { authMsg.textContent = text || ""; }
function setGameMsg(text) { if (gameMsg) gameMsg.textContent = text || ""; }
function setMinigameMsg(text) { if (minigameMsg) minigameMsg.textContent = text || ""; }

function showAuth() {
  gameBox.classList.add("hidden");
  authBox.classList.remove("hidden");
}

function renderStats(profile) {
  pointsEl.textContent = String(profile.points ?? 0);
  streakEl.textContent = `${profile.current_streak ?? 0} 🔥`;
  bestStreakEl.textContent = `Best: ${profile.best_streak ?? 0}`;
}

function showGame(profile) {
  currentProfile = profile;
  authBox.classList.add("hidden");
  gameBox.classList.remove("hidden");
  whoami.textContent = `${profile.avatar || "👤"} ${profile.name} (${profile.email})`;
  renderStats(profile);
  setGameMsg("");
}

function toYMD(d) { return d.toISOString().slice(0, 10); }
function diffDays(aYmd, bYmd) {
  const a = new Date(aYmd + "T00:00:00");
  const b = new Date(bYmd + "T00:00:00");
  return Math.round((a - b) / 86400000);
}

function shuffleString(str) {
  const arr = str.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function setHabitButtonDone(buttonEl, isDone) {
  if (!buttonEl) return;
  if (isDone) {
    buttonEl.classList.add("opacity-40", "grayscale");
    buttonEl.setAttribute("data-done", "true");
  } else {
    buttonEl.classList.remove("opacity-40", "grayscale");
    buttonEl.removeAttribute("data-done");
  }
}

function updateHabitButtonsFromTodaysHabits() {
  const stepsDone = todaysHabits.has("steps") || todaysHabits.has("steps_5k") || todaysHabits.has("steps_10k");
  setHabitButtonDone(btnSteps, stepsDone);
  setHabitButtonDone(btnProtein, todaysHabits.has("protein"));
  setHabitButtonDone(btnWater, todaysHabits.has("water"));
  setHabitButtonDone(btnNoSugar, todaysHabits.has("no_sugar"));
  setHabitButtonDone(btnNoCoke, todaysHabits.has("no_coke"));
  setHabitButtonDone(btnWorkout, todaysHabits.has("workout"));
  setHabitButtonDone(btnReading, todaysHabits.has("reading"));
  setHabitButtonDone(btnSleep, todaysHabits.has("sleep"));
}

function renderTodayPanel() {
  const stepsDone = todaysHabits.has("steps") || todaysHabits.has("steps_5k") || todaysHabits.has("steps_10k");
  let completed = 0;

  const rows = HABITS.map(h => {
    let done = todaysHabits.has(h.key);
    if (h.key === "steps") done = stepsDone;

    if (done) completed++;

    return `
      <div class="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700">
        <div class="flex items-center gap-2">
          <span>${h.emoji}</span>
          <span class="${done ? "text-emerald-200" : "text-slate-200"} font-semibold">${h.label}</span>
        </div>
        <div class="text-xs ${done ? "text-emerald-300" : "text-slate-400"}">
          ${done ? "✅ done" : "—"}
        </div>
      </div>
    `;
  }).join("");

  todayCountEl.textContent = `${completed}/8`;
  todayListEl.innerHTML = rows;
}

function showAlreadyLogged(habitLabel) {
  alreadyText.textContent = `You already logged "${habitLabel}" today!`;
  alreadyModal.classList.remove("hidden");
}

function closeAlreadyLogged() {
  alreadyModal.classList.add("hidden");
}

function showAchievementToast(achv) {
  achvToastIcon.textContent = achv.icon || "🏅";
  achvToastName.textContent = achv.name;
  achvToastDesc.textContent = achv.description;
  achvToast.classList.remove("hidden");
}

function closeAchievementToast() {
  achvToast.classList.add("hidden");
}

function openStepsModal() { stepsModal.classList.remove("hidden"); }
function closeStepsModal() { stepsModal.classList.add("hidden"); }

// ---------- Supabase profile ----------
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

    if (error) return setMsg(`Signup error: ${error.message}`);
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
    if (error) return setMsg(`Login error: ${error.message}`);

    const user = data.user;
    if (!user) return setMsg("Login failed. Please try again.");

    const profile = await ensureProfile(
      user,
      user.user_metadata?.name || "Player",
      user.user_metadata?.emoji || "👤"
    );

    showGame(profile);

    await refreshAll();
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

// ---------- load today habits ----------
async function loadTodaysHabits() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const today = toYMD(new Date());

  const { data, error } = await supabaseClient
    .from("habit_logs")
    .select("habit_key")
    .eq("user_id", user.id)
    .eq("log_date", today);

  if (error) {
    setGameMsg(`Could not load today's habits: ${error.message}`);
    return;
  }

  todaysHabits = new Set((data || []).map(r => r.habit_key));
  if (todaysHabits.has("steps_5k") || todaysHabits.has("steps_10k")) todaysHabits.add("steps");
  updateHabitButtonsFromTodaysHabits();
  renderTodayPanel();
}

// ---------- achievements ----------
async function loadAchievements() {
  const { data, error } = await supabaseClient
    .from("achievements")
    .select("code,name,description,icon,criteria")
    .order("created_at", { ascending: true });

  if (error) {
    // Don't block game
    return;
  }
  allAchievements = data || [];
}

async function loadEarnedAchievements() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("user_achievements")
    .select("achievement_code, achieved_at")
    .eq("user_id", user.id)
    .order("achieved_at", { ascending: false });

  if (error) return;

  earnedAchievementCodes = new Set((data || []).map(r => r.achievement_code));
  renderAchievementsPanel(data || []);
}

function renderAchievementsPanel(earnedRows) {
  if (!allAchievements.length) {
    achvCountEl.textContent = "";
    achvEarnedEl.innerHTML = `<div class="text-xs text-slate-400">Achievements loading...</div>`;
    return;
  }

  achvCountEl.textContent = `${earnedAchievementCodes.size}/${allAchievements.length}`;

  if (!earnedRows.length) {
    achvEarnedEl.innerHTML = `<div class="text-sm text-slate-400">No achievements yet — your first one is coming soon! 🚀</div>`;
    return;
  }

  const earnedMap = new Map(earnedRows.map(r => [r.achievement_code, r.achieved_at]));
  const earned = allAchievements
    .filter(a => earnedAchievementCodes.has(a.code))
    .map(a => ({ ...a, achieved_at: earnedMap.get(a.code) }))
    .sort((a, b) => new Date(b.achieved_at) - new Date(a.achieved_at))
    .slice(0, 6);

  achvEarnedEl.innerHTML = earned.map(a => `
    <div class="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700">
      <div class="flex items-center gap-2">
        <span class="text-xl">${a.icon}</span>
        <div>
          <div class="font-bold text-slate-100">${a.name}</div>
          <div class="text-xs text-slate-400">${a.description}</div>
        </div>
      </div>
    </div>
  `).join("");
}

async function computeUserStats() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  // Pull all habit logs for this user (fine for now; later we can optimize)
  const { data: logs, error } = await supabaseClient
    .from("habit_logs")
    .select("habit_key, log_date, points")
    .eq("user_id", user.id);

  if (error) return null;

  const totalHabits = logs.length;
  const totalPointsFromLogs = logs.reduce((s, r) => s + (r.points || 0), 0);

  const habitCounts = {};
  const uniqueDays = new Set();
  for (const row of logs) {
    habitCounts[row.habit_key] = (habitCounts[row.habit_key] || 0) + 1;
    uniqueDays.add(row.log_date);
  }

  // mini-game wins count
  const { data: mg, error: mgErr } = await supabaseClient
    .from("minigame_logs")
    .select("id, points")
    .eq("user_id", user.id)
    .eq("game_key", MINIGAME_KEY);

  const minigameWins = mgErr ? 0 : (mg?.length || 0);

  return {
    totalHabits,
    totalPointsFromLogs,
    habitCounts,
    uniqueDaysLogged: uniqueDays.size,
    minigameWins,
  };
}

function meetsCriteria(criteria, profile, stats) {
  const type = criteria?.type;

  if (type === "streak") return (profile.current_streak || 0) >= (criteria.min || 0);
  if (type === "points") return (profile.points || 0) >= (criteria.min || 0);
  if (type === "total_habits") return (stats.totalHabits || 0) >= (criteria.min || 0);
  if (type === "habit_count") {
    const k = criteria.habit;
    return (stats.habitCounts?.[k] || 0) >= (criteria.min || 0);
  }
  if (type === "minigame_wins") return (stats.minigameWins || 0) >= (criteria.min || 0);

  return false;
}

async function awardNewAchievementsIfAny(profile) {
  if (!allAchievements.length) return;

  const stats = await computeUserStats();
  if (!stats) return;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const newlyUnlocked = [];

  for (const achv of allAchievements) {
    if (earnedAchievementCodes.has(achv.code)) continue;

    if (meetsCriteria(achv.criteria, profile, stats)) {
      const { error } = await supabaseClient
        .from("user_achievements")
        .insert({ user_id: user.id, achievement_code: achv.code });

      if (!error) {
        earnedAchievementCodes.add(achv.code);
        newlyUnlocked.push(achv);
      }
    }
  }

  // show toasts for new ones
  for (const a of newlyUnlocked) {
    showAchievementToast(a);
    // small delay so multiple don't collide too hard
    await new Promise(res => setTimeout(res, 1600));
    closeAchievementToast();
  }

  // refresh panel
  await loadEarnedAchievements();
}

// ---------- mini-game ----------
function getTodayWord() {
  const today = toYMD(new Date());
  const idx = hashStr(today + MINIGAME_KEY) % WORD_BANK.length;
  return WORD_BANK[idx];
}

function openMinigameModal() {
  minigameModalMsg.textContent = "";
  minigameInput.value = "";
  const word = getTodayWord();
  scrambleText.textContent = shuffleString(word).toUpperCase();
  minigameModal.classList.remove("hidden");
  setTimeout(() => minigameInput.focus(), 50);
}

function closeMinigameModal() {
  minigameModal.classList.add("hidden");
}

async function refreshMinigameStatus() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const today = toYMD(new Date());

  const { data, error } = await supabaseClient
    .from("minigame_logs")
    .select("id, points")
    .eq("user_id", user.id)
    .eq("play_date", today)
    .eq("game_key", MINIGAME_KEY)
    .maybeSingle();

  if (error) return;

  const done = !!data;
  minigameStatus.textContent = done ? "Completed ✅" : "Available";
  btnMinigame.textContent = done ? "Played Today" : "Play Today";
}

async function submitMinigame() {
  minigameModalMsg.textContent = "";

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const today = toYMD(new Date());
  const answer = (minigameInput.value || "").trim().toLowerCase();
  const word = getTodayWord();

  if (!answer) {
    minigameModalMsg.textContent = "Type an answer first 🙂";
    return;
  }

  // check already played
  const { data: existing } = await supabaseClient
    .from("minigame_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("play_date", today)
    .eq("game_key", MINIGAME_KEY)
    .maybeSingle();

  if (existing) {
    closeMinigameModal();
    setMinigameMsg("You already played today ✅");
    await refreshMinigameStatus();
    return;
  }

  if (answer !== word) {
    minigameModalMsg.textContent = "Not quite — try again!";
    return;
  }

  // insert log
  const { error: insErr } = await supabaseClient
    .from("minigame_logs")
    .insert({ user_id: user.id, play_date: today, game_key: MINIGAME_KEY, points: MINIGAME_POINTS });

  if (insErr) {
    minigameModalMsg.textContent = `Error: ${insErr.message}`;
    return;
  }

  // add points to profile (does NOT affect streak)
  const { data: prof, error: profErr } = await supabaseClient
    .from("players")
    .select("user_id,points,current_streak,best_streak,last_checkin,email,name,avatar")
    .eq("user_id", user.id)
    .single();

  if (profErr) return;

  const newPoints = (prof.points || 0) + MINIGAME_POINTS;

  const { data: updated, error: upErr } = await supabaseClient
    .from("players")
    .update({ points: newPoints })
    .eq("user_id", user.id)
    .select("user_id,email,name,avatar,points,current_streak,best_streak,last_checkin")
    .single();

  if (upErr) return;

  showGame(updated);
  closeMinigameModal();
  setMinigameMsg(`Correct! +${MINIGAME_POINTS} pts 🎉`);

  await refreshMinigameStatus();
  await awardNewAchievementsIfAny(updated); // includes minigame_5
}

// ---------- habit logging ----------
async function logHabit(habitKey, habitLabel, points) {
  setGameMsg("");

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const today = toYMD(new Date());

  // Steps: only one option per day
  if (habitKey.startsWith("steps")) {
    const { data: existingSteps } = await supabaseClient
      .from("habit_logs")
      .select("habit_key")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .in("habit_key", ["steps_5k", "steps_10k"]);

    if (existingSteps && existingSteps.length > 0) {
      showAlreadyLogged("Steps");
      return;
    }
  }

  // insert habit log (unique per habit/day)
  const { error: insErr } = await supabaseClient
    .from("habit_logs")
    .insert({ user_id: user.id, log_date: today, habit_key: habitKey, points });

  if (insErr) {
    const msg = (insErr.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) showAlreadyLogged(habitLabel);
    else setGameMsg(`Habit log error: ${insErr.message}`);
    return;
  }

  // load profile
  const { data: prof, error: profErr } = await supabaseClient
    .from("players")
    .select("user_id,email,name,avatar,points,current_streak,best_streak,last_checkin")
    .eq("user_id", user.id)
    .single();

  if (profErr) return setGameMsg(`Profile load error: ${profErr.message}`);

  // streak logic
  let newStreak = 1;
  const last = prof.last_checkin;

  if (last) {
    const days = diffDays(today, last);
    if (days === 0) newStreak = prof.current_streak || 1;
    else if (days === 1) newStreak = (prof.current_streak || 0) + 1;
    else newStreak = 1;
  }

  const newBest = Math.max(prof.best_streak || 0, newStreak);
  const newPoints = (prof.points || 0) + points;

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

  if (upErr) return setGameMsg(`Update error: ${upErr.message}`);

  showGame(updated);

  // update local today state + UI
  todaysHabits.add(habitKey);
  if (habitKey === "steps_5k" || habitKey === "steps_10k") todaysHabits.add("steps");
  updateHabitButtonsFromTodaysHabits();
  renderTodayPanel();

  setGameMsg(`Logged "${habitLabel}" ✅ +${points} pts`);

  // achievements check
  await awardNewAchievementsIfAny(updated);
}

// ---------- wiring ----------
btnStepsCancel?.addEventListener("click", closeStepsModal);
btnAlreadyClose?.addEventListener("click", closeAlreadyLogged);
achvToastClose?.addEventListener("click", closeAchievementToast);

btnSteps?.addEventListener("click", () => {
  const stepsDone = todaysHabits.has("steps") || todaysHabits.has("steps_5k") || todaysHabits.has("steps_10k");
  if (stepsDone) return showAlreadyLogged("Steps");
  openStepsModal();
});

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

// Mini-game
btnMinigame?.addEventListener("click", async () => {
  setMinigameMsg("");
  await refreshMinigameStatus();
  // if already completed, just message
  if (btnMinigame.textContent.includes("Played")) {
    setMinigameMsg("You already played today ✅");
    return;
  }
  openMinigameModal();
});
btnMinigameCancel?.addEventListener("click", closeMinigameModal);
btnMinigameSubmit?.addEventListener("click", submitMinigame);

// ---------- master refresh ----------
async function refreshAll() {
  await loadAchievements();
  await loadEarnedAchievements();
  await loadTodaysHabits();
  await refreshMinigameStatus();
  // also award anything retroactively earned (ex: if you already had points/habits before adding achievements)
  if (currentProfile) await awardNewAchievementsIfAny(currentProfile);
}

// ---------- init (auto session restore) ----------
(async function init() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return showAuth();

  const session = data.session;
  if (!session?.user) return showAuth();

  try {
    const user = session.user;
    const profile = await ensureProfile(
      user,
      user.user_metadata?.name || "Player",
      user.user_metadata?.emoji || "👤"
    );
    showGame(profile);
    await refreshAll();
  } catch (e) {
    showAuth();
    setMsg(`Session error: ${e?.message || e}`);
  }
})();
