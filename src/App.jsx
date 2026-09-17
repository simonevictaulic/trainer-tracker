import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Papa from "papaparse";
import {
  ClipboardList, ClipboardCheck, UserPlus, GraduationCap, PlayCircle,
  UserCheck, AlertTriangle, Clock, RotateCcw, ChevronRight, ChevronLeft,
  X, Settings, Plus, Trash2, Printer, Monitor,
} from "lucide-react";

/* =====================================================================
   Trainer / Trainee Progress Tracker — same visual system as the
   Warehouse Order Flow app (header nav grouping, Kanban board, numbered
   stepper, panel/card/chip tokens).

   CHANGE FROM PREVIOUS VERSION:
   - Enrollment no longer asks the trainer to pick a support level or
     search/add skills one at a time.
   - Every department has a preset list of relevant skills (editable in
     "Edit skill presets"). Enrolling a trainee auto-assigns their
     department's preset — nothing to pick.
   - Support level starts at "On track" and is derived automatically
     from attendance occurrences logged at checkpoints (unchanged).
   ===================================================================== */

/* ------------------------------- Helpers ---------------------------------- */
const fmtElapsed = (ms) => {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};
const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function CheckMark({ size = 16, color = "#04120f" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidUpdate(prev) { if (prev.tabKey !== this.props.tabKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ maxWidth: 560, margin: "40px auto", background: "#1a1010", border: "1px solid #7f1d1d", borderRadius: 12, padding: 20, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#fca5a5" }}>This screen hit an error</div>
          <div style={{ fontSize: 13, color: "#e6b3b3", marginBottom: 10 }}>The rest of the app still works — switch tabs to keep going.</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#f2c2c2", whiteSpace: "pre-wrap" }}>{String((this.state.err && this.state.err.message) || this.state.err)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return { w, narrow: w < 880, mobile: w < 560 };
}

/* -------------------------------- Data ------------------------------------
   Skill catalog transcribed from the facility's actual checklists:
     - Saws_New_Hire_Skill_Assessment_Checklist_JDW.docx      → SAW-*
     - Koil_Kit_New_Hire_Skill_Assessment_Checklist.docx      → KOIL-*
     - Dry_department_tasks.docx                              → DRY-*
     - Leak_tester_and_pack_table_training.docx               → LTP-*
   Two safety/5S templates repeat verbatim across documents, so each is
   captured once and shared by every department preset that uses it:
     - SAF-, FIVE-, ESC-    → the "New Hire Skill Assessment" template
       used by Saws and Koil Kit
     - SFB-*               → the "Training Checklist" template used by
       Dry department tasks and Leak tester / pack table training
---------------------------------------------------------------------------- */
const DEPARTMENTS_DEFAULT = [
  "STD Heads — 1st Shift",
  "STD Heads — 3rd Shift",
  "Saws — 1st Shift",
  "Saws — 2nd Shift",
  "VicFlex — 1st Shift",
  "VicFlex — 2nd Shift",
  "Leak Test & Pack — 1st Shift",
  "Leak Test & Pack — 2nd Shift",
  "VicDry — 1st Shift",
  "Dry Sprinkler — 1st Shift",
  "Koil Kit — 1st Shift",
];

const SKILLS_DATA = [
  // Shared "New Hire Skill Assessment" safety core — Saws & Koil Kit
  ["SAF-01", "Completes JSA/PPE review and practices 20/20/20", "Safety & Workplace Conduct"],
  ["SAF-02", "Knows nurse station location", "Safety & Workplace Conduct"],
  ["SAF-03", "Knows eyewash station, fire extinguisher, and EAD locations", "Safety & Workplace Conduct"],
  ["SAF-04", "Knows exits, muster point, and shelter-in-place location", "Safety & Workplace Conduct"],
  ["SAF-05", "Knows E-stop locations and is aware of equipment in lockout/tagout (LOTO) condition", "Safety & Workplace Conduct"],
  ["FIVE-01", "Practices safe material handling", "Workplace Organization (5S)"],
  ["FIVE-02", "Knows scrap location and process", "Workplace Organization (5S)"],
  ["FIVE-03", "Knows where to transport completed bins", "Workplace Organization (5S)"],
  ["FIVE-04", "Completes post-shift duties", "Workplace Organization (5S)"],
  ["ESC-01", "Knows when to escalate an issue to the supervisor", "Productivity & Independence"],

  // Saws — Core Job Skills / Quality
  ["SAW-01", "Performs shift start-up / inspects blades, track, and harpoon", "Core Job Skills"],
  ["SAW-02", "Understands Kanban and order sequence", "Core Job Skills"],
  ["SAW-03", "Unwraps and positions reel, engages payoff arms, lifts reel, and adjusts brake correctly", "Core Job Skills"],
  ["SAW-04", "Scans reel into traceability system, prints label, and adds label to traveler", "Core Job Skills"],
  ["SAW-05", "Loads hose into saw", "Core Job Skills"],
  ["SAW-06", "Adjusts caterpillar (feed) pressure", "Core Job Skills"],
  ["SAW-07", "Joins reel head to tail", "Core Job Skills"],
  ["SAW-08", "Interacts with HMI — enters length and quantity", "Core Job Skills"],
  ["SAW-09", "Uses pliers and snips correctly", "Core Job Skills"],
  ["SAW-10", "Knows how to break down reels", "Core Job Skills"],
  ["SAW-11", "Understands hose end condition standard", "Quality"],
  ["SAW-12", "Knows how to measure length correctly", "Quality"],
  ["SAW-13", "Understands not to drop hose into bin", "Quality"],
  ["SAW-14", "Completes traveler fully and correctly", "Quality"],

  // Koil Kit — legacy + unibody + quality
  ["KOIL-01", "Reviews basic Koil Kit diagram (supply and return)", "Legacy Koil Kits — Starter Info"],
  ["KOIL-02", "Basic Koil Kit label flow and connection sizes", "Legacy Koil Kits — Starter Info"],
  ["KOIL-03", "Knows basic Koil Kit components (78Y/78T, 78U, balancing valves, 78K adapters, tailpieces, hoses, PT port/handle extensions)", "Legacy Koil Kits — Starter Info"],
  ["KOIL-04", "Tailpiece swaps — O-ring in place, proper connection size", "Legacy Koil Kits — Basic Assembly"],
  ["KOIL-05", "Proper valve placement in vise (watch valve seams)", "Legacy Koil Kits — Basic Assembly"],
  ["KOIL-06", "Loctite application", "Legacy Koil Kits — Basic Assembly"],
  ["KOIL-07", "Proper wrench selection — backup wrench on unions", "Legacy Koil Kits — Basic Assembly"],
  ["KOIL-08", "78K union assembly", "Legacy Koil Kits — Basic Assembly"],
  ["KOIL-09", "PT Port and valve handle extensions", "Legacy Koil Kits — Basic Assembly"],
  ["KOIL-10", "Backflush kits", "Legacy Koil Kits — Advanced Assembly"],
  ["KOIL-11", "Domestic water kits", "Legacy Koil Kits — Advanced Assembly"],
  ["KOIL-12", "Valves with actuators (e.g., 7MP)", "Legacy Koil Kits — Advanced Assembly"],
  ["KOIL-13", "Leak testing — proper connections and valve closure", "Quality"],
  ["KOIL-14", "Final inspection — components correct and match label", "Quality"],
  ["KOIL-15", "Reviews basic Unibody diagram (supply/return, valve/coil sides)", "Unibody Koil Kits — Starter Info"],
  ["KOIL-16", "Unibody label flow and connection sizes", "Unibody Koil Kits — Starter Info"],
  ["KOIL-17", "Knows Unibody kit components (manual, PICV, automatic, hoses/tailpieces)", "Unibody Koil Kits — Starter Info"],

  // Shared "Training Checklist" template — Dry department & Leak Test/Pack
  ["SFB-01", "Review of PPE required for task — where to get PPE", "Safety"],
  ["SFB-02", "Review of JSA and any pertinent OML's", "Safety"],
  ["SFB-03", "HP - 20 / 20 / 20", "Safety"],
  ["SFB-04", "HP - Peer to Peer", "Safety"],
  ["SFB-05", "HP - Feedback / Reinforcement", "Safety"],
  ["SFB-06", "Dress code (jewelry, hair, hoods, undergarments)", "Safety"],
  ["SFB-07", "Review of method sheets (digital or paper)", "Process Documentation"],
  ["SFB-08", "Review OMLs in the work cell", "Process Documentation"],
  ["SFB-09", "Hourly linearity sheets", "Process Documentation"],
  ["SFB-10", "Review of the shop order/Traveler information", "Shop Order / Kanbans"],
  ["SFB-11", "BOM for shop order", "Shop Order / Kanbans"],
  ["SFB-12", "Verify correct parts are being used according to the BOM/Traveler", "Shop Order / Kanbans"],
  ["SFB-13", "Kanbans", "Shop Order / Kanbans"],
  ["SFB-14", "Review of the tools used in the work cell", "Tools"],
  ["SFB-15", "Hand tool safety", "Tools"],
  ["SFB-16", "Use the right tool for the job", "Tools"],
  ["SFB-17", "Do not modify tools", "Tools"],
  ["SFB-18", "Auto leak testers — start-of-shift check", "Start of Shift"],
  ["SFB-19", "Replace both seals", "Start of Shift"],
  ["SFB-20", "Vacuum both chambers", "Start of Shift"],
  ["SFB-21", "Wipe down both chamber seals", "Start of Shift"],
  ["SFB-22", "Ensure components in hoppers are stocked", "Start of Shift"],

  // Dry department — sprinkler head assembly, test, and pack
  ["DRY-01", "Visual inspection that deflector is correct", "Outer Tube Assembly"],
  ["DRY-02", "Visual inspection that inner and outer tube match the traveler", "Outer Tube Assembly"],
  ["DRY-03", "Pull correct outer tube from cart, insert into clamp, engage handle to lock; tap escutcheon with mallet if required", "Outer Tube Assembly"],
  ["DRY-04", "Apply Loctite to frame (1/3 around threads) and screw head onto outer tube", "Outer Tube Assembly"],
  ["DRY-05", "Torque head onto tube to 20-50 FT-Lbs (wrench click)", "Outer Tube Assembly"],
  ["DRY-06", "Place completed outer tube on carousel", "Outer Tube Assembly"],
  ["DRY-07", "Pull corresponding inner tube from cart, place into assembly fixture aligned with pin", "Inner Tube Assembly"],
  ["DRY-08", "Insert spring into inner tube, held by fixture pin", "Inner Tube Assembly"],
  ["DRY-09", "Push pin through inner tube to support spring", "Inner Tube Assembly"],
  ["DRY-10", "Insert roll pin into fixture slot; use handle to seat roll pin into inner tube sub-assembly", "Inner Tube Assembly"],
  ["DRY-11", "Flip inner tube ~90° on bushing side, insert nail to hold seal at 45°", "Inner Tube Assembly"],
  ["DRY-12", "Inspect roll pin placement and seal for debris/damage", "Inner Tube Assembly"],
  ["DRY-13", "Place inner tube assembly on carousel next to matching outer tube", "Inner Tube Assembly"],
  ["DRY-14", "Placement of sprinkler into test machine", "Sprinkler Testing"],
  ["DRY-15", "Clamshell cover", "Sprinkler Testing"],
  ["DRY-16", "Handling of part when pass or fail", "Sprinkler Testing"],
  ["DRY-17", "Breakdown of part — what to reuse", "Sprinkler Testing"],
  ["DRY-18", "Red scrap bins", "Sprinkler Testing"],
  ["DRY-19", "Insert end fitting into clamp, close collet", "Final Assembly"],
  ["DRY-20", "Raise seal retaining rod, place seal on rod/pin, remove nail", "Final Assembly"],
  ["DRY-21", "Place correct bushing (K5.6 or K8) on inner tube", "Final Assembly"],
  ["DRY-22", "Apply Loctite to outer tube assembly (2 threads, 1/4 around)", "Final Assembly"],
  ["DRY-23", "Screw outer tube assembly into end fitting hand-tight; inspect pipe bottoms out", "Final Assembly"],
  ["DRY-24", "Place split spacer / pip cap assembly; check V36 gap vs. V33 placement", "Final Assembly"],
  ["DRY-25", "Grease and place correct, non-inverted bulb in pip cap; check 3mm cap alignment", "Final Assembly"],
  ["DRY-26", "Place screw into frame to hold bulb, spacers, pip cap", "Final Assembly"],
  ["DRY-27", "Load machine driver, pull trigger, confirm correct program (V33/V36 = #1)", "Machine Loading"],
  ["DRY-28", "Remove sprinkler after green light, inspect alignment, clean excess Loctite", "Machine Loading"],
  ["DRY-29", "Load sprinkler into leak test fixture, close door, push green button", "Testing Process"],
  ["DRY-30", "Confirm auto-engrave on passed parts; open door when light turns green", "Testing Process"],
  ["DRY-31", "Apply 3M Scotch Weld to load screw cavity on passed parts", "Testing Process"],
  ["DRY-32", "Move good parts to vacuum chamber tray, start test", "Testing Process"],
  ["DRY-33", "Route failed leak parts to burn-off table for rework", "Testing Process"],
  ["DRY-34", "Check bulb for leaking fluid/bubbles after vacuum test; failures route to burn-off", "Testing Process"],
  ["DRY-35", "Install bulb protector and pack parts that pass vacuum test", "Testing Process"],
  ["DRY-36", "Install bulb protective cap", "Packing"],
  ["DRY-37", "Correct boxes and dunnage", "Packing"],
  ["DRY-38", "Labeling (boxes not pre-labeled)", "Packing"],
  ["DRY-39", "Placement and handling of box onto skid", "Packing"],
  ["DRY-40", "Knows clean-up start time, broom/dustpan location, cleaning area, and tool storage spot", "End of Shift / 5S"],

  // Leak tester & pack table — hose loading and packing
  ["LTP-01", "Visual inspection that hose is correct", "Hose Loading"],
  ["LTP-02", "Visual inspection of the hose", "Hose Loading"],
  ["LTP-03", "Place hose in leak chamber and push the white button", "Hose Loading"],
  ["LTP-04", "If hose fails, follows the scrap/rework process", "Hose Loading"],
  ["LTP-05", "Ensures paperwork and components are correct", "Packing Vic-Flex Hose"],
  ["LTP-06", "Follows 1st piece check process for QA", "Packing Vic-Flex Hose"],
  ["LTP-07", "Ensures boxes are correct", "Packing Vic-Flex Hose"],
  ["LTP-08", "Assembles branch nipple (no laser marking end) and reducer (laser-marked end)", "Packing Vic-Flex Hose"],
  ["LTP-09", "Installs honeycomb, packs 10 hoses per box", "Packing Vic-Flex Hose"],
  ["LTP-10", "Folds, tapes, and labels box correctly", "Packing Vic-Flex Hose"],
  ["LTP-11", "Places box on correct-size pallet; does not stack past 10 boxes high", "Packing Vic-Flex Hose"],
  ["LTP-12", "Fills all hoppers at end of shift", "End of Shift"],
  ["LTP-13", "Removes unneeded components", "End of Shift"],
  ["LTP-14", "Processes all scrap and rework", "End of Shift"],
];
const SKILLS = SKILLS_DATA.map((r) => ({ id: r[0], desc: r[1], category: r[2] }));

// Shared safety/5S/escalation core — used as the starting preset for any
// department that doesn't have its own checklist document yet.
const SHARED_CORE = ["SAF-01", "SAF-02", "SAF-03", "SAF-04", "SAF-05", "FIVE-01", "FIVE-02", "FIVE-03", "FIVE-04", "ESC-01"];

// Default relevant-skills preset per department family (the part of the
// department name before " — <shift>"). Every shift of the same family
// shares a preset; edit per-department from "Edit skill presets".
const FAMILY_PRESETS_DEFAULT = {
  "STD Heads": [...SHARED_CORE],
  "Saws": [...SHARED_CORE, "SAW-01", "SAW-02", "SAW-03", "SAW-04", "SAW-05", "SAW-06", "SAW-07", "SAW-08", "SAW-09", "SAW-10", "SAW-11", "SAW-12", "SAW-13", "SAW-14"],
  "VicFlex": [...SHARED_CORE],
  "Leak Test & Pack": ["SFB-01", "SFB-02", "SFB-03", "SFB-04", "SFB-05", "SFB-06", "SFB-07", "SFB-08", "SFB-09", "SFB-10", "SFB-11", "SFB-12", "SFB-13", "SFB-14", "SFB-15", "SFB-16", "SFB-17", "SFB-18", "SFB-19", "SFB-20", "SFB-21", "SFB-22", "LTP-01", "LTP-02", "LTP-03", "LTP-04", "LTP-05", "LTP-06", "LTP-07", "LTP-08", "LTP-09", "LTP-10", "LTP-11", "LTP-12", "LTP-13", "LTP-14"],
  "VicDry": [...SHARED_CORE],
  "Dry Sprinkler": ["SFB-01", "SFB-02", "SFB-03", "SFB-04", "SFB-05", "SFB-06", "SFB-07", "SFB-08", "SFB-09", "SFB-10", "SFB-11", "SFB-12", "SFB-13", "SFB-14", "SFB-15", "SFB-16", "SFB-17", "SFB-18", "SFB-19", "SFB-20", "SFB-21", "SFB-22", "DRY-01", "DRY-02", "DRY-03", "DRY-04", "DRY-05", "DRY-06", "DRY-07", "DRY-08", "DRY-09", "DRY-10", "DRY-11", "DRY-12", "DRY-13", "DRY-14", "DRY-15", "DRY-16", "DRY-17", "DRY-18", "DRY-19", "DRY-20", "DRY-21", "DRY-22", "DRY-23", "DRY-24", "DRY-25", "DRY-26", "DRY-27", "DRY-28", "DRY-29", "DRY-30", "DRY-31", "DRY-32", "DRY-33", "DRY-34", "DRY-35", "DRY-36", "DRY-37", "DRY-38", "DRY-39", "DRY-40"],
  "Koil Kit": [...SHARED_CORE, "KOIL-01", "KOIL-02", "KOIL-03", "KOIL-04", "KOIL-05", "KOIL-06", "KOIL-07", "KOIL-08", "KOIL-09", "KOIL-10", "KOIL-11", "KOIL-12", "KOIL-13", "KOIL-14", "KOIL-15", "KOIL-16", "KOIL-17"],
};
const familyOf = (dept) => dept.split("—")[0].trim();
const defaultDeptSkills = (departments) => {
  const map = {};
  departments.forEach((d) => { map[d] = [...(FAMILY_PRESETS_DEFAULT[familyOf(d)] || SHARED_CORE)]; });
  return map;
};
// Resolve a department's preset skill ids against the current catalog,
// silently dropping any id that no longer exists (e.g. skill was deleted).
const resolvePreset = (deptSkills, department, skills) => {
  const ids = (deptSkills && deptSkills[department]) || [];
  const byId = new Map(skills.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
};

const SUPPORT_LEVELS = [
  { key: "On track", color: "#10b981", overdueMin: 240 },
  { key: "Needs support", color: "#f59e0b", overdueMin: 60 },
  { key: "At risk", color: "#ef4444", overdueMin: 15 },
];
const supportMeta = (k) => SUPPORT_LEVELS.find((s) => s.key === k) || SUPPORT_LEVELS[0];
const supportFromOccurrences = (n) => (n >= 3 ? "At risk" : n === 2 ? "Needs support" : "On track");

const STAGES = ["Initial (Wk 1-2)", "Light (Wk 3-4)", "Independent", "Completed"];
const STAGE_ICON = { "Initial (Wk 1-2)": ClipboardList, "Light (Wk 3-4)": PlayCircle, "Independent": UserCheck, "Completed": GraduationCap };

/* ------------------------------ Storage ----------------------------------- */
const KEY = "trainer_tracker_v3";
const SKILLS_KEY = "trainer_skills_v2";
const SKILLS_VERSION = 2;

async function loadState() {
  let main = { seq: 301, trainees: [], departments: [...DEPARTMENTS_DEFAULT], deptSkills: null };
  try {
    const r = await window.storage.get(KEY);
    if (r && r.value) {
      const p = JSON.parse(r.value);
      if (typeof p.seq === "number") main.seq = p.seq;
      if (Array.isArray(p.trainees)) main.trainees = p.trainees;
      if (p.departments && p.departments.length) main.departments = p.departments;
      if (p.deptSkills) main.deptSkills = p.deptSkills;
    }
  } catch (e) {}
  let skills = null;
  try {
    const rs = await window.storage.get(SKILLS_KEY);
    if (rs && rs.value) {
      const ps = JSON.parse(rs.value);
      if (ps && ps.version === SKILLS_VERSION && Array.isArray(ps.skills) && ps.skills.length) skills = ps.skills;
    }
  } catch (e) {}
  if (!skills) skills = [...SKILLS];
  if (!main.deptSkills) main.deptSkills = defaultDeptSkills(main.departments);
  return { ...main, skills };
}
async function persist(state) {
  try {
    await window.storage.set(KEY, JSON.stringify({
      seq: state.seq, trainees: state.trainees, departments: state.departments, deptSkills: state.deptSkills,
    }));
  } catch (e) {}
}
async function persistSkills(skills) {
  try { await window.storage.set(SKILLS_KEY, JSON.stringify({ version: SKILLS_VERSION, skills })); } catch (e) {}
}

/* ============================== App ===================================== */
export default function App() {
  const [tab, setTab] = useState("enroll");
  const [state, setState] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [time, setTime] = useState(clock());
  const [printTargetId, setPrintTargetId] = useState(null);
  const [showDepartments, setShowDepartments] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [logTraineeId, setLogTraineeId] = useState(null);

  useEffect(() => { loadState().then(setState); }, []);
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setTime(clock()); }, 1000);
    return () => clearInterval(t);
  }, []);

  // Single commit path — always writes both storage keys, so trainees,
  // departments, presets, and the skills catalog never drift out of sync.
  const commit = useCallback((next) => { setState(next); persist(next); persistSkills(next.skills); }, []);

  const addTrainee = ({ name, department, note }) => {
    const id = state.seq;
    const presetSkills = resolvePreset(state.deptSkills, department, state.skills).map((s) => ({ ...s, done: false }));
    const full = {
      id: `TR-${id}`, num: id, name, department, note,
      support: "On track",
      status: STAGES[0],
      enrolledAt: Date.now(),
      stamps: {},
      occurrences: 0,
      checkpoints: [],
      skills: presetSkills,
    };
    commit({ ...state, seq: id + 1, trainees: [full, ...state.trainees] });
    setTab("dashboard");
  };

  const toggleSkillDone = (traineeId, skillId) => {
    const trainees = state.trainees.map((t) => {
      if (t.id !== traineeId) return t;
      const skills = t.skills.map((s) => (s.id === skillId ? { ...s, done: !s.done } : s));
      return { ...t, skills };
    });
    commit({ ...state, trainees });
  };

  const completeCheckpoint = (traineeId, { note, hadOccurrence }) => {
    const trainees = state.trainees.map((t) => {
      if (t.id !== traineeId) return t;
      const i = STAGES.indexOf(t.status);
      const nextStatus = STAGES[Math.min(i + 1, STAGES.length - 1)];
      const occurrences = t.occurrences + (hadOccurrence ? 1 : 0);
      return {
        ...t,
        status: nextStatus,
        support: supportFromOccurrences(occurrences),
        occurrences,
        stamps: { ...t.stamps, [nextStatus]: Date.now() },
        checkpoints: [...t.checkpoints, { at: Date.now(), stage: t.status, note, hadOccurrence }],
      };
    });
    commit({ ...state, trainees });
  };

  const removeTrainee = (id) => commit({ ...state, trainees: state.trainees.filter((t) => t.id !== id) });

  const openPrint = (id) => { setPrintTargetId(id); setTab("print"); };

  const addDepartment = (name) => {
    const n = name.trim();
    if (!n || state.departments.includes(n)) return;
    const deptSkills = { ...state.deptSkills, [n]: [...(FAMILY_PRESETS_DEFAULT[familyOf(n)] || SHARED_CORE)] };
    commit({ ...state, departments: [...state.departments, n], deptSkills });
  };
  const removeDepartment = (name) => {
    if (state.departments.length <= 1) return;
    const deptSkills = { ...state.deptSkills };
    delete deptSkills[name];
    commit({ ...state, departments: state.departments.filter((d) => d !== name), deptSkills });
  };

  const toggleDeptSkill = (department, skillId) => {
    const cur = new Set(state.deptSkills[department] || []);
    if (cur.has(skillId)) cur.delete(skillId); else cur.add(skillId);
    commit({ ...state, deptSkills: { ...state.deptSkills, [department]: [...cur] } });
  };

  const addSkill = (skill) => {
    const id = (skill.id || "").trim();
    if (!id || state.skills.some((s) => s.id === id)) return;
    commit({ ...state, skills: [...state.skills, { id, desc: (skill.desc || "").trim(), category: (skill.category || "").trim() }] });
  };
  const removeSkill = (id) => {
    const skills = state.skills.filter((s) => s.id !== id);
    const deptSkills = {};
    Object.keys(state.deptSkills).forEach((d) => { deptSkills[d] = state.deptSkills[d].filter((sid) => sid !== id); });
    commit({ ...state, skills, deptSkills });
  };
  const setSkills = (rows, mode) => {
    const base = mode === "append" ? [...state.skills] : [];
    const seen = new Set(base.map((s) => s.id));
    for (const r of rows) if (r.id && !seen.has(r.id)) { base.push(r); seen.add(r.id); }
    let deptSkills = state.deptSkills;
    if (mode !== "append") {
      const validIds = new Set(base.map((s) => s.id));
      deptSkills = {};
      Object.keys(state.deptSkills).forEach((d) => { deptSkills[d] = state.deptSkills[d].filter((sid) => validIds.has(sid)); });
    }
    commit({ ...state, skills: base, deptSkills });
  };

  const resetAll = () => commit({ seq: 301, trainees: [], departments: state.departments, deptSkills: state.deptSkills, skills: state.skills });
  const seed = () => {
    let seq = state.seq;
    const mk = (deptIdx, support, stage, daysAgo, doneCount) => {
      const id = seq++;
      const enrolledAt = Date.now() - daysAgo * 24 * 60 * 60000;
      const department = state.departments[deptIdx] || state.departments[0];
      const preset = resolvePreset(state.deptSkills, department, state.skills);
      const skills = preset.map((s, i) => ({ ...s, done: i < doneCount }));
      return {
        id: `TR-${id}`, num: id,
        name: ["Jordan Reyes", "Casey Nolan", "Priya Anand", "Marcus Webb", "Lena Ortiz"][id % 5],
        department, support, status: stage, enrolledAt, stamps: {},
        occurrences: support === "At risk" ? 3 : support === "Needs support" ? 2 : 0,
        checkpoints: [], note: "", skills,
      };
    };
    const demo = [
      mk(0, "On track", STAGES[0], 3, 2),
      mk(2, "Needs support", STAGES[1], 9, 5),
      mk(1, "On track", STAGES[2], 40, 7),
      mk(4, "At risk", STAGES[0], 5, 1),
      mk(3, "On track", STAGES[3], 190, 8),
    ];
    commit({ ...state, seq, trainees: [...demo, ...state.trainees] });
  };

  if (!state) return (
    <div style={styles.shell}>
      <div style={{ margin: "auto", color: "#8a95a5", fontFamily: "ui-monospace, monospace" }}>Loading trainee list…</div>
    </div>
  );

  return (
    <div style={styles.shell}>
      <style>{`
        input::placeholder { color: #55606e; }
        select option { background: #0c1117; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          #sheet { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
        }
      `}</style>
      <Header tab={tab} setTab={setTab} time={time}
        activeCount={state.trainees.filter((t) => t.status !== "Completed").length}
        atRiskCount={state.trainees.filter((t) => t.support === "At risk" && t.status !== "Completed").length}
        onManageDepartments={() => setShowDepartments(true)} />
      <div style={styles.body}>
        <ErrorBoundary tabKey={tab}>
          {tab === "enroll" && (
            <Enroll onSubmit={addTrainee} departments={state.departments} skills={state.skills} deptSkills={state.deptSkills}
              onManageDepartments={() => setShowDepartments(true)} onManagePresets={() => setShowPresets(true)} />
          )}
          {tab === "checkpoints" && <Checkpoints state={state} now={now} onLog={(id) => setLogTraineeId(id)} />}
          {tab === "dashboard" && (
            <Dashboard state={state} now={now} remove={removeTrainee}
              reset={resetAll} seed={seed} openPrint={openPrint} openLog={(id) => setLogTraineeId(id)} />
          )}
          {tab === "print" && <PrintSheet state={state} initialId={printTargetId} />}
        </ErrorBoundary>
      </div>
      {showDepartments && (
        <ManageDepartments departments={state.departments} onAdd={addDepartment} onRemove={removeDepartment} onClose={() => setShowDepartments(false)} />
      )}
      {showSkills && (
        <ManageSkills skills={state.skills} onAdd={addSkill} onRemove={removeSkill} onSetSkills={setSkills} onClose={() => setShowSkills(false)} />
      )}
      {showPresets && (
        <ManagePresets departments={state.departments} skills={state.skills} deptSkills={state.deptSkills}
          onToggle={toggleDeptSkill} onManageSkills={() => { setShowPresets(false); setShowSkills(true); }}
          onClose={() => setShowPresets(false)} />
      )}
      {logTraineeId && (() => {
        const t = state.trainees.find((x) => x.id === logTraineeId);
        if (!t) return null;
        return (
          <LogMode trainee={t}
            onToggleSkill={(skillId) => toggleSkillDone(t.id, skillId)}
            onComplete={(payload) => completeCheckpoint(t.id, payload)}
            onClose={() => setLogTraineeId(null)} />
        );
      })()}
    </div>
  );
}

