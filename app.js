(() => {
  const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

  if (!window.supabase?.createClient) throw new Error("Supabase library not loaded");

  let sb = window.__sb_client;
  if (!sb) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.__sb_client = sb;
  }

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
    if (disabled) btnEl.classList.add("opacity-50", "cursor-not-allowed");
    else btnEl.classList.remove("opacity-50", "cursor-not-allowed");
  }

  function toggleEye(inputId) {
    const input = $(inputId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h >>> 0;
  }

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

  let currentUser = null;
  let currentProfile = null;
  let selectedLeague = null;

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

  async function computeStreak(userId) {
    const { data, error } = await sb
      .from("habit_logs")
      .select("log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(180);
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
      const prevDate = new Date(uniqueDays[i - 1] + "T00:00:00");
      const curDate = new Date(uniqueDays[i] + "T00:00:00");
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
    const { data: h, error: e1 } = await sb
      .from("habit_logs")
      .select("points")
      .eq("user_id", userId);
    if (e1) throw e1;

    const { data: m, error: e2 } = await sb
      .from("minigame_logs")
      .select("points")
      .eq("user_id", userId);

    const mg = e2 ? [] : (m || []);
    const sum = (arr) => (arr || []).reduce((a, r) => a + Number(r.points || 0), 0);
    return sum(h) + sum(mg);
  }

  async function loadAchievementList(userId) {
    const { data, error } = await sb
      .from("user_achievements")
      .select("earned_at, achievements(code,name,icon,description)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })
      .limit(60);
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

  // ----------------------------
  // HABITS
  // ----------------------------
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
    const keysToCheck = habitKey.startsWith("steps_") ? ["steps_5k", "steps_10k"] : [habitKey];

    const { data: existing, error: e1 } = await sb
      .from("habit_logs")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("log_date", today)
      .in("habit_key", keysToCheck);

    if (e1) { toast("Error checking today’s logs."); console.error(e1); return; }

    if ((existing || []).length > 0) {
      toast(habitKey.startsWith("steps_") ? "You already logged Steps today." : `You already logged ${label} today.`);
      await refreshHabitButtonStates();
      return;
    }

    const { error: e2 } = await sb
      .from("habit_logs")
      .insert({ user_id: currentUser.id, habit_key: habitKey, points, log_date: today });

    if (e2) { toast("Error logging habit."); console.error(e2); return; }

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

  // ----------------------------
  // LEAGUES
  // ----------------------------
  const leagueModal = $("league-modal");
  function openLeagueModal() {
    $("create-league-msg").textContent = "";
    $("join-league-msg").textContent = "";
    $("create-league-name").value = "";
    $("join-league-code").value = "";
    leagueModal.classList.remove("hidden");
  }
  function closeLeagueModal() { leagueModal.classList.add("hidden"); }

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
        <button class="btn-open px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600">Open</button>
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
    if (!name) { $("create-league-msg").textContent = "Please enter a league name."; return; }

    const { data, error } = await sb.rpc("create_league", { league_name: name, is_private: true });
    if (error) { console.error(error); $("create-league-msg").textContent = `Create league error: ${error.message}`; return; }

    const code = data?.code || data?.invite_code || data?.join_code || "";
    $("create-league-msg").textContent = code ? `League created! Invite code: ${code}` : `League created!`;
    toast("League created!");
    await refreshLeaguesList();
  }

  async function joinLeague() {
    $("join-league-msg").textContent = "";
    const code = $("join-league-code").value.trim().toUpperCase();
    if (!code) { $("join-league-msg").textContent = "Enter a league code."; return; }

    const { error } = await sb.rpc("join_league", { join_code: code });
    if (error) { console.error(error); $("join-league-msg").textContent = `Join error: ${error.message}`; return; }

    toast("Joined league!");
    await refreshLeaguesList();
  }

  async function deleteLeague() {
    if (!selectedLeague) return;
    if (!confirm(`Delete "${selectedLeague.name}"? This cannot be undone.`)) return;

    const { error } = await sb.rpc("delete_league", { league_id: selectedLeague.id });
    if (error) { console.error(error); toast(`Delete error: ${error.message}`); return; }

    toast("League deleted.");
    selectedLeague = null;
    goDashboard();
    await refreshLeaguesList();
  }

  // ----------------------------
  // AVATAR UPLOAD
  // ----------------------------
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

  // ----------------------------
  // FRIENDS + NOTIFS
  // ----------------------------
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
      empty.textContent = "Could not load notifications.";
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
      box.innerHTML = `<div class="text-slate-300 text-sm">Could not load friends.</div>`;
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

      row.innerHTML = `${avatar}<div class="font-extrabold">${f.friend_name || "Friend"}</div>`;
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

  // ----------------------------
  // MIND GAMES (4 games)
  // ----------------------------
  let activeMindGame = "guess";

  function setMindTab(tab) {
    activeMindGame = tab;
    const tabs = ["guess", "wordle", "riddle", "memory"];
    for (const t of tabs) {
      const btn = $(`mg-tab-${t}`);
      const panel = $(`mg-panel-${t}`);
      if (btn) btn.classList.toggle("bg-indigo-500", t === tab);
      if (btn) btn.classList.toggle("text-slate-900", t === tab);
      if (btn) btn.classList.toggle("bg-slate-700", t !== tab);
      if (panel) panel.classList.toggle("hidden", t !== tab);
    }
  }

  async function alreadyPlayed(gameKey) {
    const today = todayKeyLocal();
    const { data, error } = await sb
      .from("minigame_logs")
      .select("id, won, points")
      .eq("user_id", currentUser.id)
      .eq("game_key", gameKey)
      .eq("played_on", today)
      .maybeSingle();

    if (error) return { played: false, row: null };
    return { played: !!data, row: data };
  }

  async function logMindgameResult(gameKey, won, points) {
    const today = todayKeyLocal();
    const { error } = await sb.from("minigame_logs").insert({
      user_id: currentUser.id,
      game_key: gameKey,
      played_on: today,
      won: !!won,
      points: Number(points || 0)
    });
    if (error) console.error(error);
  }

  // --- Guess (existing) ---
  async function mindgameStateGuess() {
    const today = todayKeyLocal();
    const key = `mg_guess10_${today}_${currentUser?.id || ""}`;
    const state = JSON.parse(localStorage.getItem(key) || "null") || { tries: 0, done: false };
    return { key, today, state };
  }

  async function loadGuessUI() {
    if (!currentUser) return;

    const { played, row } = await alreadyPlayed("guess10");
    const msg = $("mg-msg");
    const doneBox = $("mg-done");
    const left = $("mg-left");
    const btn = $("btn-mg-try");

    const { key, state } = await mindgameStateGuess();

    if (played || state.done) {
      setBtnDisabled(btn, true);
      doneBox.classList.remove("hidden");
      doneBox.textContent = played
        ? (row.won ? `✅ You already won today (+${row.points} points).` : `✅ You already played today. Try again tomorrow!`)
        : `✅ You already played today. Try again tomorrow!`;
      msg.textContent = "";
      left.textContent = "0";
      return;
    }

    setBtnDisabled(btn, false);
    doneBox.classList.add("hidden");
    left.textContent = String(3 - state.tries);
    msg.textContent = "";
    localStorage.setItem(key, JSON.stringify(state));
  }

  async function tryGuess() {
    if (!currentUser) return;

    const { played } = await alreadyPlayed("guess10");
    if (played) { await loadGuessUI(); return; }

    const guess = Number($("mg-guess").value);
    if (!guess || guess < 1 || guess > 10) { $("mg-msg").textContent = "Enter a number between 1 and 10."; return; }

    const { key, today, state } = await mindgameStateGuess();
    const secret = (hashStr("guess10:" + today) % 10) + 1;

    state.tries = (state.tries || 0) + 1;
    $("mg-left").textContent = String(Math.max(0, 3 - state.tries));

    if (guess === secret) {
      state.done = true;
      localStorage.setItem(key, JSON.stringify(state));
      await logMindgameResult("guess10", true, 10);
      toast("+10 points — Mind game win!");
      $("mg-msg").textContent = "✅ Correct!";
      await refreshAll();
      await loadGuessUI();
      return;
    }

    if (state.tries >= 3) {
      state.done = true;
      localStorage.setItem(key, JSON.stringify(state));
      await logMindgameResult("guess10", false, 0);
      $("mg-msg").textContent = `❌ Out of tries. The answer was ${secret}.`;
      await loadGuessUI();
      return;
    }

    $("mg-msg").textContent = guess < secret ? "Too low. Try again." : "Too high. Try again.";
    localStorage.setItem(key, JSON.stringify(state));
  }

  // --- Wordle ---
  const WORDS = [
    "HEART","SLEEP","WATER","POWER","TRAIN","HABIT","SMILE","FOCUS","BRAVE","BOOST",
    "APPLE","GRAPE","ALARM","MIGHT","PLANT","GLOWS","NURSE","CLEAN","SWEAT","PEACE"
  ].map(w => w.slice(0,5));

  function wordleDailyWord() {
    const today = todayKeyLocal();
    const idx = hashStr("wordle:" + today) % WORDS.length;
    return WORDS[idx];
  }

  function wordleKey() {
    const today = todayKeyLocal();
    return `mg_wordle_${today}_${currentUser?.id || ""}`;
  }

  function wordleLoadState() {
    return JSON.parse(localStorage.getItem(wordleKey()) || "null") || { guesses: [], done: false };
  }

  function wordleSaveState(st) {
    localStorage.setItem(wordleKey(), JSON.stringify(st));
  }

  function renderWordleGrid(st) {
    const grid = $("wordle-grid");
    grid.innerHTML = "";
    for (let r = 0; r < 6; r++) {
      const row = document.createElement("div");
      row.className = "grid grid-cols-5 gap-2";
      const guess = st.guesses[r] || "";
      const target = wordleDailyWord();

      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        cell.className = "h-12 rounded-lg border border-slate-700 flex items-center justify-center font-extrabold text-lg bg-slate-900";
        const ch = (guess[c] || "").toUpperCase();
        cell.textContent = ch;

        if (guess.length === 5) {
          const g = guess.toUpperCase();
          const t = target;
          if (ch && ch === t[c]) {
            cell.classList.add("bg-emerald-700");
          } else if (ch && t.includes(ch)) {
            cell.classList.add("bg-amber-700");
          } else if (ch) {
            cell.classList.add("bg-slate-700");
          }
        }

        row.appendChild(cell);
      }
      grid.appendChild(row);
    }
  }

  async function loadWordleUI() {
    if (!currentUser) return;

    const msg = $("wordle-msg");
    const done = $("wordle-done");
    const btn = $("btn-wordle");

    const { played, row } = await alreadyPlayed("wordle5");
    const st = wordleLoadState();

    renderWordleGrid(st);

    if (played || st.done) {
      setBtnDisabled(btn, true);
      done.classList.remove("hidden");
      done.textContent = played
        ? (row.won ? `✅ You already won today (+${row.points} points).` : `✅ You already played today. Try again tomorrow!`)
        : `✅ You already played today. Try again tomorrow!`;
      msg.textContent = "";
      return;
    }

    setBtnDisabled(btn, false);
    done.classList.add("hidden");
    msg.textContent = "Type a 5-letter word and press Guess.";
  }

  async function submitWordle() {
    if (!currentUser) return;

    const { played } = await alreadyPlayed("wordle5");
    if (played) { await loadWordleUI(); return; }

    const st = wordleLoadState();
    if (st.done) { await loadWordleUI(); return; }

    const raw = ($("wordle-input").value || "").trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(raw)) {
      $("wordle-msg").textContent = "Please enter exactly 5 letters (A–Z).";
      return;
    }

    if (st.guesses.length >= 6) {
      $("wordle-msg").textContent = "No guesses left.";
      return;
    }

    st.guesses.push(raw);
    wordleSaveState(st);
    renderWordleGrid(st);
    $("wordle-input").value = "";

    const target = wordleDailyWord();
    if (raw === target) {
      st.done = true;
      wordleSaveState(st);
      await logMindgameResult("wordle5", true, 15);
      toast("+15 points — Wordle win!");
      $("wordle-msg").textContent = "✅ Correct!";
      await refreshAll();
      await loadWordleUI();
      return;
    }

    if (st.guesses.length >= 6) {
      st.done = true;
      wordleSaveState(st);
      await logMindgameResult("wordle5", false, 0);
      $("wordle-msg").textContent = `❌ Out of tries. The word was ${target}.`;
      await loadWordleUI();
      return;
    }

    $("wordle-msg").textContent = `Try again (${6 - st.guesses.length} tries left).`;
  }

  // --- Riddle ---
  const RIDDLES = [
    { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", a: "echo" },
    { q: "What has to be broken before you can use it?", a: "egg" },
    { q: "I’m tall when I’m young, and I’m short when I’m old. What am I?", a: "candle" },
    { q: "What goes up but never comes down?", a: "age" },
    { q: "What has many keys but can’t open a single lock?", a: "piano" },
  ];

  function riddleToday() {
    const today = todayKeyLocal();
    const idx = hashStr("riddle:" + today) % RIDDLES.length;
    return RIDDLES[idx];
  }

  function riddleKey() {
    const today = todayKeyLocal();
    return `mg_riddle_${today}_${currentUser?.id || ""}`;
  }

  function riddleLoadState() {
    return JSON.parse(localStorage.getItem(riddleKey()) || "null") || { done: false };
  }
  function riddleSaveState(st) {
    localStorage.setItem(riddleKey(), JSON.stringify(st));
  }

  async function loadRiddleUI() {
    const r = riddleToday();
    $("riddle-text").textContent = r.q;

    const msg = $("riddle-msg");
    const done = $("riddle-done");
    const btn = $("btn-riddle");

    const { played, row } = await alreadyPlayed("riddle");
    const st = riddleLoadState();

    if (played || st.done) {
      setBtnDisabled(btn, true);
      done.classList.remove("hidden");
      done.textContent = played
        ? (row.won ? `✅ You already solved today (+${row.points} points).` : `✅ You already attempted today. Try again tomorrow!`)
        : `✅ You already attempted today. Try again tomorrow!`;
      msg.textContent = "";
      return;
    }

    setBtnDisabled(btn, false);
    done.classList.add("hidden");
    msg.textContent = "Enter your answer and submit.";
  }

  function normalizeAnswer(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
  }

  async function submitRiddle() {
    const { played } = await alreadyPlayed("riddle");
    if (played) { await loadRiddleUI(); return; }

    const st = riddleLoadState();
    if (st.done) { await loadRiddleUI(); return; }

    const r = riddleToday();
    const ans = normalizeAnswer($("riddle-input").value);

    if (!ans) { $("riddle-msg").textContent = "Type an answer."; return; }

    st.done = true;
    riddleSaveState(st);

    if (ans === normalizeAnswer(r.a)) {
      await logMindgameResult("riddle", true, 12);
      toast("+12 points — Riddle solved!");
      $("riddle-msg").textContent = "✅ Correct!";
      await refreshAll();
      await loadRiddleUI();
      return;
    }

    await logMindgameResult("riddle", false, 0);
    $("riddle-msg").textContent = `❌ Not quite. The answer was: ${r.a}.`;
    await loadRiddleUI();
  }

  // --- Memory Match ---
  const EMOJIS = ["🍎","🍌","🍓","🍇","🍍","🥝","🍉","🍑","🥕","🥦","🍋","🍒","🍔","🍕","🌮","🍪"];

  function mmKey() {
    const today = todayKeyLocal();
    return `mg_mm_${today}_${currentUser?.id || ""}`;
  }

  function mmSeededShuffle(arr, seed) {
    const a = arr.slice();
    let s = seed >>> 0;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function mmInitBoard() {
    const today = todayKeyLocal();
    const seed = hashStr("mm:" + today + ":" + (currentUser?.id || ""));
    const pairs = mmSeededShuffle(EMOJIS, seed).slice(0, 8);
    const deck = mmSeededShuffle([...pairs, ...pairs], seed ^ 0x9e3779b9);
    return {
      deck,
      revealed: Array(16).fill(false),
      matched: Array(16).fill(false),
      first: null,
      second: null,
      lock: false,
      moves: 0,
      done: false
    };
  }

  function mmLoadState() {
    return JSON.parse(localStorage.getItem(mmKey()) || "null") || mmInitBoard();
  }

  function mmSaveState(st) {
    localStorage.setItem(mmKey(), JSON.stringify(st));
  }

  function renderMM(st) {
    $("mm-moves").textContent = String(st.moves || 0);
    const grid = $("mm-grid");
    grid.innerHTML = "";

    for (let i = 0; i < 16; i++) {
      const btn = document.createElement("button");
      btn.className = "h-16 rounded-xl border border-slate-700 bg-slate-900 font-extrabold text-2xl flex items-center justify-center hover:bg-slate-800";
      const faceUp = st.revealed[i] || st.matched[i];
      btn.textContent = faceUp ? st.deck[i] : "❓";

      if (st.matched[i]) btn.classList.add("bg-emerald-900/40");
      if (st.done) btn.disabled = true;

      btn.addEventListener("click", async () => mmClick(i));
      grid.appendChild(btn);
    }
  }

  async function loadMMUI() {
    const msg = $("mm-msg");
    const done = $("mm-done");
    const { played, row } = await alreadyPlayed("memorymatch");

    let st = mmLoadState();
    renderMM(st);

    if (played || st.done) {
      done.classList.remove("hidden");
      done.textContent = played
        ? (row.won ? `✅ You already completed today (+${row.points} points).` : `✅ You already played today. Try again tomorrow!`)
        : `✅ You already completed today. Try again tomorrow!`;
      msg.textContent = "";
      return;
    }

    done.classList.add("hidden");
    msg.textContent = "Match all pairs to win.";
  }

  async function mmClick(i) {
    const { played } = await alreadyPlayed("memorymatch");
    if (played) { await loadMMUI(); return; }

    let st = mmLoadState();
    if (st.done || st.lock) return;
    if (st.matched[i] || st.revealed[i]) return;

    st.revealed[i] = true;

    if (st.first === null) {
      st.first = i;
      mmSaveState(st);
      renderMM(st);
      return;
    }

    st.second = i;
    st.lock = true;
    st.moves = (st.moves || 0) + 1;

    const a = st.first, b = st.second;
    const match = st.deck[a] === st.deck[b];

    mmSaveState(st);
    renderMM(st);

    setTimeout(async () => {
      st = mmLoadState();

      if (match) {
        st.matched[a] = true;
        st.matched[b] = true;
      } else {
        st.revealed[a] = false;
        st.revealed[b] = false;
      }

      st.first = null;
      st.second = null;
      st.lock = false;

      const allMatched = st.matched.every(Boolean);
      if (allMatched) {
        st.done = true;
        mmSaveState(st);

        await logMindgameResult("memorymatch", true, 15);
        toast("+15 points — Memory Match complete!");
        $("mm-msg").textContent = "✅ Completed!";
        await refreshAll();
      } else {
        mmSaveState(st);
      }

      renderMM(st);
      await loadMMUI();
    }, 650);
  }

  async function mmReset() {
    const { played } = await alreadyPlayed("memorymatch");
    if (played) { toast("You already played today."); return; }
    const st = mmInitBoard();
    mmSaveState(st);
    renderMM(st);
    $("mm-msg").textContent = "Board reset.";
  }

  async function loadMindGamesAll() {
    setMindTab(activeMindGame);
    await loadGuessUI();
    await loadWordleUI();
    await loadRiddleUI();
    await loadMMUI();
  }

  // ----------------------------
  // PASSWORD RESET
  // ----------------------------
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
    if (error) { console.error(error); $("reset-msg").textContent = error.message; return; }

    $("reset-msg").textContent = "✅ Reset link sent! Check your email.";
  }

  async function handleRecoveryLinkIfPresent() {
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
    if (error) { console.error(error); $("reset-msg").textContent = error.message; return; }

    $("reset-msg").textContent = "✅ Password updated! You can log in now.";
    toast("Password updated!");
    history.replaceState({}, document.title, window.location.pathname);
  }

  // ----------------------------
  // DELETE PROFILE DATA
  // ----------------------------
  async function deleteMyProfileData() {
    $("del-msg").textContent = "";

    const sure = prompt('Type DELETE to confirm you want to delete your profile data:');
    if (sure !== "DELETE") {
      $("del-msg").textContent = "Cancelled.";
      return;
    }
    if (!confirm("Final confirmation: delete your data now?")) {
      $("del-msg").textContent = "Cancelled.";
      return;
    }

    try {
      toast("Deleting your data...");
      // Attempt to delete avatar files too (best effort)
      try {
        const uid = currentUser.id;
        const { data: listed } = await sb.storage.from("avatars").list(uid, { limit: 100 });
        const paths = (listed || []).map(x => `${uid}/${x.name}`);
        if (paths.length > 0) await sb.storage.from("avatars").remove(paths);
      } catch (e) {
        console.warn("Avatar cleanup skipped:", e);
      }

      const { data, error } = await sb.rpc("delete_my_data");
      if (error) throw error;

      toast(data?.message || "Deleted.");
      await sb.auth.signOut();
      currentUser = null;
      currentProfile = null;
      selectedLeague = null;
      showAuth("Your profile data was deleted. You can sign up again or log in to start fresh.");
    } catch (e) {
      console.error(e);
      $("del-msg").textContent = `Delete error: ${e.message || e}`;
      toast("Delete failed. Check console.");
    }
  }

  // ----------------------------
  // REFRESH ALL
  // ----------------------------
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
    await loadMindGamesAll();
  }

  // ----------------------------
  // EVENT WIRING
  // ----------------------------
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
      options: { emailRedirectTo: redirectTo, data: { name } }
    });

    if (error) { authMsg.textContent = `Signup error: ${error.message}`; return; }
    authMsg.textContent = "Signup successful! Check your email and click the verification link, then log in.";
  });

  $("btn-login").addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = $("li-email").value.trim().toLowerCase();
    const password = $("li-pass").value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
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

  $("btn-forgot")?.addEventListener("click", () => { showResetBox(true); $("reset-msg").textContent = ""; });
  $("btn-send-reset")?.addEventListener("click", sendResetEmail);
  $("btn-set-newpass")?.addEventListener("click", setNewPassword);

  $("nav-dashboard").addEventListener("click", goDashboard);
  $("nav-profile").addEventListener("click", goProfile);
  $("nav-friends").addEventListener("click", async () => { goFriends(); await refreshFriends(); });
  $("nav-mindgame").addEventListener("click", async () => { goMindgame(); await loadMindGamesAll(); });

  $("btn-league-back").addEventListener("click", goDashboard);
  $("btn-league-refresh").addEventListener("click", refreshLeagueBoard);
  $("btn-league-delete").addEventListener("click", deleteLeague);

  $("btn-open-league-modal").addEventListener("click", openLeagueModal);
  $("btn-close-league-modal").addEventListener("click", closeLeagueModal);
  $("btn-create-league").addEventListener("click", createLeague);
  $("btn-join-league").addEventListener("click", joinLeague);

  $("btn-notifs").addEventListener("click", async () => { openNotifModal(); await loadNotifications(); });
  $("btn-close-notif").addEventListener("click", () => closeNotifModal());

  $("btn-send-friend").addEventListener("click", sendFriendRequest);

  $("btn-mg-try").addEventListener("click", tryGuess);
  $("btn-wordle").addEventListener("click", submitWordle);
  $("btn-riddle").addEventListener("click", submitRiddle);
  $("btn-mm-reset").addEventListener("click", mmReset);

  $("mg-tab-guess").addEventListener("click", async () => { setMindTab("guess"); await loadMindGamesAll(); });
  $("mg-tab-wordle").addEventListener("click", async () => { setMindTab("wordle"); await loadMindGamesAll(); });
  $("mg-tab-riddle").addEventListener("click", async () => { setMindTab("riddle"); await loadMindGamesAll(); });
  $("mg-tab-memory").addEventListener("click", async () => { setMindTab("memory"); await loadMindGamesAll(); });

  $("avatar-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast("Uploading photo…");
      const url = await uploadAvatar(file);
      $("avatar-img").src = url;
      $("hdr-avatar").src = url;
      toast("Profile photo updated!");
    } catch (err) {
      console.error(err);
      toast(`Upload error: ${err.message || err}`);
    } finally {
      e.target.value = "";
    }
  });

  $("btn-delete-profile").addEventListener("click", deleteMyProfileData);

  // ----------------------------
  // AFTER LOGIN
  // ----------------------------
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

    setText("whoami", `${currentProfile.name}`);

    // Set header avatar
    const defaultAvatar = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%25' height='100%25' fill='%231f2937'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-size='56'>👤</text></svg>";
    const avatarUrl = currentProfile.avatar_url || defaultAvatar;
    $("hdr-avatar").src = avatarUrl;

    // Profile view
    setText("profile-name", currentProfile.name);
    setText("profile-email", currentProfile.email);
    setText("friend-code", currentProfile.friend_code || "—");
    $("avatar-img").src = avatarUrl;

    await refreshAll();
  }

  // ----------------------------
  // INIT
  // ----------------------------
  wireHabitButtons();

  (async function init() {
    await handleRecoveryLinkIfPresent();

    const { data, error } = await sb.auth.getSession();
    if (error) { console.error(error); showAuth("Auth error. Please refresh."); return; }

    const session = data.session;
    if (!session?.user) { showAuth(""); setMindTab("guess"); return; }

    currentUser = session.user;
    await afterLogin();
    setMindTab("guess");
  })();

})();
