// =====================================================
// Health Challenge League - app.js
// =====================================================

// Your Supabase project URL + anon key
const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

// Prevent "Identifier 'supabase' has already been declared"
(() => {
  if (!window.supabase) {
    throw new Error("Supabase library not loaded. Check index.html script tags.");
  }
})();

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
const $ = (id) => document.getElementById(id);

function todayKeyLocal() {
  // Local day key YYYY-MM-DD
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toast(msg, kind = "info") {
  const box = $("toast");
  const inner = $("toast-inner");
  inner.textContent = msg;

  inner.className =
    "bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 shadow-xl";

  if (kind === "error") {
    inner.className =
      "bg-rose-950 border border-rose-700 rounded-2xl px-4 py-3 shadow-xl";
  }
  if (kind === "success") {
    inner.className =
      "bg-emerald-950 border border-emerald-700 rounded-2xl px-4 py-3 shadow-xl";
  }

  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 2600);
}

function setAuthMsg(t) {
  $("auth-msg").textContent = t || "";
}
function setModeMsg(t) {
  $("mode-msg").textContent = t || "";
}
function setLeagueMsg(t) {
  $("league-msg").textContent = t || "";
}

function leagueTier(points) {
  if (points >= 1900) return { name: "Champion", color: "rainbow" };
  if (points >= 1500) return { name: "MVP", color: "purple" };
  if (points >= 750) return { name: "Pro", color: "gold" };
  if (points >= 450) return { name: "Elite", color: "silver" };
  return { name: "Rookie", color: "bronze" };
}

function tierBorderClass(color) {
  // Tailwind-friendly border colors
  if (color === "bronze") return "border-amber-500";
  if (color === "silver") return "border-slate-300";
  if (color === "gold") return "border-yellow-400";
  if (color === "purple") return "border-fuchsia-500";
  if (color === "rainbow") return "border-pink-400";
  return "border-slate-700";
}

function disableButton(btn, reasonText) {
  btn.disabled = true;
  btn.classList.add("opacity-40", "cursor-not-allowed");
  btn.dataset.lockedReason = reasonText || "You already logged that today.";
}

function enableButton(btn) {
  btn.disabled = false;
  btn.classList.remove("opacity-40", "cursor-not-allowed");
  delete btn.dataset.lockedReason;
}

// -----------------------------------------------------
// UI state
// -----------------------------------------------------
let currentUser = null;
let currentProfile = null;
let activeLeagueId = null;

// Habit config (keys must match your DB habit_keys logic)
const HABITS = [
  { key: "water", btn: "btn-log-water", points: 5, label: "Water" },
  { key: "protein", btn: "btn-log-protein", points: 8, label: "Protein Goal" },
  { key: "steps_5k", btn: "btn-log-steps-5k", points: 6, label: "Steps (5K–9.9K)", group: "steps" },
  { key: "steps_10k", btn: "btn-log-steps-10k", points: 10, label: "Steps (10K+)", group: "steps" },
  { key: "workout", btn: "btn-log-workout", points: 12, label: "Workout" },
  { key: "reading", btn: "btn-log-reading", points: 9, label: "Reading" },
  { key: "sleep", btn: "btn-log-sleep", points: 11, label: "Sleep" },
  { key: "no_sugar", btn: "btn-log-nosugar", points: 7, label: "No Added Sugar" },
  { key: "no_coke", btn: "btn-log-nocoke", points: 5, label: "No Coke" },
];

// -----------------------------------------------------
// Auth + Profile
// -----------------------------------------------------
async function ensurePlayerProfile(user, displayName) {
  const { data: existing, error: e1 } = await sb
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (e1) throw e1;
  if (existing) return existing;

  const payload = {
    user_id: user.id,
    email: user.email,
    name: displayName || "Player",
  };

  const { data: inserted, error: e2 } = await sb
    .from("players")
    .insert(payload)
    .select()
    .single();

  if (e2) throw e2;
  return inserted;
}

