// =============================
// SUPABASE CONNECTION
// =============================

const SUPABASE_URL = "https://onndovdpdaccsavbkykm.supabase.co"

const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubmRvdmRwZGFjY3NhdmJreWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjI2NTksImV4cCI6MjA4ODEzODY1OX0.7dnpa5q34PbW34tF1U83NRJGWRyR70twlDNxgXMOoeE"

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// =============================
// GLOBAL STATE
// =============================

let currentUser = null
let playerProfile = null
let achievements = []
let unlockedAchievements = []

// =============================
// AUTH STATE
// =============================

async function init() {

const { data } = await sb.auth.getSession()

if(data.session){
loginSuccess(data.session.user)
}

}

init()

// =============================
// LOGIN SUCCESS
// =============================

async function loginSuccess(user){

currentUser = user

const { data } = await sb
.from("players")
.select("*")
.eq("user_id", user.id)
.single()

playerProfile = data

document.getElementById("whoami").innerText =
playerProfile.name + " (" + playerProfile.email + ")"

await loadAchievements()
await loadUnlockedAchievements()

}

// =============================
// LOAD ACHIEVEMENTS CATALOG
// =============================

async function loadAchievements(){

const { data } = await sb
.from("achievements")
.select("*")

achievements = data

}

// =============================
// LOAD UNLOCKED ACHIEVEMENTS
// =============================

async function loadUnlockedAchievements(){

const { data } = await sb
.from("user_achievements")
.select("achievement_code")
.eq("user_id", currentUser.id)

unlockedAchievements = data.map(a => a.achievement_code)

updateAchievementCounter()

}

// =============================
// UPDATE PROFILE COUNTER
// =============================

function updateAchievementCounter(){

const el = document.getElementById("badge-achievements")

if(el){
el.innerText = unlockedAchievements.length
}

}

// =============================
// CHECK FOR ACHIEVEMENTS
// =============================

async function checkAchievements(){

// total habits logged

const { count } = await sb
.from("checkins")
.select("*",{count:"exact", head:true})
.eq("user_id", currentUser.id)

for(let a of achievements){

if(unlockedAchievements.includes(a.code)) continue

// total habit achievements
if(a.code === "habits_25" && count >= 25){
unlockAchievement(a)
}

if(a.code === "habits_100" && count >= 100){
unlockAchievement(a)
}

if(a.code === "logs_50" && count >= 50){
unlockAchievement(a)
}

}

}

// =============================
// UNLOCK ACHIEVEMENT
// =============================

async function unlockAchievement(a){

await sb
.from("user_achievements")
.insert({
user_id: currentUser.id,
achievement_code: a.code
})

unlockedAchievements.push(a.code)

updateAchievementCounter()

showAchievementPopup(a)

}

// =============================
// POPUP
// =============================

function showAchievementPopup(a){

const popup = document.createElement("div")

popup.style.position = "fixed"
popup.style.bottom = "30px"
popup.style.right = "30px"
popup.style.background = "#111827"
popup.style.border = "2px solid #fbbf24"
popup.style.padding = "16px"
popup.style.borderRadius = "12px"
popup.style.zIndex = "9999"

popup.innerHTML =
`
<div style="font-size:20px">${a.icon} Achievement Unlocked</div>
<div style="font-weight:bold">${a.name}</div>
<div>${a.description}</div>
`

document.body.appendChild(popup)

setTimeout(()=>{
popup.remove()
},4000)

}

// =============================
// HABIT LOGGING
// =============================

async function logHabit(habitKey, points){

const today = new Date().toISOString().slice(0,10)

const { data: existing } = await sb
.from("checkins")
.select("*")
.eq("user_id", currentUser.id)
.eq("habit_key", habitKey)
.eq("checkin_date", today)

if(existing.length){

alert("You already logged this today")
return

}

await sb
.from("checkins")
.insert({
user_id: currentUser.id,
habit_key: habitKey,
checkin_date: today,
points: points
})

// update points

const newPoints = (playerProfile.points || 0) + points

await sb
.from("players")
.update({points:newPoints})
.eq("user_id",currentUser.id)

playerProfile.points = newPoints

checkAchievements()

}
