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
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setBtnDisabled(btnEl, disabled) {
    if (!btnEl) return;
    btnEl.disabled = !!disabled;
    if (disabled) {
      btnEl.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      btnEl.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }

  function toggleEye(inputId) {
    const input = $(inputId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  }

  // simple hash for daily mind game
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h >>> 0;
  }

  // ---- UI: views ----
  const authBox = $("auth-box");
  const appShell = $("app-shell");
  const authMsg = $("auth-msg");

  const viewDash = $("view-dashboard");
  const viewLeague = $("view-league");
  const viewProfile = $("view-profile");
  const viewFriends = $("view-friends");
  const viewMindgame = $("view-mindgame");

  function showAuth(msg) {
    appShell.classList.add("hidden");
    authBox.classList.remove("hidden");
    authMsg.textContent = msg || "";
  }

  function showApp() {
    authBox.classList.add("hidden");
    appShell.classList.remove("hidden");
  }

  function hideAllViews() {
    viewDash.classList.add("hidden");
    viewLeague.classList.add("hidden");
    viewProfile.classList.add("hidden");
    viewFriends.classList.add("hidden");
    viewMindgame.classList.add("hidden");
  }

  function goDashboard() { hideAllViews(); viewDash.classList.remove("hidden"); }
  function goProfile() { hideAllViews(); viewProfile.classList.remove("hidden"); }
  function goFriends() { hideAllViews(); viewFriends.classList.remove("hidden"); }
  function goMindgame() { hideAllViews(); viewMindgame.classList.remove("hidden"); }
  function goLeagueView() { hideAllViews(); viewLeague.classList.remove("hidden"); }

  // ---- State ----
  let currentUser = null;
  let currentProfile = null;
  let selectedLeague = null;

  // ---- Ensure player profile row ----
  async function ensurePlayer(user, fallbackName) {
    const { data: existing, error: e1 } = await sb
      .from("players")
      .select("user_id,email,name,avatar_url,friend_code")
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

  // ---- Stats ----
  async function computeStreak(userId) {
    const { data, error } = await sb
      .from("habit_logs")
      .select("log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(160);

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

  async function totalPoints(userId) {
    // habit logs points
    const { data: h, error: e1 } = await sb
      .from("habit_logs")
      .select("points")
      .eq("user_id", userId);

    if (e1) throw e1;

    // minigame points
    const { data: m, error: e2 } = await sb
      .from("minigame_logs")
      .select("points")
      .eq("user_id", userId);

    // minigame table might not exist in older setups; handle gracefully
    let mg = [];
    if (!e2) mg = m || [];

    const sum = (arr) => (arr || []).reduce((a, r) => a + Number(r.points || 0), 0);
    return sum(h) + sum(mg);
  }

  async function loadAchievementList(userId) {
    const { data, error } = await sb
      .from("user_achievements")
      .select("earned_at, achievements(code,name,icon,description)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })
      .limit(50);

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

    // check today existing
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
      toast(habitKey.startsWith("steps_") ? "You already logged Steps today." : `You already logged ${label} today.`);
      await refreshHabitButtonStates();
      return;
    }

    const { error: e2 } = await sb
      .from("habit_logs")
      .insert({
        user_id: currentUser.id,
        habit_key: habitKey,
        points: points,
        log_date: today
      });

    if (e2) {
      toast("Error logging habit. Check console.");
      console.error(e2);
      await refreshHabitButtonStates();
      return;
    }

    toast(`+${points} points — logged ${label}!`);
    await refreshAll();
  }

  function wireHabitButtons() {
    for (const h of HABITS) {
      const btn = $(h.btn);
      if (!btn) continue;
      btn.addEventListener("click", async () => logHabit(h.key, h.label, h.points));
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

    const { data, error } = await sb
      .from("league_members")
      .select("league_id, joined_at, leagues(id,name,code,owner_id,is_private)")
      .eq("user_id", currentUser.id)
      .order("joined_at", { ascending: false });

    const list = $("leagues-list");
    list.innerHTML = "";

    if (error) {
      console.error(error);
      $("leagues-empty").classList.remove("hidden");
      return;
    }

    const leagues = (data || []).map(r => r.leagues).filter(Boolean);

    if (leagues.length === 0) {
      $("leagues-empty").classList.remove("hidden");
      return;
    }
    $("leagues-empty").classList.add("hidden");

    for (const lg of leagues) {
      const card = document.createElement("div");
      card.className = "bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4";

      card.innerHTML = `
        <div class="min-w-0">
          <div class="font-extrabold text-lg truncate">${lg.name}</div>
          <div class="text-slate-300 text-xs">Invite code: <span class="font-mono tracking-wider">${lg.code || "—"}</span></div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-open px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600">Open</button>
        </div>
      `;

      card.querySelector(".btn-open").addEventListener("click", async () => {
        selectedLeague = lg;
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

    const delBtn = $("btn-league-delete");
    if (league.owner_id && currentUser && league.owner_id === currentUser.id) delBtn.classList.remove("hidden");
    else delBtn.classList.add("hidden");

    await refreshLeagueBoard();
  }

  async function refreshLeagueBoard() {
    if (!selectedLeague) return;

    const board = $("league-board");
    board.innerHTML = `<div class="text-slate-300 text-sm">Loading…</div>`;

    const { data, error } = await sb
      .from("league_leaderboard")
      .select("league_id,user_id,name,avatar_url,points")
      .eq("league_id", selectedLeague.id)
      .order("points", { ascending: false })
      .limit(50);

    if (error) {
      console.warn(error);
      board.innerHTML = `<div class="text-slate-300 text-sm">Leaderboard not available (check view/RLS).</div>`;
      return;
    }

    board.innerHTML = "";
    if (!data || data.length === 0) {
      board.innerHTML = `<div class="text-slate-300 text-sm">No members yet.</div>`;
      return;
    }

    let rank = 1;
    for (const r of data) {
      const card = document.createElement("div");
      card.className = `rounded-2xl p-4 bg-slate-900/40 border border-slate-700 flex items-center justify-between gap-4`;

      const avatar = r.avatar_url
        ? `<img src="${r.avatar_url}" class="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-800" />`
        : `<div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">👤</div>`;

      card.innerHTML = `
        <div class="flex items-center gap-4 min-w-0">
          <div class="text-slate-300 w-8 text-center font-extrabold">${rank}</div>
          ${avatar}
          <div class="min-w-0">
            <div class="font-extrabold text-lg truncate">${r.name || "Player"}</div>
          </div>
        </div>

        <div class="text-right">
          <div class="text-3xl font-extrabold text-amber-300">${Number(r.points || 0)}</div>
          <div class="text-slate-400 text-xs">points</div>
        </div>
      `;
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

    const { data, error } = await sb.rpc("create_league", {
      league_name: name,
      is_private: true
    });

    if (error) {
      console.error(error);
      $("create-league-msg").textContent = `Create league error: ${error.message}`;
      return;
    }

    const code = data?.code || data?.invite_code || data?.join_code || "";
    $("create-league-msg").textContent = code ? `League created! Invite code: ${code}` : `League created!`;
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

    const { error } = await sb.rpc("join_league", { join_code: code });

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

  // ---- Avatar upload ----
  async function uploadAvatar(file) {
    if (!currentUser) return;

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${currentUser.id}/avatar.${ext}`;

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

  // ---- Friends + Notifications ----
  const notifModal = $("notif-modal");
  function openNotifModal() { notifModal.classList.remove("hidden"); }
  function closeNotifModal() { notifModal.classList.add("hidden"); }

  async function refreshNotifCount() {
    const dot = $("notif-dot");
    if (!currentUser) { dot.classList.add("hidden"); return; }

    const { data, error } = await sb.rpc("notifications_count");
    if (error) { console.warn(error); dot.classList.add("hidden"); return; }

    if ((data || 0) > 0) dot.classList.remove("hidden");
    else dot.classList.add("hidden");
  }

  async function loadNotifications() {
    const list = $("notif-list");
    const empty = $("notif-empty");
    list.innerHTML = "";
    empty.classList.add("hidden");

    const { data, error } = await sb.rpc("list_pending_friend_requests");
    if (error) {
      console.error(error);
      empty.classList.remove("hidden");
      empty.textContent = "Could not load notifications (check SQL/functions).";
      return;
    }

    if (!data || data.length === 0) {
      empty.classList.remove("hidden");
      return;
    }

    for (const r of data) {
      const row = document.createElement("div");
      row.className = "bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4";

      const avatar = r.requester_avatar_url
        ? `<img src="${r.requester_avatar_url}" class="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-800" />`
        : `<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">👤</div>`;

      row.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          ${avatar}
          <div class="min-w-0">
            <div class="font-extrabold truncate">${r.requester_name || "Player"}</div>
            <div class="text-slate-300 text-xs">sent you a friend request</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-accept px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold">Accept</button>
          <button class="btn-decline px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600">Decline</button>
        </div>
      `;

      row.querySelector(".btn-accept").addEventListener("click", async () => {
        const { data: out, error: e } = await sb.rpc("accept_friend_request", { p_request_id: r.request_id });
        if (e) { toast(e.message); console.error(e); return; }
        toast(out?.message || "Friend added!");
        await refreshFriends();
        await loadNotifications();
        await refreshNotifCount();
      });

      row.querySelector(".btn-decline").addEventListener("click", async () => {
        const { data: out, error: e } = await sb.rpc("decline_friend_request", { p_request_id: r.request_id });
        if (e) { toast(e.message); console.error(e); return; }
        toast(out?.message || "Declined.");
        await loadNotifications();
        await refreshNotifCount();
      });

      list.appendChild(row);
    }
  }

  async function refreshFriends() {
    const box = $("friends-list");
    box.innerHTML = "";

    const { data, error } = await sb.rpc("list_friends");
    if (error) {
      console.error(error);
      box.innerHTML = `<div class="text-slate-300 text-sm">Could not load friends (check SQL/functions).</div>`;
      return;
    }

    if (!data || data.length === 0) {
      box.innerHTML = `<div class="text-slate-300 text-sm">No friends yet.</div>`;
      return;
    }

    for (const f of data) {
      const row = document.createElement("div");
      row.className = "bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex items-center gap-3";

      const avatar = f.friend_avatar_url
        ? `<img src="${f.friend_avatar_url}" class="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-800" />`
        : `<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">👤</div>`;

      row.innerHTML = `
        ${avatar}
        <div class="font-extrabold">${f.friend_name || "Friend"}</div>
      `;
      box.appendChild(row);
    }
  }

  async function sendFriendRequest() {
    $("friend-msg").textContent = "";
    const code = $("friend-code-input").value.trim().toUpperCase();
    if (!code) { $("friend-msg").textContent = "Enter a Friend Code."; return; }

    const { data, error } = await sb.rpc("request_friend", { p_friend_code: code });
    if (error) { console.error(error); $("friend-msg").textContent = error.message; return; }

    $("friend-msg").textContent = data?.message || "Request sent.";
    toast(data?.message || "Friend request sent!");
    $("friend-code-input").value = "";
    await refreshNotifCount();
  }

  // ---- Mind Game ----
  async function mindgameState() {
    const today = todayKeyLocal();
    const key = `mg_guess10_${today}_${currentUser?.id || ""}`;
    const state = JSON.parse(localStorage.getItem(key) || "null") || { tries: 0, done: false };
    return { key, today, state };
  }

  async function loadMindgameUI() {
    if (!currentUser) return;

    const { key, today, state } = await mindgameState();
    const msg = $("mg-msg");
    const doneBox = $("mg-done");
    const left = $("mg-left");
    const btn = $("btn-mg-try");

    // check if already logged in DB (prevents clearing localStorage to replay)
    const { data, error } = await sb
      .from("minigame_logs")
      .select("id, won, points")
      .eq("user_id", currentUser.id)
      .eq("game_key", "guess10")
      .eq("played_on", today)
      .maybeSingle();

    const played = !error && !!data;

    if (played || state.done) {
      btn.disabled = true;
      setBtnDisabled(btn, true);
      doneBox.classList.remove("hidden");
      doneBox.textContent = played
        ? (data.won ? `✅ You already won today (+${data.points} points).` : `✅ You already played today. Try again tomorrow!`)
        : `✅ You already played today. Try again tomorrow!`;
      msg.textContent = "";
      left.textContent = "0";
      return;
    }

    btn.disabled = false;
    setBtnDisabled(btn, false);
    doneBox.classList.add("hidden");
    left.textContent = String(3 - state.tries);
    msg.textContent = "";
  }

  async function tryMindgame() {
    if (!currentUser) return;

    const guess = Number($("mg-guess").value);
    if (!guess || guess < 1 || guess > 10) {
      $("mg-msg").textContent = "Enter a number between 1 and 10.";
      return;
    }

    const { key, today, state } = await mindgameState();
    const secret = (hashStr("guess10:" + today) % 10) + 1;

    state.tries = (state.tries || 0) + 1;

    const left = 3 - state.tries;
    $("mg-left").textContent = String(Math.max(0, left));

    if (guess === secret) {
      state.done = true;
      localStorage.setItem(key, JSON.stringify(state));

      const { error } = await sb
        .from("minigame_logs")
        .insert({
          user_id: currentUser.id,
          game_key: "guess10",
          played_on: today,
          won: true,
          points: 10
        });

      if (error) console.error(error);

      toast("+10 points — Mind game win!");
      $("mg-msg").textContent = "✅ Correct!";
      await refreshAll();
      await loadMindgameUI();
      return;
    }

    if (state.tries >= 3) {
      state.done = true;
      localStorage.setItem(key, JSON.stringify(state));

      const { error } = await sb
        .from("minigame_logs")
        .insert({
          user_id: currentUser.id,
          game_key: "guess10",
          played_on: today,
          won: false,
          points: 0
        });

      if (error) console.error(error);

      $("mg-msg").textContent = `❌ Out of tries. The answer was ${secret}.`;
      await loadMindgameUI();
      return;
    }

    $("mg-msg").textContent = guess < secret ? "Too low. Try again." : "Too high. Try again.";
    localStorage.setItem(key, JSON.stringify(state));
  }

  // ---- Password reset ----
  function showResetBox(show) {
    const box = $("reset-box");
    if (!box) return;
    if (show) box.classList.remove("hidden");
    else box.classList.add("hidden");
  }

  async function sendResetEmail() {
    $("reset-msg").textContent = "";
    const email = $("reset-email").value.trim().toLowerCase();
    if (!email) { $("reset-msg").textContent = "Enter your email."; return; }

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      console.error(error);
      $("reset-msg").textContent = error.message;
      return;
    }

    $("reset-msg").textContent = "✅ Reset link sent! Check your email.";
  }

  async function handleRecoveryLinkIfPresent() {
    // Supabase recovery uses ?code=... often
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    showResetBox(true);
    $("newpass-box").classList.remove("hidden");
    $("reset-msg").textContent = "✅ Recovery link detected. Set your new password below.";

    try {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) console.warn(error);
    } catch (e) {
      console.warn(e);
    }
  }

  async function setNewPassword() {
    $("reset-msg").textContent = "";
    const p1 = $("new-pass").value;
    const p2 = $("new-pass2").value;
    if (!p1 || p1.length < 6) { $("reset-msg").textContent = "Password must be at least 6 characters."; return; }
    if (p1 !== p2) { $("reset-msg").textContent = "Passwords do not match."; return; }

    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) {
      console.error(error);
      $("reset-msg").textContent = error.message;
      return;
    }

    $("reset-msg").textContent = "✅ Password updated! You can log in now.";
    toast("Password updated!");
    // Clean URL
    history.replaceState({}, document.title, window.location.pathname);
  }

  // ---- Refresh everything ----
  async function refreshAll() {
    if (!currentUser) return;

    const [streak, ach, pts] = await Promise.all([
      computeStreak(currentUser.id),
      countAchievements(currentUser.id),
      totalPoints(currentUser.id)
    ]);

    setText("hdr-streak", streak);
    setText("hdr-ach", ach);
    setText("hdr-points", pts);

    await loadAchievementList(currentUser.id);
    await refreshHabitButtonStates();
    await refreshLeaguesList();
    await refreshFriends();
    await refreshNotifCount();
    await loadMindgameUI();
  }

  // ---- Auth wiring ----
  $("su-pass-eye")?.addEventListener("click", () => toggleEye("su-pass"));
  $("li-pass-eye")?.addEventListener("click", () => toggleEye("li-pass"));
  $("new-pass-eye")?.addEventListener("click", () => toggleEye("new-pass"));

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

    authMsg.textContent = "Signup successful! Check your email and click the verification link, then log in.";
  });

  $("btn-login").addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = $("li-email").value.trim().toLowerCase();
    const password = $("li-pass").value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      // Friendlier error for wrong email/pass
      authMsg.textContent = "Incorrect email or password. Please try again.";
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

  // Forgot password UI
  $("btn-forgot")?.addEventListener("click", () => {
    showResetBox(true);
    $("reset-msg").textContent = "";
  });
  $("btn-send-reset")?.addEventListener("click", sendResetEmail);
  $("btn-set-newpass")?.addEventListener("click", setNewPassword);

  // ---- Navigation ----
  $("nav-dashboard").addEventListener("click", goDashboard);
  $("nav-profile").addEventListener("click", goProfile);
  $("nav-friends").addEventListener("click", async () => { goFriends(); await refreshFriends(); });
  $("nav-mindgame").addEventListener("click", async () => { goMindgame(); await loadMindgameUI(); });

  $("btn-league-back").addEventListener("click", goDashboard);
  $("btn-league-refresh").addEventListener("click", refreshLeagueBoard);
  $("btn-league-delete").addEventListener("click", deleteLeague);

  // League modal
  $("btn-open-league-modal").addEventListener("click", openLeagueModal);
  $("btn-close-league-modal").addEventListener("click", closeLeagueModal);
  $("btn-create-league").addEventListener("click", createLeague);
  $("btn-join-league").addEventListener("click", joinLeague);

  // Notifications modal
  $("btn-notifs").addEventListener("click", async () => {
    openNotifModal();
    await loadNotifications();
  });
  $("btn-close-notif").addEventListener("click", closeNotifModal);

  // Friends
  $("btn-send-friend").addEventListener("click", sendFriendRequest);

  // Mind game
  $("btn-mg-try").addEventListener("click", tryMindgame);

  // Avatar
  $("avatar-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast("Uploading photo…");
      const url = await uploadAvatar(file);
      $("avatar-img").src = url;
      toast("Profile photo updated!");
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

    try {
      currentProfile = await ensurePlayer(currentUser, currentUser.user_metadata?.name);
    } catch (e) {
      console.error(e);
      showAuth(`Profile error: ${e.message || e}`);
      return;
    }

    // Dashboard: show NAME only (no email)
    setText("whoami", `${currentProfile.name}`);

    // Profile: show email
    setText("profile-name", currentProfile.name);
    setText("profile-email", currentProfile.email);
    setText("friend-code", currentProfile.friend_code || "—");

    const avatarUrl = currentProfile.avatar_url || "";
    $("avatar-img").src = avatarUrl || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%25' height='100%25' fill='%231f2937'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-size='56'>👤</text></svg>";

    await refreshAll();
  }

  // ---- Init ----
  wireHabitButtons();

  (async function init() {
    await handleRecoveryLinkIfPresent();

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
