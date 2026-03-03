// 1) Paste your Supabase project URL + anon key here
// Supabase → Project Settings → API
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI elements
const authBox = document.getElementById("auth-box");
const gameBox = document.getElementById("game-box");
const authMsg = document.getElementById("auth-msg");
const whoami = document.getElementById("whoami");

const btnSignup = document.getElementById("btn-signup");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");

function setMsg(text) {
  authMsg.textContent = text || "";
}

function showGame(profile) {
  authBox.classList.add("hidden");
  gameBox.classList.remove("hidden");
  whoami.textContent = `${profile.avatar || "👤"} ${profile.name} (${profile.email})`;
}

function showAuth() {
  gameBox.classList.add("hidden");
  authBox.classList.remove("hidden");
}

async function ensureProfile(user, fallbackName, fallbackEmoji) {
  // Check if profile exists
  const { data: existing, error: selErr } = await supabase
    .from("players")
    .select("user_id,email,name,avatar")
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
  };

  const { data: inserted, error: insErr } = await supabase
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (insErr) throw insErr;
  return inserted;
}

btnSignup.addEventListener("click", async () => {
  setMsg("");

  const email = document.getElementById("su-email").value.trim().toLowerCase();
  const password = document.getElementById("su-pass").value;
  const name = document.getElementById("su-name").value.trim();
  const emoji = document.getElementById("su-emoji").value.trim();

  if (!email || !password || !name) {
    setMsg("Please enter email, password, and display name.");
    return;
  }

  // IMPORTANT: redirectTo must match Supabase Auth URL configuration
  const redirectTo = window.location.origin + window.location.pathname;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: { name, emoji }
    }
  });

  if (error) {
    setMsg(`Signup error: ${error.message}`);
    return;
  }

  setMsg("Signup successful! Check your email and click the verification link, then come back and log in.");
});

btnLogin.addEventListener("click", async () => {
  setMsg("");

  const email = document.getElementById("li-email").value.trim().toLowerCase();
  const password = document.getElementById("li-pass").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setMsg(`Login error: ${error.message}`);
    return;
  }

  // If email isn't confirmed, Supabase usually blocks login depending on settings,
  // but we still handle it gracefully.
  const user = data.user;
  if (!user) {
    setMsg("Login failed. Please try again.");
    return;
  }

  try {
    const name = user.user_metadata?.name || "Player";
    const emoji = user.user_metadata?.emoji || "👤";
    const profile = await ensureProfile(user, name, emoji);
    showGame(profile);
  } catch (e) {
    setMsg(`Profile error: ${e.message || e}`);
  }
});

btnLogout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showAuth();
  setMsg("Logged out.");
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
    showGame(profile);
  } catch (e) {
    showAuth();
    setMsg(`Session error: ${e.message || e}`);
  }
})();
