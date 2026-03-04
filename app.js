// ===== Supabase client (safe + debuggable) =====
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BRrrewpR08gLYTPhn7kZTw_WsMDu5g0";

// If Supabase JS didn't load, show a clear message
function mustHaveSupabaseLoaded() {
  if (!window.supabase) {
    const msg =
      "Supabase library did not load. Fix index.html script tags:\n" +
      "1) <script defer src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script>\n" +
      "2) <script defer src='./app.js'></script>";
    const el = document.getElementById("auth-msg");
    if (el) el.textContent = msg;
    throw new Error(msg);
  }
}
mustHaveSupabaseLoaded();

window.__hcl = window.__hcl || {};
window.__hcl.sb =
  window.__hcl.sb || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sb = window.__hcl.sb;

// ===== helpers =====
const $ = (id) => document.getElementById(id);

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

// ===== state =====
let currentUser = null;

// ===== auth wiring =====
function wireAuth() {
  const btnSignup = $("btn-signup");
  const btnLogin = $("btn-login");
  const btnLogout = $("btn-logout");

  if (!btnSignup || !btnLogin) {
    setAuthMsg("Missing auth buttons in HTML (btn-signup / btn-login).");
    return;
  }

  btnSignup.onclick = async () => {
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

      if (error) {
        setAuthMsg("Signup error: " + error.message);
        return;
      }

      setAuthMsg("✅ Signup successful! Check your email to verify, then log in.");
    } catch (e) {
      console.error(e);
      setAuthMsg("Signup crashed: " + (e.message || e));
    }
  };

  btnLogin.onclick = async () => {
    try {
      setAuthMsg("");

      const email = $("li-email")?.value.trim().toLowerCase();
      const password = $("li-pass")?.value;

      if (!email || !password) {
        setAuthMsg("Please enter email and password.");
        return;
      }

      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        setAuthMsg("Login error: " + error.message);
        return;
      }

      currentUser = data.user;
      if (!currentUser) {
        setAuthMsg("Login failed: no user returned.");
        return;
      }

      const profile = await ensureProfile(currentUser);

      const whoami = $("whoami");
      if (whoami) whoami.textContent = `${profile.name} (${profile.email})`;

      showGame();
      setAuthMsg("");
    } catch (e) {
      console.error(e);
      setAuthMsg("Login crashed: " + (e.message || e));
    }
  };

  btnLogout && (btnLogout.onclick = async () => {
    await sb.auth.signOut();
    currentUser = null;
    showAuth();
    setAuthMsg("Logged out.");
  });
}

// ===== init =====
async function init() {
  wireAuth();

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

    const whoami = $("whoami");
    if (whoami) whoami.textContent = `${profile.name} (${profile.email})`;

    showGame();
  } catch (e) {
    console.error(e);
    setAuthMsg("Init crashed: " + (e.message || e));
    showAuth();
  }
}

document.addEventListener("DOMContentLoaded", init);
