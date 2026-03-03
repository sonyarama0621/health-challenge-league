// Supabase → Project Settings → API
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

// IMPORTANT: Supabase CDN script already creates window.supabase,
// so we must NOT redeclare "supabase" as a variable name.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const { data: existing, error: selErr } = await supabaseClient
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

  const { data: inserted, error: insErr } = await supabaseClient
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (insErr) throw insErr;
  return inserted;
}

btnSignup.addEventListener("click", async () => {
  setMsg("");

  // Immediate UI feedback so it never feels like "nothing happened"
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

    // This must match your Supabase Auth URL configuration
    const redirectTo = "https://sonyarama0621.github.io/health-challenge-league/";

    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { name, emoji },
      },
    });

    if (error) {
      setMsg(`Signup error: ${error.message}`);
      return;
    }

    setMsg(
      "Signup submitted ✅ Check your email for the verification link, then come back and log in."
    );
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

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg(`Login error: ${error.message}`);
      return;
    }

    const user = data.user;
    if (!user) {
      setMsg("Login failed. Please try again.");
      return;
    }

    const name = user.user_metadata?.name || "Player";
    const emoji = user.user_metadata?.emoji || "👤";
    const profile = await ensureProfile(user, name, emoji);
    showGame(profile);
  } catch (e) {
    setMsg(`Profile/login error: ${e?.message || e}`);
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
    const name = user.user_metadata?.name || "Player";
    const emoji = user.user_metadata?.emoji || "👤";
    const profile = await ensureProfile(user, name, emoji);
    showGame(profile);
  } catch (e) {
    showAuth();
    setMsg(`Session error: ${e?.message || e}`);
  }
})();
