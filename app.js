(() => {
  // ---- Supabase config ----
  const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

  if (!window.supabase?.createClient) {
    throw new Error("Supabase library not loaded");
  }

  // IMPORTANT: do NOT use `const supabase = ...` globally (causes 'already declared' if reloaded)
  let sb = window.__sb_client;
  if (!sb) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.__sb_client = sb;
  }

  // ---- Helpers ----
  const $ = (id) => document.getElementById(id);
  const toastEl = $("toast");

  function toast(msg, ms = 2600) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastEl.__t);
    toastEl.__t = setTimeout(() => toastEl.classList.add("hidden"), ms);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text ?? "";
  }

  function todayKeyLocal() {
    // Local "day key" in YYYY-MM-DD
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function leagueTier(points) {
    const p = Number(points || 0);
    if (p >= 1900) return { name: "Champion", style: "border-2 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,.35)]" }; // "rainbow" later
    if (p >= 1500) return { name: "MVP", style: "border-2 border-purple-400 shadow-[0_0_18px_rgba(168,85,247,.25)]" };
    if (p >= 750)  return { name: "Pro", style: "border-2 border-yellow-400 shadow-[0_0_18px_rgba(250,204,21,.22)]" };
    if (p >= 450)  return { name: "Elite", style: "border-2 border-slate-300 shadow-[0_0_18px_rgba(203,213,225,.18)]" };
    return { name: "Rookie", style: "border-2 border-amber-700/80 shadow-[0_0_18px_rgba(180,83,9,.20)]" };
  }

  // ---- UI: views ----
  const authBox = $("auth-box");
  const appShell = $("app-shell");
  const authMsg = $("auth-msg");

  const viewDash = $("view-dashboard");
  const viewLeague = $("view-league");
  const viewProfile = $("view-profile");

  function showAuth(msg) {
    appShell.classList.add("hidden");
    authBox.classList.remove("hidden");
    authMsg.textContent = msg || "";
  }

  function showApp() {
    authBox.classList.add("hidden");
    appShell.classList.remove("hidden");
  }

  function goDashboard() {
    viewDash.classList.remove("hidden");
    viewLeague.classList.add("hidden");
    viewProfile.classList.add("hidden");
  }

  function goProfile() {
    viewDash.classList.add("hidden");
    viewLeague.classList.add("hidden");
    viewProfile.classList.remove("hidden");
  }

  function goLeagueView() {
    viewDash.classList.add("hidden");
    viewLeague.classList.remove("hidden");
    viewProfile.classList.add("hidden");
  }

  // ---- State ----
  let currentUser = null;
  let currentProfile = null;
  let selectedLeague = null; // { id, name, code, owner_id, is_private }

  // ---- Ensure player profile row ----
  async function ensurePlayer(user, fallbackName) {
    const { data: existing, error: e1 } = await sb
      .from("players")
      .select("user_id,email,name,avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (e1) throw e1;
    if (existing) return existing;

    const row = {
      user_id: user.id,
      email: user.email,
      name: fallbackName || user.user_metadata?.name || "Player",
      avatar_url: null
    };

    const { data: inserted, error: e2 } = await sb
      .from("players")
      .insert(row)
      .select()
      .single();

    if (e2) throw e2;
    return inserted;
  }

  // ---- Stats / streak / achievements ----
  async function computeStreak(userId) {
    // Pull recent logs, compute distinct days, count consecutive ending today
    const { data, error } = await sb
      .from("habit_logs")
      .select("log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(120);

    if (error) throw error;

    const uniqueDays = [];
    const seen = new Set();
    for (const r of (data || [])) {
      const day = (typeof r.log_date === "string")
        ? r.log_date.slice(0, 10)
        : new Date(r.log_date).toISOString().slice(0, 10);

      if (!seen.has(day)) {
        seen.add(day);
        uniqueDays.push(day);
      }
    }

    if (uniqueDays.length === 0) return 0;

    const today = todayKeyLocal();
    // streak only counts if at least 1 habit logged today
    if (uniqueDays[0] !== today) return 0;

    let streak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      const prev = uniqueDays[i - 1];
      const cur = uniqueDays[i];

      const prevDate = new Date(prev + "T00:00:00");
      const curDate = new Date(cur + "T00:00:00");
      const diffDays = Math.round((prevDate - curDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) streak++;
      else break;
    }
    return streak;
  }

  async function countAchievements(userId) {
    const { count, error } = await sb
      .from("user_achievements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) throw error;
    return count || 0;
  }

  async function countTodayLogs(userId) {
    const today = todayKeyLocal();
    const { count, error } = await sb
      .from("habit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("log_date", today);

    if (error) throw error;
    return count || 0;
  }

  async function loadAchievementList(userId) {
    // show last ~20 earned
    const { data, error } = await sb
      .from("user_achievements")
      .select("earned_at, achievements(code,name,icon,description)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })
      .limit(25);

    if (error) throw error;

    const box = $("ach-list");
    box.innerHTML = "";
    if (!data || data.length === 0) {
      box.innerHTML = `<div class="text-slate-300 text-sm">No achievements yet — start logging habits!</div>`;
      return;
    }

    for (const row of data) {
      const a = row.achievements;
      if (!a) continue;
      const el = document.createElement("div");
      el.className = "bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex items-start gap-3";
      el.innerHTML = `
        <div class="text-2xl">${a.icon || "🏅"}</div>
        <div>
          <div class="font-extrabold">${a.name}</div>
          <div class="text-slate-300 text-sm">${a.description || ""}</div>
        </div>
      `;
      box.appendChild(el);
    }
  }

  async function refreshDashboard() {
    if (!currentUser) return;

    // streak + achievements + today count
    const [streak, ach, today] = await Promise.all([
      computeStreak(currentUser.id),
      countAchievements(currentUser.id),
      countTodayLogs(currentUser.id),
    ]);

    setText("stat-streak", streak);
    setText("stat-ach", ach);
    setText("stat-today", today);

    setText("profile-streak", streak);
    setText("profile-ach", ach);

    await loadAchievementList(currentUser.id);

    // disable buttons already logged today
    await refreshHabitButtonStates();

    // leagues list
    await refreshLeaguesList();
  }

  // ---- Habits ----
  const HABITS = [
    { key: "water", label: "Water", points: 5, btn: "btn-log-water" },
    { key: "protein", label: "Protein", points: 8, btn: "btn-log-protein" },
    { key: "steps_5k", label: "Steps (5K–9.9K)", points: 6, btn: "btn-log-steps-5k", group: "steps" },
    { key: "steps_10k", label: "Steps (10K+)", points: 10, btn: "btn-log-steps-10k", group: "steps" },
    { key: "workout", label: "Workout", points: 12, btn: "btn-log-workout" },
    { key: "reading", label: "Reading", points: 9, btn: "btn-log-reading" },
    { key: "sleep", label: "Sleep", points: 11, btn: "btn-log-sleep" },
    { key: "no_sugar", label: "No Added Sugar", points: 7, btn: "btn-log-nosugar" },
    { key: "no_coke", label: "No Coke", points: 5, btn: "btn-log-nocoke" },
  ];

  function setBtnDisabled(btnEl, disabled) {
    if (!btnEl) return;
    btnEl.disabled = !!disabled;
    if (disabled) {
      btnEl.classList.add("opacity-50");
      btnEl.classList.add("cursor-not-allowed");
      btnEl.classList.remove("hover:brightness-110");
    } else {
      btnEl.classList.remove("opacity-50");
      btnEl.classList.remove("cursor-not-allowed");
    }
  }

  async function refreshHabitButtonStates() {
    if (!currentUser) return;

    const today = todayKeyLocal();

    const { data, error } = await sb
      .from("habit_logs")
      .select("habit_key")
      .eq("user_id", currentUser.id)
      .eq("log_date", today);

    if (error) throw error;

    const logged = new Set((data || []).map(r => r.habit_key));

    // If any steps logged, lock both
    const stepsLogged = logged.has("steps_5k") || logged.has("steps_10k");

    for (const h of HABITS) {
      const btn = $(h.btn);
      const already = logged.has(h.key) || (h.group === "steps" && stepsLogged);
      setBtnDisabled(btn, already);
    }
  }

  async function logHabit(habitKey, label, points) {
    if (!currentUser) return;

    const today = todayKeyLocal();

    // quick check (so we can show clean toast)
    const { data: existing, error: e1 } = await sb
      .from("habit_logs")
      .select("id, habit_key")
      .eq("user_id", currentUser.id)
      .eq("log_date", today)
      .in("habit_key", habitKey.startsWith("steps_") ? ["steps_5k", "steps_10k"] : [habitKey]);

    if (e1) {
      toast("Error checking today’s logs.");
      console.error(e1);
      return;
    }

    if ((existing || []).length > 0) {
      toast(habitKey.startsWith("steps_")
        ? "You already logged Steps today."
        : `You already logged ${label} today.`
      );
      await refreshHabitButtonStates();
      return;
    }

    // Insert log (unique constraint in DB should also protect this)
    const { error: e2 } = await sb
      .from("habit_logs")
      .insert({
        user_id: currentUser.id,
        habit_key: habitKey,
        points: points,
        log_date: today
      });

    if (e2) {
      // 409 conflict often means unique constraint hit
      if (String(e2.message || "").toLowerCase().includes("duplicate") || e2.code === "23505") {
        toast(`You already logged ${label} today.`);
      } else {
        toast("Error logging habit. Check console.");
      }
      console.error(e2);
      await refreshHabitButtonStates();
      return;
    }

    toast(`+${points} points — logged ${label}!`);
    await refreshDashboard();
  }

  function wireHabitButtons() {
    for (const h of HABITS) {
      const btn = $(h.btn);
      if (!btn) continue;

      btn.addEventListener("click", async () => {
        await logHabit(h.key, h.label, h.points);
      });
    }
  }

  // ---- Leagues ----
  const leagueModal = $("league-modal");
  function openLeagueModal() {
    $("create-league-msg").textContent = "";
    $("join-league-msg").textContent = "";
    $("create-league-name").value = "";
    $("join-league-code").value = "";
    leagueModal.classList.remove("hidden");
  }
  function closeLeagueModal() {
    leagueModal.classList.add("hidden");
  }

  async function refreshLeaguesList() {
    if (!currentUser) return;

    // We expect league_members has FK to leagues
    const { data, error } = await sb
      .from("league_members")
      .select("league_id, joined_at, leagues(id,name,code,owner_id,is_private)")
      .eq("user_id", currentUser.id)
      .order("joined_at", { ascending: false });

    if (error) {
      console.error(error);
      $("leagues-empty").classList.remove("hidden");
      $("leagues-list").innerHTML = "";
      return;
    }

    const leagues = (data || [])
      .map(r => ({
        league_id: r.league_id,
        joined_at: r.joined_at,
        league: r.leagues
      }))
      .filter(x => x.league);

    const list = $("leagues-list");
    list.innerHTML = "";

    if (leagues.length === 0) {
      $("leagues-empty").classList.remove("hidden");
      return;
    }
    $("leagues-empty").classList.add("hidden");

    for (const item of leagues) {
      const card = document.createElement("div");
      card.className = "bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4";

      card.innerHTML = `
        <div>
          <div class="font-extrabold text-lg">${item.league.name}</div>
          <div class="text-slate-300 text-xs">Invite code: <span class="font-mono tracking-wider">${item.league.code || "—"}</span></div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-open px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600">Open</button>
        </div>
      `;

      card.querySelector(".btn-open").addEventListener("click", async () => {
        selectedLeague = item.league;
        await loadLeaguePage(selectedLeague);
      });

      list.appendChild(card);
    }
  }

  async function loadLeaguePage(league) {
    if (!league) return;

    setText("league-title", league.name || "League");
    setText("league-sub", league.code ? `Invite code: ${league.code}` : "");
    goLeagueView();

    // show delete button if owner
    const delBtn = $("btn-league-delete");
    if (league.owner_id && currentUser && league.owner_id === currentUser.id) {
      delBtn.classList.remove("hidden");
    } else {
      delBtn.classList.add("hidden");
    }

    await refreshLeagueBoard();
  }

  async function refreshLeagueBoard() {
    if (!selectedLeague) return;

    const board = $("league-board");
    board.innerHTML = `<div class="text-slate-300 text-sm">Loading…</div>`;

    // Preferred: view `league_leaderboard` with columns:
    // league_id, user_id, name, avatar_url, points
    let rows = null;

    const { data, error } = await sb
      .from("league_leaderboard")
      .select("league_id,user_id,name,avatar_url,points")
      .eq("league_id", selectedLeague.id)
      .order("points", { ascending: false })
      .limit(50);

    if (!error) rows = data;

    if (error) {
      console.warn("league_leaderboard not available or blocked by RLS:", error);
      board.innerHTML = `<div class="text-slate-300 text-sm">Leaderboard view not available. (Check Supabase view/RLS.)</div>`;
      return;
    }

    board.innerHTML = "";

    if (!rows || rows.length === 0) {
      board.innerHTML = `<div class="text-slate-300 text-sm">No members yet.</div>`;
      return;
    }

    let rank = 1;
    for (const r of rows) {
      const tier = leagueTier(r.points);
      const card = document.createElement("div");
      card.className = `rounded-2xl p-4 bg-slate-900/40 border border-slate-700 flex items-center justify-between gap-4 ${tier.style}`;

      const avatar = r.avatar_url
        ? `<img src="${r.avatar_url}" class="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-800" />`
        : `<div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">👤</div>`;

      card.innerHTML = `
        <div class="flex items-center gap-4 min-w-0">
          <div class="text-slate-300 w-8 text-center font-extrabold">${rank}</div>
          ${avatar}
          <div class="min-w-0">
            <div class="font-extrabold text-lg truncate">${r.name || "Player"}</div>
            <div class="text-slate-300 text-sm flex items-center gap-2">
              <span>${tier.name}</span>
            </div>
          </div>
        </div>

        <div class="text-right">
          <div class="text-3xl font-extrabold text-amber-300">${Number(r.points || 0)}</div>
          <div class="text-slate-400 text-xs">points</div>
        </div>
      `;

      // click to view profile-lite (future: full profile page)
      card.addEventListener("click", () => {
        toast(`${r.name || "Player"} — ${Number(r.points || 0)} pts in this league`);
      });

      board.appendChild(card);
      rank++;
    }
  }

  async function createLeague() {
    $("create-league-msg").textContent = "";
    const name = $("create-league-name").value.trim();
    if (!name) {
      $("create-league-msg").textContent = "Please enter a league name.";
      return;
    }

    // RPC must exist: create_league(league_name text, is_private boolean)
    const { data, error } = await sb.rpc("create_league", {
      league_name: name,
      is_private: true
    });

    if (error) {
      console.error(error);
      $("create-league-msg").textContent = `Create league error: ${error.message}`;
      return;
    }

    // Expect return { league_id, code } or similar; handle generically
    const code = data?.code || data?.invite_code || data?.join_code || "";
    $("create-league-msg").textContent = code
      ? `League created! Invite code: ${code}`
      : `League created!`;

    toast("League created!");
    await refreshLeaguesList();
  }

  async function joinLeague() {
    $("join-league-msg").textContent = "";
    const code = $("join-league-code").value.trim().toUpperCase();
    if (!code) {
      $("join-league-msg").textContent = "Enter a league code.";
      return;
    }

    // RPC must exist: join_league(join_code text)
    const { data, error } = await sb.rpc("join_league", { join_code: code });

    if (error) {
      console.error(error);
      $("join-league-msg").textContent = `Join error: ${error.message}`;
      return;
    }

    toast("Joined league!");
    await refreshLeaguesList();
  }

  async function deleteLeague() {
    if (!selectedLeague) return;
    if (!confirm(`Delete "${selectedLeague.name}"? This cannot be undone.`)) return;

    // RPC must exist: delete_league(league_id uuid)
    const { error } = await sb.rpc("delete_league", { league_id: selectedLeague.id });

    if (error) {
      console.error(error);
      toast(`Delete error: ${error.message}`);
      return;
    }

    toast("League deleted.");
    selectedLeague = null;
    goDashboard();
    await refreshLeaguesList();
  }

  // ---- Avatar upload (Supabase Storage bucket: avatars) ----
  async function uploadAvatar(file) {
    if (!currentUser) return;

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${currentUser.id}/avatar.${ext}`;

    // We store as PUBLIC bucket (so we can show images easily)
    const { error: upErr } = await sb.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type
    });

    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from("avatars").getPublicUrl(path);
    const url = pub?.publicUrl;

    const { error: e2 } = await sb
      .from("players")
      .update({ avatar_url: url })
      .eq("user_id", currentUser.id);

    if (e2) throw e2;

    return url;
  }

  // ---- Auth wiring ----
  $("btn-signup").addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = $("su-email").value.trim().toLowerCase();
    const password = $("su-pass").value;
    const name = $("su-name").value.trim();

    if (!email || !password || !name) {
      authMsg.textContent = "Please enter email, password, and display name.";
      return;
    }

    const redirectTo = window.location.origin + window.location.pathname;

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { name }
      }
    });

    if (error) {
      authMsg.textContent = `Signup error: ${error.message}`;
      return;
    }

    authMsg.textContent = "Signup successful! Check your email and click the verification link, then come back and log in.";
  });

  $("btn-login").addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = $("li-email").value.trim().toLowerCase();
    const password = $("li-pass").value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      authMsg.textContent = `Login error: ${error.message}`;
      return;
    }

    currentUser = data.user;
    await afterLogin();
  });

  $("btn-logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    selectedLeague = null;
    showAuth("Logged out.");
  });

  // ---- Navigation ----
  $("nav-dashboard").addEventListener("click", () => goDashboard());
  $("nav-profile").addEventListener("click", () => goProfile());
  $("btn-league-back").addEventListener("click", () => goDashboard());
  $("btn-league-refresh").addEventListener("click", async () => refreshLeagueBoard());
  $("btn-league-delete").addEventListener("click", async () => deleteLeague());

  // ---- League modal buttons ----
  $("btn-open-league-modal").addEventListener("click", openLeagueModal);
  $("btn-close-league-modal").addEventListener("click", closeLeagueModal);
  $("btn-create-league").addEventListener("click", async () => createLeague());
  $("btn-join-league").addEventListener("click", async () => joinLeague());

  // ---- Profile avatar input ----
  $("avatar-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast("Uploading photo…");
      const url = await uploadAvatar(file);
      $("avatar-img").src = url;
      toast("Profile photo updated!");
      await refreshLeaguesList();
    } catch (err) {
      console.error(err);
      toast(`Upload error: ${err.message || err}`);
    } finally {
      e.target.value = "";
    }
  });

  // ---- After login ----
  async function afterLogin() {
    showApp();
    goDashboard();

    // load profile
    try {
      currentProfile = await ensurePlayer(currentUser, currentUser.user_metadata?.name);
    } catch (e) {
      console.error(e);
      showAuth(`Profile error: ${e.message || e}`);
      return;
    }

    setText("whoami", `${currentProfile.name} (${currentProfile.email})`);
    setText("profile-name", currentProfile.name);
    setText("profile-email", currentProfile.email);

    const avatarUrl = currentProfile.avatar_url || "";
    $("avatar-img").src = avatarUrl || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%25' height='100%25' fill='%231f2937'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-size='56'>👤</text></svg>";

    await refreshDashboard();
  }

  // ---- Init ----
  wireHabitButtons();

  (async function init() {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      console.error(error);
      showAuth("Auth error. Please refresh.");
      return;
    }

    const session = data.session;
    if (!session?.user) {
      showAuth("");
      return;
    }

    currentUser = session.user;
    await afterLogin();
  })();

})();