async function fetchAchievementCount(userId) {
  const { count, error } = await sb
    .from("user_achievements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count || 0;
}

async function refreshProfileUI() {
  if (!currentProfile) return;

  // Points / streak may be computed via DB columns you added earlier
  const { data: p, error } = await sb
    .from("players")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  if (!error && p) currentProfile = p;

  const points = Number(currentProfile.points || 0);
  const streak = Number(currentProfile.streak || 0);

  $("whoami").textContent = `${currentProfile.name} (${currentProfile.email})`;
  $("points-num").textContent = points;
  $("streak-num").textContent = streak;

  const achCount = await fetchAchievementCount(currentUser.id);
  $("ach-num").textContent = achCount;

  const tier = leagueTier(points);
  $("tier-name").textContent = tier.name;

  // Profile card border by tier
  const card = $("profile-card");
  card.classList.remove(
    "border-amber-500",
    "border-slate-300",
    "border-yellow-400",
    "border-fuchsia-500",
    "border-pink-400"
  );
  card.classList.add(tierBorderClass(tier.color));

  // avatar
  $("avatar-img").src = currentProfile.avatar_url || "";
  if (!currentProfile.avatar_url) {
    // tiny fallback
    $("avatar-img").src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23111827'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%239CA3AF' font-size='20'%3EAvatar%3C/text%3E%3C/svg%3E";
  }
}

function showApp() {
  $("auth-box").classList.add("hidden");
  $("app-shell").classList.remove("hidden");
}

function showAuth() {
  $("app-shell").classList.add("hidden");
  $("auth-box").classList.remove("hidden");
}

async function initAfterLogin() {
  showApp();
  await refreshProfileUI();
  await loadMyLeagues();
  await refreshTodayLocks();
  // mode modal is available from button
}

// -----------------------------------------------------
// Daily locks (disable buttons already logged today)
// -----------------------------------------------------
async function getTodayLoggedKeys() {
  const dayKey = todayKeyLocal();

  // Prefer habit_logs table (per your schema)
  const { data, error } = await sb
    .from("habit_logs")
    .select("habit_key")
    .eq("user_id", currentUser.id)
    .eq("day_key", dayKey);

  if (error) return [];
  return (data || []).map((r) => r.habit_key);
}

async function refreshTodayLocks() {
  const keys = await getTodayLoggedKeys();

  // reset all
  HABITS.forEach((h) => enableButton($(h.btn)));

  // disable logged
  for (const h of HABITS) {
    if (keys.includes(h.key)) {
      disableButton($(h.btn), `You already logged ${h.label} today.`);
    }
  }

  // steps group: if either steps logged, lock both
  const stepsLogged =
    keys.includes("steps_5k") || keys.includes("steps_10k");
  if (stepsLogged) {
    disableButton($("btn-log-steps-5k"), "You already logged Steps today.");
    disableButton($("btn-log-steps-10k"), "You already logged Steps today.");
  }
}

// -----------------------------------------------------
// Habit logging
// -----------------------------------------------------
async function logHabit(habitKey, points, label) {
  if (!currentUser) return;

  const dayKey = todayKeyLocal();

  // If button already locked, show toast
  const habit = HABITS.find((h) => h.key === habitKey);
  if (habit) {
    const btn = $(habit.btn);
    if (btn.disabled) {
      toast(btn.dataset.lockedReason || `You already logged ${label} today.`);
      return;
    }
  }

  // Prevent steps double logging (choose one)
  if (habitKey === "steps_5k" || habitKey === "steps_10k") {
    const keys = await getTodayLoggedKeys();
    if (keys.includes("steps_5k") || keys.includes("steps_10k")) {
      toast("You already logged Steps today.");
      await refreshTodayLocks();
      return;
    }
  }

  // Insert habit log (unique constraint should prevent duplicates)
  const { error } = await sb.from("habit_logs").insert({
    user_id: currentUser.id,
    habit_key: habitKey,
    day_key: dayKey,
    points: points,
  });

  if (error) {
    // 409 conflicts show as duplicate insert; treat as "already logged"
    if (String(error.code) === "23505" || String(error.status) === "409") {
      toast(`You already logged ${label} today.`);
      await refreshTodayLocks();
      return;
    }
    toast(`Error logging habit: ${error.message}`, "error");
    return;
  }

  toast(`✅ Logged ${label} (+${points})`, "success");

  // Refresh profile (points/streak updates)
  await refreshProfileUI();
  await refreshTodayLocks();

  // If in a league, refresh league board too
  if (activeLeagueId) {
    await renderLeague(activeLeagueId);
  }
}

// Hook up habit buttons
function wireHabitButtons() {
  HABITS.forEach((h) => {
    const btn = $(h.btn);
    btn.addEventListener("click", () => logHabit(h.key, h.points, h.label));
    btn.addEventListener("click", () => {
      if (btn.disabled) toast(btn.dataset.lockedReason || "Already logged today.");
    });
  });
}

// -----------------------------------------------------
// Avatar upload (Supabase Storage bucket: avatars)
// -----------------------------------------------------
async function uploadAvatar(file) {
  if (!file || !currentUser) return;

  // Save as avatars/<user_id>/avatar.jpg
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${currentUser.id}/avatar.${ext}`;

  const { error: upErr } = await sb.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (upErr) {
    toast(`Avatar upload error: ${upErr.message}`, "error");
    return;
  }

  const { data: pub } = sb.storage.from("avatars").getPublicUrl(path);
  const url = pub?.publicUrl;

  const { error: updErr } = await sb
    .from("players")
    .update({ avatar_url: url })
    .eq("user_id", currentUser.id);

  if (updErr) {
    toast(`Avatar save error: ${updErr.message}`, "error");
    return;
  }

  currentProfile.avatar_url = url;
  $("avatar-img").src = url;
  toast("✅ Profile photo updated", "success");

  if (activeLeagueId) await renderLeague(activeLeagueId);
}

// -----------------------------------------------------
// Leagues (private)
// -----------------------------------------------------
function showModeModal(show) {
  if (show) $("mode-modal").classList.remove("hidden");
  else $("mode-modal").classList.add("hidden");
}

function renderMyLeaguesList(leagues) {
  const box = $("my-leagues");
  box.innerHTML = "";

  if (!leagues || leagues.length === 0) {
    box.innerHTML = `
      <div class="text-slate-400 text-sm">
        You haven't created or joined any leagues! Create or join one.
      </div>
    `;
    return;
  }

  leagues.forEach((l) => {
    const div = document.createElement("button");
    div.className =
      "w-full text-left rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 hover:bg-slate-800";
    div.innerHTML = `
      <div class="font-bold">${escapeHtml(l.name)}</div>
      <div class="text-slate-400 text-xs">Invite code: <span class="font-mono">${escapeHtml(l.code || "")}</span></div>
    `;
    div.addEventListener("click", async () => {
      activeLeagueId = l.id;
      await renderLeague(l.id);
      $("league-detail").classList.remove("hidden");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
    box.appendChild(div);
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadMyLeagues() {
  // leagues visible via RLS only if member
  const { data, error } = await sb
    .from("leagues")
    .select("id,name,code,owner_id")
    .order("created_at", { ascending: false });

  if (error) {
    // If policies not ready, show friendly
    $("my-leagues").innerHTML = `<div class="text-slate-400 text-sm">Couldn't load leagues yet.</div>`;
    return;
  }
  renderMyLeaguesList(data);
}

