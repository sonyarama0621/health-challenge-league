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

// Game UI (exists only when logged in)
const pointsEl = document.getElementById("points");
const streakEl = document.getElementById("streak");
const bestStreakEl = document.getElementById("best-streak");
const btnCheckin = document.getElementById("btn-checkin");
const gameMsg = document.getElementById("game-msg");

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
  // Check if profile exists
  const { data: existing, error: selErr } = await supabaseClient
    .from("players")
    .select("user_id,email,name,avatar,points,current_streak,best_streak,last_checkin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing;

  // Create profile row
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

// ---------- DAILY CHECK-IN (Duolingo-style) ----------
btnCheckin?.addEventListener("click", async () => {
  setGameMsg("");

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    setGameMsg("You must be logged in.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const CHECKIN_POINTS = 10;

  btnCheckin.disabled = true;
  const oldText = btnCheckin.textContent;
  btnCheckin.textContent = "Checking in...";

  try {
    // 1) Insert checkin row (unique constraint enforces once/day)
    const { error: insErr } = await supabaseClient
      .from("checkins")
      .insert({ user_id: user.id, checkin_date: today, points_awarded: CHECKIN_POINTS });

    if (insErr) {
      const msg = (insErr.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        setGameMsg("You already checked in today ✅ Come back tomorrow!");
      } else {
        setGameMsg(`Check-in error: ${insErr.message}`);
      }
      return;
    }

    // 2) Load current profile
    const { data: prof, error: profErr } = await supabaseClient
      .from("players")
      .select("user_id,email,name,avatar,points,current_streak,best_streak,last_checkin")
      .eq("user_id", user.id)
      .single();

    if (profErr) throw profErr;

    // 3) Calculate streak
    let newStreak = 1;

    if (prof.last_checkin) {
      const lastDate = new Date(prof.last_checkin + "T00:00:00");
      const todayDate = new Date(today + "T00:00:00");
      const diffDays = Math.round((todayDate - lastDate) / 86400000);

      if (diffDays === 1) newStreak = (prof.current_streak || 0) + 1;
      else if (diffDays === 0) newStreak = prof.current_streak || 0;
      else newStreak = 1;
    }

    const newBest = Math.max(prof.best_streak || 0, newStreak);
    const newPoints = (prof.points || 0) + CHECKIN_POINTS;

    // 4) Update profile
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

    if (upErr) throw upErr;

    showGame(updated);
    setGameMsg("Check-in complete! 🎉");
  } catch (e) {
    setGameMsg(`Unexpected error: ${e?.message || e}`);
  } finally {
    btnCheckin.disabled = false;
    btnCheckin.textContent = oldText;
  }
});

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
