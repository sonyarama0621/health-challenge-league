const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

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
  const { data: existing } = await supabaseClient
    .from("players")
    .select("user_id,email,name,avatar")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return existing;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: fallbackName || "Player",
    avatar: fallbackEmoji || "👤",
  };

  const { data: inserted } = await supabaseClient
    .from("players")
    .insert(profile)
    .select()
    .single();

  return inserted;
}

btnSignup.addEventListener("click", async () => {
  setMsg("");
  btnSignup.disabled = true;
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
        emailRedirectTo:
          "https://sonyarama0621.github.io/health-challenge-league/",
        data: { name, emoji },
      },
    });

    if (error) {
      setMsg(`Signup error: ${error.message}`);
      return;
    }

    setMsg("Signup submitted ✅ Check your email.");
  } catch (e) {
    setMsg(`Unexpected error: ${e?.message || e}`);
  } finally {
    btnSignup.disabled = false;
    btnSignup.textContent = "Sign up (will email you a verification link)";
  }
});

btnLogin.addEventListener("click", async () => {
  setMsg("");
  btnLogin.disabled = true;
  btnLogin.textContent = "Logging in...";

  try {
    const email = document.getElementById("li-email").value.trim().toLowerCase();
    const password = document.getElementById("li-pass").value;

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setMsg(`Login error: ${error.message}`);
      return;
    }

    const user = data.user;
    const profile = await ensureProfile(
      user,
      user.user_metadata?.name,
      user.user_metadata?.emoji
    );

    showGame(profile);
  } catch (e) {
    setMsg(`Login error: ${e?.message || e}`);
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Log in";
  }
});

btnLogout.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showAuth();
});

(async function init() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session?.user) {
    showAuth();
    return;
  }

  const user = data.session.user;
  const profile = await ensureProfile(
    user,
    user.user_metadata?.name,
    user.user_metadata?.emoji
  );
  showGame(profile);
})();
