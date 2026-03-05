// ===== Supabase Config =====
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

// Guard: Supabase library must exist
if (!window.supabase) {
  throw new Error("Supabase library not loaded");
}

// IMPORTANT: Avoid "Identifier supabase has already been declared"
window.sb = window.sb || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sb = window.sb;

// ===== UI Elements =====
const authBox = document.getElementById("auth-box");
const gameBox = document.getElementById("game-box");
const authMsg = document.getElementById("auth-msg");
const whoami = document.getElementById("whoami");

const btnSignup = document.getElementById("btn-signup");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");

// You should already have these IDs in your updated index.html:
const leaguesBox = document.getElementById("leagues-box");
const leaguesList = document.getElementById("leagues-list");
const btnOpenLeagueModal = document.getElementById("btn-open-league-modal");

const leagueModal = document.getElementById("league-modal");
const btnCloseLeagueModal = document.getElementById("btn-close-league-modal");

const inpLeagueName = document.getElementById("league-name");
const btnCreateLeague = document.getElementById("btn-create-league");

const inpJoinCode = document.getElementById("join-code");
const btnJoinLeague = document.getElementById("btn-join-league");

const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");

// ===== Helpers =====
function setMsg(text) {
  authMsg.textContent = text || "";
}

function showToast(message, ok = true) {
  if (!toast || !toastMsg) return;
  toastMsg.textContent = message;
  toast.className =
    "fixed bottom-4 right-4 px-4 py-3 rounded-xl shadow-lg z-50 " +
    (ok ? "bg-emerald-600" : "bg-red-600");
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
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

function openLeagueModal() {
  if (!leagueModal) return;
  leagueModal.classList.remove("hidden");
}
function closeLeagueModal() {
  if (!leagueModal) return;
  leagueModal.classList.add("hidden");
}

// ===== Profile =====
async function ensureProfile(user, fallbackName, fallbackEmoji) {
  const { data: existing, error: selErr } = await sb
    .from("players")
    .select("user_id,email,name,avatar")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing;

  const profile = {
    user_id: user.id,
    email: user.email,
    name: fallbackName || "Player",
    avatar: fallbackEmoji || "👤",
  };

  const { data: inserted, error: insErr } = await sb
    .from("players")
    .insert(profile)
    .select()
    .single();

  if (insErr) throw insErr;
  return inserted;
}

// ===== Leagues =====
async function fetchMyLeagues() {
  // League memberships for current user
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return [];

  const { data, error } = await sb
    .from("league_members")
    .select("role, league:leagues(id,name,code,is_private,owner_id,created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Normalize
  return (data || []).map((row) => ({
    role: row.role,
    ...row.league,
  }));
}

function renderLeagues(leagues) {
  if (!leaguesList) return;

  if (!leagues || leagues.length === 0) {
    leaguesList.innerHTML = `
      <div class="text-slate-400 text-sm">
        You haven't created or joined any leagues yet. Create one or join with a code!
      </div>
    `;
    return;
  }

  leaguesList.innerHTML = leagues
    .map((l) => {
      const isOwner = l.owner_id ? "yes" : "no";
      return `
        <div class="p-4 rounded-xl bg-slate-900 border border-slate-700 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-bold text-lg truncate">${escapeHtml(l.name)}</div>
            <div class="text-xs text-slate-400 mt-1">
              Invite code: <span class="font-mono text-amber-300">${escapeHtml(l.code || "")}</span>
            </div>
            <div class="text-xs text-slate-500 mt-1">
              Role: <span class="text-slate-300">${escapeHtml(l.role || "member")}</span>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <button class="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
              onclick="copyInviteCode('${escapeAttr(l.code || "")}')">
              Copy code
            </button>
            ${
              l.role === "owner"
                ? `<button class="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm"
                     onclick="deleteLeague('${escapeAttr(l.id)}')">
                     Delete
                   </button>`
                : ``
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll("`", "");
}

window.copyInviteCode = async function copyInviteCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast("Invite code copied!");
  } catch {
    showToast("Could not copy code (browser blocked clipboard).", false);
  }
};

async function createLeague(name) {
  // RPC we just created: create_league(name text, is_private boolean)
  const { data, error } = await sb.rpc("create_league", {
    name: name,
    is_private: true,
  });

  if (error) throw error;
  return data;
}

async function joinLeagueByCode(code) {
  // Expects you already created a join RPC earlier OR you used a table insert approach.
  // We'll try RPC first, then fallback to insert if needed.

  // 1) Try RPC "join_league"
  const { data: rpcData, error: rpcErr } = await sb.rpc("join_league", {
    invite_code: code,
  });

  if (!rpcErr) return rpcData;

  // 2) Fallback (if you don't have join_league RPC)
  // Find league by code then insert membership
  const { data: league, error: leErr } = await sb
    .from("leagues")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (leErr) throw leErr;
  if (!league?.id) throw new Error("Invalid invite code.");

  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) throw new Error("Not logged in.");

  const { error: insErr } = await sb
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id, role: "member" });

  if (insErr) throw insErr;
  return true;
}

