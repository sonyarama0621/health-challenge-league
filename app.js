(() => {
  const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE";

  if (!window.supabase?.createClient) {
    throw new Error("Supabase library not loaded");
  }

  let sb = window.__sb_client;
  if (!sb) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.__sb_client = sb;
  }

  const $ = (id) => document.getElementById(id);
  const toastEl = $("toast");

  function toast(msg, ms = 2600) {
    if (!toastEl) return;
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

  const BUILTIN_HABITS = {
    water: { name: "Water", points: 5, color: "bg-sky-600 hover:bg-sky-500" },
    protein: { name: "Protein", points: 8, color: "bg-red-600 hover:bg-red-500" },
    steps: { name: "Steps", points: 10, color: "bg-blue-700 hover:bg-blue-600" },
    workout: { name: "Workout", points: 12, color: "bg-emerald-700 hover:bg-emerald-600" },
    reading: { name: "Reading", points: 9, color: "bg-orange-700 hover:bg-orange-600" },
    sleep: { name: "Sleep", points: 11, color: "bg-violet-700 hover:bg-violet-600" },
    no_sugar: { name: "No Added Sugar", points: 7, color: "bg-fuchsia-700 hover:bg-fuchsia-600" },
    no_soda: { name: "No Soda", points: 5, color: "bg-amber-700 hover:bg-amber-600" }
  };

  const authBox = $("auth-box");
  const appShell = $("app-shell");
  const authMsg = $("auth-msg");

  const viewDash = $("view-dashboard");
  const viewLeague = $("view-league");
  const viewProfile = $("view-profile");
  const viewFriends = $("view-friends");
  const viewMindgame = $("view-mindgame");

  function showAuth(msg) {
    appShell?.classList.add("hidden");
    authBox?.classList.remove("hidden");
    if (authMsg) authMsg.textContent = msg || "";
  }

  function showApp() {
    authBox?.classList.add("hidden");
    appShell?.classList.remove("hidden");
  }

  function hideAllViews() {
    viewDash?.classList.add("hidden");
    viewLeague?.classList.add("hidden");
    viewProfile?.classList.add("hidden");
    viewFriends?.classList.add("hidden");
    viewMindgame?.classList.add("hidden");
  }

  function goDashboard() { hideAllViews(); viewDash?.classList.remove("hidden"); }
  function goProfile() { hideAllViews(); viewProfile?.classList.remove("hidden"); }
  function goFriends() { hideAllViews(); viewFriends?.classList.remove("hidden"); }
  function goMindgame() { hideAllViews(); viewMindgame?.classList.remove("hidden"); }
  function goLeagueView() { hideAllViews(); viewLeague?.classList.remove("hidden"); }

  let currentUser = null;
  let currentProfile = null;
  let selectedLeague = null;
  let playerHabits = [];
  let activeMindGame = "guess";

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
      const day = typeof r.log_date === "string"
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
    if (!box) return;
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
  // PLAYER HABITS
  // ----------------------------
  async function seedDefaultsIfNeeded() {
    const { data, error } = await sb
      .from("player_habits")
      .select("id")
      .eq("user_id", currentUser.id)
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      await sb.rpc("seed_default_player_habits");
      $("habit-setup-modal")?.classList.remove("hidden");
    }
  }

  async function loadPlayerHabits() {
    const { data, error } = await sb
      .from("player_habits")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    playerHabits = data || [];
    renderHabitCards();
    renderProfileHabits();
    renderSetupCustomList();
  }

  function renderProfileHabits() {
    const box = $("profile-habits-list");
    if (!box) return;
    box.innerHTML = "";

    if (!playerHabits.length) {
      box.innerHTML = `<div class="text-slate-300 text-sm">No habits selected yet.</div>`;
      return;
    }

    for (const h of playerHabits) {
      const row = document.createElement("div");
      row.className = "bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3";
      row.innerHTML = `
        <div>
          <div class="font-extrabold">${h.habit_name}</div>
          <div class="text-slate-300 text-xs">
            ${h.is_custom ? "Custom personal habit" : "Built-in habit"} • ${h.habit_key === "steps" ? "1K = 1 point, 10K+ = 10 points" : `${h.points} points`}
          </div>
        </div>
      `;
      box.appendChild(row);
    }
  }

  function renderHabitCards() {
    const box = $("habit-cards");
    if (!box) return;
    box.innerHTML = "";

    if (!playerHabits.length) {
      box.innerHTML = `<div class="text-slate-300 text-sm">No habits selected yet. Open Profile → Edit Habits.</div>`;
      return;
    }

    for (const h of playerHabits) {
      const meta = BUILTIN_HABITS[h.habit_key] || {};
      const color = meta.color || "bg-slate-700 hover:bg-slate-600";

      const btn = document.createElement("button");
      btn.className = `habit-btn w-full font-bold py-4 rounded-xl ${color}`;
      btn.id = h.habit_key === "steps" ? "btn-open-steps-modal" : `habit-${h.habit_key}`;

      if (h.habit_key === "steps") {
        btn.textContent = "Log Steps";
        btn.addEventListener("click", () => {
          $("steps-modal")?.classList.remove("hidden");
          updateStepsUI();
        });
      } else {
        btn.textContent = `Log ${h.habit_name} (+${h.points})`;
        btn.addEventListener("click", async () => {
          await logHabit(h.habit_key, h.habit_name, h.points);
        });
      }

      box.appendChild(btn);
    }
  }

  function renderSetupCustomList() {
    const box = $("setup-custom-list");
    if (!box) return;
    box.innerHTML = "";

    const customs = playerHabits.filter(h => h.is_custom);
    if (!customs.length) return;

    for (const h of customs) {
      const row = document.createElement("div");
      row.className = "bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between gap-3";
      row.innerHTML = `
        <div class="min-w-0">
          <div class="font-extrabold truncate">${h.habit_name}</div>
          <div class="text-slate-300 text-xs">${h.points} points • personal only</div>
        </div>
        <button class="btn-remove px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500">Remove</button>
      `;
      row.querySelector(".btn-remove").addEventListener("click", async () => {
        await deactivateHabit(h.id);
      });
      box.appendChild(row);
    }
  }

  async function deactivateHabit(id) {
    const { error } = await sb
      .from("player_habits")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) {
      console.error(error);
      toast("Could not remove habit.");
      return;
    }

    toast("Habit removed.");
    await loadPlayerHabits();
    await refreshHabitButtonStates();
  }

  async function addCustomHabit(name, points) {
    const { data, error } = await sb.rpc("create_custom_habit", {
      p_habit_name: name,
      p_points: points
    });

    if (error) {
      console.error(error);
      setText("habit-setup-msg", error.message);
      return;
    }

    setText("habit-setup-msg", data?.message || "Custom habit added.");
    if ($("setup-custom-name")) $("setup-custom-name").value = "";
    if ($("setup-custom-points")) $("setup-custom-points").value = "5";
    await loadPlayerHabits();
  }

  async function saveHabitSelections() {
    const checks = [...document.querySelectorAll(".setup-habit")];
    for (const c of checks) {
      const habitKey = c.value;
      const { error } = await sb
        .from("player_habits")
        .update({ is_active: c.checked })
        .eq("user_id", currentUser.id)
        .eq("habit_key", habitKey);

      if (error) console.error(error);
    }

    setText("habit-setup-msg", "Habits saved!");
    await loadPlayerHabits();
    await refreshHabitButtonStates();
    toast("Your habits were saved.");
    setTimeout(() => $("habit-setup-modal")?.classList.add("hidden"), 600);
  }

  // ----------------------------
  // STEPS MODAL
  // ----------------------------
  function updateStepsUI() {
    const range = $("steps-range");
    const display = $("steps-display");
    const pts = $("steps-points");
    if (!range || !display || !pts) return;

    const v = Number(range.value || 0);
    const points = Math.min(10, Math.floor(v / 1000));
    display.textContent = v.toLocaleString();
    pts.textContent = points;
  }

  // ----------------------------
  // HABIT LOGGING
  // ----------------------------
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

    for (const h of playerHabits) {
      if (h.habit_key === "steps") {
        setBtnDisabled($("btn-open-steps-modal"), logged.has("steps"));
        setBtnDisabled($("btn-log-steps"), logged.has("steps"));
      } else {
        setBtnDisabled($(`habit-${h.habit_key}`), logged.has(h.habit_key));
      }
    }
  }

  async function logHabit(habitKey, label, points) {
    if (!currentUser) return;
    const today = todayKeyLocal();

    const { data: existing, error: e1 } = await sb
      .from("habit_logs")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("log_date", today)
      .eq("habit_key", habitKey);

    if (e1) {
      toast("Error checking today’s logs.");
      console.error(e1);
      return;
    }

    if ((existing || []).length > 0) {
      toast(`You already logged ${label} today.`);
      await refreshHabitButtonStates();
      return;
    }

    const { error: e2 } = await sb
      .from("habit_logs")
      .insert({
        user_id: currentUser.id,
        habit_key: habitKey,
        points,
        log_date: today
      });

    if (e2) {
      toast("Error logging habit.");
      console.error(e2);
      return;
    }

    toast(`+${points} points — logged ${label}!`);
    await refreshAll();
  }

  function wireHabitButtons() {}

  // ----------------------------
  // LEAGUES
  // ----------------------------
  const leagueModal = $("league-modal");

  function openLeagueModal() {
    setText("create-league-msg", "");
    setText("join-league-msg", "");
    if ($("create-league-name")) $("create-league-name").value = "";
    if ($("join-league-code")) $("join-league-code").value = "";
    leagueModal?.classList.remove("hidden");
  }

  function closeLeagueModal() {
    leagueModal?.classList.add("hidden");
  }

  async function refreshLeaguesList() {
    if (!currentUser) return;

    const { data, error } = await sb
      .from("league_members")
      .select("league_id, joined_at, leagues(id,name,code,owner_id,is_private)")
      .eq("user_id", currentUser.id)
      .order("joined_at", { ascending: false });

    const list = $("leagues-list");
    if (!list) return;
    list.innerHTML = "";

    if (error) {
      console.error(error);
      $("leagues-empty")?.classList.remove("hidden");
      return;
    }

    const leagues = (data || []).map(r => r.leagues).filter(Boolean);

    if (leagues.length === 0) {
      $("leagues-empty")?.classList.remove("hidden");
      return;
    }

    $("leagues-empty")?.classList.add("hidden");

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
    if (league.owner_id && currentUser && league.owner_id === currentUser.id) delBtn?.classList.remove("hidden");
    else delBtn?.classList.add("hidden");

    await refreshLeagueBoard();
  }

  async function refreshLeagueBoard() {
    if (!selectedLeague) return;

    const board = $("league-board");
    if (!board) return;
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
      card.className = "rounded-2xl p-4 bg-slate-900/40 border border-slate-700 flex items-center justify-between gap-4";

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
    setText("create-league-msg", "");
    const name = $("create-league-name")?.value.trim();
    if (!name) {
      setText("create-league-msg", "Please enter a league name.");
      return;
    }

    const { data, error } = await sb.rpc("create_league", {
      league_name: name,
      is_private: true
    });

    if (error) {
      console.error(error);
      setText("create-league-msg", `Create league error: ${error.message}`);
      return;
    }

    const leagueId = data?.id || data?.league_id;
    if (leagueId) {
      await sb.rpc("seed_league_default_habits", { p_league_id: leagueId });
    }

    const code = data?.code || data?.invite_code || data?.join_code || "";
    setText("create-league-msg", code ? `League created! Invite code: ${code}` : "League created!");
    toast("League created!");
    await refreshLeaguesList();
  }

  async function joinLeague() {
    setText("join-league-msg", "");
    const code = $("join-league-code")?.value.trim().toUpperCase();
    if (!code) {
      setText("join-league-msg", "Enter a league code.");
      return;
    }

    const { error } = await sb.rpc("join_league", { join_code: code });
    if (error) {
      console.error(error);
      setText("join-league-msg", `Join error: ${error.message}`);
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

  // ----------------------------
  // AVATAR
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
  // FRIENDS + NOTIFICATIONS
  // ----------------------------
  const notifModal = $("notif-modal");

  function openNotifModal() { notifModal?.classList.remove("hidden"); }
  function closeNotifModal() { notifModal?.classList.add("hidden"); }

  async function refreshNotifCount() {
    const dot = $("notif-dot");
    if (!currentUser) {
      dot?.classList.add("hidden");
      return;
    }

    const { data, error } = await sb.rpc("notifications_count");
    if (error) {
      console.warn(error);
      dot?.classList.add("hidden");
      return;
    }

    if ((data || 0) > 0) dot?.classList.remove("hidden");
    else dot?.classList.add("hidden");
  }

  async function loadNotifications() {
    const list = $("notif-list");
    const empty = $("notif-empty");
    if (!list || !empty) return;

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
        if (e) {
          toast(e.message);
          console.error(e);
          return;
        }
        toast(out?.message || "Friend added!");
        await refreshFriends();
        await loadNotifications();
        await refreshNotifCount();
      });

      row.querySelector(".btn-decline").addEventListener("click", async () => {
        const { data: out, error: e } = await sb.rpc("decline_friend_request", { p_request_id: r.request_id });
        if (e) {
          toast(e.message);
          console.error(e);
          return;
        }
        toast(out?.message || "Declined.");
        await loadNotifications();
        await refreshNotifCount();
      });

      list.appendChild(row);
    }
  }

  async function refreshFriends() {
    const box = $("friends-list");
    if (!box) return;
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
    setText("friend-msg", "");
    const code = $("friend-code-input")?.value.trim().toUpperCase();
    if (!code) {
      setText("friend-msg", "Enter a Friend Code.");
      return;
    }

    const { data, error } = await sb.rpc("request_friend", { p_friend_code: code });
    if (error) {
      console.error(error);
      setText("friend-msg", error.message);
      return;
    }

    setText("friend-msg", data?.message || "Request sent.");
    toast(data?.message || "Friend request sent!");
    if ($("friend-code-input")) $("friend-code-input").value = "";
    await refreshNotifCount();
  }

  // ----------------------------
  // MIND GAMES
  // ----------------------------
  function setMindTab(tab) {
    activeMindGame = tab;
    const tabs = ["guess", "wordle", "riddle", "memory"];

    for (const t of tabs) {
      const btn = $(`mg-tab-${t}`);
      const panel = $(`mg-panel-${t}`);
      if (btn) {
        btn.classList.toggle("bg-indigo-500", t === tab);
        btn.classList.toggle("text-slate-900", t === tab);
        btn.classList.toggle("bg-slate-700", t !== tab);
      }
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

  async function loadGuessUI() {
    if (!currentUser) return;

    const { played, row } = await alreadyPlayed("guess10");
    const { key, state } = await mindgameStateGuess();
    const msg = $("mg-msg");
    const doneBox = $("mg-done");
    const left = $("mg-left");
    const btn = $("btn-mg-try");
    if (!msg || !doneBox || !left || !btn) return;

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

  async function mindgameStateGuess() {
    const today = todayKeyLocal();
    const key = `mg_guess10_${today}_${currentUser?.id || ""}`;
    const state = JSON.parse(localStorage.getItem(key) || "null") || { tries: 0, done: false };
    return { key, today, state };
  }

  async function tryGuess() {
    if (!currentUser) return;

    const { played } = await alreadyPlayed("guess10");
    if (played) {
      await loadGuessUI();
      return;
    }

    const guess = Number($("mg-guess")?.value);
    if (!guess || guess < 1 || guess > 10) {
      setText("mg-msg", "Enter a number between 1 and 10.");
      return;
    }

    const { key, today, state } = await mindgameStateGuess();
    const secret = (hashStr("guess10:" + today) % 10) + 1;

    state.tries = (state.tries || 0) + 1;
    setText("mg-left", String(Math.max(0, 3 - state.tries)));

    if (guess === secret) {
      state.done = true;
      localStorage.setItem(key, JSON.stringify(state));
      await logMindgameResult("guess10", true, 10);
      toast("+10 points — Mind game win!");
      setText("mg-msg", "✅ Correct!");
      await refreshAll();
      await loadGuessUI();
      return;
    }

    if (state.tries >= 3) {
      state.done = true;
      localStorage.setItem(key, JSON.stringify(state));
      await logMindgameResult("guess10", false, 0);
      setText("mg-msg", `❌ Out of tries. The answer was ${secret}.`);
      await loadGuessUI();
      return;
    }

    setText("mg-msg", guess < secret ? "Too low. Try again." : "Too high. Try again.");
    localStorage.setItem(key, JSON.stringify(state));
  }

  const WORDS = [
    "HEART","SLEEP","WATER","POWER","TRAIN","HABIT","SMILE","FOCUS","BRAVE","BOOST",
    "APPLE","GRAPE","ALARM","MIGHT","PLANT","GLOWS","NURSE","CLEAN","SWEAT","PEACE"
  ].map(w => w.slice(0, 5));

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
    if (!grid) return;
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
          if (ch === target[c]) {
            cell.classList.add("bg-emerald-700");
          } else if (target.includes(ch)) {
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
    if (!msg || !done || !btn) return;

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
    if (played) {
      await loadWordleUI();
      return;
    }

    const st = wordleLoadState();
    if (st.done) {
      await loadWordleUI();
      return;
    }

    const raw = ($("wordle-input")?.value || "").trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(raw)) {
      setText("wordle-msg", "Please enter exactly 5 letters.");
      return;
    }

    if (st.guesses.length >= 6) {
      setText("wordle-msg", "No guesses left.");
      return;
    }

    st.guesses.push(raw);
    wordleSaveState(st);
    renderWordleGrid(st);
    if ($("wordle-input")) $("wordle-input").value = "";

    const target = wordleDailyWord();
    if (raw === target) {
      st.done = true;
      wordleSaveState(st);
      await logMindgameResult("wordle5", true, 15);
      toast("+15 points — Wordle win!");
      setText("wordle-msg", "✅ Correct!");
      await refreshAll();
      await loadWordleUI();
      return;
    }

    if (st.guesses.length >= 6) {
      st.done = true;
      wordleSaveState(st);
      await logMindgameResult("wordle5", false, 0);
      setText("wordle-msg", `❌ Out of tries. The word was ${target}.`);
      await loadWordleUI();
      return;
    }

    setText("wordle-msg", `Try again (${6 - st.guesses.length} tries left).`);
  }

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
    setText("riddle-text", r.q);

    const msg = $("riddle-msg");
    const done = $("riddle-done");
    const btn = $("btn-riddle");
    if (!msg || !done || !btn) return;

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
    return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  }

  async function submitRiddle() {
    const { played } = await alreadyPlayed("riddle");
    if (played) {
      await loadRiddleUI();
      return;
    }

    const st = riddleLoadState();
    if (st.done) {
      await loadRiddleUI();
      return;
    }

    const r = riddleToday();
    const ans = normalizeAnswer($("riddle-input")?.value);

    if (!ans) {
      setText("riddle-msg", "Type an answer.");
      return;
    }

    st.done = true;
    riddleSaveState(st);

    if (ans === normalizeAnswer(r.a)) {
      await logMindgameResult("riddle", true, 12);
      toast("+12 points — Riddle solved!");
      setText("riddle-msg", "✅ Correct!");
      await refreshAll();
      await loadRiddleUI();
      return;
    }

    await logMindgameResult("riddle", false, 0);
    setText("riddle-msg", `❌ Not quite. The answer was: ${r.a}.`);
    await loadRiddleUI();
  }

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
    setText("mm-moves", String(st.moves || 0));
    const grid = $("mm-grid");
    if (!grid) return;
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
    if (!msg || !done) return;

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
    if (played) {
      await loadMMUI();
      return;
    }

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

    const a = st.first;
    const b = st.second;
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
        setText("mm-msg", "✅ Completed!");
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
    if (played) {
      toast("You already played today.");
      return;
    }

    const st = mmInitBoard();
    mmSaveState(st);
    renderMM(st);
    setText("mm-msg", "Board reset.");
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
    setText("reset-msg", "");
    const email = $("reset-email")?.value.trim().toLowerCase();
    if (!email) {
      setText("reset-msg", "Enter your email.");
      return;
    }

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      console.error(error);
      setText("reset-msg", error.message);
      return;
    }

    setText("reset-msg", "✅ Reset link sent! Check your email.");
  }

  async function handleRecoveryLinkIfPresent() {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    showResetBox(true);
    $("newpass-box")?.classList.remove("hidden");
    setText("reset-msg", "✅ Recovery link detected. Set your new password below.");

    try {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) console.warn(error);
    } catch (e) {
      console.warn(e);
    }
  }

  async function setNewPassword() {
    setText("reset-msg", "");
    const p1 = $("new-pass")?.value;
    const p2 = $("new-pass2")?.value;

    if (!p1 || p1.length < 6) {
      setText("reset-msg", "Password must be at least 6 characters.");
      return;
    }

    if (p1 !== p2) {
      setText("reset-msg", "Passwords do not match.");
      return;
    }

    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) {
      console.error(error);
      setText("reset-msg", error.message);
      return;
    }

    setText("reset-msg", "✅ Password updated! You can log in now.");
    toast("Password updated!");
    history.replaceState({}, document.title, window.location.pathname);
  }

  // ----------------------------
  // DELETE PROFILE
  // ----------------------------
  async function deleteMyProfileData() {
    setText("del-msg", "");
    const sure = prompt('Type DELETE to confirm you want to delete your profile data:');
    if (sure !== "DELETE") {
      setText("del-msg", "Cancelled.");
      return;
    }
    if (!confirm("Final confirmation: delete your data now?")) {
      setText("del-msg", "Cancelled.");
      return;
    }

    try {
      toast("Deleting your data...");

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
      setText("del-msg", `Delete error: ${e.message || e}`);
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
    await loadPlayerHabits();
    await refreshHabitButtonStates();
    await refreshLeaguesList();
    await refreshFriends();
    await refreshNotifCount();
    await loadMindGamesAll();
  }

  // ----------------------------
  // EVENTS
  // ----------------------------
  $("su-pass-eye")?.addEventListener("click", () => toggleEye("su-pass"));
  $("li-pass-eye")?.addEventListener("click", () => toggleEye("li-pass"));
  $("new-pass-eye")?.addEventListener("click", () => toggleEye("new-pass"));

  $("btn-signup")?.addEventListener("click", async () => {
    if (authMsg) authMsg.textContent = "";
    const email = $("su-email")?.value.trim().toLowerCase();
    const password = $("su-pass")?.value;
    const name = $("su-name")?.value.trim();

    if (!email || !password || !name) {
      if (authMsg) authMsg.textContent = "Please enter email, password, and display name.";
      return;
    }

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo, data: { name } }
    });

    if (error) {
      if (authMsg) authMsg.textContent = `Signup error: ${error.message}`;
      return;
    }

    if (authMsg) authMsg.textContent = "Signup successful! Check your email and click the verification link, then log in.";
  });

  $("btn-login")?.addEventListener("click", async () => {
    if (authMsg) authMsg.textContent = "";
    const email = $("li-email")?.value.trim().toLowerCase();
    const password = $("li-pass")?.value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      if (authMsg) authMsg.textContent = "Incorrect email or password. Please try again.";
      return;
    }

    currentUser = data.user;
    await afterLogin();
  });

  $("btn-logout")?.addEventListener("click", async () => {
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    selectedLeague = null;
    showAuth("Logged out.");
  });

  $("btn-forgot")?.addEventListener("click", () => {
    showResetBox(true);
    setText("reset-msg", "");
  });

  $("btn-send-reset")?.addEventListener("click", sendResetEmail);
  $("btn-set-newpass")?.addEventListener("click", setNewPassword);

  $("nav-dashboard")?.addEventListener("click", goDashboard);
  $("nav-profile")?.addEventListener("click", goProfile);
  $("nav-friends")?.addEventListener("click", async () => {
    goFriends();
    await refreshFriends();
  });
  $("nav-mindgame")?.addEventListener("click", async () => {
    goMindgame();
    await loadMindGamesAll();
  });

  $("btn-league-back")?.addEventListener("click", goDashboard);
  $("btn-league-refresh")?.addEventListener("click", refreshLeagueBoard);
  $("btn-league-delete")?.addEventListener("click", deleteLeague);

  $("btn-open-league-modal")?.addEventListener("click", openLeagueModal);
  $("btn-close-league-modal")?.addEventListener("click", closeLeagueModal);
  $("btn-create-league")?.addEventListener("click", createLeague);
  $("btn-join-league")?.addEventListener("click", joinLeague);

  $("btn-notifs")?.addEventListener("click", async () => {
    openNotifModal();
    await loadNotifications();
  });
  $("btn-close-notif")?.addEventListener("click", closeNotifModal);

  $("btn-send-friend")?.addEventListener("click", sendFriendRequest);

  $("btn-mg-try")?.addEventListener("click", tryGuess);
  $("btn-wordle")?.addEventListener("click", submitWordle);
  $("btn-riddle")?.addEventListener("click", submitRiddle);
  $("btn-mm-reset")?.addEventListener("click", mmReset);

  $("mg-tab-guess")?.addEventListener("click", async () => { setMindTab("guess"); await loadMindGamesAll(); });
  $("mg-tab-wordle")?.addEventListener("click", async () => { setMindTab("wordle"); await loadMindGamesAll(); });
  $("mg-tab-riddle")?.addEventListener("click", async () => { setMindTab("riddle"); await loadMindGamesAll(); });
  $("mg-tab-memory")?.addEventListener("click", async () => { setMindTab("memory"); await loadMindGamesAll(); });

  $("avatar-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast("Uploading photo…");
      const url = await uploadAvatar(file);
      if ($("avatar-img")) $("avatar-img").src = url;
      if ($("hdr-avatar")) $("hdr-avatar").src = url;
      toast("Profile photo updated!");
    } catch (err) {
      console.error(err);
      toast(`Upload error: ${err.message || err}`);
    } finally {
      e.target.value = "";
    }
  });

  $("btn-delete-profile")?.addEventListener("click", deleteMyProfileData);

  $("btn-open-habit-setup")?.addEventListener("click", () => {
    $("habit-setup-modal")?.classList.remove("hidden");
    setText("habit-setup-msg", "");
  });

  $("btn-setup-add-custom")?.addEventListener("click", async () => {
    const name = $("setup-custom-name")?.value.trim();
    const points = Number($("setup-custom-points")?.value || 5);
    if (!name) {
      setText("habit-setup-msg", "Enter a custom habit name.");
      return;
    }
    await addCustomHabit(name, points);
  });

  $("btn-save-habit-setup")?.addEventListener("click", saveHabitSelections);

  $("btn-close-steps-modal")?.addEventListener("click", () => {
    $("steps-modal")?.classList.add("hidden");
  });

  $("steps-range")?.addEventListener("input", updateStepsUI);

  $("btn-log-steps")?.addEventListener("click", async () => {
    const v = Number($("steps-range")?.value || 0);
    const points = Math.min(10, Math.floor(v / 1000));
    if (v < 1000) {
      toast("Log at least 1,000 steps.");
      return;
    }
    await logHabit("steps", "Steps", points);
    $("steps-modal")?.classList.add("hidden");
  });

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

    setText("whoami", currentProfile.name);
    setText("profile-name", currentProfile.name);
    setText("profile-email", currentProfile.email);
    setText("friend-code", currentProfile.friend_code || "—");

    const defaultAvatar = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%25' height='100%25' fill='%231f2937'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-size='56'>👤</text></svg>";
    const avatarUrl = currentProfile.avatar_url || defaultAvatar;
    if ($("hdr-avatar")) $("hdr-avatar").src = avatarUrl;
    if ($("avatar-img")) $("avatar-img").src = avatarUrl;

    await seedDefaultsIfNeeded();
    await loadPlayerHabits();
    await refreshAll();
    updateStepsUI();
  }

  // ----------------------------
  // INIT
  // ----------------------------
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
      setMindTab("guess");
      return;
    }

    currentUser = session.user;
    await afterLogin();
    setMindTab("guess");
  })();
})();
