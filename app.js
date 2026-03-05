(() => {
  // =========================
  // Supabase Config (yours)
  // =========================
  const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

  if (!window.supabase) {
    throw new Error("Supabase library not loaded");
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // =========================
  // Helpers
  // =========================
  const $ = (id) => document.getElementById(id);

  function toast(msg, ok = true) {
    const t = $("toast");
    const inner = $("toast-inner");
    inner.className =
      "bg-slate-900 border rounded-2xl px-4 py-3 shadow-xl " +
      (ok ? "border-emerald-500/40" : "border-red-500/40");
    inner.textContent = msg;
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 3200);
  }

  function setAuthMsg(msg) {
    $("auth-msg").textContent = msg || "";
  }
  function setModeMsg(msg) {
    $("mode-msg").textContent = msg || "";
  }
  function setLeagueMsg(msg) {
    const el = $("league-msg");
    if (el) el.textContent = msg || "";
  }

  function showAuth() {
    $("auth-box").classList.remove("hidden");
    $("app-shell").classList.add("hidden");
  }
  function showApp() {
    $("auth-box").classList.add("hidden");
    $("app-shell").classList.remove("hidden");
  }

  function showModeModal(on) {
    $("mode-modal").classList.toggle("hidden", !on);
  }
  function showPlayerModal(on) {
    $("player-modal").classList.toggle("hidden", !on);
  }

  function todayISODate() {
    // local date (YYYY-MM-DD)
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function startEndOfTodayUTC() {
    // We query via created_at range to avoid relying on day_key/checkin_date columns.
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  // =========================
  // Habits + Points
  // =========================
  const HABITS = {
    water: { points: 5, name: "Water" },
    protein: { points: 8, name: "Protein" },
    steps_5k: { points: 6, name: "Steps 5K–9.9K", group: "steps" },
    steps_10k: { points: 10, name: "Steps 10K+", group: "steps" },
    workout: { points: 12, name: "Workout" },
    reading: { points: 9, name: "Reading" },
    sleep: { points: 11, name: "Sleep" },
    no_sugar: { points: 7, name: "No Added Sugar" },
    no_coke: { points: 5, name: "No Coke" },
  };

  const BTN_TO_HABIT = {
    "btn-log-water": "water",
    "btn-log-protein": "protein",
    "btn-log-steps-5k": "steps_5k",
    "btn-log-steps-10k": "steps_10k",
    "btn-log-workout": "workout",
    "btn-log-reading": "reading",
    "btn-log-sleep": "sleep",
    "btn-log-nosugar": "no_sugar",
    "btn-log-nocoke": "no_coke",
  };

  // =========================
  // Tier Colors
  // =========================
  function getTier(points) {
    const p = Number(points || 0);
    if (p >= 1900) return { name: "Champion", border: "conic-gradient(from 180deg, #f87171, #fb923c, #facc15, #4ade80, #60a5fa, #a78bfa, #f87171)" };
    if (p >= 1500) return { name: "MVP", border: "#a78bfa" };
    if (p >= 750) return { name: "Pro", border: "#fbbf24" };
    if (p >= 450) return { name: "Elite", border: "#94a3b8" };
    return { name: "Rookie", border: "#b45309" }; // bronze-ish
  }

  function applyTierOutline(cardEl, points) {
    const tier = getTier(points);
    if (!cardEl) return;

    // fancy gradient for champion
    if (tier.name === "Champion") {
      cardEl.style.border = "2px solid transparent";
      cardEl.style.backgroundImage =
        `linear-gradient(#0f172a, #0f172a), ${tier.border}`;
      cardEl.style.backgroundOrigin = "border-box";
      cardEl.style.backgroundClip = "padding-box, border-box";
    } else {
      cardEl.style.backgroundImage = "";
      cardEl.style.border = `2px solid ${tier.border}`;
    }
  }

  // =========================
  // App state
  // =========================
  let me = null;                 // auth user
  let myProfile = null;          // players row
  let myLeagues = [];            // list of leagues user is in
  let activeLeagueId = null;     // selected league
  let todayLoggedSet = new Set();// habit keys logged today

  // =========================
  // Profile / players
  // =========================
  async function ensureProfile(user, fallbackName) {
    const { data: existing, error: selErr } = await sb
      .from("players")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (selErr) throw selErr;
    if (existing) return existing;

    const toInsert = {
      user_id: user.id,
      email: user.email,
      name: fallbackName || "Player",
      streak: 0,
      total_points: 0,
      last_tracked: null, // keep compatible with your older streak logic
      avatar_url: null,
    };

    const { data: inserted, error: insErr } = await sb
      .from("players")
      .insert(toInsert)
      .select()
      .single();

    if (insErr) throw insErr;
    return inserted;
  }

  async function refreshProfileUI() {
    // refresh myProfile from DB (so UI is always current)
    const { data, error } = await sb
      .from("players")
      .select("*")
      .eq("user_id", me.id)
      .single();

    if (error) throw error;
    myProfile = data;

    $("whoami").textContent = `${myProfile.name} (${myProfile.email})`;

    // avatar
    $("avatar-img").src = myProfile.avatar_url || "https://placehold.co/200x200/png?text=%F0%9F%91%A4";

    $("streak-num").textContent = String(myProfile.streak || 0);
    $("points-num").textContent = String(myProfile.total_points || 0);

    // achievements count (global)
    try {
      const { count } = await sb
        .from("player_achievements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", me.id);
      $("ach-num").textContent = String(count || 0);
    } catch (e) {
      // table may not exist yet; keep UI stable
      $("ach-num").textContent = "0";
    }

    // active league badge
    if (activeLeagueId) {
      const lg = myLeagues.find((x) => x.id === activeLeagueId);
      $("active-league-badge").textContent = lg ? `Selected league: ${lg.name}` : "Selected league: —";
    } else {
      $("active-league-badge").textContent = "No league selected";
    }

    await refreshLeaguePointsAndTier();
  }

  async function refreshLeaguePointsAndTier() {
    if (!activeLeagueId) {
      $("league-points-num").textContent = "—";
      $("tier-name").textContent = "—";
      $("tier-subtext").textContent = "Join/select a league to see tier.";
      applyTierOutline($("profile-card"), 0);
      return;
    }

    // Use RPC that you created earlier
    const { data, error } = await sb.rpc("get_my_league_points_v2", { p_league_id: activeLeagueId });

    if (error) {
      $("league-points-num").textContent = "—";
      $("tier-name").textContent = "—";
      $("tier-subtext").textContent = "Could not load league points.";
      return;
    }

    const leaguePoints = Array.isArray(data) ? (data[0]?.league_points ?? 0) : (data?.league_points ?? 0);
    $("league-points-num").textContent = String(leaguePoints);

    const tier = getTier(leaguePoints);
    $("tier-name").textContent = tier.name;
    $("tier-subtext").textContent = `Based on ${leaguePoints} league points.`;

    applyTierOutline($("profile-card"), leaguePoints);
  }

  // =========================
  // Avatar upload (Storage)
  // =========================
  async function uploadAvatar(file) {
    if (!file) return;

    // simple square crop using canvas
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.src = blobUrl;

    await new Promise((res, rej) => {
      img.onload = () => res();
      img.onerror = (e) => rej(e);
    });

    const size = Math.min(img.width, img.height);
    const sx = Math.floor((img.width - size) / 2);
    const sy = Math.floor((img.height - size) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    URL.revokeObjectURL(blobUrl);

    const path = `${me.id}/${Date.now()}.jpg`;
    const { error: upErr } = await sb.storage.from("avatars").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = pub.publicUrl;

    const { error: updErr } = await sb.from("players").update({ avatar_url: avatarUrl }).eq("user_id", me.id);
    if (updErr) throw updErr;

    toast("Profile photo updated ✅");
    await refreshProfileUI();
  }

  // =========================
  // Habit logging (robust insert + locks)
  // =========================
  async function fetchTodayLoggedHabits() {
    todayLoggedSet.clear();
    const { start, end } = startEndOfTodayUTC();

    const { data, error } = await sb
      .from("habit_logs")
      .select("habit_key, created_at")
      .eq("user_id", me.id)
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) {
      console.warn("fetchTodayLoggedHabits error", error);
      return;
    }

    (data || []).forEach((row) => {
      if (row.habit_key) todayLoggedSet.add(row.habit_key);
    });
  }

  function disableHabitButton(btnId, label) {
    const b = $(btnId);
    if (!b) return;
    b.disabled = true;
    b.classList.add("opacity-40", "cursor-not-allowed");
    b.textContent = label || b.textContent;
  }

  function enableHabitButton(btnId, label) {
    const b = $(btnId);
    if (!b) return;
    b.disabled = false;
    b.classList.remove("opacity-40", "cursor-not-allowed");
    if (label) b.textContent = label;
  }

  function syncHabitButtonLocks() {
    // Normal habits
    for (const [btnId, habitKey] of Object.entries(BTN_TO_HABIT)) {
      const habit = HABITS[habitKey];
      const baseLabel =
        btnId === "btn-log-steps-5k" ? `Log Steps 5K–9.9K (+${habit.points})` :
        btnId === "btn-log-steps-10k" ? `Log Steps 10K+ (+${habit.points})` :
        `Log ${habit.name} (+${habit.points})`;

      // Steps group: if any steps habit logged today -> disable both
      if (habit.group === "steps") {
        const stepsDone = todayLoggedSet.has("steps_5k") || todayLoggedSet.has("steps_10k");
        if (stepsDone) disableHabitButton(btnId, "Logged ✅");
        else enableHabitButton(btnId, baseLabel);
        continue;
      }

      if (todayLoggedSet.has(habitKey)) disableHabitButton(btnId, "Logged ✅");
      else enableHabitButton(btnId, baseLabel);
    }
  }

  async function updateStreakAndPoints(pointsEarned) {
    // Reads from players.last_tracked (timestamp) + players.streak
    // Rule: if first habit today => update streak (today keeps, yesterday increments, else reset to 1)
    const { data, error } = await sb
      .from("players")
      .select("streak,last_tracked,total_points")
      .eq("user_id", me.id)
      .single();

    if (error) throw error;

    const prevStreak = Number(data.streak || 0);
    const lastTracked = data.last_tracked ? new Date(data.last_tracked) : null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    let newStreak = prevStreak;
    if (!lastTracked) {
      newStreak = 1;
    } else {
      const lastDay = new Date(lastTracked.getFullYear(), lastTracked.getMonth(), lastTracked.getDate());
      if (lastDay.getTime() === today.getTime()) {
        // already tracked today; streak unchanged
      } else if (lastDay.getTime() === yesterday.getTime()) {
        newStreak = prevStreak + 1;
      } else {
        newStreak = 1;
      }
    }

    const newTotal = Number(data.total_points || 0) + Number(pointsEarned || 0);

    const { error: updErr } = await sb
      .from("players")
      .update({ streak: newStreak, last_tracked: now.toISOString(), total_points: newTotal })
      .eq("user_id", me.id);

    if (updErr) throw updErr;
  }

  async function insertHabitLogRobust(habitKey, points) {
    // Try insert with different optional columns depending on your table shape.
    const base = {
      user_id: me.id,
      habit_key: habitKey,
      points: points,
    };

    // try with checkin_date (common in your project)
    {
      const payload = { ...base, checkin_date: todayISODate() };
      const { error } = await sb.from("habit_logs").insert(payload);
      if (!error) return;
      if (!String(error.message || "").toLowerCase().includes("column") && !String(error.message || "").toLowerCase().includes("does not exist")) {
        // real error (409 duplicate, RLS, etc.)
        throw error;
      }
    }

    // try with day_key
    {
      const payload = { ...base, day_key: todayISODate() };
      const { error } = await sb.from("habit_logs").insert(payload);
      if (!error) return;
      if (!String(error.message || "").toLowerCase().includes("column") && !String(error.message || "").toLowerCase().includes("does not exist")) {
        throw error;
      }
    }

    // fallback: insert only required columns
    {
      const { error } = await sb.from("habit_logs").insert(base);
      if (!error) return;
      throw error;
    }
  }

  async function logHabit(habitKey) {
    const habit = HABITS[habitKey];
    if (!habit) return;

    // local guard (for fast UX)
    if (habit.group === "steps") {
      if (todayLoggedSet.has("steps_5k") || todayLoggedSet.has("steps_10k")) {
        toast("You already logged your steps today ✅", false);
        return;
      }
    } else {
      if (todayLoggedSet.has(habitKey)) {
        toast(`You already logged ${habit.name} today ✅`, false);
        return;
      }
    }

    try {
      await insertHabitLogRobust(habitKey, habit.points);

      // update streak + global points
      await updateStreakAndPoints(habit.points);

      // refresh locks + UI
      await fetchTodayLoggedHabits();
      syncHabitButtonLocks();
      await refreshProfileUI();

      toast(`Logged ${habit.name} (+${habit.points}) ✅`);
    } catch (e) {
      const msg = e?.message || String(e);
      // duplicate unique constraint → show friendly message
      if (String(msg).includes("duplicate") || String(msg).includes("409")) {
        toast(`You already logged that habit today ✅`, false);
      } else {
        toast(`Error logging habit: ${msg}`, false);
      }
      console.error(e);
    }
  }

  async function refreshTodayLocks() {
    await fetchTodayLoggedHabits();
    syncHabitButtonLocks();
  }

  function wireHabitButtons() {
    for (const [btnId, habitKey] of Object.entries(BTN_TO_HABIT)) {
      const btn = $(btnId);
      if (!btn) continue;
      btn.addEventListener("click", () => logHabit(habitKey));
    }
  }

  // =========================
  // Leagues
  // =========================
  function setActiveLeague(id) {
    activeLeagueId = id || null;
    if (activeLeagueId) localStorage.setItem("hcl_active_league_id", activeLeagueId);
    else localStorage.removeItem("hcl_active_league_id");
  }

  async function loadMyLeagues() {
    // Pull leagues via join
    const { data, error } = await sb
      .from("league_members")
      .select("league_id, role, joined_at, leagues:leagues(id,name,code,owner_id)")
      .eq("user_id", me.id)
      .order("joined_at", { ascending: false });

    if (error) throw error;

    myLeagues = (data || [])
      .map((row) => ({
        id: row.leagues?.id,
        name: row.leagues?.name,
        code: row.leagues?.code,
        owner_id: row.leagues?.owner_id,
        my_role: row.role,
        joined_at: row.joined_at,
      }))
      .filter((x) => x.id);

    // Restore active league if possible
    const saved = localStorage.getItem("hcl_active_league_id");
    if (saved && myLeagues.some((x) => x.id === saved)) {
      setActiveLeague(saved);
    } else {
      setActiveLeague(myLeagues[0]?.id || null);
    }

    renderMyLeaguesList();
    await refreshProfileUI();

    if (activeLeagueId) {
      await openLeagueHub(activeLeagueId);
    } else {
      closeLeagueHub();
    }
  }

  function renderMyLeaguesList() {
    const box = $("my-leagues");
    if (!box) return;

    if (!myLeagues.length) {
      box.innerHTML = `<div class="text-slate-400 text-sm">You haven't created or joined any leagues! Create or join one.</div>`;
      return;
    }

    box.innerHTML = myLeagues
      .map((lg) => {
        const isActive = lg.id === activeLeagueId;
        return `
          <button
            data-league="${lg.id}"
            class="w-full text-left px-4 py-3 rounded-2xl border ${isActive ? "border-amber-400/60 bg-slate-900" : "border-slate-700 bg-slate-900/40 hover:bg-slate-900"}">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="font-extrabold truncate">${lg.name}</div>
                <div class="text-xs text-slate-400">Code: <span class="font-mono">${lg.code || "—"}</span></div>
              </div>
              <div class="text-xs text-slate-400">${isActive ? "Selected" : "Select"}</div>
            </div>
          </button>
        `;
      })
      .join("");

    [...box.querySelectorAll("button[data-league]")].forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-league");
        setActiveLeague(id);
        renderMyLeaguesList();
        await refreshProfileUI();
        await openLeagueHub(id);
      });
    });
  }

  function closeLeagueHub() {
    $("league-detail").classList.add("hidden");
  }

  async function openLeagueHub(leagueId) {
    $("league-detail").classList.remove("hidden");

    const league = myLeagues.find((x) => x.id === leagueId);
    if (!league) return;

    $("league-title").textContent = league.name || "League";
    $("league-code").textContent = league.code || "—";

    // Owner tools visibility
    const isOwner = league.owner_id === me.id;
    $("league-owner-tools").classList.toggle("hidden", !isOwner);

    // If owner, hide "Leave league" button (owner should delete instead)
    $("btn-leave-league").classList.toggle("hidden", isOwner);

    await renderLeagueMembers(leagueId);
    await renderLeagueLeaderboard(leagueId);
    await refreshLeaguePointsAndTier();
  }

  async function renderLeagueLeaderboard(leagueId) {
    const wrap = $("league-leaderboard");
    wrap.innerHTML = `<div class="text-slate-400 text-sm">Loading...</div>`;

    const { data, error } = await sb.rpc("get_league_leaderboard_v2", { p_league_id: leagueId });
    if (error) {
      wrap.innerHTML = `<div class="text-red-300 text-sm">Leaderboard error: ${error.message}</div>`;
      return;
    }

    if (!data?.length) {
      wrap.innerHTML = `<div class="text-slate-400 text-sm">No members yet.</div>`;
      return;
    }

    wrap.innerHTML = data
      .map((row, idx) => {
        const tier = getTier(row.league_points || 0);
        return `
          <button data-user="${row.user_id}" data-role="${row.role || "member"}" data-points="${row.league_points || 0}"
            class="w-full text-left p-4 rounded-2xl border border-slate-700 bg-slate-950/30 hover:bg-slate-900 transition">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="text-slate-400 font-bold w-8">#${idx + 1}</div>
                <img src="${row.avatar_url || "https://placehold.co/64x64/png?text=%F0%9F%91%A4"}"
                  class="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-900" />
                <div class="min-w-0">
                  <div class="font-extrabold truncate">${row.name || "Player"}</div>
                  <div class="text-xs text-slate-400">Tier: ${tier.name} • Streak: ${row.streak || 0} • Role: ${row.role || "member"}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-extrabold text-cyan-300">${row.league_points || 0}</div>
                <div class="text-xs text-slate-400">points</div>
              </div>
            </div>
          </button>
        `;
      })
      .join("");

    [...wrap.querySelectorAll("button[data-user]")].forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-user");
        const role = btn.getAttribute("data-role") || "member";
        await openPlayerProfileModal(userId, role, leagueId);
      });
    });
  }

  async function renderLeagueMembers(leagueId) {
    const wrap = $("league-members");
    wrap.innerHTML = `<div class="text-slate-400 text-sm">Loading...</div>`;

    const { data, error } = await sb
      .from("league_members")
      .select("user_id, role, players:players(name,avatar_url,email,streak)")
      .eq("league_id", leagueId)
      .order("joined_at", { ascending: true });

    if (error) {
      wrap.innerHTML = `<div class="text-red-300 text-sm">Members error: ${error.message}</div>`;
      return;
    }

    if (!data?.length) {
      wrap.innerHTML = `<div class="text-slate-400 text-sm">No members.</div>`;
      return;
    }

    wrap.innerHTML = data
      .map((m) => {
        const p = m.players || {};
        return `
          <button data-user="${m.user_id}" data-role="${m.role || "member"}"
            class="w-full text-left px-3 py-2 rounded-xl bg-slate-950/30 border border-slate-700 hover:bg-slate-900">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <img src="${p.avatar_url || "https://placehold.co/64x64/png?text=%F0%9F%91%A4"}"
                  class="w-9 h-9 rounded-xl object-cover border border-slate-700 bg-slate-900" />
                <div class="min-w-0">
                  <div class="font-bold truncate">${p.name || "Player"}</div>
                  <div class="text-xs text-slate-400 truncate">${m.role || "member"}</div>
                </div>
              </div>
              <div class="text-xs text-slate-400">View</div>
            </div>
          </button>
        `;
      })
      .join("");

    [...wrap.querySelectorAll("button[data-user]")].forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-user");
        const role = btn.getAttribute("data-role") || "member";
        await openPlayerProfileModal(userId, role, leagueId);
      });
    });
  }

  async function openPlayerProfileModal(userId, role, leagueId) {
    // Fetch profile
    const { data: p, error: pErr } = await sb
      .from("players")
      .select("user_id,name,email,avatar_url,streak")
      .eq("user_id", userId)
      .single();

    if (pErr) {
      toast(`Profile error: ${pErr.message}`, false);
      return;
    }

    // League points via leaderboard RPC (fast + consistent)
    let leaguePoints = 0;
    try {
      const { data: lb } = await sb.rpc("get_league_leaderboard_v2", { p_league_id: leagueId });
      const row = (lb || []).find((x) => x.user_id === userId);
      leaguePoints = row?.league_points || 0;
    } catch (_) {}

    // Achievements count (global)
    let achCount = 0;
    try {
      const { count } = await sb
        .from("player_achievements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      achCount = count || 0;
    } catch (_) {}

    $("pm-avatar").src = p.avatar_url || "https://placehold.co/200x200/png?text=%F0%9F%91%A4";
    $("pm-name").textContent = p.name || "Player";
    $("pm-email").textContent = p.email || "";
    $("pm-role").textContent = role || "member";
    $("pm-streak").textContent = String(p.streak || 0);
    $("pm-ach").textContent = String(achCount);
    $("pm-league-points").textContent = String(leaguePoints);

    const tier = getTier(leaguePoints);
    $("pm-tier").textContent = `Tier: ${tier.name}`;

    applyTierOutline($("player-modal-card"), leaguePoints);

    showPlayerModal(true);
  }

  async function createLeague(name) {
    // Prefer RPC create_league if it exists (and you already got it working)
    const { data, error } = await sb.rpc("create_league", { p_name: name, p_is_private: true });

    if (error) {
      // fallback: some setups use (name,is_private) params
      const r2 = await sb.rpc("create_league", { name, is_private: true });
      if (r2.error) throw r2.error;
      return r2.data;
    }
    return data;
  }

  async function joinLeagueByCode(code) {
    // Prefer RPC if you have it
    const r1 = await sb.rpc("join_league_by_code", { p_code: code });
    if (!r1.error) return r1.data;

    // fallback alt param name
    const r2 = await sb.rpc("join_league_by_code", { code });
    if (!r2.error) return r2.data;

    throw r1.error;
  }

  async function leaveLeague(leagueId) {
    const { error } = await sb
      .from("league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", me.id);

    if (error) throw error;

    // If they left the active league, select another
    if (activeLeagueId === leagueId) {
      setActiveLeague(null);
    }

    toast("Left league ✅");
    await loadMyLeagues();
  }

  // =========================
  // Invite link auto-join
  // =========================
  async function tryAutoJoinFromURL() {
    const url = new URL(window.location.href);
    const joinCode = (url.searchParams.get("join") || "").trim();

    if (!joinCode) return;

    // remove join param from URL (clean)
    url.searchParams.delete("join");
    window.history.replaceState({}, "", url.toString());

    // attempt join
    try {
      await joinLeagueByCode(joinCode);
      toast("Joined league ✅");
      await loadMyLeagues();
    } catch (e) {
      toast(`Join link error: ${e?.message || e}`, false);
    }
  }

  // =========================
  // Owner tools
  // =========================
  async function updateLeagueName(leagueId, newName) {
    const { error } = await sb
      .from("leagues")
      .update({ name: newName })
      .eq("id", leagueId);

    if (error) throw error;

    toast("League name updated ✅");
    await loadMyLeagues();
    await openLeagueHub(leagueId);
  }

  async function deleteLeague(leagueId) {
    // Owner only via RLS
    const { error } = await sb.from("leagues").delete().eq("id", leagueId);
    if (error) throw error;

    toast("League deleted ✅");
    setActiveLeague(null);
    await loadMyLeagues();
    closeLeagueHub();
  }

  // =========================
  // Wiring UI
  // =========================
  function wireUI() {
    // Auth
    $("btn-signup").addEventListener("click", async () => {
      setAuthMsg("");
      const email = $("su-email").value.trim().toLowerCase();
      const password = $("su-pass").value;
      const name = $("su-name").value.trim();

      if (!email || !password || !name) return setAuthMsg("Please enter email, password, and display name.");

      const redirectTo = window.location.origin + window.location.pathname;

      const { error } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { name },
        },
      });

      if (error) return setAuthMsg(`Signup error: ${error.message}`);
      setAuthMsg("Signup successful! Check your email to verify, then log in.");
    });

    $("btn-login").addEventListener("click", async () => {
      setAuthMsg("");
      const email = $("li-email").value.trim().toLowerCase();
      const password = $("li-pass").value;

      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return setAuthMsg(`Login error: ${error.message}`);

      if (!data?.user) return setAuthMsg("Login failed. Try again.");
      await onAuthed(data.user);
    });

    $("btn-logout").addEventListener("click", async () => {
      await sb.auth.signOut();
      me = null;
      myProfile = null;
      myLeagues = [];
      activeLeagueId = null;
      showAuth();
      setAuthMsg("Logged out.");
    });

    // Modal open/close (ONLY from button)
    $("btn-open-mode").addEventListener("click", () => {
      setModeMsg("");
      showModeModal(true);
    });
    $("btn-close-mode").addEventListener("click", () => showModeModal(false));

    // Create / join
    $("btn-create-league").addEventListener("click", async () => {
      setModeMsg("");
      const name = $("create-league-name").value.trim();
      if (!name) return setModeMsg("Enter a league name.");

      try {
        await createLeague(name);
        toast("League created ✅");
        showModeModal(false);
        await loadMyLeagues();
      } catch (e) {
        setModeMsg(`Create league error: ${e?.message || e}`);
      }
    });

    $("btn-join-league").addEventListener("click", async () => {
      setModeMsg("");
      const code = $("join-league-code").value.trim();
      if (!code) return setModeMsg("Enter an invite code.");

      try {
        await joinLeagueByCode(code);
        toast("Joined league ✅");
        showModeModal(false);
        await loadMyLeagues();
      } catch (e) {
        setModeMsg(`Join league error: ${e?.message || e}`);
      }
    });

    // League hub buttons
    $("btn-league-refresh").addEventListener("click", async () => {
      if (!activeLeagueId) return;
      await openLeagueHub(activeLeagueId);
      toast("Refreshed ✅");
    });

    $("btn-copy-code").addEventListener("click", async () => {
      const lg = myLeagues.find((x) => x.id === activeLeagueId);
      if (!lg?.code) return toast("No invite code found", false);

      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("join", lg.code);

      await navigator.clipboard.writeText(url.toString());
      toast("Invite link copied ✅");
    });

    $("btn-leave-league").addEventListener("click", async () => {
      if (!activeLeagueId) return;

      const ok = confirm("Leave this league? You can re-join later with the code.");
      if (!ok) return;

      try {
        await leaveLeague(activeLeagueId);
      } catch (e) {
        toast(`Leave error: ${e?.message || e}`, false);
      }
    });

    // Owner tools
    $("btn-update-league-name").addEventListener("click", async () => {
      if (!activeLeagueId) return;
      const newName = $("league-name-input").value.trim();
      if (!newName) return setLeagueMsg("Enter a new league name.");

      try {
        await updateLeagueName(activeLeagueId, newName);
        $("league-name-input").value = "";
        setLeagueMsg("");
      } catch (e) {
        setLeagueMsg(`Update error: ${e?.message || e}`);
      }
    });

    $("btn-delete-league").addEventListener("click", async () => {
      if (!activeLeagueId) return;

      const ok = confirm("Delete this league permanently? This removes the league for everyone.");
      if (!ok) return;

      try {
        await deleteLeague(activeLeagueId);
      } catch (e) {
        setLeagueMsg(`Delete error: ${e?.message || e}`);
      }
    });

    // Player modal close
    $("btn-close-player").addEventListener("click", () => showPlayerModal(false));
    $("player-modal").addEventListener("click", (e) => {
      if (e.target === $("player-modal")) showPlayerModal(false);
    });

    // Avatar upload
    $("avatar-file").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await uploadAvatar(file);
      } catch (err) {
        toast(`Upload error: ${err?.message || err}`, false);
      } finally {
        e.target.value = "";
      }
    });
  }

  // =========================
  // Auth flow + init
  // =========================
  async function onAuthed(user) {
    me = user;

    // Ensure profile
    const name = user.user_metadata?.name || "Player";
    myProfile = await ensureProfile(user, name);

    showApp();
    wireHabitButtons();

    // IMPORTANT: modal does NOT auto-open
    // (only opens when player clicks Create/Join)

    await refreshTodayLocks();
    await loadMyLeagues();
    await refreshProfileUI();

    // Auto-join invite link if present
    await tryAutoJoinFromURL();
  }

  async function init() {
    wireUI();

    // restore session
    const { data } = await sb.auth.getSession();
    const session = data.session;

    if (!session?.user) {
      showAuth();
      return;
    }

    try {
      await onAuthed(session.user);
    } catch (e) {
      console.error(e);
      showAuth();
      setAuthMsg(`Session error: ${e?.message || e}`);
    }
  }

  init();
})();
