// ===== Supabase client =====
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

// Create once globally (won't redeclare)
window.__hcl = window.__hcl || {};
window.__hcl.supabase =
  window.__hcl.supabase ||
  window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sb = window.__hcl.supabase; // <- use sb everywhere (not "supabase")

// ===== UI refs =====
const authBox = document.getElementById("auth-box");
const gameBox = document.getElementById("game-box");
const authMsg = document.getElementById("auth-msg");

const whoami = document.getElementById("whoami");
const btnSignup = document.getElementById("btn-signup");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");

function setAuthMsg(text) {
  if (authMsg) authMsg.textContent = text || "";
}
function showGame() {
  authBox?.classList.add("hidden");
  gameBox?.classList.remove("hidden");
}
function showAuth() {
  gameBox?.classList.add("hidden");
  authBox?.classList.remove("hidden");
}

// ===== Ensure profile exists =====
async function ensureProfile(user, fallbackName, fallbackEmoji) {
  const { data: existing, error: selErr } = await sb
    .from("players")
    .select("user_id,email,name,avatar,points,current_streak")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: fallbackName || "Player",
    avatar: (fallbackEmoji || "👤").slice(0, 4),
    points: 0,
    current_streak: 0,
  };

  const { data: inserted, error: insErr } = await sb
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (insErr) throw insErr;
  return inserted;
}

// ===== Auth handlers =====
btnSignup?.addEventListener("click", async () => {
  setAuthMsg("");

  const email = document.getElementById("su-email")?.value.trim().toLowerCase();
  const password = document.getElementById("su-pass")?.value;
  const name = document.getElementById("su-name")?.value.trim();
  const emoji = document.getElementById("su-emoji")?.value.trim();

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

btnLogin?.addEventListener("click", async () => {
  setAuthMsg("");

  const email = document.getElementById("li-email")?.value.trim().toLowerCase();
  const password = document.getElementById("li-pass")?.value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthMsg(`Login error: ${error.message}`);
    return;
  }

  const user = data.user;
  if (!user) {
    setAuthMsg("Login failed. Please try again.");
    return;
  }

  try {
    const name = user.user_metadata?.name || "Player";
    const emoji = user.user_metadata?.emoji || "👤";
    await ensureProfile(user, name, emoji);

    if (whoami) whoami.textContent = `${name} (${user.email})`;
    showGame();
  } catch (e) {
    setAuthMsg(`Profile error: ${e.message || e}`);
  }
});

btnLogout?.addEventListener("click", async () => {
  await sb.auth.signOut();
  showAuth();
  setAuthMsg("Logged out.");
});

// ===== Auto restore session =====
(async function init() {
  const { data } = await sb.auth.getSession();
  const session = data.session;

  if (!session?.user) {
    showAuth();
    return;
  }

  try {
    const user = session.user;
    const name = user.user_metadata?.name || "Player";
    const emoji = user.user_metadata?.emoji || "👤";
    await ensureProfile(user, name, emoji);

    if (whoami) whoami.textContent = `${name} (${user.email})`;
    showGame();
  } catch (e) {
    showAuth();
    setAuthMsg(`Session error: ${e.message || e}`);
  }
})();
