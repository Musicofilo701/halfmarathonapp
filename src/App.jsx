import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Clock, Activity, TrendingUp, ChevronRight, Copy, Save, MapPin, AlertCircle, MessageSquare, Loader } from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

// --- CONFIGURATION SECTION ---

// 1. FIREBASE CONFIGURATION
// When deploying to your own laptop/phone, replace the `JSON.parse` line below with your actual config object from the Firebase Console.
console.log("CHIAVE VISTA DA REACT:", import.meta.env.VITE_FIREBASE_API_KEY);
// Example: const firebaseConfig = { apiKey: "AIzaSy...", authDomain: "...", ... };
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "marathon-app-a2001.firebaseapp.com",
  projectId: "marathon-app-a2001",
  storageBucket: "marathon-app-a2001.firebasestorage.app",
  messagingSenderId: "994044496527",
  appId: "1:994044496527:web:14dff11431f988b33b7efa"
};



const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2. APP ID
// Keep this as is for the chat, or change to "my-marathon-app" for your local deployment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'marathon-tracker-v1';

// 3. GEMINI API KEY
// When deploying locally, paste your key inside the quotes: const apiKey = "AIzaSy...";
const apiKey = process.env.REACT_APP_GEMINI_KEY; 

// --- END CONFIGURATION ---