// Create league (uses your RPC if present; else direct insert)
async function createLeague(name) {
  setModeMsg("");
  const leagueName = (name || "").trim();
  if (!leagueName) {
    setModeMsg("Please enter a league name.");
    return;
  }

  // Prefer RPC create_league if you have it
  // It should return: { id, name, code, owner_id }
  const tryRpc = await sb.rpc("create_league", { league_name: leagueName });
  if (!tryRpc.error && tryRpc.data) {
    toast("✅ League created!", "success");
    showModeModal(false);
    await loadMyLeagues();
    activeLeagueId = tryRpc.data.id;
    await renderLeague(activeLeagueId);
    $("league-detail").classList.remove("hidden");
    return;
  }

  // Fallback: direct insert (requires RLS insert policy with check owner_id=auth.uid())
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const { data: inserted, error: insErr } = await sb
    .from("leagues")
    .insert({ name: leagueName, code, owner_id: currentUser.id })
    .select()
    .single();

  if (insErr) {
    setModeMsg(`Create league error: ${insErr.message}`);
    return;
  }

  // Add self as member
  await sb.from("league_members").insert({
    league_id: inserted.id,
    user_id: currentUser.id,
    role: "owner",
  });

  toast("✅ League created!", "success");
  showModeModal(false);
  await loadMyLeagues();
  activeLeagueId = inserted.id;
  await renderLeague(activeLeagueId);
  $("league-detail").classList.remove("hidden");
}