window.deleteLeague = async function deleteLeague(leagueId) {
  try {
    if (!confirm("Delete this league? This cannot be undone.")) return;

    // If you later add a delete_league RPC, we can call it here.
    // For now, we attempt direct deletes; RLS must allow owner to delete.
    const { error: mErr } = await sb.from("league_members").delete().eq("league_id", leagueId);
    if (mErr) throw mErr;

    const { error: lErr } = await sb.from("leagues").delete().eq("id", leagueId);
    if (lErr) throw lErr;

    showToast("League deleted.");
    await refreshLeagueUI();
  } catch (e) {
    showToast(`Delete league error: ${e.message || e}`, false);
  }
};

async function refreshLeagueUI() {
  try {
    const leagues = await fetchMyLeagues();
    renderLeagues(leagues);
  } catch (e) {
    showToast(`Leagues error: ${e.message || e}`, false);
  }
}

// ===== Auth actions =====
btnSignup?.addEventListener("click", async () => {
  setMsg("");

  const email = document.getElementById("su-email").value.trim().toLowerCase();
  const password = document.getElementById("su-pass").value;
  const name = document.getElementById("su-name").value.trim();
  const emoji = document.getElementById("su-emoji").value.trim();

  if (!email || !password || !name) {
    setMsg("Please enter email, password, and display name.");
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
    setMsg(`Signup error: ${error.message}`);
    return;
  }

  setMsg("Signup successful! Check your email, verify, then come back and log in.");
});

btnLogin?.addEventListener("click", async () => {
  setMsg("");

  const email = document.getElementById("li-email").value.trim().toLowerCase();
  const password = document.getElementById("li-pass").value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    setMsg(`Login error: ${error.message}`);
    return;
  }

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
    await refreshLeagueUI();
  } catch (e) {
    setMsg(`Profile error: ${e.message || e}`);
  }
});

btnLogout?.addEventListener("click", async () => {
  await sb.auth.signOut();
  showAuth();
  setMsg("Logged out.");
});

// ===== League modal bindings =====
btnOpenLeagueModal?.addEventListener("click", () => openLeagueModal());
btnCloseLeagueModal?.addEventListener("click", () => closeLeagueModal());

btnCreateLeague?.addEventListener("click", async () => {
  try {
    const name = (inpLeagueName?.value || "").trim();
    if (!name) {
      showToast("Enter a league name.", false);
      return;
    }
    await createLeague(name);
    showToast("League created!");
    inpLeagueName.value = "";
    closeLeagueModal();
    await refreshLeagueUI();
  } catch (e) {
    showToast(`Create league error: ${e.message || e}`, false);
  }
});

btnJoinLeague?.addEventListener("click", async () => {
  try {
    const code = (inpJoinCode?.value || "").trim().toUpperCase();
    if (!code) {
      showToast("Enter a join code.", false);
      return;
    }
    await joinLeagueByCode(code);
    showToast("Joined league!");
    inpJoinCode.value = "";
    closeLeagueModal();
    await refreshLeagueUI();
  } catch (e) {
    showToast(`Join league error: ${e.message || e}`, false);
  }
});

// ===== Init (auto session restore) =====
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
    const profile = await ensureProfile(user, name, emoji);
    showGame(profile);
    await refreshLeagueUI();
  } catch (e) {
    showAuth();
    setMsg(`Session error: ${e.message || e}`);
  }
})();
