const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const authBox = document.getElementById("auth-box");
const gameBox = document.getElementById("game-box");
const authMsg = document.getElementById("auth-msg");
const whoami = document.getElementById("whoami");

const btnSignup = document.getElementById("btn-signup");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");

const avatarChip = document.getElementById("avatar-chip");
const avatarFile = document.getElementById("avatar-file");
const btnUploadAvatar = document.getElementById("btn-upload-avatar");
const avatarPreview = document.getElementById("avatar-preview");
const avatarFallback = document.getElementById("avatar-fallback");
const avatarMsg = document.getElementById("avatar-msg");

const pointsEl = document.getElementById("points");
const streakEl = document.getElementById("streak");
const bestStreakEl = document.getElementById("best-streak");
const gameMsg = document.getElementById("game-msg");

const todayCountEl = document.getElementById("today-count");
const todayListEl = document.getElementById("today-list");

const achvCountEl = document.getElementById("achv-count");
const achvEarnedEl = document.getElementById("achv-earned");

// Habits
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

// Already logged modal
const alreadyModal = document.getElementById("already-modal");
const alreadyText = document.getElementById("already-text");
const btnAlreadyClose = document.getElementById("btn-already-close");

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

// Data
const HABITS = [
  { key: "steps", label: "Steps", emoji: "🚶" },
  { key: "protein", label: "Protein", emoji: "🥩" },
  { key: "water", label: "Water", emoji: "💧" },
  { key: "no_sugar", label: "No Sugar", emoji: "🍬" },
  { key: "no_coke", label: "No Coke", emoji: "🥤" },
  { key: "workout", label: "Workout", emoji: "💪" },
  { key: "reading", label: "Reading", emoji: "📚" },
  { key: "sleep", label: "Sleep", emoji: "😴" },
];

let todaysHabits = new Set();
let currentProfile = null;

const MINIGAME_KEY = "scramble_v1";
const MINIGAME_POINTS = 20;
const WORD_BANK = ["protein","hydration","workout","streak","league","sleep","reading","discipline","momentum","victory","healthy","challenge","habit","focus","energy"];

function setMsg(text) { authMsg.textContent = text || ""; }
function setGameMsg(text) { if (gameMsg) gameMsg.textContent = text || ""; }
function setMinigameMsg(text) { if (minigameMsg) minigameMsg.textContent = text || ""; }
function setAvatarMsg(text) { if (avatarMsg) avatarMsg.textContent = text || ""; }

function showAuth() {
  gameBox.classList.add("hidden");
  authBox.classList.remove("hidden");
}

function toYMD(d) { return d.toISOString().slice(0, 10); }
function diffDays(aYmd, bYmd) {
  const a = new Date(aYmd + "T00:00:00");
  const b = new Date(bYmd + "T00:00:00");
  return Math.round((a - b) / 86400000);
}

function showGame(profile) {
  currentProfile = profile;
  authBox.classList.add("hidden");
  gameBox.classList.remove("hidden");
  whoami.textContent = `${profile.name} (${profile.email})`;
  renderStats(profile);
  renderAvatar(profile);
  setGameMsg("");
  setAvatarMsg("");
}

function renderStats(profile) {
  pointsEl.textContent = String(profile.points ?? 0);
  streakEl.textContent = `${profile.current_streak ?? 0} 🔥`;
  bestStreakEl.textContent = `Best: ${profile.best_streak ?? 0}`;
}

function renderAvatar(profile) {
  const emoji = profile.avatar || "👤";
  const url = profile.avatar_url || "";

  avatarChip.innerHTML = "";
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "avatar";
    img.className = "w-full h-full object-cover";
    avatarChip.appendChild(img);
  } else {
    avatarChip.textContent = emoji;
  }

  if (url) {
    avatarPreview.src = url;
    avatarPreview.classList.remove("hidden");
    avatarFallback.classList.add("hidden");
  } else {
    avatarPreview.classList.add("hidden");
    avatarFallback.classList.remove("hidden");
    avatarFallback.textContent = emoji;
  }
}

// Square crop + compress to jpg
async function fileToSquareJpegBlob(file, size = 512, quality = 0.9) {
  const img = new Image();
  const url = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = url;
  });

  const s = Math.min(img.width, img.height);
  const sx = Math.floor((img.width - s) / 2);
  const sy = Math.floor((img.height - s) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);

  URL.revokeObjectURL(url);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Could not process image.");
  return blob;
}

async function ensureProfile(user, fallbackName, fallbackEmoji) {
  const { data: existing, error: selErr } = await supabaseClient
    .from("players")
    .select("user_id,email,name,avatar,avatar_url,points,current_streak,best_streak,last_checkin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: fallbackName || "Player",
    avatar: fallbackEmoji || "👤",
    avatar_url: null,
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

// AUTH
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

// Avatar upload
btnUploadAvatar.addEventListener("click", async () => {
  setAvatarMsg("");

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const file = avatarFile?.files?.[0];
  if (!file) return setAvatarMsg("Choose a photo first.");
  if (!file.type.startsWith("image/")) return setAvatarMsg("Please upload an image file.");
  if (file.size > 5 * 1024 * 1024) return setAvatarMsg("That file is too large (max 5MB).");

  btnUploadAvatar.disabled = true;
  const old = btnUploadAvatar.textContent;
  btnUploadAvatar.textContent = "Uploading...";

  try {
    const blob = await fileToSquareJpegBlob(file, 512, 0.9);
    const path = `${user.id}/avatar.jpg`;

    const { error: upErr } = await supabaseClient.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

    if (upErr) throw upErr;

    const { data: pub } = supabaseClient.storage.from("avatars").getPublicUrl(path);
    const publicUrl = (pub?.publicUrl || "") + `?t=${Date.now()}`;

    const { data: updated, error: profErr } = await supabaseClient
      .from("players")
      .update({ avatar_url: publicUrl })
      .eq("user_id", user.id)
      .select("user_id,email,name,avatar,avatar_url,points,current_streak,best_streak,last_checkin")
      .single();

    if (profErr) throw profErr;

    showGame(updated);
    setAvatarMsg("Saved ✅");
  } catch (e) {
    setAvatarMsg(`Upload error: ${e?.message || e}`);
  } finally {
    btnUploadAvatar.disabled = false;
    btnUploadAvatar.textContent = old;
  }
});

// Basic today UI (no DB here yet — we’ll merge back in after avatar works)
function showAlreadyLogged(habitLabel) {
  alreadyText.textContent = `You already logged "${habitLabel}" today!`;
  alreadyModal.classList.remove("hidden");
}
btnAlreadyClose.addEventListener("click", () => alreadyModal.classList.add("hidden"));

// Mini-game modal behavior (UI only for now)
btnMinigame.addEventListener("click", () => {
  minigameModalMsg.textContent = "";
  minigameInput.value = "";
  const today = toYMD(new Date());
  const idx = Math.abs(today.split("-").join("").split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % WORD_BANK.length;
  const word = WORD_BANK[idx];
  scrambleText.textContent = word.toUpperCase().split("").sort(()=>Math.random()-0.5).join("");
  minigameModal.classList.remove("hidden");
});
btnMinigameCancel.addEventListener("click", () => minigameModal.classList.add("hidden"));
btnMinigameSubmit.addEventListener("click", () => {
  minigameModalMsg.textContent = "Mini-game DB wiring comes next ✅";
});

// Init
(async function init() {
  const { data } = await supabaseClient.auth.getSession();
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
  } catch (e) {
    showAuth();
    setMsg(`Session error: ${e?.message || e}`);
  }
})();