async function joinLeague(code) {
  setModeMsg("");
  const c = (code || "").trim().toUpperCase();
  if (!c) {
    setModeMsg("Please enter an invite code.");
    return;
  }

  // Prefer RPC join_league if exists
  const tryRpc = await sb.rpc("join_league", { invite_code: c });
  if (!tryRpc.error) {
    toast("✅ Joined league!", "success");
    showModeModal(false);
    await loadMyLeagues();
    // Optionally open the league if returned
    if (tryRpc.data?.league_id) {
      activeLeagueId = tryRpc.data.league_id;
      await renderLeague(activeLeagueId);
      $("league-detail").classList.remove("hidden");
    }
    return;
  }

  // Fallback: manual join
  const { data: league, error: findErr } = await sb
    .from("leagues")
    .select("id")
    .eq("code", c)
    .maybeSingle();

  if (findErr || !league) {
    setModeMsg("Could not find a league with that code.");
    return;
  }

  const { error: memErr } = await sb.from("league_members").insert({
    league_id: league.id,
    user_id: currentUser.id,
    role: "member",
  });

  if (memErr) {
    setModeMsg(`Join error: ${memErr.message}`);
    return;
  }

  toast("✅ Joined league!", "success");
  showModeModal(false);
  await loadMyLeagues();
  activeLeagueId = league.id;
  await renderLeague(activeLeagueId);
  $("league-detail").classList.remove("hidden");
}