/* ------------------------------ Header ----------------------------------- */
function Header({ tab, setTab, time, activeCount, atRiskCount, onManageDepartments }) {
  const { mobile, narrow } = useViewport();
  const groups = [
    { label: "Track", tabs: [
      { k: "enroll", label: "New trainee", icon: UserPlus },
      { k: "checkpoints", label: "Checkpoints", icon: ClipboardCheck },
    ]},
    { label: "Program", tabs: [
      { k: "dashboard", label: "Training queue", icon: Monitor },
      { k: "print", label: "Checkpoint sheet", icon: Printer },
    ]},
  ];
  return (
    <header style={{ ...styles.header, flexWrap: narrow ? "wrap" : "nowrap", rowGap: 10 }} className="no-print">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={styles.logoMark}>◇</div>
        <div>
          <div style={{ fontWeight: 700, letterSpacing: 0.3 }}>Trainer Progress Tracker</div>
          <div style={{ fontSize: 11, color: "#7a869a", letterSpacing: 1, textTransform: "uppercase" }}>Leland Facility — New Hire Onboarding</div>
        </div>
      </div>
      <nav style={{ display: "flex", alignItems: "center", order: narrow ? 3 : 2, width: narrow ? "100%" : "auto" }}>
        {groups.map((g, gi) => (
          <React.Fragment key={g.label}>
            {gi > 0 && <div style={styles.navDivider} />}
            <div style={styles.navGroup}>
              {!mobile && <span style={styles.navGroupLabel}>{g.label}</span>}
              {g.tabs.map((t) => {
                const active = tab === t.k;
                const Icon = t.icon;
                const badge = t.k === "dashboard" ? activeCount : t.k === "checkpoints" ? atRiskCount : 0;
                return (
                  <button key={t.k} onClick={() => setTab(t.k)}
                    style={{ ...styles.tabBtn, padding: mobile ? "12px 8px" : "10px 12px", ...(active ? styles.tabBtnActive : {}) }}>
                    <Icon size={17} />
                    {!mobile && <span>{t.label}</span>}
                    {badge > 0 && <span style={{ ...styles.badge, background: t.k === "checkpoints" ? "#ef4444" : "#5eead4", color: t.k === "checkpoints" ? "#fff" : "#04120f" }}>{badge}</span>}
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 10, order: narrow ? 2 : 3 }}>
        <button onClick={onManageDepartments} title="Manage departments" style={{ ...styles.tabBtn, padding: 9 }}>
          <Settings size={17} />
          {!mobile && <span>Depts</span>}
        </button>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, color: "#aeb7c4", minWidth: 74, textAlign: "right" }}>{time}</div>
      </div>
    </header>
  );
}

/* ------------------------------ Step helper ------------------------------- */
function Step({ n, label, last, children }) {
  return (
    <div style={styles.stepRow}>
      <div style={styles.stepRail}>
        <div style={styles.stepDot}>{n}</div>
        {!last && <div style={styles.stepLine} />}
      </div>
      <div style={styles.stepContent}>
        <div style={styles.stepLabel}>{label}</div>
        {children}
      </div>
    </div>
  );
}
function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#5cc9bd", fontWeight: 700, marginBottom: 10, ...style }}>{children}</div>;
}

/* ------------------------------ Enroll form -------------------------------
   Now just two decisions: name, and department. The department's preset
   drives the skills checklist automatically — nothing to search or add.
---------------------------------------------------------------------------- */
function Enroll({ onSubmit, departments, skills, deptSkills, onManageDepartments, onManagePresets }) {
  const { narrow } = useViewport();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(departments[0]);
  useEffect(() => { if (!departments.includes(department)) setDepartment(departments[0]); }, [departments]); // eslint-disable-line
  const [note, setNote] = useState("");

  const preset = useMemo(() => resolvePreset(deptSkills, department, skills), [deptSkills, department, skills]);

  const submit = () => {
    if (!name.trim() || preset.length === 0) return;
    onSubmit({ name: name.trim(), department, note });
    setName(""); setNote("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1.3fr) minmax(0,1fr)", gap: 20, maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      <div style={styles.panel}>
        <div style={styles.roleNote}>
          Enroll a new hire here. Their skills checklist is assigned automatically from their department's preset — edit the presets themselves from "Edit skill presets," not per trainee.
        </div>

        <Step n={1} label="Who">
          <label style={styles.fieldLabel}>Trainee name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" style={styles.input} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16 }}>
            <label style={styles.fieldLabel}>Department & shift</label>
            <button onClick={onManageDepartments} style={styles.linkBtn}>Manage departments</button>
          </div>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={styles.select}>
            {(departments || []).map((d) => <option key={d}>{d}</option>)}
          </select>
        </Step>

        <Step n={2} label="Skills checklist (auto-assigned)" last>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={onManagePresets} style={styles.linkBtn}>Edit skill presets</button>
          </div>
          {preset.length === 0 ? (
            <div style={{ ...styles.hint, color: "#f59e0b" }}>
              No preset skills are set for {department} yet. Add some from "Edit skill presets" before enrolling.
            </div>
          ) : (
            <>
              <div style={styles.hint}>
                These {preset.length} skills are the preset for <b style={{ color: "#c3cad4" }}>{department}</b> — every trainee in this department gets this checklist automatically.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {preset.map((s) => (
                  <span key={s.id} style={styles.chip}>
                    <span style={styles.mono}>{s.id}</span>
                    <span style={{ color: "#8a95a5" }}>{s.desc}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </Step>

        <div style={{ marginTop: -6 }}>
          <label style={styles.fieldLabel}>Note for the record (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. transferring in from Line 2 with prior experience"
            style={styles.input} />
        </div>
      </div>

      <div style={styles.panel}>
        <SectionLabel>Enrollment preview</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700 }}>{name || "New trainee"}</span>
          <span style={{ color: "#7a869a" }}>·</span>
          <span style={{ color: "#aeb7c4", fontSize: 14 }}>{department}</span>
        </div>
        {preset.length === 0 ? (
          <div style={{ color: "#6b7686", padding: "28px 0", textAlign: "center", fontSize: 14 }}>
            No preset skills for this department — nothing to enroll into yet.
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {preset.map((s) => (
              <div key={s.id} style={styles.lineItem}>
                <span style={{ ...styles.mono, minWidth: 68 }}>{s.id}</span>
                <span style={{ flex: 1, color: "#c3cad4", fontSize: 13, marginLeft: 10 }}>{s.desc}</span>
                <span style={{ color: "#5f6b7c", fontSize: 12 }}>{s.category}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={submit} disabled={!name.trim() || preset.length === 0}
          style={{ ...styles.submitBtn, opacity: (!name.trim() || preset.length === 0) ? 0.4 : 1, cursor: (!name.trim() || preset.length === 0) ? "not-allowed" : "pointer" }}>
          Enroll trainee <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Checkpoints -------------------------------
   Same shape as the warehouse app's Receiving screen.
---------------------------------------------------------------------------- */
function Checkpoints({ state, now, onLog }) {
  const [dept, setDept] = useState("All departments");
  const due = state.trainees
    .filter((t) => t.status !== "Completed")
    .filter((t) => dept === "All departments" || t.department === dept)
    .sort((a, b) => {
      const rank = { "At risk": 0, "Needs support": 1, "On track": 2 };
      const r = rank[a.support] - rank[b.support];
      return r !== 0 ? r : a.enrolledAt - b.enrolledAt;
    });
  const recentlyCompleted = state.trainees.filter((t) => t.status === "Completed").slice(0, 3);

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
      <div style={styles.roleNote}>
        Log the next checkpoint for a trainee here — skills reviewed, attendance, and a note. Completing a checkpoint moves them to the next stage on the training queue.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ color: "#8a95a5", fontSize: 13 }}>Show department:</span>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ ...styles.select, width: "auto", minWidth: 220 }}>
          <option>All departments</option>
          {(state.departments || []).map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {due.length === 0 ? (
        <div style={{ ...styles.panel, textAlign: "center", padding: 44, color: "#7a869a" }}>
          Nothing due{dept !== "All departments" ? ` in ${dept}` : ""}. Enroll a trainee to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {due.map((t) => {
            const s = supportMeta(t.support);
            const doneCount = t.skills.filter((k) => k.done).length;
            return (
              <div key={t.id} style={{ ...styles.card, borderLeft: `5px solid ${s.color}`, flexDirection: "column", alignItems: "stretch", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 17, color: "#fff", fontWeight: 700 }}>{t.name}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 9, background: s.color }} />
                      <span style={{ fontSize: 13, color: s.color, fontWeight: 700 }}>{t.support}</span>
                      <span style={{ color: "#7a869a" }}>·</span>
                      <span style={{ fontSize: 13, color: "#aeb7c4" }}>{t.department}</span>
                    </div>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#8a95a5" }}>
                    <Clock size={14} /> stage: {t.status}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span style={styles.chip}>
                    <span style={styles.mono}>{doneCount}/{t.skills.length}</span>
                    <span style={{ color: "#8a95a5" }}>skills mastered</span>
                  </span>
                  {t.occurrences > 0 && (
                    <span style={styles.chip}>
                      <span style={{ color: "#f59e0b", fontWeight: 700 }}>{t.occurrences}</span>
                      <span style={{ color: "#8a95a5" }}>attendance occurrence{t.occurrences > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </div>
                <button onClick={() => onLog(t.id)} style={{ ...styles.touchBtn, background: s.color, borderColor: s.color, color: "#04120f" }}>
                  <ClipboardCheck size={17} /> Log checkpoint
                </button>
              </div>
            );
          })}
        </div>
      )}

      {recentlyCompleted.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#5f6b7c", fontWeight: 700, marginBottom: 8 }}>Recently completed</div>
          {recentlyCompleted.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #161d26", fontSize: 13, color: "#8a95a5" }}>
              <GraduationCap size={14} color="#10b981" />
              <span style={{ color: "#aeb7c4" }}>{t.name}</span>
              <span>{t.department}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Dashboard ---------------------------------
   Same shape as the warehouse app's Kanban board.
---------------------------------------------------------------------------- */
const SUPPORT_RANK = { "At risk": 0, "Needs support": 1, "On track": 2 };

function Dashboard({ state, now, remove, reset, seed, openPrint, openLog }) {
  const { narrow } = useViewport();
  const active = state.trainees.filter((t) => t.status !== "Completed");
  const atRisk = active.filter((t) => t.support === "At risk").length;
  const dueCheckpoint = active.length;
  const completed = state.trainees.filter((t) => t.status === "Completed").length;

  const columns = STAGES.map((status) => ({
    status,
    trainees: state.trainees
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const r = SUPPORT_RANK[a.support] - SUPPORT_RANK[b.support];
        return r !== 0 ? r : a.enrolledAt - b.enrolledAt;
      }),
  }));

  return (
    <div style={{ width: "100%", maxWidth: 1320, margin: "0 auto" }}>
      <div style={styles.kpiRow} className="no-print">
        <Kpi label="Active trainees" value={active.length} />
        <Kpi label="At risk" value={atRisk} accent="#ef4444" />
        <Kpi label="Checkpoint due" value={dueCheckpoint} accent="#f59e0b" />
        <Kpi label="Completed (180-day)" value={completed} accent="#10b981" />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={seed} style={styles.ghostBtn}>Load demo trainees</button>
          <button onClick={reset} style={styles.ghostBtn}><RotateCcw size={14} /> Reset</button>
        </div>
      </div>

      {state.trainees.length === 0 ? (
        <div style={{ ...styles.panel, textAlign: "center", padding: 48, color: "#7a869a" }}>
          Training queue is empty. Enroll a trainee from <b style={{ color: "#c3cad4" }}>New trainee</b>, or load demo trainees above.
        </div>
      ) : (
        <div style={styles.board(narrow)}>
          {columns.map((col) => (
            <BoardColumn key={col.status} status={col.status} trainees={col.trainees} now={now}
              remove={remove} openPrint={openPrint} openLog={openLog} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardColumn({ status, trainees, now, remove, openPrint, openLog }) {
  const Icon = STAGE_ICON[status];
  const dim = status === "Completed";
  return (
    <div style={styles.boardColumn}>
      <div style={styles.boardColumnHead}>
        <Icon size={15} style={{ color: dim ? "#5f6b7c" : "#5eead4" }} />
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{status}</span>
        <span style={styles.boardCount}>{trainees.length}</span>
      </div>
      <div style={styles.boardColumnBody}>
        {trainees.length === 0 ? (
          <div style={styles.boardEmpty}>Nothing here</div>
        ) : (
          trainees.map((t) => (
            <TraineeCard key={t.id} t={t} now={now} remove={remove} openPrint={openPrint} openLog={openLog} />
          ))
        )}
      </div>
    </div>
  );
}

function TraineeCard({ t, now, remove, openPrint, openLog }) {
  const [confirming, setConfirming] = useState(false);
  const s = supportMeta(t.support);
  const elapsed = now - t.enrolledAt;
  const done = t.status === "Completed";
  const doneCount = t.skills.filter((k) => k.done).length;

  return (
    <div style={{ ...styles.kCard, borderLeft: `4px solid ${s.color}`, opacity: done ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, color: "#fff" }}>{t.name}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#7a869a" }}>
          <Clock size={12} /> {fmtElapsed(elapsed)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color }} />
        <span style={{ fontSize: 12, color: "#8a95a5" }}>{t.support} · {t.department}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
        <span style={{ ...styles.chip, fontSize: 11.5, padding: "2px 7px" }}>
          <span style={styles.mono}>{doneCount}/{t.skills.length}</span>
          <span style={{ color: "#8a95a5" }}>mastered</span>
        </span>
        {t.occurrences > 0 && (
          <span style={{ ...styles.chip, fontSize: 11.5, padding: "2px 7px" }}>
            <AlertTriangle size={11} color="#f59e0b" />
            <span style={{ color: "#8a95a5" }}>{t.occurrences} occ.</span>
          </span>
        )}
      </div>
      {t.note && <div style={{ fontSize: 11.5, color: "#8a95a5", marginTop: 6, fontStyle: "italic" }}>“{t.note}”</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }} className="no-print">
        {!done && (
          <>
            <button onClick={() => openLog(t.id)} style={{ ...styles.kBtn, background: s.color, borderColor: s.color, color: "#04120f" }}>
              <ClipboardCheck size={14} /> Log checkpoint
            </button>
            <button onClick={() => openPrint(t.id)} style={styles.kGhost}><Printer size={14} /> Print checkpoint sheet</button>
          </>
        )}
        {done && (
          <div style={{ ...styles.kGhost, borderStyle: "dashed", color: "#10b981", justifyContent: "center", cursor: "default" }}>
            <GraduationCap size={14} /> 180-day complete
          </div>
        )}

        {!confirming ? (
          <button onClick={() => setConfirming(true)} style={{ ...styles.kGhost, color: "#5f6b7c" }}>Remove trainee</button>
        ) : (
          <div style={{ border: "1px solid #7f1d1d", background: "#2a0f0f", borderRadius: 8, padding: 7 }}>
            <div style={{ fontSize: 11.5, color: "#fca5a5", marginBottom: 6, fontWeight: 600 }}>Remove {t.name}?</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setConfirming(false)} style={{ ...styles.kGhost, flex: 1 }}>Keep</button>
              <button onClick={() => { remove(t.id); setConfirming(false); }}
                style={{ ...styles.kBtn, flex: 1, background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}>
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div style={styles.kpi}>
      <div style={{ fontSize: 12, color: "#7a869a", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: accent || "#eef2f7", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

/* ------------------------------ Print sheet -------------------------------- */
function PrintSheet({ state, initialId }) {
  const printable = state.trainees.filter((t) => t.status !== "Completed");
  const [selId, setSelId] = useState(initialId || printable[0]?.id || null);
  useEffect(() => {
    if (!printable.find((t) => t.id === selId)) setSelId(printable[0]?.id || null);
  }, [state.trainees]); // eslint-disable-line
  const t = state.trainees.find((x) => x.id === selId);

  return (
    <div style={{ width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }} className="no-print">
        <span style={{ color: "#8a95a5", fontSize: 13 }}>Trainee:</span>
        <select value={selId || ""} onChange={(e) => setSelId(e.target.value)} style={{ ...styles.select, width: "auto", minWidth: 260 }}>
          {printable.length === 0 && <option>No active trainees</option>}
          {printable.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.status} — {x.department}</option>)}
        </select>
        <button onClick={() => window.print()} disabled={!t} style={{ ...styles.primaryBtn, opacity: t ? 1 : 0.4 }}>
          <Printer size={16} /> Print sheet
        </button>
        <span style={{ color: "#6b7686", fontSize: 12 }}>Page 1 = skills checklist · Page 2 = trainer / supervisor sign-off.</span>
      </div>

      {!t ? (
        <div style={{ ...styles.panel, textAlign: "center", padding: 40, color: "#7a869a" }}>Nothing to print — enroll a trainee first.</div>
      ) : (
        <div id="sheet" style={styles.sheet}>
          <div style={styles.sheetPage}>
            <div style={styles.sheetHead}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: 2, color: "#555", textTransform: "uppercase" }}>Checkpoint checklist</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#111" }}>{t.name}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 13, color: "#333" }}>
                <div><b>{t.department}</b></div>
                <div>Stage: <b>{t.status}</b></div>
                <div>Enrolled {new Date(t.enrolledAt).toLocaleDateString()}</div>
              </div>
            </div>
            {t.note && <div style={{ margin: "8px 0", fontStyle: "italic", color: "#444" }}>Note: {t.note}</div>}
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Category", "Skill", "Status"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...t.skills].sort((a, b) => a.category.localeCompare(b.category)).map((s) => (
                  <tr key={s.id}>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{s.category}</td>
                    <td style={styles.td}>{s.desc}</td>
                    <td style={{ ...styles.td, textAlign: "center" }}>{s.done ? "✔ Mastered" : "☐ Not yet"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...styles.sheetPage, marginTop: 18, borderTop: "2px dashed #ccc", paddingTop: 18 }}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: "#555", textTransform: "uppercase", marginBottom: 14 }}>
              Checkpoint sign-off — {t.name}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
              <div style={styles.signBox}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 30 }}>Trainer signature</div>
                <div style={{ borderTop: "1px solid #999", paddingTop: 6, fontSize: 12, color: "#888" }}>Date: ____________</div>
              </div>
              <div style={styles.signBox}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 30 }}>Supervisor signature</div>
                <div style={{ borderTop: "1px solid #999", paddingTop: 6, fontSize: 12, color: "#888" }}>Date: ____________</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- Log mode: tablet-friendly checklist walk + sign-off ------------- */
function LogMode({ trainee, onToggleSkill, onComplete, onClose }) {
  const [step, setStep] = useState("skills");
  const [hadOccurrence, setHadOccurrence] = useState(false);
  const [note, setNote] = useState("");
  const s = supportMeta(trainee.support);
  const doneCount = trainee.skills.filter((k) => k.done).length;
  const total = trainee.skills.length;

  return (
    <div style={styles.pickOverlay} className="no-print">
      <div style={styles.pickHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 12, height: 12, borderRadius: 12, background: s.color, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, color: "#fff", fontWeight: 700 }}>{trainee.name}</div>
            <div style={{ fontSize: 12, color: "#8a95a5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {trainee.status} · {trainee.department}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ ...styles.touchGhost, width: "auto", padding: "10px 14px" }}>
          <X size={16} /> Close
        </button>
      </div>

      <div style={styles.pickTabs}>
        <button onClick={() => setStep("skills")} style={{ ...styles.pickTab, ...(step === "skills" ? styles.pickTabOn : {}) }}>
          1 · Skills ({doneCount}/{total})
        </button>
        <button onClick={() => setStep("signoff")} style={{ ...styles.pickTab, ...(step === "signoff" ? styles.pickTabOn : {}) }}>
          2 · Sign off
        </button>
      </div>

      <div style={styles.pickBody}>
        {step === "skills" ? (
          <>
            <div style={{ height: 6, background: "#1b222b", borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ height: "100%", width: `${total ? (doneCount / total) * 100 : 0}%`, background: s.color, transition: "width .2s" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trainee.skills.map((sk) => {
                const on = !!sk.done;
                return (
                  <button key={sk.id} onClick={() => onToggleSkill(sk.id)} style={{ ...styles.pickRow, borderColor: on ? "#14532d" : "#232c37", background: on ? "#0e1f16" : "#0c1117" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, border: `2px solid ${on ? "#22c55e" : "#3a424d"}`, background: on ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {on && <CheckMark size={18} color="#04120f" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left", opacity: on ? 0.6 : 1 }}>
                      <div style={{ fontSize: 15 }}>{sk.desc}</div>
                      <div style={{ fontSize: 12, color: "#7a869a" }}>{sk.category}</div>
                    </div>
                    <span style={styles.mono}>{sk.id}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep("signoff")} style={{ ...styles.touchBtn, background: s.color, borderColor: s.color, color: "#04120f", marginTop: 18 }}>
              Go to sign off <ChevronRight size={18} />
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "#8a95a5", marginBottom: 14 }}>
              Log attendance for this checkpoint window and add a note. Completing the checkpoint moves {trainee.name} to the next stage.
            </div>

            <button onClick={() => setHadOccurrence((v) => !v)}
              style={{ ...styles.pickRow, borderColor: hadOccurrence ? "#7f1d1d" : "#232c37", background: hadOccurrence ? "#2a0f0f" : "#0c1117", marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, border: `2px solid ${hadOccurrence ? "#ef4444" : "#3a424d"}`, background: hadOccurrence ? "#ef4444" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {hadOccurrence && <CheckMark size={18} color="#fff" />}
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontSize: 15 }}>Attendance occurrence this window</div>
                <div style={{ fontSize: 12, color: "#7a869a" }}>Currently {trainee.occurrences} on record — 3+ flags "At risk"</div>
              </div>
            </button>

            <label style={styles.fieldLabel}>Checkpoint note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you observe this checkpoint?"
              style={styles.input} />

            <button onClick={() => { onComplete({ note, hadOccurrence }); onClose(); }}
              style={{ ...styles.touchBtn, background: "#22c55e", borderColor: "#22c55e", color: "#04120f", marginTop: 18 }}>
              <ClipboardCheck size={18} /> Complete checkpoint &amp; advance
            </button>
            <button onClick={() => setStep("skills")} style={{ ...styles.touchGhost, marginTop: 8 }}>
              <ChevronLeft size={16} /> Back to skills
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* -------- Manage departments (same shape as ManageLines) ------------------ */
function ManageDepartments({ departments, onAdd, onRemove, onClose }) {
  const [name, setName] = useState("");
  const submit = () => { onAdd(name); setName(""); };
  return (
    <div style={styles.overlay} onClick={onClose} className="no-print">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Departments</div>
          <button onClick={onClose} style={styles.iconBtn}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "#8a95a5", marginBottom: 14, lineHeight: 1.5 }}>
          These fill the "Department & shift" dropdown when enrolling a trainee. A new department starts with its family's default skill preset — adjust it from "Edit skill presets."
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {departments.map((d) => (
            <div key={d} style={styles.lineRow}>
              <span style={{ fontSize: 14 }}>{d}</span>
              <button onClick={() => onRemove(d)} disabled={departments.length <= 1}
                title={departments.length <= 1 ? "Keep at least one department" : "Remove"}
                style={{ ...styles.iconBtn, color: departments.length <= 1 ? "#3a424d" : "#c66", cursor: departments.length <= 1 ? "not-allowed" : "pointer" }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <label style={styles.fieldLabel}>Add a department</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="e.g. VicFlex — 3rd Shift" style={{ ...styles.input, flex: 1 }} />
          <button onClick={submit} disabled={!name.trim()} style={{ ...styles.primaryBtn, opacity: name.trim() ? 1 : 0.4 }}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------- Edit skill presets by department --------------------------------
   Pick a department, then toggle which catalog skills are relevant to it.
   This IS the preset that enrollment reads from — no per-trainee editing.
---------------------------------------------------------------------------- */
function ManagePresets({ departments, skills, deptSkills, onToggle, onManageSkills, onClose }) {
  const [dept, setDept] = useState(departments[0]);
  useEffect(() => { if (!departments.includes(dept)) setDept(departments[0]); }, [departments]); // eslint-disable-line
  const included = new Set((deptSkills && deptSkills[dept]) || []);
  const byCategory = useMemo(() => {
    const groups = {};
    skills.forEach((s) => { (groups[s.category || "Other"] = groups[s.category || "Other"] || []).push(s); });
    return groups;
  }, [skills]);

  return (
    <div style={styles.overlay} onClick={onClose} className="no-print">
      <div style={{ ...styles.modal, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Skill presets by department</div>
          <button onClick={onClose} style={styles.iconBtn}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "#8a95a5", marginBottom: 14, lineHeight: 1.5 }}>
          Check the skills relevant to this department. Every trainee enrolled here gets exactly this checklist.
          Need a skill that doesn't exist yet? <button onClick={onManageSkills} style={styles.linkBtn}>Add it to the catalog</button> first.
        </div>

        <label style={styles.fieldLabel}>Department</label>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ ...styles.select, marginBottom: 14 }}>
          {(departments || []).map((d) => <option key={d}>{d}</option>)}
        </select>

        <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.keys(byCategory).map((cat) => (
            <div key={cat}>
              <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#5f6b7c", fontWeight: 700, marginBottom: 6 }}>{cat}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {byCategory[cat].map((s) => {
                  const on = included.has(s.id);
                  return (
                    <button key={s.id} onClick={() => onToggle(dept, s.id)}
                      style={{ ...styles.lineRow, justifyContent: "flex-start", gap: 10, cursor: "pointer", border: `1px solid ${on ? "#14532d" : "#1f2731"}`, background: on ? "#0e1f16" : "#0c1117" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${on ? "#22c55e" : "#3a424d"}`, background: on ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <CheckMark size={14} color="#04120f" />}
                      </div>
                      <span style={styles.mono}>{s.id}</span>
                      <span style={{ color: "#8a95a5", fontSize: 13 }}>{s.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------- Manage skills catalog (same shape as ManageParts) --------------- */
function ManageSkills({ skills, onAdd, onRemove, onSetSkills, onClose }) {
  const [id, setId] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [bulk, setBulk] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const cleanRow = (a, b, c) => ({ id: (a || "").trim(), desc: (b || "").replace(/\s+/g, " ").trim(), category: (c || "").trim() });
  const isHeader = (v) => /^(id|skill|code)$/i.test(v);

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const res = Papa.parse(String(reader.result), { skipEmptyLines: true });
        const rows = res.data.map((r) => cleanRow(r[0], r[1], r[2])).filter((x) => x.id && !isHeader(x.id));
        if (rows.length) { onSetSkills(rows, "replace"); setMsg(`Loaded ${rows.length} skills from ${file.name}.`); }
        else setMsg("No skills found in that file.");
      } catch (err) { setMsg("Couldn't read that file."); }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const parseBulk = () =>
    bulk.split("\n").map((l) => {
      const line = l.replace(/\r$/, "");
      const f = (line.includes("\t") ? line.split("\t") : line.split(",")).map((x) => x.trim());
      return { id: f[0] || "", desc: (f[1] || "").trim(), category: (f[2] || "").trim() };
    }).filter((r) => r.id && r.id.toLowerCase() !== "id");

  const doReplace = () => { const rows = parseBulk(); if (rows.length) { onSetSkills(rows, "replace"); setBulk(""); } };
  const doAppend = () => { const rows = parseBulk(); if (rows.length) { onSetSkills(rows, "append"); setBulk(""); } };
  const addOne = () => { if (id.trim()) { onAdd({ id, desc, category }); setId(""); setDesc(""); setCategory(""); } };

  const shown = q.trim() ? skills.filter((s) => (s.id + " " + s.desc + " " + s.category).toLowerCase().includes(q.trim().toLowerCase())) : skills;

  return (
    <div style={styles.overlay} onClick={onClose} className="no-print">
      <div style={{ ...styles.modal, maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Skills catalog ({skills.length})</div>
          <button onClick={onClose} style={styles.iconBtn}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "#8a95a5", marginBottom: 14, lineHeight: 1.5 }}>
          The master list of checklist items. To decide which apply to which department, use "Edit skill presets" instead — this screen only manages the catalog itself.
        </div>

        <SectionLabel>Load from file</SectionLabel>
        <div style={{ fontSize: 12, color: "#8a95a5", marginBottom: 8 }}>
          Pick a CSV file (columns: <span style={styles.mono}>id, description, category</span>). This replaces the whole catalog.
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={onFile} style={{ display: "none" }} />
        <button onClick={() => fileRef.current && fileRef.current.click()} style={styles.primaryBtn}>Choose CSV file…</button>
        {msg && <div style={{ fontSize: 12.5, color: "#5eead4", marginTop: 8 }}>{msg}</div>}

        <div style={{ height: 1, background: "#1b222b", margin: "16px 0" }} />

        <SectionLabel>Bulk paste</SectionLabel>
        <div style={{ fontSize: 12, color: "#8a95a5", marginBottom: 6 }}>
          One skill per line: <span style={styles.mono}>id, description, category</span>. Commas or tabs.
        </div>
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5}
          placeholder={"SAF-05, Fire extinguisher location, Safety\nOPS-05, Second machine cross-train, Machine Ops"}
          style={{ ...styles.input, width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12.5, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={doReplace} disabled={!bulk.trim()} style={{ ...styles.primaryBtn, opacity: bulk.trim() ? 1 : 0.4 }}>Replace catalog</button>
          <button onClick={doAppend} disabled={!bulk.trim()} style={{ ...styles.touchGhost, width: "auto", padding: "10px 16px" }}>Add to catalog</button>
        </div>

        <div style={{ height: 1, background: "#1b222b", margin: "16px 0" }} />

        <SectionLabel>Current skills</SectionLabel>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" style={{ ...styles.input, marginBottom: 8 }} />
        <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
          {shown.length === 0 && <div style={{ color: "#6b7686", fontSize: 13, padding: 6 }}>No skills{skills.length ? " match the filter" : " yet — import or add below"}.</div>}
          {shown.slice(0, 100).map((s) => (
            <div key={s.id} style={styles.lineRow}>
              <div style={{ minWidth: 0 }}>
                <span style={styles.mono}>{s.id}</span>
                <span style={{ color: "#8a95a5", fontSize: 13, marginLeft: 8 }}>{s.desc}</span>
                {s.category ? <span style={{ color: "#5f6b7c", fontSize: 12, marginLeft: 8 }}>{s.category}</span> : null}
              </div>
              <button onClick={() => onRemove(s.id)} title="Remove" style={{ ...styles.iconBtn, color: "#c66" }}><Trash2 size={15} /></button>
            </div>
          ))}
          {shown.length > 100 && <div style={{ color: "#6b7686", fontSize: 12, padding: 6 }}>Showing 100 of {shown.length} — type in the filter to narrow.</div>}
        </div>

        <div style={{ height: 1, background: "#1b222b", margin: "16px 0" }} />

        <SectionLabel>Add one skill</SectionLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Skill code" style={{ ...styles.input, flex: "1 1 100px" }} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" style={{ ...styles.input, flex: "2 1 180px" }} />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" style={{ ...styles.input, flex: "1 1 100px" }} />
          <button onClick={addOne} disabled={!id.trim()} style={{ ...styles.primaryBtn, opacity: id.trim() ? 1 : 0.4 }}><Plus size={16} /> Add</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- styles ---------------------------------- */
const sans = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
const styles = {
  shell: { minHeight: "100vh", width: "100%", background: "#0c0f14", color: "#dfe5ec", fontFamily: sans, display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", gap: 20, padding: "12px 20px", borderBottom: "1px solid #1b222b", background: "#0f141b", position: "sticky", top: 0, zIndex: 10 },
  logoMark: { width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#0e766e,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#001", fontSize: 18, fontWeight: 900 },
  body: { flex: 1, padding: "26px 20px", display: "flex", flexDirection: "column" },
  tabBtn: { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, border: "1px solid transparent", background: "transparent", color: "#8a95a5", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  tabBtnActive: { background: "#14b8a611", borderColor: "#14b8a655", color: "#5eead4" },
  badge: { background: "#ef4444", color: "#fff", borderRadius: 20, fontSize: 11, padding: "1px 7px", fontWeight: 800 },
  panel: { background: "#0f141b", border: "1px solid #1b222b", borderRadius: 14, padding: 20 },
  fieldLabel: { display: "block", fontSize: 13, color: "#8a95a5", marginBottom: 6 },
  select: { width: "100%", padding: "10px 12px", borderRadius: 8, background: "#0c1117", border: "1px solid #262f3a", color: "#e6ebf1", fontSize: 14, outline: "none" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, background: "#0c1117", border: "1px solid #262f3a", color: "#e6ebf1", fontSize: 14, outline: "none", boxSizing: "border-box" },
  hint: { fontSize: 12.5, color: "#7a869a", background: "#0c1117", border: "1px solid #1b222b", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5 },
  dropdown: { marginTop: 8, border: "1px solid #262f3a", borderRadius: 8, overflowY: "auto", maxHeight: 280, background: "#0c1117" },
  optionRow: { display: "flex", alignItems: "center", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderBottom: "1px solid #161d26", color: "#dfe5ec", cursor: "pointer", textAlign: "left" },
  mono: { fontFamily: "ui-monospace, Menlo, Consolas, monospace", letterSpacing: 0.5, color: "#7fe3d6" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8, background: "#14b8a6", border: "1px solid #14b8a6", color: "#00201d", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  touchBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px 14px", borderRadius: 9, border: "1px solid", fontWeight: 700, fontSize: 15, cursor: "pointer", minHeight: 46 },
  touchGhost: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 14px", borderRadius: 9, background: "transparent", border: "1px solid #2a323c", color: "#aeb7c4", fontWeight: 600, fontSize: 14, cursor: "pointer", minHeight: 44 },
  roleNote: { fontSize: 12.5, color: "#9fd3cb", background: "#0e2b28", border: "1px solid #14453f", borderRadius: 8, padding: "9px 11px", marginBottom: 16, lineHeight: 1.5 },
  linkBtn: { background: "transparent", border: "none", color: "#5cc9bd", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" },
  overlay: { position: "fixed", inset: 0, background: "rgba(4,7,11,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  modal: { width: "100%", maxWidth: 440, background: "#0f141b", border: "1px solid #232c37", borderRadius: 14, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,.5)" },
  lineRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c1117", border: "1px solid #1f2731", borderRadius: 8, padding: "9px 8px 9px 12px" },
  pickOverlay: { position: "fixed", inset: 0, background: "#0c0f14", zIndex: 60, display: "flex", flexDirection: "column" },
  pickHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: "1px solid #1b222b", background: "#0f141b" },
  pickTabs: { display: "flex", gap: 8, padding: "12px 16px 0" },
  pickTab: { flex: 1, padding: "12px", borderRadius: "9px 9px 0 0", border: "1px solid #1b222b", borderBottom: "none", background: "#0f141b", color: "#8a95a5", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  pickTabOn: { background: "#131a22", color: "#5eead4", borderColor: "#22333a" },
  pickBody: { flex: 1, overflowY: "auto", padding: "18px 16px 28px", maxWidth: 620, width: "100%", margin: "0 auto" },
  pickRow: { display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 11, border: "1px solid", cursor: "pointer", width: "100%", minHeight: 64 },
  submitBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 18, padding: "13px", borderRadius: 10, background: "#14b8a6", border: "none", color: "#00201d", fontWeight: 800, fontSize: 15 },
  iconBtn: { background: "transparent", border: "none", color: "#5f6b7c", cursor: "pointer", padding: 4, marginLeft: 6 },
  lineItem: { display: "flex", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #161d26" },
  kpiRow: { display: "flex", gap: 12, marginBottom: 16, alignItems: "stretch", flexWrap: "wrap" },
  kpi: { background: "#0f141b", border: "1px solid #1b222b", borderRadius: 12, padding: "12px 16px", minWidth: 120 },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "1px solid #262f3a", color: "#aeb7c4", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  card: { display: "flex", gap: 16, alignItems: "flex-start", background: "#0f141b", border: "1px solid #1b222b", borderRadius: 12, padding: 16 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "#0c1117", border: "1px solid #222c37", borderRadius: 7, padding: "3px 9px", fontSize: 13 },
  sheet: { background: "#fff", color: "#111", borderRadius: 8, padding: 34, boxShadow: "0 10px 40px rgba(0,0,0,.4)" },
  sheetPage: {},
  sheetHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #111", paddingBottom: 10 },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 12 },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#666", borderBottom: "1.5px solid #ccc", padding: "7px 8px" },
  td: { padding: "9px 8px", borderBottom: "1px solid #eee", fontSize: 14, color: "#222", verticalAlign: "top" },
  navGroup: { display: "flex", alignItems: "center", gap: 6 },
  navGroupLabel: { fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#5f6b7c", fontWeight: 700, padding: "0 4px 0 6px" },
  navDivider: { width: 1, height: 22, background: "#232c37", margin: "0 8px" },
  board: (narrow) => ({ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(4, minmax(0,1fr))", gap: 14, alignItems: "start" }),
  boardColumn: { background: "#0f141b", border: "1px solid #1b222b", borderRadius: 12, display: "flex", flexDirection: "column", minHeight: 140 },
  boardColumnHead: { display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #1b222b" },
  boardCount: { marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#7a869a", background: "#0c1117", border: "1px solid #232c37", borderRadius: 20, padding: "1px 8px" },
  boardColumnBody: { padding: 10, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: "calc(100vh - 300px)" },
  boardEmpty: { color: "#4b5563", fontSize: 12.5, textAlign: "center", padding: "20px 6px" },
  kCard: { background: "#0c1117", border: "1px solid #1b222b", borderRadius: 10, padding: 12 },
  kBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 10px", borderRadius: 7, border: "1px solid", fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  kGhost: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 7, background: "transparent", border: "1px solid #2a323c", color: "#aeb7c4", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  stepRow: { display: "flex", gap: 14 },
  stepRail: { display: "flex", flexDirection: "column", alignItems: "center", width: 26, flexShrink: 0 },
  stepDot: { width: 24, height: 24, borderRadius: 24, background: "#14b8a622", border: "1.5px solid #14b8a6", color: "#5eead4", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepLine: { flex: 1, width: 2, background: "#1f2731", marginTop: 4, minHeight: 24 },
  stepContent: { flex: 1, paddingBottom: 26, minWidth: 0 },
  stepLabel: { fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", color: "#5cc9bd", fontWeight: 700, marginBottom: 10 },
  signBox: { border: "1px solid #ddd", borderRadius: 8, padding: "14px 14px 10px" },
};