// Gemini API Helper
async function getAICoachFeedback(runData) {
  const finalApiKey = apiKey || "";

  if (!finalApiKey && typeof __firebase_config === 'undefined') {
    return "Please add your Gemini API Key in the code to get AI coaching!";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${finalApiKey}`;

  const prompt = `
    Act as "Pace & Perseverance," an elite, encouraging but data-driven marathon coach.
    The user just completed a run. Analyze these stats briefly (1-2 sentences max):
    - Distance: ${runData.distance}km
    - Time: ${runData.time}
    - Pace: ${runData.pace}/km
    - Avg Heart Rate: ${runData.hr} bpm
    - RPE (Exertion 1-10): ${runData.rpe}
    - User Notes: "${runData.notes}"
    - Planned Distance: ${runData.plannedDistance}
    
    If they hit the goal, celebrate. If they struggled (high RPE/HR), give a specific recovery tip.
    Keep it short, punchy, and "coach-like".
  `;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Great job getting it done today. Recover well!";
  } catch (error) {
    console.error("AI Feedback Error:", error);
    return "Great effort! I couldn't generate a specific analysis right now, but miles in the bank are what count.";
  }
}

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [today, setToday] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  
  // Race Day: April 25, 2026
  const raceDate = new Date('2026-04-25');
  const daysToRace = Math.ceil((raceDate - today) / (1000 * 60 * 60 * 24));
  
  // Training Plan Data (Complete 11-Week Sub-1:40 Plan)
  const trainingPlan = [
    // Phase 1: Base & Re-Introduction
    { id: 1, date: '2026-02-11', type: 'Easy Base', distance: '8km', pace: '5:30-5:50', status: 'pending', notes: 'Rust Remover. Keep it strictly Zone 2.' },
    { id: 2, date: '2026-02-13', type: 'Travel', distance: '0km', pace: '-', status: 'scheduled', notes: 'Long Weekend - Rest' },
    { id: 3, date: '2026-02-15', type: 'Travel', distance: '0km', pace: '-', status: 'scheduled', notes: 'Long Weekend - Rest' },
    { id: 4, date: '2026-02-18', type: 'Steady', distance: '8km', pace: '5:15-5:30', status: 'scheduled', notes: 'Returning from trip. Find rhythm.' },
    { id: 5, date: '2026-02-20', type: 'Easy Short', distance: '6km', pace: '5:40-6:00', status: 'scheduled', notes: 'Shakeout run.' },
    { id: 6, date: '2026-02-22', type: 'Long Run', distance: '14km', pace: '5:45-6:00', status: 'scheduled', notes: 'First double-digit run of the block.' },
    { id: 7, date: '2026-02-24', type: 'Goal Pace', distance: '8km', pace: '4:45', status: 'scheduled', notes: '2km wu + 4km @ 4:45/km + 2km cd' },
    { id: 8, date: '2026-02-27', type: 'Easy Short', distance: '7km', pace: '5:40-6:00', status: 'scheduled', notes: 'Easy recovery run.' },
    { id: 9, date: '2026-03-01', type: 'Long Run', distance: '16km', pace: '5:45-6:00', status: 'scheduled', notes: 'Building endurance.' },
    // Phase 2: Build & Strength
    { id: 10, date: '2026-03-03', type: 'Intervals', distance: '9km', pace: '4:30', status: 'scheduled', notes: '2k wu + 3x1km @ 4:30/km (2min rest) + cd' },
    { id: 11, date: '2026-03-06', type: 'Easy Short', distance: '7km', pace: '5:40-6:00', status: 'scheduled', notes: 'Keep it easy.' },
    { id: 12, date: '2026-03-08', type: 'Long Run', distance: '18km', pace: '5:45-6:00', status: 'scheduled', notes: 'Longest run so far. Stay hydrated.' },
    { id: 13, date: '2026-03-10', type: 'Tempo', distance: '10km', pace: '4:50', status: 'scheduled', notes: '2k wu + 5km @ 4:50/km + cd' },
    { id: 14, date: '2026-03-13', type: 'Travel', distance: '0km', pace: '-', status: 'scheduled', notes: 'Long Weekend - Rest' },
    { id: 15, date: '2026-03-15', type: 'Travel', distance: '0km', pace: '-', status: 'scheduled', notes: 'Long Weekend - Rest' },
    { id: 16, date: '2026-03-18', type: 'Easy', distance: '7km', pace: '5:40-6:00', status: 'scheduled', notes: 'Recovery week post-trip.' },
    { id: 17, date: '2026-03-20', type: 'Easy Short', distance: '6km', pace: '5:40-6:00', status: 'scheduled', notes: 'Shakeout run.' },
    { id: 18, date: '2026-03-22', type: 'Long Run', distance: '15km', pace: '5:30-5:45', status: 'scheduled', notes: 'Keep Sunday steady.' },
    // Phase 3: Peak Performance
    { id: 19, date: '2026-03-24', type: 'Fartlek', distance: '10km', pace: 'Varies', status: 'scheduled', notes: '1 min hard / 1 min easy x 15' },
    { id: 20, date: '2026-03-27', type: 'Easy Short', distance: '7km', pace: '5:40-6:00', status: 'scheduled', notes: 'Recovery before the big weekend.' },
    { id: 21, date: '2026-03-29', type: 'Long Run', distance: '19km', pace: '5:45-6:00', status: 'scheduled', notes: 'Comfortable but focused.' },
    { id: 22, date: '2026-03-31', type: 'Tempo', distance: '11km', pace: '4:40', status: 'scheduled', notes: '2k wu + 6km @ 4:40/km + cd' },
    { id: 23, date: '2026-04-03', type: 'Easy Short', distance: '7km', pace: '5:40-6:00', status: 'scheduled', notes: 'Keep it light.' },
    { id: 24, date: '2026-04-05', type: 'Race Sim', distance: '21km', pace: 'Mixed', status: 'scheduled', notes: 'Distance simulation. Mostly easy, last 3km fast.' },
    { id: 25, date: '2026-04-07', type: 'Intervals', distance: '10km', pace: '4:35', status: 'scheduled', notes: '2k wu + 4x1.5km @ 4:35/km + cd' },
    { id: 26, date: '2026-04-10', type: 'Easy Short', distance: '6km', pace: '5:40-6:00', status: 'scheduled', notes: 'Taper starting soon.' },
    { id: 27, date: '2026-04-12', type: 'Long Run', distance: '14km', pace: '5:45-6:00', status: 'scheduled', notes: 'Slightly early taper to absorb volume.' },
    // Phase 4: Taper & Race
    { id: 28, date: '2026-04-14', type: 'Goal Pace', distance: '8km', pace: '4:44', status: 'scheduled', notes: '2k wu + 3km @ Goal Pace + cd. Drop volume.' },
    { id: 29, date: '2026-04-17', type: 'Easy Short', distance: '5km', pace: '5:40-6:00', status: 'scheduled', notes: 'Very easy.' },
    { id: 30, date: '2026-04-19', type: 'Long Run', distance: '10km', pace: '5:40-6:00', status: 'scheduled', notes: 'Short long run. Feel fresh.' },
    { id: 31, date: '2026-04-21', type: 'Strides', distance: '5km', pace: 'Mixed', status: 'scheduled', notes: 'Easy with 4x30sec strides.' },
    { id: 32, date: '2026-04-23', type: 'Shakeout', distance: '3km', pace: '6:00', status: 'scheduled', notes: 'Pre-race shakeout.' },
    { id: 33, date: '2026-04-25', type: 'RACE DAY', distance: '21.1km', pace: '4:44', status: 'scheduled', notes: 'Trust the training. Go crush it.' },
  ];

  // Initialize with a safe default, but let useEffect handle the logic
  const [currentRun, setCurrentRun] = useState(trainingPlan[0]);
  
  // Form State
  const [formData, setFormData] = useState({
    distance: '',
    time: '',
    hr: '',
    rpe: 5,
    notes: ''
  });

  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // --- Auth & Data Effects ---

  // 1. Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Fetch Logs from Firestore
  useEffect(() => {
    if (!user) return;

    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'runLogs');
    const unsubscribe = onSnapshot(logsRef, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort in memory (newest first)
      fetchedLogs.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(fetchedLogs);
    }, (error) => {
      console.error("Error fetching logs:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. (NEW) SMART UPDATE OF CURRENT RUN
  // This effect runs whenever 'logs' changes. It calculates the next run dynamically.
  useEffect(() => {
    // Basic initialization: find run based on today's date if no logs exist
    const todayStr = today.toISOString().split('T')[0];
    
    if (logs.length === 0) {
      // Logic: Find first run where date >= today
      const upcoming = trainingPlan.find(run => run.date >= todayStr);
      setCurrentRun(upcoming || trainingPlan[trainingPlan.length - 1]);
      return;
    }

    // Advanced Logic: If logs exist, find the first plan item AFTER the last logged run
    // logs[0] is the most recent run because we sorted them in step 2.
    const lastRunTimestamp = logs[0].timestamp;
    const lastRunDate = new Date(lastRunTimestamp);
    
    // Normalize last run date to midnight to compare accurately with plan dates
    lastRunDate.setHours(0,0,0,0);

    // Find the next run in the plan that is strictly AFTER the last logged run date
    const nextUp = trainingPlan.find(run => {
      const planDate = new Date(run.date);
      planDate.setHours(0,0,0,0);
      return planDate > lastRunDate;
    });

    if (nextUp) {
      setCurrentRun(nextUp);
    } else {
      // If no future runs found, stick to the last one (Race Day)
      setCurrentRun(trainingPlan[trainingPlan.length - 1]);
    }

  }, [logs]); // Depend on logs array


  // --- Handlers ---

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculatePace = () => {
    if (!formData.distance || !formData.time) return '--:--';
    const [min, sec] = formData.time.split(':').map(Number);
    const totalMin = min + (sec || 0) / 60;
    const paceDec = totalMin / parseFloat(formData.distance);
    const paceMin = Math.floor(paceDec);
    const paceSec = Math.round((paceDec - paceMin) * 60);
    return `${paceMin}:${paceSec < 10 ? '0' : ''}${paceSec}`;
  };

  const handleSave = async () => {
    if (!user || !formData.distance || !formData.time) return;
    
    setIsSaving(true);

    const calculatedPace = calculatePace();
    
    // 1. Get AI Feedback first
    const aiFeedback = await getAICoachFeedback({
      ...formData,
      pace: calculatedPace,
      plannedDistance: currentRun.distance
    });

    // 2. Create Log Object
    const newLog = {
      date: today.toLocaleDateString(),
      timestamp: Date.now(),
      distance: formData.distance,
      time: formData.time,
      hr: formData.hr,
      rpe: formData.rpe,
      notes: formData.notes,
      pace: calculatedPace,
      plannedDistance: currentRun.distance,
      planId: currentRun.id, // Storing Plan ID for better tracking
      coachFeedback: aiFeedback
    };

    // 3. Save to Firestore
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'runLogs'), newLog);
      
      // Reset & Redirect
      setFormData({ distance: '', time: '', hr: '', rpe: 5, notes: '' });
      setActiveTab('history');
    } catch (err) {
      console.error("Error saving run:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const generateCoachReport = (log) => {
    const report = `
🏃‍♂️ **Run Report**
📅 Date: ${log.date}
📏 Distance: ${log.distance}km (Planned: ${log.plannedDistance})
⏱️ Time: ${log.time}
⚡ Pace: ${log.pace}/km
❤️ Avg HR: ${log.hr} bpm
😰 RPE: ${log.rpe}/10
🤖 Coach AI: ${log.coachFeedback}
📝 Notes: ${log.notes}
    `.trim();

    const textArea = document.createElement("textarea");
    textArea.value = report;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold italic tracking-tighter">PACE & PERSEVERANCE</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-blue-100 opacity-90">Elite Marathon Coaching</p>
              {user ? <span className="bg-green-400 w-2 h-2 rounded-full shadow-[0_0_5px_rgba(74,222,128,0.8)]"></span> : <span className="bg-red-400 w-2 h-2 rounded-full"></span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{daysToRace}</div>
            <div className="text-[10px] uppercase tracking-wider">Days to Race</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Next Run Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transform transition-all hover:scale-[1.01]">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <span className="font-bold text-sm uppercase tracking-wide text-yellow-400">Up Next</span>
                <span className="text-xs text-slate-400">{currentRun.date}</span>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-800">{currentRun.distance}</h2>
                    <p className="text-slate-500 font-medium">{currentRun.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Target Pace</p>
                    <p className="text-xl font-bold text-blue-600">{currentRun.pace} <span className="text-xs text-slate-400">/km</span></p>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-6">
                  <p className="text-sm text-blue-800 italic">"Coach: {currentRun.notes}"</p>
                </div>

                <button 
                  onClick={() => setActiveTab('log')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={20} />
                  Log This Run
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-2 text-slate-500">
                  <Activity size={16} />
                  <span className="text-xs font-bold uppercase">Current Goal</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">1:40:00</p>
                <p className="text-xs text-slate-400">Half Marathon</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-2 text-slate-500">
                  <TrendingUp size={16} />
                  <span className="text-xs font-bold uppercase">Req. Pace</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">4:44</p>
                <p className="text-xs text-slate-400">min/km</p>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'log' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Activity className="text-blue-600" /> Run Details
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total Distance (km)</label>
                <input 
                  type="number" 
                  name="distance"
                  value={formData.distance}
                  onChange={handleInputChange}
                  placeholder="e.g. 8.0"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time (mm:ss)</label>
                  <input 
                    type="text" 
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    placeholder="45:00"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Avg HR (bpm)</label>
                  <input 
                    type="number" 
                    name="hr"
                    value={formData.hr}
                    onChange={handleInputChange}
                    placeholder="145"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  RPE (1-10) 
                  <span className="ml-2 text-slate-400 font-normal normal-case">1=Easy, 10=Max</span>
                </label>
                <div className="flex justify-between gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setFormData({...formData, rpe: num})}
                      className={`h-8 w-8 rounded-full text-sm font-bold transition-colors ${
                        formData.rpe === num 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes / Feeling</label>
                <textarea 
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Legs felt heavy at start, eased into it..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                 <button 
                  onClick={() => setActiveTab('dashboard')}
                  disabled={isSaving}
                  className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex-1 font-bold py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 ${
                    isSaving ? 'bg-blue-400 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save & Analyze
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
             <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="text-blue-600" /> Run History
            </h2>
            
            {logs.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-400">No runs logged yet.</p>
                <button onClick={() => setActiveTab('log')} className="text-blue-600 font-bold mt-2 hover:underline">Log your first run</button>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">{log.date}</p>
                      <h3 className="text-lg font-bold text-slate-800">{log.distance} km <span className="text-sm font-normal text-slate-500">@ {log.pace}/km</span></h3>
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                        <Activity size={10} /> {log.hr}
                      </span>
                    </div>
                  </div>
                  
                  {/* AI Feedback Section */}
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 my-3">
                    <div className="flex items-center gap-2 mb-1 text-yellow-700">
                       <MessageSquare size={14} />
                       <span className="text-xs font-bold uppercase">Coach Analysis</span>
                    </div>
                    <p className="text-sm text-slate-700 italic">"{log.coachFeedback}"</p>
                  </div>

                  <p className="text-xs text-slate-500 mt-2">
                    <span className="font-bold">Notes:</span> {log.notes}
                  </p>
                  
                  <button 
                    onClick={() => generateCoachReport(log)}
                    className="w-full mt-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {showCopySuccess ? <CheckCircle size={16} /> : <Copy size={16} />}
                    {showCopySuccess ? 'Copied!' : 'Copy for Coach'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="bg-white border-t border-slate-200 p-2 pb-6">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Activity size={24} />
            <span className="text-[10px] font-bold mt-1 uppercase">Plan</span>
          </button>
          <button 
            onClick={() => setActiveTab('log')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'log' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <CheckCircle size={24} />
            <span className="text-[10px] font-bold mt-1 uppercase">Log Run</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'history' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Clock size={24} />
            <span className="text-[10px] font-bold mt-1 uppercase">History</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;