async function renderLeague(leagueId) {
  setLeagueMsg("");

  // Load league
  const { data: league, error: lgErr } = await sb
    .from("leagues")
    .select("id,name,code,owner_id")
    .eq("id", leagueId)
    .single();

  if (lgErr) {
    toast(`League error: ${lgErr.message}`, "error");
    return;
  }

  $("league-title").textContent = league.name;
  $("league-code").textContent = league.code || "";

  // Owner tools visible only if owner
  if (league.owner_id === currentUser.id) {
    $("league-owner-tools").classList.remove("hidden");
  } else {
    $("league-owner-tools").classList.add("hidden");
  }

  // Members list (via join to players)
  const { data: mem, error: memErr } = await sb
    .from("league_members")
    .select("user_id,role,players(name,avatar_url,points,streak)")
    .eq("league_id", leagueId);

  if (memErr) {
    toast(`Members error: ${memErr.message}`, "error");
    return;
  }

  // Render members
  const membersBox = $("league-members");
  membersBox.innerHTML = "";

  (mem || []).forEach((m) => {
    const p = m.players || {};
    const points = Number(p.points || 0);
    const tier = leagueTier(points);

    const row = document.createElement("div");
    row.className =
      "rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 flex items-center gap-3";

    row.innerHTML = `
      <img src="${escapeHtml(p.avatar_url || "")}" class="w-10 h-10 rounded-xl object-cover bg-slate-900 border border-slate-700"
        onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%23111827 /%3E%3C/svg%3E'"/>
      <div class="min-w-0">
        <div class="font-bold truncate">${escapeHtml(p.name || "Player")}</div>
        <div class="text-xs text-slate-400">${escapeHtml(m.role || "member")} • ${tier.name}</div>
      </div>
    `;
    membersBox.appendChild(row);
  });

  // Leaderboard (top points within this league)
  const leaderboard = (mem || [])
    .map((m) => ({
      user_id: m.user_id,
      role: m.role,
      name: m.players?.name || "Player",
      avatar_url: m.players?.avatar_url || "",
      points: Number(m.players?.points || 0),
      streak: Number(m.players?.streak || 0),
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);

  const lbBox = $("league-leaderboard");
  lbBox.innerHTML = "";

  leaderboard.forEach((p, idx) => {
    const tier = leagueTier(p.points);
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎖️";

    const row = document.createElement("div");
    row.className =
      "rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 flex items-center justify-between gap-4";

    row.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="text-xl">${medal}</div>
        <img src="${escapeHtml(p.avatar_url || "")}" class="w-12 h-12 rounded-2xl object-cover bg-slate-900 border border-slate-700"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%23111827 /%3E%3C/svg%3E'"/>
        <div class="min-w-0">
          <div class="font-extrabold truncate">${escapeHtml(p.name)}</div>
          <div class="text-slate-400 text-sm">● ${tier.name}</div>
        </div>
      </div>

      <div class="text-right">
        <div class="text-3xl font-extrabold text-amber-400">${p.points}</div>
        <div class="text-slate-400 text-sm">points</div>
      </div>
    `;
    lbBox.appendChild(row);
  });

  // Wire rename button
  $("btn-update-league-name").onclick = async () => {
    setLeagueMsg("");
    const newName = ($("league-name-input").value || "").trim();
    if (!newName) {
      setLeagueMsg("Enter a new league name.");
      return;
    }

    const { error } = await sb
      .from("leagues")
      .update({ name: newName })
      .eq("id", leagueId);

    if (error) {
      setLeagueMsg(`Update error: ${error.message}`);
      return;
    }

    toast("✅ League name updated", "success");
    $("league-name-input").value = "";
    await loadMyLeagues();
    await renderLeague(leagueId);
  };

  // Copy code
  $("btn-copy-code").onclick = async () => {
    try {
      await navigator.clipboard.writeText(league.code || "");
      toast("✅ Invite code copied", "success");
    } catch {
      toast("Copy failed — you can manually select the code.", "error");
    }
  };
}

// Delete league (owner only)
$("btn-delete-league").addEventListener("click", async () => {
  if (!activeLeagueId) return;

  const ok = confirm(
    "Are you sure you want to delete this league?\n\nThis will remove the league and all memberships. This cannot be undone."
  );
  if (!ok) return;

  // delete memberships first
  const { error: memErr } = await sb
    .from("league_members")
    .delete()
    .eq("league_id", activeLeagueId);

  if (memErr) {
    toast(`Delete error (members): ${memErr.message}`, "error");
    return;
  }

  // delete league (RLS allows only owner)
  const { error: lgErr } = await sb
    .from("leagues")
    .delete()
    .eq("id", activeLeagueId);

  if (lgErr) {
    toast(`Delete error (league): ${lgErr.message}`, "error");
    return;
  }

  toast("✅ League deleted.", "success");
  $("league-detail").classList.add("hidden");
  activeLeagueId = null;
  await loadMyLeagues();
});

// -----------------------------------------------------
// Auth wiring
// -----------------------------------------------------
$("btn-signup").addEventListener("click", async () => {
  setAuthMsg("");

  const email = $("su-email").value.trim().toLowerCase();
  const password = $("su-pass").value;
  const name = $("su-name").value.trim();

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
      data: { name },
    },
  });

  if (error) {
    setAuthMsg(`Signup error: ${error.message}`);
    return;
  }

  setAuthMsg("Signup successful! Check your email and click the verification link, then come back and log in.");
});

$("btn-login").addEventListener("click", async () => {
  setAuthMsg("");

  const email = $("li-email").value.trim().toLowerCase();
  const password = $("li-pass").value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthMsg(`Login error: ${error.message}`);
    return;
  }

  currentUser = data.user;
  const displayName = currentUser.user_metadata?.name || "Player";
  currentProfile = await ensurePlayerProfile(currentUser, displayName);
  await initAfterLogin();
});

$("btn-logout").addEventListener("click", async () => {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  activeLeagueId = null;
  showAuth();
  toast("Logged out.");
});

// -----------------------------------------------------
// Mode modal wiring
// -----------------------------------------------------
$("btn-open-mode").addEventListener("click", () => {
  setModeMsg("");
  showModeModal(true);
});

$("btn-close-mode").addEventListener("click", () => {
  showModeModal(false);
});

$("btn-mode-solo").addEventListener("click", async () => {
  // Solo = just close modal; no league join
  toast("✅ Solo mode selected", "success");
  showModeModal(false);
  $("league-detail").classList.add("hidden");
  activeLeagueId = null;
});

$("btn-create-league").addEventListener("click", async () => {
  await createLeague($("create-league-name").value);
});

$("btn-join-league").addEventListener("click", async () => {
  await joinLeague($("join-league-code").value);
});

$("btn-league-refresh").addEventListener("click", async () => {
  if (activeLeagueId) await renderLeague(activeLeagueId);
});

// Avatar file input
$("avatar-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await uploadAvatar(file);
  e.target.value = "";
});

// Wire habits
wireHabitButtons();

// -----------------------------------------------------
// Boot: restore session
// -----------------------------------------------------
(async function init() {
  // session restore
  const { data } = await sb.auth.getSession();
  const session = data.session;

  if (!session?.user) {
    showAuth();
    return;
  }

  currentUser = session.user;
  const displayName = currentUser.user_metadata?.name || "Player";
  currentProfile = await ensurePlayerProfile(currentUser, displayName);
  await initAfterLogin();
})();
