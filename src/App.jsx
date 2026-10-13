import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Papa from "papaparse";
import {
  ClipboardList, ClipboardCheck, UserPlus, GraduationCap, PlayCircle,
  UserCheck, AlertTriangle, Clock, RotateCcw, ChevronRight, ChevronLeft,
  X, Settings, Plus, Trash2, Printer, Monitor, Sun, Moon, Download, Users, Lock, Unlock,
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
   - HOME is a list of training specialists only. Click one to see their trainees and
     progress. Adding specialists and editing trainee start dates live on a separate,
     password-protected Admin page.
   - Check-ins are biweekly (from the trainee's start date). Performance evaluations
     (the six-area ratings) happen ONLY at stage reviews and the final evaluation.
     Moving between stages is a decision made at a stage review (minimum time +
     skills % + sign-off), not an automatic date. The 180-day completion stays fixed.
   - Every time a skill is marked mastered, an optional comment can be added (and
     added or edited later).
   - Attendance is not tracked. Support level is the specialist's own judgment,
     set at each checkpoint, alongside performance notes.
   ===================================================================== */

/* ------------------------------- Helpers ---------------------------------- */
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
   Skill catalog transcribed from the facility's official standard:
     New_Hire_Skill_Assessment_Checklist_Standard.xlsx

   Every department tab in that workbook shares the same seven common
   sections (Safety & Workplace Conduct, Workplace Organization (5S),
   Tools, Process Documentation, Quality, Productivity & Independence,
   Reliability) — transcribed once below and shared by every preset —
   plus its own "Task Specific" sections, which are transcribed under
   department-prefixed ids:
     STD Heads      → SH-*   (workbook tab "Fire Safety")
     Saws           → SW-*
     VicFlex        → VF-*
     VicDry         → VD-*   (workbook tab "VF Dry")
     Dry Sprinkler  → DS-*
     Koil Kit       → KK-*
---------------------------------------------------------------------------- */
const DEPARTMENTS_DEFAULT = [
  "STD Heads — 1st Shift",
  "STD Heads — 3rd Shift",
  "Saws — 1st Shift",
  "Saws — 2nd Shift",
  "VicFlex — 1st Shift",
  "VicFlex — 2nd Shift",
  "VicDry — 1st Shift",
  "Dry Sprinkler — 1st Shift",
  "Koil Kit — 1st Shift",
];

const SKILLS_DATA = [
  // ---- Shared across every department tab ----
  ["SAF-01", "Review of required PPE, HP 20/20/20, Machine Safety, E-stops", "Safety & Workplace Conduct"],
  ["SAF-02", "Understands JSA, and any pertinent OML's", "Safety & Workplace Conduct"],
  ["SAF-03", "Knows emergency evacuations, muster points, and shelter-in-place areas", "Safety & Workplace Conduct"],
  ["SAF-04", "Company policies — dress code (jewelry, hair, hoods, undergarments); no drinks/food on floor", "Safety & Workplace Conduct"],
  ["SAF-05", "Knows location of fire extinguishers and eyewash stations", "Safety & Workplace Conduct"],
  ["SAF-06", "Understands importance of reporting injuries, near-misses, and hazards to supervisor or safety", "Safety & Workplace Conduct"],

  ["FIVE-01", "Returns tools to shadow boards; nothing missing at shift end", "Workplace Organization (5S)"],
  ["FIVE-02", "All components labeled and stored properly — bins, shelves, WIP, finished goods", "Workplace Organization (5S)"],
  ["FIVE-03", "Maintains clean, orderly workbench; brooms kept in proper storage areas; TPMs", "Workplace Organization (5S)"],
  ["FIVE-04", "Follows standard work location for materials and tools", "Workplace Organization (5S)"],

  ["TL-01", "Review of the tools used in each work cell", "Tools"],
  ["TL-02", "Hand tool safety", "Tools"],
  ["TL-03", "Use the right tool for the job", "Tools"],
  ["TL-04", "Do not use torque wrenches to loosen threads", "Tools"],
  ["TL-05", "Do not modify tools", "Tools"],
  ["TL-06", "Broken tools should be reported to supervisor", "Tools"],
  ["TL-07", "Uses pliers and snips correctly", "Tools"],

  ["PD-01", "Review of the traveler information, parts produced, sign-offs", "Process Documentation"],
  ["PD-02", "Review of any OMLs in work cell", "Process Documentation"],
  ["PD-03", "Verify correct parts are being used according to the traveler/BOM", "Process Documentation"],
  ["PD-04", "Kanbans, linearity sheets", "Process Documentation"],

  ["QA-01", "Review of method sheets (digital or paper); understands quality standard for the part/task", "Quality"],
  ["QA-02", "Performs required self-checks and in-process inspection", "Quality"],
  ["QA-03", "Records quality data / completes documentation accurately", "Quality"],
  ["QA-04", "Completes hourly linearity sheets", "Quality"],
  ["QA-05", "Understands the finished product they are making and how it works", "Quality"],

  ["PI-01", "Works at a steady, safe pace toward standard rate", "Productivity & Independence"],
  ["PI-02", "Requires decreasing supervision on routine tasks", "Productivity & Independence"],
  ["PI-03", "Manages time and keeps up with line/flow demand", "Productivity & Independence"],
  ["PI-04", "Asks appropriate questions; applies feedback", "Productivity & Independence"],

  ["REL-01", "Arrives on time and ready at shift start and after breaks", "Reliability"],
  ["REL-02", "Consistent attendance during training period", "Reliability"],
  ["REL-03", "Communicates absences per policy", "Reliability"],

  // ---- STD Heads (workbook tab "Fire Safety") ----
  ["SH-01", "Verify components, rivet deflector to frame; inspect for cracked/deformed rivets — diameter .330\" min, height .020\" min; torque wrench check not to exceed 17 in-lbs", "Rivet & Tap of Sprinkler"],
  ["SH-02", "Check alignment using comparator in QA dept — alignment must meet drawing tolerance", "Rivet & Tap of Sprinkler"],
  ["SH-03", "Tap selection — always use H5 taps unless otherwise specified; ensure tap aligned with hole and goes down completely through frame; vacuum on to evacuate chips/debris", "Rivet & Tap of Sprinkler"],
  ["SH-04", "Thread inspection — use 10-32 UNF Go/No-Go gage; Go gage must pass freely through entire frame; No-Go cannot turn more than 3 turns", "Rivet & Tap of Sprinkler"],
  ["SH-05", "Threads inspected and results documented on Form-0526 every 30 minutes; alignment checked once per hour; hand vacuum to keep cell free of chips; tap change when needed", "Rivet & Tap of Sprinkler"],
  ["SH-06", "Verify Kanban and BOM, obtain parts kitted by warehouse; team uses the \"Waffle House\" technique to verify all components are correct on BOM", "Manual Std Head Assembly"],
  ["SH-07", "Scan the Kanban barcode to display the part on the HUD and verify it matches the current build", "Manual Std Head Assembly"],
  ["SH-08", "General component information — pip cap types (F, D, B); bulb temperatures/colors, quick/std, and marking; deflector stampings and alignment dots; frame stampings including dates", "Manual Std Head Assembly"],
  ["SH-09", "Place the Frame/Deflector sub-assembly on the assembly fixture post; ensure part sits on fixture correctly", "Manual Std Head Assembly"],
  ["SH-10", "Take pip cap and visually inspect for any seal damage; place the seal on the frame seat", "Manual Std Head Assembly"],
  ["SH-11", "Pick up bulb and apply grease on the round end (not too much); place bulb tip down inside pip cap", "Manual Std Head Assembly"],
  ["SH-12", "Insert load screw into tapped hole in top of frame — screw must have the torx side up", "Manual Std Head Assembly"],
  ["SH-13", "Using Kolver driver, select the appropriate program for the K-factor of sprinkler being built", "Manual Std Head Assembly"],
  ["SH-14", "Bring driver down to insert tip in screw; pull trigger to complete program without excessive force; program complete when display is green — if red, back screw out and replace bulb, screw, and pip cap", "Manual Std Head Assembly"],
  ["SH-15", "Assemble the lodgement spring if applicable — load onto spring tool, press around fixture post until it snaps into place, insert around pip cap, ensure it hooks into frame arms", "Manual Std Head Assembly"],
  ["SH-16", "Place assembled sprinkler into the leak tester, close protective cover — green light = passed, red light = failed; if fail, rotate and re-leak once, break down if it fails a 2nd time", "Manual Std Head Assembly"],
  ["SH-17", "Quality alert — do not let sprinklers pile up at leak tester; use one-piece flow", "Manual Std Head Assembly"],
  ["SH-18", "Bubble-test passed parts on the Microbite — green smiley = pass, red smiley = fail (failed part auto-ejected)", "Manual Std Head Assembly"],
  ["SH-19", "Apply Loctite to the cavity on top of frame without overfilling; clean off any excess", "Manual Std Head Assembly"],
  ["SH-20", "Apply the correct bulb protector per BOM, add instruction sheet, and place in box", "Manual Std Head Assembly"],
  ["SH-21", "For grooved sprinklers, press the appropriate coupling onto the grooved end before boxing", "Manual Std Head Assembly"],
  ["SH-22", "Verify label is correct, place on end of box (never pre-label); seal box with tape and place on skid", "Manual Std Head Assembly"],
  ["SH-23", "Build and test sprinkler per Std Head Assembly instructions above; verify components", "Concealed Std Head Assembly"],
  ["SH-24", "Flip sprinkler and insert the appropriate pins; place assembly in cup and ensure it seats properly, place in fixture with pins up, rivet pins", "Concealed Std Head Assembly"],
  ["SH-25", "Inspect rivet pins — cannot be smashed or off-center, pins cannot spin, deflector must move up and down freely (place frame on deflector, it should drop)", "Concealed Std Head Assembly"],
  ["SH-26", "Rivets must measure .108\" min diameter and .020\" min depth", "Concealed Std Head Assembly"],
  ["SH-27", "Inspect cups — must be fully crimped, cannot slide on frame, cannot be crimped crooked", "Concealed Std Head Assembly"],
  ["SH-28", "Note: V31 — ensure deflector pins align with slots in the cup", "Concealed Std Head Assembly"],
  ["SH-29", "Apply protective cover per BOM, add instruction sheet, place in box", "Concealed Std Head Assembly"],
  ["SH-30", "Verify label is correct, place on end of box (never pre-label); seal box with tape and place on skid", "Concealed Std Head Assembly"],

  // ---- Saws ----
  ["SW-01", "Understands Kanban and order sequence; fills in required information on the Traceability Log", "Operation"],
  ["SW-02", "Performs shift start-up TPM / inspects blades, track, and harpoon", "Operation"],
  ["SW-03", "To start up or load a hose reel — power on, select Manual Mode on saw screen, press Back Arrow on track, turn switch to run reel in reverse", "Operation"],
  ["SW-04", "Rotate knob and release pressure, lower reel to ground; unclamp hose reel by pressing both buttons on side of controller; remove hose reel", "Operation"],
  ["SW-05", "Replace the reel — turn switch to forward, press both buttons to clamp reel, tighten/close pressure relief knob; use handle to pump reel up into position", "Operation"],
  ["SW-06", "Unwrap hose and feed into rollers and saw; press track-forward arrow to advance hose until green light comes on, showing ready to cut", "Operation"],
  ["SW-07", "Enter style of hose and total pieces required on screen; press Start Cycle, then Green Cut, then Main — machine cycles until parts counter is complete", "Operation"],
  ["SW-08", "Verify hose length using scale inside trough; check both ends for cut quality (braid formed over ends, not loose — refer to Hose Quality Shadow Board if needed); do not drop hose into bin, braid can come loose", "Operation"],
  ["SW-09", "On a Machine Fault Alarm — press Alarm button (top right), Clear (bottom left), then Abort; press Start Cycle to resume", "Operation"],
  ["SW-10", "Complete end-of-shift TPM and Daily Production Report — hourly count, total cuts, hose length, bad cuts/scrap, and downtime", "Operation"],
  ["SW-11", "At the saw kiosk, select the saw and click \"Start New Bin\"; scan Kanban ID barcode, click next; scan Product Code, click next; scan Quantity, click finish", "Scan Kanban for Hose Bin"],
  ["SW-12", "Scan ID badge on badge reader, click \"Understood\"", "Scan Kanban for Hose Bin"],
  ["SW-13", "Label must be removed from reel — click Scan Reel, position label under camera, click Scan Sheet, confirm info scanned correctly, click Confirm and Continue", "Scan Kanban for Hose Bin"],
  ["SW-14", "If needed, click Add Rewelds, type quantity of hoses, click Submit — production can now start", "Scan Kanban for Hose Bin"],
  ["SW-15", "Understands hose end condition standard", "Hose Inspection"],
  ["SW-16", "Knows how to measure length correctly", "Hose Inspection"],
  ["SW-17", "Understands not to drop hose into bin", "Hose Inspection"],
  ["SW-18", "Completes traveler fully and correctly", "Hose Inspection"],
  ["SW-19", "Joins reel head to tail", "Hose Inspection"],
  ["SW-20", "Knows how to break down reels", "Hose Inspection"],

  // ---- VicFlex ----
  ["VF-01", "Operator TPM performed at start of shift — replace seals with correct tool, vacuum chambers, wipe down seals", "Manual Leak Test"],
  ["VF-02", "Ensure hoses have been annealed; inspect for damaged/loose braid and damaged weld ends; place hose into chamber with ends snapped into universal fittings", "Manual Leak Test"],
  ["VF-03", "Activate the leak tester by pressing the white button for the appropriate chamber to start test", "Manual Leak Test"],
  ["VF-04", "Reads test result — Green ✓ = passed leak, Red X = failed leak", "Manual Leak Test"],
  ["VF-05", "If a hose fails leak test, mark a white \"X\" on the collar with the Nicobraz marker while in the tester, then place in the appropriate bin — 1st-time fail goes to Blue Bin, a reweld with \"Black X\" that fails again goes to Red Bin", "Manual Leak Test"],
  ["VF-06", "Blue Bin hoses are taken by the Group Leader to the Reweld Bin; Red Bin hoses are brought to the Scrap Bin outside QA", "Manual Leak Test"],
  ["VF-07", "Hose that passes leak — place in laser engraver, scan Kanban for correct program, press start; yellow light flashes when engraving complete; verify laser engraving per traveler", "Manual Leak Test"],
  ["VF-08", "Add split spacer and gasket to the weld end on both ends of the hose", "Manual Leak Test"],
  ["VF-09", "Place nut on hose (hex side out), press into crimper until magnet pulls nut; crimping cycle begins and crimper releases hose automatically when complete — crimp both ends", "Manual Leak Test"],
  ["VF-10", "Inspect the crimp nut visually — crimp marks uniform around nut, nut moves freely when pushed/pulled, O-rings present and not cut or damaged", "Manual Leak Test"],
  ["VF-11", "No hoses shall be left in the Leak Test Chamber or at the Laser/Crimper when leaving the work station — all hoses must be in a finished state", "Manual Leak Test"],
  ["VF-12", "Assemble the correct reducer onto the engraved end of the hose until snug against gaskets", "Packing for Branch Orders"],
  ["VF-13", "Assemble branch line nipple on opposite end of hose until snug against gasket; ensure plastic cap covers NPT threads — if either nipple does not tighten up, check for missing gaskets", "Packing for Branch Orders"],
  ["VF-14", "Assemble box for the correct size hose, pack 10 hoses per box, alternate direction of ends; AB6 hoses require a Red Cap placed over the open nut to hold", "Packing for Branch Orders"],
  ["VF-15", "Place 1 bag of zip ties in box, fold box closed and tape as required; verify label is correct and apply to end of box, write clock number on top right of label", "Packing for Branch Orders"],
  ["VF-16", "Place boxes on the appropriate pallet; place Kanban on order when complete", "Packing for Branch Orders"],

  // ---- VicDry (workbook tab "VF Dry") ----
  ["VD-01", "Verify components, rivet deflector to frame; inspect for cracked/deformed rivets — diameter .330\" min, height .020\" min; torque wrench check not to exceed 17 in-lbs", "Rivet & Tap of Sprinkler"],
  ["VD-02", "Check alignment using comparator in QA dept — alignment must meet drawing tolerance", "Rivet & Tap of Sprinkler"],
  ["VD-03", "Tap selection — always use H5 taps unless otherwise specified; ensure tap aligned with hole and goes down completely through frame; vacuum evacuates chips/debris from tapping process", "Rivet & Tap of Sprinkler"],
  ["VD-04", "Thread inspection — use 10-32 UNF Go/No-Go gage; Go gage must pass freely through entire frame; No-Go cannot turn more than 3 turns", "Rivet & Tap of Sprinkler"],
  ["VD-05", "Threads inspected and results documented on Form-0526 every 30 minutes; alignment checked once per hour; hand vacuum to keep cell free of chips; tap change when needed", "Rivet & Tap of Sprinkler"],
  ["VD-06", "Parts and paperwork must match — gather components for Quick vs. Std, escutcheon or cups per order", "Outlet Sub Assembly"],
  ["VD-07", "Use correct Quick/Std fixture, place split bushings in frame aligned with frame arms", "Outlet Sub Assembly"],
  ["VD-08", "Place pip cap in split spacer bushing, aligned with slots and frame arms", "Outlet Sub Assembly"],
  ["VD-09", "Place bearing (non-rivet side) on top of pip cap; install socket head screw using 11 in-oz driver, tighten until driver \"clicks\"", "Outlet Sub Assembly"],
  ["VD-10", "Apply glue to frame threads, place escutcheon/cup/sleeve (if required) on outlet tube and hand tighten — no glue inside tube", "Outlet Sub Assembly"],
  ["VD-11", "Load outlet frame assembly into chuck and tighten to 20 ft-lbs — threads should bottom out and escutcheon/cup should not rotate", "Outlet Sub Assembly"],
  ["VD-12", "Thread outlet assembly onto adapter, load into arbor press fixture with frame arms parallel to front", "Outlet Assembly"],
  ["VD-13", "Load bushing and spring sub-assembly into adapter — notch in bushing and cable assembly must align with frame arms", "Outlet Assembly"],
  ["VD-14", "Insert snap ring (rounded side down) using snap ring pliers until it rests on cable retainer", "Outlet Assembly"],
  ["VD-15", "Place spring plunger over cable and align notch with cable retainer", "Outlet Assembly"],
  ["VD-16", "Press handle down on arbor press until snap ring engages the groove and releases the plunger", "Outlet Assembly"],
  ["VD-17", "If the plunger does not release it is a bad part — do not apply excess force, it will not correct the problem", "Outlet Assembly"],
  ["VD-18", "Inspect the inside of the assembly — ensure snap ring is seated in groove, spring/cable assembly and bushing are aligned with frame arms", "Outlet Assembly"],
  ["VD-19", "Place 10 hoses on table and verify gaskets in both ends — no more than 10 at a time", "Outlet Assembly"],
  ["VD-20", "Pull cable through hose — hose markings must be on opposite side of outlet", "Outlet Assembly"],
  ["VD-21", "Apply glue to threads of outlet and tighten; use torque wrench and tighten to 20 ft-lbs", "Outlet Assembly"],
  ["VD-22", "Place long SS load screw through the back center hole of screen; apply nut and tighten", "Inlet Sub Assembly"],
  ["VD-23", "Place assembled screen into the inlet frame", "Inlet Sub Assembly"],
  ["VD-24", "Install retaining ring in groove; lubricate inlet frame O-ring and install in O-ring groove; inspect for no cuts or damage", "Inlet Sub Assembly"],
  ["VD-25", "Place frame on assembly post, align frame arms with notch on fixture", "Inlet Sub Assembly"],
  ["VD-26", "Load Belleville seal on post and align with frame arms — no contamination or damage to seal", "Inlet Sub Assembly"],
  ["VD-27", "Place finger on top of pip cap and press down while lifting frame off post", "Inlet Sub Assembly"],
  ["VD-28", "Load inlet frame on loading fixture; ensure proper loading of lodgement spring in groove of frame", "Inlet Sub Assembly"],
  ["VD-29", "Pull the spring back in fixture until it locks in place", "Inlet Sub Assembly"],
  ["VD-30", "Load strut into frame — must sit in groove of pip cap; load lever into holder, circle facing up", "Inlet Sub Assembly"],
  ["VD-31", "Place lever holder on frame, placed at notch on end of strut", "Inlet Sub Assembly"],
  ["VD-32", "Using screen assembly, tighten load screw, align the screw with circle on lever; tighten using 11 in-oz torque driver until it \"clicks\"", "Inlet Sub Assembly"],
  ["VD-33", "Zero the display; verify strut and lever are aligned side to side; using nut driver, tighten to .031\" ± .001\" on display", "Inlet Sub Assembly"],
  ["VD-34", "Slide lever block out, release arm from spring, remove from inlet assembly fixture", "Inlet Sub Assembly"],
  ["VD-35", "Load the inlet frame into arbor press, press the inlet frame into the nut until retaining ring snaps in place — nut must spin freely", "Inlet Sub Assembly"],
  ["VD-36", "Leak test inlet subassembly — Green = pass, Red = fail; a subassembly that fails leak test must be reworked", "Inlet Sub Assembly"],
  ["VD-37", "Using block, verify the gap between frame and lever is -1.5° to +1.5°", "Inlet Sub Assembly"],
  ["VD-38", "Apply 1 drop of glue to threads of nut in basket; move inlet sub-assemblies to Final Assembly", "Inlet Sub Assembly"],
  ["VD-39", "Take a cable, place spring up to bushing and twist over bushing until it hits stop; slide retaining bushing on cable", "Cable Sub Assembly"],
  ["VD-40", "Back off handwheel prior to loading cable on fixture", "Cable Sub Assembly"],
  ["VD-41", "Align hole in bushing with pin on fixture; straighten cable", "Cable Sub Assembly"],
  ["VD-42", "Tighten handwheel to compress spring until stop clears spring", "Cable Sub Assembly"],
  ["VD-43", "Slide cable fitting support block into slot; align cable fitting and support block; align cable retaining ring with groove in cable fitting", "Cable Sub Assembly"],
  ["VD-44", "Swing the arm over retaining ring and press the ring onto the cable fitting", "Cable Sub Assembly"],
  ["VD-45", "Remove from fixture by sliding the fitting support block out, release handwheel until spring not compressed, remove assembly", "Cable Sub Assembly"],
  ["VD-46", "Verify cable end fitting is fully engaged in retaining ring", "Cable Sub Assembly"],
  ["VD-47", "Load hose assembly into fixture, bend around the post according to length; clamp hose", "Final Assembly"],
  ["VD-48", "Pull cable through reducer; thread reducer onto hose 1/2 way", "Final Assembly"],
  ["VD-49", "Insert the inlet sub-assembly into the collet, align frame arms parallel with base plate; clamp collet", "Final Assembly"],
  ["VD-50", "Slide the carriage over the inlet frame to check lever position — initial angle check must read Zero° ± 1.5°", "Final Assembly"],
  ["VD-51", "Pull cable through the screen and frame hole, align notch in cable end fitting with the groove in the lever; crimp with cable pliers — cable must spin freely", "Final Assembly"],
  ["VD-52", "Slide the carriage over the assembly again; click the secondary reading and zero the readout; loosen the socket head screw until it reads between -1.0 and -2.0", "Final Assembly"],
  ["VD-53", "If loosening the screw the readout doesn't reach -1.0 to -2.0, the lever is not properly installed — if the secondary angle exceeds -2.0 the part is rejected", "Final Assembly"],
  ["VD-54", "Turn the screw in the outlet clockwise until it bottoms out; verify Initial Angle Check reads between -1.50 and +1.50 and Second Angle Check turns Red — otherwise the part is rejected", "Final Assembly"],
  ["VD-55", "Slide the carriage away, apply glue to the first 2 threads of the Inlet frame and hand tighten until it bottoms out — do not allow adhesive to get inside inlet frame", "Final Assembly"],
  ["VD-56", "Apply glue to the first 2 threads of the reducer and hand tighten; torque the hex nut to 20 ft-lbs with torque wrench", "Final Assembly"],
  ["VD-57", "Unclamp the hose and release the collet to free the inlet, remove assembly and hand to bulb installer", "Final Assembly"],
  ["VD-58", "Verify that temperature of deflector matches temperature of bulb; verify SIN number corresponds to correct bulb response per traveler", "Bulb Assembly"],
  ["VD-59", "Load the assembly into bulb install fixture — feet of fixture must sit inside frame arms; close the toggle clamp", "Bulb Assembly"],
  ["VD-60", "Crank hand wheel counter-clockwise on fixture until feet are tight on the split spacers", "Bulb Assembly"],
  ["VD-61", "Use driver to remove the socket head screw; use magnet to remove bushing, place both parts in respective bins", "Bulb Assembly"],
  ["VD-62", "Ensure the split spacers are aligned between frame arms; insert load screw, grip the bulb with tweezers, grease the bulb tip end that engages the load screw", "Bulb Assembly"],
  ["VD-63", "Tighten load screw with 11 in-oz torque driver until it \"clicks\"; inspect for proper bulb installation; apply glue to top of load screw — do not over apply", "Bulb Assembly"],
  ["VD-64", "Crank hand wheel clockwise and release feet of fixture off split spacers; pull back toggle clamp and remove assembly, hang on rack", "Bulb Assembly"],
  ["VD-65", "GL or supervisor must sign off 1 piece of first traveler for each Kanban", "Bulb Assembly"],
  ["VD-66", "Insert assembly (sprinkler head end) into support tube; load the inlet side into the leak test fixture", "Leak Test"],
  ["VD-67", "Close the door — leak test cycle starts; Green Light = passing leak, Red Light = failed leak (failed leaks need to be broken down and reworked); remove assembly from tester", "Leak Test"],
  ["VD-68", "Quality check — press on Belleville seal with finger (if seal moves, scrap assembly); hold inlet reducer and rotate inlet nut (if nut does not spin, scrap assembly)", "Leak Test"],
  ["VD-69", "Insert hose into tamper-proof cover fixture; place cover over the hex nut on the inlet side, press down on handle until it snaps in place; move to Microbite station", "Leak Test"],
  ["VD-70", "Select temperature by pressing \"Choose Type\" button, press arrows to select temp, press Start — Ubite will heat up", "Ubite Test"],
  ["VD-71", "Place sprinkler head into fixture — frame arms should be parallel to fixture; beware of pinch points", "Ubite Test"],
  ["VD-72", "Close doors and swipe the Opto-Touch to start the test; part will raise up to heaters for testing; light turns blue when test is in process", "Ubite Test"],
  ["VD-73", "Light turns Green for a passing test and Red for a failed test — failed tests need to be broken down immediately", "Ubite Test"],
  ["VD-74", "Once test is complete, assembly lowers — if green, remove assembly and add the tamper-proof cover to the sprinkler end using the fixture", "Ubite Test"],
  ["VD-75", "Place completed hoses in the trough for X-Ray", "Ubite Test"],
  ["VD-76", "X-ray startup procedure and calibration is done by X-Ray technician", "X-Ray"],
  ["VD-77", "Place cursor in File Name field, scan QR Code on hose end fitting", "X-Ray"],
  ["VD-78", "Press unlock door button, open door and place in X-Ray fixture — lever must be aligned parallel with X-ray screen; close door", "X-Ray"],
  ["VD-79", "Press \"F2\" to capture image — image must be clear, you should not see both frame arms; if frame is not oriented correctly, readjust part in fixture", "X-Ray"],
  ["VD-80", "Verify the cable end fitting is fully engaged in the lever — lever arms should fully extend to edge of fitting and lever is straight up and down", "X-Ray"],
  ["VD-81", "Verify the fitting is secure in the base of the coil spring", "X-Ray"],
  ["VD-82", "Inspect conduit and cable fitting are aligned with bushing and relatively straight", "X-Ray"],
  ["VD-83", "Do not let X-Ray run more than 5 minutes unattended — press unlock door button or turn the Enable X-Ray key to off", "X-Ray"],
  ["VD-84", "Place x-rayed part into preassembled box with dividers; install thread protector on inlet and bulb protector on sprinkler head", "Packing"],
  ["VD-85", "Place the correct escutcheon and instruction sheet in the box", "Packing"],
  ["VD-86", "Fold and tape box — 2 pieces of tape on long end and 2 pieces of tape on each end", "Packing"],
  ["VD-87", "Place label on box, ensure label is correct, write clock number on top right corner of label; place box on the appropriate size pallet according to part length", "Packing"],
  ["VD-88", "Operator must sign off at completion of the 1st and last traveler of each order", "Packing"],
  ["VD-89", "Scan Kanban and notify QA for inspection", "Packing"],

  // ---- Dry Sprinkler ----
  ["DS-01", "Using the traveler, pull all necessary components; verify parts are correct and match traveler (note: check order for No UL/No FM)", "Kitting"],
  ["DS-02", "Kitter rivets/taps all necessary heads needed for order (see instructions per style in Rivet & Tap section)", "Kitting"],
  ["DS-03", "Print labels associated with order and place in packet with components", "Kitting"],
  ["DS-04", "Verify components, rivet deflector to frame; inspect for cracked/deformed rivets — diameter .330\" min, height .020\" min; torque wrench check not to exceed 8 in-lbs", "Rivet for Coating"],
  ["DS-05", "Check alignment using comparator in QA dept — alignment must meet print tolerance (no tapping required)", "Rivet for Coating"],
  ["DS-06", "Verify components, rivet deflector to frame; inspect for cracked/deformed rivets — diameter .330\" min, height .020\" min; torque wrench check not to exceed 17 in-lbs", "Rivet & Tap of Sprinkler — V36"],
  ["DS-07", "Check alignment using comparator in QA dept — alignment must meet drawing tolerance", "Rivet & Tap of Sprinkler — V36"],
  ["DS-08", "Tap selection — always use H5 taps unless otherwise specified; ensure tap aligned with hole and goes down completely through frame; vacuum evacuates chips/debris from tapping process", "Rivet & Tap of Sprinkler — V36"],
  ["DS-09", "Thread inspection — use 10-32 UNF Go/No-Go gage; Go gage must pass freely through entire frame; No-Go cannot turn more than 3 turns", "Rivet & Tap of Sprinkler — V36"],
  ["DS-10", "Threads inspected and results documented on Form-0526 every 30 minutes; alignment checked once per hour; hand vacuum to keep cell free of chips; tap change when needed", "Rivet & Tap of Sprinkler — V36"],
  ["DS-11", "Verify components; flip sprinkler over, insert appropriate pins, place sprinkler in fixture with pins up, secure deflector by depressing handle, rivet pins", "Rivet Deflector — V33, V56 & V81"],
  ["DS-12", "Inspect rivet pins — deflector must move up and down freely (place frame on deflector, it should drop); rivet pins cannot be smashed and cannot spin", "Rivet Deflector — V33, V56 & V81"],
  ["DS-13", "Visually check all components match traveler; scan barcode of outer tube (HUD shows style and components needed); pull correct outer tube from cart, insert into clamp, engage handle to lock in place — tap escutcheon with mallet if required", "Outer Tube Assembly"],
  ["DS-14", "Apply Loctite to first 2 threads, screw head hand tight; using torque wrench (set to 35 ft-lbs) torque head to tube — acceptable range 20-50 ft-lbs; wipe off excess Loctite", "Outer Tube Assembly"],
  ["DS-15", "Pull corresponding inner tube from cart; place inner tube and pip cap/seal into assembly fixture — pin on pip cap faces away, holes aligned with both ear holes", "Inner Tube Assembly"],
  ["DS-16", "Insert spring into middle of inner tube and hold in place by pushing pin through the fixture; insert a roll pin into the front slot of the fixture", "Inner Tube Assembly"],
  ["DS-17", "Using the handle on the fixture, the roll pin pushes out the support pin and inserts itself into the inner tube sub-assembly — apply back pressure against pin during insertion", "Inner Tube Assembly"],
  ["DS-18", "Inner tube is then flipped up on the bushing side about 90° and a metal nail is inserted to hold the seal at a 45° angle", "Inner Tube Assembly"],
  ["DS-19", "Inspect assembly and roll pin to ensure it was inserted properly — must be centered, equally sticking out both ends; inspect seal for debris and any damage to Teflon", "Inner Tube Assembly"],
  ["DS-20", "Inner tube assembly is placed on carousel next to corresponding outer tube", "Inner Tube Assembly"],
  ["DS-21", "Insert End Fitting into collet on assembly fixture; close the collet to hold end fitting", "Final Assembly"],
  ["DS-22", "From under the part holder, push up the seal retaining rod so the seal can be placed onto the rod; while holding the rod, place the pip cap/seal on the pin (ears perpendicular to fixture); raise the tube enough to remove the nail", "Final Assembly"],
  ["DS-23", "After securing the pip cap/seal to the rod, stand the inner tube upright and turn 90° — the tube will stand on its own", "Final Assembly"],
  ["DS-24", "Verify order K5.6 or K8.0 bushing; place bushing on top of the inner tube", "Final Assembly"],
  ["DS-25", "Apply Loctite to outer tube assembly — apply to two threads 1/4 the way around the pipe; hand tighten the outer tube until the pipe bottoms out; do not apply too much Loctite", "Final Assembly"],
  ["DS-26", "Place split spacer/pip cap assembly on top of the bushing in center of frame opening; inspect the split spacer gap — V36 heads split spacers are between the frame arms, V33 split spacers should not be between frame arms", "Final Assembly"],
  ["DS-27", "3mm pip caps — markings must align with frame arms; 5mm pip caps must have top parallel with frame arms; V33 pip caps and split spacers must be built using designated fixture, gaps should not be between frame arms", "Final Assembly"],
  ["DS-28", "Put grease on top of the bulb and place through the screw hole; inspect bulb to ensure correct bulb is being used and is not inverted (bulb tip must be positioned in pip cap)", "Final Assembly"],
  ["DS-29", "Place torx head screw into frame, hold the bulb, split spacer, and pip cap in place while tightening with Kolver driver", "Final Assembly"],
  ["DS-30", "Using Kolver driver, select the appropriate program for the style of sprinkler being built — V33 and V36 = Program 1, V40 = Program 2, V56 = Program 3", "Final Assembly"],
  ["DS-31", "Bring driver down to insert tip in screw; pull trigger to complete program without excessive force — program complete when display is green; if red, back screw out and replace bulb, screw, and pip cap", "Final Assembly"],
  ["DS-32", "Remove sprinkler from fixture and inspect for proper bulb alignment, spacers, and pip cap; clean any excessive Loctite from fitting", "Final Assembly"],
  ["DS-33", "Load assembled sprinkler into leak test fixture; close door and push Green Button — pass turns light green and part is engraved, fail turns light red and part is not engraved; failed parts must be broken down at burn-off station", "Testing Process"],
  ["DS-34", "Short parts that cannot be engraved must be marked with a Purple X after passing leak", "Testing Process"],
  ["DS-35", "Parts that pass leak — apply 1-2 drops of glue to the load screw cavity and move parts to the vacuum chamber trough", "Testing Process"],
  ["DS-36", "Load parts into the Vacuum Chamber, press start; start test based on Standard Work Flow", "Testing Process"],
  ["DS-37", "Concealed deflectors must be extended and placed in the vacuum tray to prevent gluing the deflector to the frame", "Testing Process"],
  ["DS-38", "Once vacuum test is complete, inspect each bulb for leaking fluid or large bubbles; any part that fails inspection is broken down at burn-off station", "Testing Process"],
  ["DS-39", "Dry sprinklers must pass all required testing — Bath Test (1 sample per K-factor, per temperature, per shift), Load Test (2 samples per station, per shift)", "Testing Process"],
  ["DS-40", "Ensure correct components as called out on the traveler; read shipping methods and special instructions prior to packing — traveler description calls out required escutcheon/cover plate and finish", "Packing"],
  ["DS-41", "Place all required components and instruction sheet into box (see Packaging Procedure MP-06-0064 for complete details)", "Packing"],
  ["DS-42", "Fold and tape box; verify the label is correct, apply the correct label over end of box", "Packing"],
  ["DS-43", "Place box on skid — be aware of safety hazard when handling boxes", "Packing"],

  // ---- Koil Kit ----
  ["KK-01", "Reviews basic Koil Kit diagram (supply and return)", "Knowledge of Legacy Koil Kits"],
  ["KK-02", "Basic Koil Kit label flow and connection sizes", "Knowledge of Legacy Koil Kits"],
  ["KK-03", "Knows basic Koil Kit components — 78Y/78T inlets/outlets, 78U inlet/outlet, balancing valves (787, 722, 78BL), 78K adapters, tailpiece styles (male, female, sweat, press-fit), hoses and tailpiece styles, PT port and valve handle extensions", "Knowledge of Legacy Koil Kits"],
  ["KK-04", "Tailpiece swaps — O-ring in place, proper connection size", "Basic Assy Methods of Legacy Koil Kits"],
  ["KK-05", "Proper valve placement in vise (watch valve seams)", "Basic Assy Methods of Legacy Koil Kits"],
  ["KK-06", "Loctite application", "Basic Assy Methods of Legacy Koil Kits"],
  ["KK-07", "Proper wrench selection — backup wrench on unions", "Basic Assy Methods of Legacy Koil Kits"],
  ["KK-08", "78K union assembly", "Basic Assy Methods of Legacy Koil Kits"],
  ["KK-09", "PT Port and valve handle extensions", "Basic Assy Methods of Legacy Koil Kits"],
  ["KK-10", "Backflush kits", "Advanced Assy Methods of Legacy Koil Kits"],
  ["KK-11", "Domestic water kits", "Advanced Assy Methods of Legacy Koil Kits"],
  ["KK-12", "Valves with actuators (e.g., 7MP)", "Advanced Assy Methods of Legacy Koil Kits"],
  ["KK-13", "Reviews basic Unibody diagram (supply/return, valve/coil sides)", "Knowledge of Unibody Koil Kits"],
  ["KK-14", "Unibody Koil Kit label flow and connection sizes", "Knowledge of Unibody Koil Kits"],
  ["KK-15", "Knows Unibody components — Unibody Kit Manual, PICV, Automatic, hoses and tailpiece styles", "Knowledge of Unibody Koil Kits"],
  ["KK-16", "Leak testing — proper connections and valve closure", "Leak Testing"],
  ["KK-17", "Final inspection — components correct and match label", "Leak Testing"],
];
const SKILLS = SKILLS_DATA.map((r) => ({ id: r[0], desc: r[1], category: r[2] }));

// Shared core used by every department (Safety, 5S, Tools, Process Docs,
// Quality, Productivity, Reliability) — matches the seven common sections
// present on every tab of the standard workbook. TL-04 (torque wrench)
// and TL-07 (pliers/snips) are mutually exclusive per department — swap
// which one is included to match that department's actual Tools list.
const CORE_STANDARD = ["SAF-01", "SAF-02", "SAF-03", "SAF-04", "SAF-05", "SAF-06", "FIVE-01", "FIVE-02", "FIVE-03", "FIVE-04", "TL-01", "TL-02", "TL-03", "TL-04", "TL-05", "TL-06", "PD-01", "PD-02", "PD-03", "PD-04", "QA-01", "QA-02", "QA-03", "QA-04", "QA-05", "PI-01", "PI-02", "PI-03", "PI-04", "REL-01", "REL-02", "REL-03"];
const CORE_SAWS = ["SAF-01", "SAF-02", "SAF-03", "SAF-04", "SAF-05", "SAF-06", "FIVE-01", "FIVE-02", "FIVE-03", "FIVE-04", "TL-01", "TL-02", "TL-03", "TL-07", "TL-05", "TL-06", "PD-01", "PD-02", "PD-03", "PD-04", "QA-01", "QA-02", "QA-03", "QA-04", "QA-05", "PI-01", "PI-02", "PI-03", "PI-04", "REL-01", "REL-02", "REL-03"];
// Fallback for any department without its own checklist yet — safety/5S/tools only.
const SHARED_CORE = ["SAF-01", "SAF-02", "SAF-03", "SAF-04", "SAF-05", "SAF-06", "FIVE-01", "FIVE-02", "FIVE-03", "FIVE-04", "TL-01", "TL-02", "TL-03", "TL-04", "TL-05", "TL-06"];

// Default relevant-skills preset per department family (the part of the
// department name before " — <shift>"). Every shift of the same family
// shares a preset; edit per-department from "Edit skill presets".
const FAMILY_PRESETS_DEFAULT = {
  "STD Heads": [...CORE_STANDARD, "SH-01", "SH-02", "SH-03", "SH-04", "SH-05", "SH-06", "SH-07", "SH-08", "SH-09", "SH-10", "SH-11", "SH-12", "SH-13", "SH-14", "SH-15", "SH-16", "SH-17", "SH-18", "SH-19", "SH-20", "SH-21", "SH-22", "SH-23", "SH-24", "SH-25", "SH-26", "SH-27", "SH-28", "SH-29", "SH-30"],
  "Saws": [...CORE_SAWS, "SW-01", "SW-02", "SW-03", "SW-04", "SW-05", "SW-06", "SW-07", "SW-08", "SW-09", "SW-10", "SW-11", "SW-12", "SW-13", "SW-14", "SW-15", "SW-16", "SW-17", "SW-18", "SW-19", "SW-20"],
  "VicFlex": [...CORE_STANDARD, "VF-01", "VF-02", "VF-03", "VF-04", "VF-05", "VF-06", "VF-07", "VF-08", "VF-09", "VF-10", "VF-11", "VF-12", "VF-13", "VF-14", "VF-15", "VF-16"],
  "VicDry": [...CORE_STANDARD, "VD-01", "VD-02", "VD-03", "VD-04", "VD-05", "VD-06", "VD-07", "VD-08", "VD-09", "VD-10", "VD-11", "VD-12", "VD-13", "VD-14", "VD-15", "VD-16", "VD-17", "VD-18", "VD-19", "VD-20", "VD-21", "VD-22", "VD-23", "VD-24", "VD-25", "VD-26", "VD-27", "VD-28", "VD-29", "VD-30", "VD-31", "VD-32", "VD-33", "VD-34", "VD-35", "VD-36", "VD-37", "VD-38", "VD-39", "VD-40", "VD-41", "VD-42", "VD-43", "VD-44", "VD-45", "VD-46", "VD-47", "VD-48", "VD-49", "VD-50", "VD-51", "VD-52", "VD-53", "VD-54", "VD-55", "VD-56", "VD-57", "VD-58", "VD-59", "VD-60", "VD-61", "VD-62", "VD-63", "VD-64", "VD-65", "VD-66", "VD-67", "VD-68", "VD-69", "VD-70", "VD-71", "VD-72", "VD-73", "VD-74", "VD-75", "VD-76", "VD-77", "VD-78", "VD-79", "VD-80", "VD-81", "VD-82", "VD-83", "VD-84", "VD-85", "VD-86", "VD-87", "VD-88", "VD-89"],
  "Dry Sprinkler": [...CORE_STANDARD, "DS-01", "DS-02", "DS-03", "DS-04", "DS-05", "DS-06", "DS-07", "DS-08", "DS-09", "DS-10", "DS-11", "DS-12", "DS-13", "DS-14", "DS-15", "DS-16", "DS-17", "DS-18", "DS-19", "DS-20", "DS-21", "DS-22", "DS-23", "DS-24", "DS-25", "DS-26", "DS-27", "DS-28", "DS-29", "DS-30", "DS-31", "DS-32", "DS-33", "DS-34", "DS-35", "DS-36", "DS-37", "DS-38", "DS-39", "DS-40", "DS-41", "DS-42", "DS-43"],
  "Koil Kit": [...CORE_STANDARD, "KK-01", "KK-02", "KK-03", "KK-04", "KK-05", "KK-06", "KK-07", "KK-08", "KK-09", "KK-10", "KK-11", "KK-12", "KK-13", "KK-14", "KK-15", "KK-16", "KK-17"],
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

const STAGES = ["Initial (Wk 1-2)", "Light (Wk 3-4)", "Independent", "Completed"];

/* ------------------- Time in training & checkpoint schedule ----------------
   Everything is measured from the trainee's start date (enrolledAt).
   Edit these numbers if the training plan changes.

   CHECK-INS   Every 14 days (14, 28 ... 168) plus a final one at day 180. Ordinary check-ins
               are just support level + a comment. The six-area performance evaluation
               (rated 1-3) is ONLY done at stage reviews and the final evaluation.
   STAGES      Moving between stages is a DECISION, not a date. At a check-in the trainer
               (with the supervisor) chooses Advance or Extend 2 weeks. Advancing needs:
                 1. the minimum time in training   (GATES[].day)
                 2. the skills-checklist % for that move (GATES[].minSkillPct)
                 3. the sign-off - advancing BELOW the skills target is an override and
                    needs a written reason.
               Extending keeps the same biweekly schedule; the next check-in is the next chance.
   ESCALATION  Still not Independent by ESCALATE_DAY -> flagged for the supervisor.
   180 DAYS    Fixed. Everyone is marked Completed on day 180, however their stages went.
---------------------------------------------------------------------------- */
const DAY_MS = 24 * 60 * 60 * 1000;
const PROGRAM_DAYS = 180;
const CHECKPOINT_EVERY = 14;
const DUE_SOON_DAYS = 3;               // "due soon" starts this many days before the due day
const GATES = [
  { day: 14, minSkillPct: 40 },        // Initial -> Light
  { day: 28, minSkillPct: 80 },        // Light   -> Independent
];
const ESCALATE_DAY = 56;               // not Independent by this day -> escalate to supervisor
const STAGE_START_DAY = [0, 14, 28, PROGRAM_DAYS];                // used only to PLACE a trainee at enrollment
const CHECKPOINT_DAYS = (() => {
  const d = [];
  for (let x = CHECKPOINT_EVERY; x < PROGRAM_DAYS; x += CHECKPOINT_EVERY) d.push(x);
  d.push(PROGRAM_DAYS);
  return d;
})();
// Starting placement only (enrollment / seeding). After that, stage changes come from gate decisions.
const stageForDays = (d) => STAGES[d >= STAGE_START_DAY[3] ? 3 : d >= STAGE_START_DAY[2] ? 2 : d >= STAGE_START_DAY[1] ? 1 : 0];
const stageIdx = (t) => Math.max(0, STAGES.indexOf(t.status));
const shortStage = (n) => String(n || "").split(" (")[0];
const daysInTraining = (t, now) => Math.max(0, Math.floor((now - t.enrolledAt) / DAY_MS));
// local-midnight timestamp for a yyyy-mm-dd string (what <input type="date"> gives us)
const dateToStart = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
const startToDate = (ms) => { const x = new Date(ms); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const todayStr = () => startToDate(Date.now());
const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const KIND_LABEL = { "check-in": "Check-in", gate: "Stage review", final: "Final evaluation", evaluation: "Stage evaluation", "follow-up": "Check-in" };

// Can this trainee move up a stage, and what is still missing? null once they are Independent or Completed.
function gateStatus(t, now) {
  const idx = stageIdx(t);
  const g = GATES[idx];
  if (!g || t.status === "Completed") return null;
  const total = (t.skills || []).length;
  const done = (t.skills || []).filter((k) => k.done).length;
  const pct = total ? Math.floor((done * 100) / total) : 100;
  const floorMet = daysInTraining(t, now) >= g.day;
  const skillsMet = pct >= g.minSkillPct;
  return { idx, from: STAGES[idx], to: STAGES[idx + 1], floorDay: g.day, floorMet, pct, target: g.minSkillPct, skillsMet, ready: floorMet && skillsMet, done, total };
}

// The next check-in a trainee owes, and whether it is upcoming, due soon, or overdue.
function checkpointInfo(t, now) {
  const k = (t.checkpoints || []).length;
  if (k >= CHECKPOINT_DAYS.length) return null;
  const dueDay = CHECKPOINT_DAYS[k];
  const daysLeft = dueDay - daysInTraining(t, now);
  const gs = gateStatus(t, now);
  const kind = dueDay === PROGRAM_DAYS ? "final" : gs && dueDay >= gs.floorDay ? "gate" : "check-in";
  const state = daysLeft < 0 ? "overdue" : daysLeft <= DUE_SOON_DAYS ? "soon" : "upcoming";
  const label = daysLeft < 0 ? `Overdue by ${-daysLeft} day${daysLeft === -1 ? "" : "s"}`
    : daysLeft === 0 ? "Due today"
    : `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  return { number: k + 1, total: CHECKPOINT_DAYS.length, dueDay, daysLeft, state, label,
           kind, title: KIND_LABEL[kind], gate: kind === "gate" ? gs : null };
}
const CP_COLOR = { overdue: "var(--bad-text)", soon: "var(--warn-text)", upcoming: "var(--text-dim)" };
const needsCheckpoint = (t, now) => { const i = checkpointInfo(t, now); return !!i && i.state !== "upcoming"; };
// A trainee auto-completes on day 180; if their final evaluation is still owed it stays loggable.
const owesFinal = (t, now) => { if (t.status !== "Completed") return false; const i = checkpointInfo(t, now); return !!i && i.kind === "final"; };

// Flag shown on cards for trainees who have not reached Independent.
function stageFlag(t, now) {
  const gs = gateStatus(t, now);
  if (!gs) return null;
  const day = daysInTraining(t, now);
  if (day >= ESCALATE_DAY) return { key: "escalate", label: "Escalate to supervisor", color: "#ef4444", detail: `Day ${day} and still in ${shortStage(t.status)}` };
  if (gs.ready) return { key: "ready", label: "Ready to advance", color: "#22c55e", detail: "Decide at the next check-in" };
  if (gs.floorMet) return { key: "review", label: "Needs extension review", color: "#f59e0b", detail: `Skills ${gs.pct}% — ${gs.target}% needed for ${shortStage(gs.to)}` };
  return null;
}

/* The areas a specialist rates at EVERY check-in (quick 1-3 rating; notes are optional). */
const EVAL_AREAS = [
  { id: "enthusiasm", label: "Enthusiasm & attitude", hint: "Engagement, willingness to learn, response to feedback" },
  { id: "quality", label: "Quality of work & errors", hint: "Accuracy, mistakes made, rework needed" },
  { id: "safety", label: "Safety awareness", hint: "PPE, safe habits, speaking up about hazards" },
  { id: "procedures", label: "Follows procedures & instructions", hint: "Uses method sheets, follows standard work" },
  { id: "pace", label: "Pace & productivity", hint: "Steady pace, keeping up with the line" },
  { id: "teamwork", label: "Teamwork & communication", hint: "Asks questions, works well with others" },
];
const RATINGS = [{ v: 1, label: "Needs improvement" }, { v: 2, label: "Meets expectations" }, { v: 3, label: "Exceeds expectations" }];
const ratingLabel = (v) => (RATINGS.find((r) => r.v === v) || {}).label || "—";

// Average of a check-in's ratings, and how the latest compares with the one before.
const avgRating = (c) => { const v = Object.values((c && c.ratings) || {}).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
function ratingTrend(t) {
  const rated = (t.checkpoints || []).filter((c) => avgRating(c) !== null);
  if (!rated.length) return null;
  const last = avgRating(rated[rated.length - 1]);
  const prev = rated.length > 1 ? avgRating(rated[rated.length - 2]) : null;
  const dir = prev === null ? 0 : last - prev > 0.15 ? 1 : last - prev < -0.15 ? -1 : 0;
  return { avg: last, dir };
}
// Areas rated "Needs improvement" at both of the last two rated check-ins.
function concernAreas(t) {
  const rated = (t.checkpoints || []).filter((c) => Object.keys(c.ratings || {}).length > 0).slice(-2);
  if (rated.length < 2) return [];
  return EVAL_AREAS.filter((a) => rated.every((c) => (c.ratings || {})[a.id] === 1));
}

// Trainees are only shown one specialist at a time. UNASSIGNED is the pick for trainees who aren't
// under anyone yet (e.g. enrolled before specialists existed). The pick lasts for this browser session.
const UNASSIGNED = "__unassigned";
const SCOPE_WIDTH = { queue: 1320, checkpoints: 900, print: 1000 };
const STAGE_ICON = { "Initial (Wk 1-2)": ClipboardList, "Light (Wk 3-4)": PlayCircle, "Independent": UserCheck, "Completed": GraduationCap };

/* ------------------------------ Storage ----------------------------------- */
const KEY = "trainer_tracker_v4";
const SKILLS_KEY = "trainer_skills_v3";
const SKILLS_VERSION = 3;

async function loadState() {
  let main = { seq: 301, trainees: [], departments: [...DEPARTMENTS_DEFAULT], deptSkills: null, theme: "dark", specialists: [], admin: null };
  try {
    const r = await window.storage.get(KEY);
    if (r && r.value) {
      const p = JSON.parse(r.value);
      if (typeof p.seq === "number") main.seq = p.seq;
      if (Array.isArray(p.trainees)) main.trainees = p.trainees;
      if (p.departments && p.departments.length) main.departments = p.departments;
      if (p.deptSkills) main.deptSkills = p.deptSkills;
      if (p.theme === "light" || p.theme === "dark") main.theme = p.theme;
      if (Array.isArray(p.specialists)) main.specialists = p.specialists;
      if (p.admin && p.admin.salt && p.admin.hash) main.admin = p.admin;
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
      seq: state.seq, trainees: state.trainees, departments: state.departments, deptSkills: state.deptSkills, theme: state.theme, specialists: state.specialists, admin: state.admin || null,
    }));
  } catch (e) {}
}
/* ---- Admin password: stored only as a salted SHA-256 hash. This is a screen lock for the Admin page;
   anyone with access to the browser's storage or dev tools could bypass it, so it is not server-side security. ---- */
const newSalt = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
async function hashPw(pw, salt) {
  const str = `${salt}:${pw}`;
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {            // crypto.subtle is unavailable on some non-secure pages
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return "f" + (h >>> 0).toString(16);
  }
}
const MIN_PW = 6;

async function persistSkills(skills) {
  try { await window.storage.set(SKILLS_KEY, JSON.stringify({ version: SKILLS_VERSION, skills })); } catch (e) {}
}

/* ============================== App ===================================== */
export default function App() {
  const [tab, setTab] = useState("specialists");          // home = the list of specialists
  const [view, setView] = useState("queue");                 // inside a specialist: queue | checkpoints | print
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [state, setState] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [time, setTime] = useState(clock());
  const [printTargetId, setPrintTargetId] = useState(null);
  const [showDepartments, setShowDepartments] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [logTraineeId, setLogTraineeId] = useState(null);
  const [activeSpecialistId, setActiveSpecialistId] = useState(null);   // not remembered: a reload lands on the specialist list
  const selectSpecialist = (id) => { setActiveSpecialistId(id || null); setView("queue"); };
  // Leaving the Admin page locks it again.
  useEffect(() => { if (tab !== "admin") setAdminUnlocked(false); }, [tab]);
  // Clicking "Specialists" while inside a specialist goes back to the list.
  const goTab = (k) => { if (k === "specialists" && tab === "specialists") setActiveSpecialistId(null); setTab(k); };

  useEffect(() => { loadState().then(setState); }, []);
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setTime(clock()); }, 1000);
    return () => clearInterval(t);
  }, []);

  // Single commit path — always writes both storage keys, so trainees,
  // departments, presets, and the skills catalog never drift out of sync.
  const commit = useCallback((next) => { setState(next); persist(next); persistSkills(next.skills); }, []);

  // ---- Which specialist's trainees are on screen (null = none picked yet) ----
  const knownSpecIds = new Set(((state && state.specialists) || []).map((s) => s.id));
  const scopeId = knownSpecIds.has(activeSpecialistId) ? activeSpecialistId : null;
  const inScope = (t) => !!scopeId && t.specialistId === scopeId;
  const scopedTrainees = state ? state.trainees.filter(inScope) : [];

  // Stage changes come from gate decisions at check-ins. The ONLY automatic move is day 180 -> Completed.
  // Runs once state has loaded, then re-checks every minute.
  const minuteTick = Math.floor(now / 60000);
  useEffect(() => {
    if (!state) return;
    const t0 = Date.now();
    let changed = false;
    const trainees = state.trainees.map((t) => {
      if (t.status === "Completed" || daysInTraining(t, t0) < PROGRAM_DAYS) return t;
      changed = true;
      return { ...t, status: "Completed" };
    });
    if (changed) commit({ ...state, trainees });
  }, [state, minuteTick]); // eslint-disable-line

  const toggleTheme = () => commit({ ...state, theme: state.theme === "light" ? "dark" : "light" });

  // ---- Admin page password ----
  const createAdminPassword = async (pw) => {
    const salt = newSalt();
    const hash = await hashPw(pw, salt);
    commit({ ...state, admin: { salt, hash } });
    setAdminUnlocked(true);
  };
  const tryAdminPassword = async (pw) => {
    if (!state.admin) return false;
    const ok = (await hashPw(pw, state.admin.salt)) === state.admin.hash;
    if (ok) setAdminUnlocked(true);
    return ok;
  };
  const changeAdminPassword = async (current, next) => {
    if (!state.admin || (await hashPw(current, state.admin.salt)) !== state.admin.hash) return false;
    const salt = newSalt();
    commit({ ...state, admin: { salt, hash: await hashPw(next, salt) } });
    return true;
  };

  const addTrainee = ({ name, department, note, specialistId, startDate }, opts = {}) => {
    const id = state.seq;
    const presetSkills = resolvePreset(state.deptSkills, department, state.skills).map((s) => ({ ...s, done: false }));
    const enrolledAt = Math.min(dateToStart(startDate || todayStr()), Date.now());   // start date, never in the future
    const full = {
      id: `TR-${id}`, num: id, name, department, note,
      specialistId: specialistId || null,
      support: "On track",
      status: stageForDays(daysInTraining({ enrolledAt }, Date.now())),
      enrolledAt,
      checkpoints: [],
      skills: presetSkills,
    };
    commit({ ...state, seq: id + 1, trainees: [full, ...state.trainees] });
    if (!opts.stay) {
      if (specialistId) selectSpecialist(specialistId); // show the new trainee under their specialist
      setView("queue");
      setTab("specialists");
    }
  };

  // ---- Training specialists ----
  const addSpecialist = ({ name, department }) => {
    const n = name.trim();
    if (!n) return;
    const sp = { id: "SP-" + Date.now().toString(36), name: n, department };
    commit({ ...state, specialists: [...state.specialists, sp] });
  };
  const updateSpecialist = (id, patch) =>
    commit({ ...state, specialists: state.specialists.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  // Removing a specialist never deletes trainees — they just become unassigned.
  const removeSpecialist = (id) => {
    commit({
      ...state,
      specialists: state.specialists.filter((s) => s.id !== id),
      trainees: state.trainees.map((t) => (t.specialistId === id ? { ...t, specialistId: null } : t)),
    });
    if (activeSpecialistId === id) selectSpecialist(null);
  };
  const assignTrainee = (traineeId, specialistId) =>
    commit({ ...state, trainees: state.trainees.map((t) => (t.id === traineeId ? { ...t, specialistId: specialistId || null } : t)) });

  const toggleSkillDone = (traineeId, skillId) => {
    const trainees = state.trainees.map((t) => {
      if (t.id !== traineeId) return t;
      const skills = t.skills.map((s) => (s.id === skillId ? { ...s, done: !s.done, doneAt: !s.done ? Date.now() : null } : s));
      return { ...t, skills };
    });
    commit({ ...state, trainees });
  };
  // Optional comment on a skill — offered whenever a skill is marked mastered, and editable afterwards.
  const setSkillComment = (traineeId, skillId, text) => {
    const trainees = state.trainees.map((t) => (t.id !== traineeId ? t
      : { ...t, skills: t.skills.map((s) => (s.id === skillId ? { ...s, comment: text } : s)) }));
    commit({ ...state, trainees });
  };

  // Record a check-in. At a stage review the trainer's decision (advance / extend) is applied here;
  // advancing needs the minimum time in training. Everything else never changes the stage.
  const logCheckpoint = (traineeId, { support, ratings, areaNotes, summary, decision }) => {
    const nowMs = Date.now();
    const trainees = state.trainees.map((t) => {
      if (t.id !== traineeId) return t;
      const info = checkpointInfo(t, nowMs);
      if (!info) return t;
      let status = t.status, gate = null;
      if (info.gate) {
        const g = info.gate;
        const adv = decision === "advance" && g.floorMet;
        gate = { from: g.from, to: g.to, decision: adv ? "advance" : "extend", pct: g.pct, target: g.target,
                 floorMet: g.floorMet, skillsMet: g.skillsMet, override: adv && !g.skillsMet };
        if (adv) status = g.to;
      }
      const rec = {
        at: nowMs, number: info.number, dueDay: info.dueDay, day: daysInTraining(t, nowMs),
        kind: info.kind, stage: t.status, gate,
        ratings: ratings || {}, areaNotes: areaNotes || {}, summary: summary || "", support,
      };
      return { ...t, support, status, checkpoints: [...t.checkpoints, rec] };
    });
    commit({ ...state, trainees });
  };

  // Correct a trainee's start date; the check-in schedule follows. The stage is kept (it is a decision, not a date).
  const setStartDate = (id, dateStr) => {
    if (!dateStr) return;
    const enrolledAt = Math.min(dateToStart(dateStr), Date.now());
    commit({ ...state, trainees: state.trainees.map((t) => (t.id === id
      ? { ...t, enrolledAt, status: t.status === "Completed" && daysInTraining({ enrolledAt }, Date.now()) < PROGRAM_DAYS
          ? stageForDays(daysInTraining({ enrolledAt }, Date.now())) : t.status } : t)) });
  };

  const removeTrainee = (id) => commit({ ...state, trainees: state.trainees.filter((t) => t.id !== id) });

  const openPrint = (id) => { setPrintTargetId(id); setView("print"); };

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

  // Clears only the trainees on screen (the selected specialist's). The ID counter is left alone
  // so new trainees never reuse an ID that another specialist's trainee still has.
  const resetAll = () => commit({ ...state, trainees: state.trainees.filter((t) => !inScope(t)) });

  // Download a backup of everyone marked Completed, then remove them from
  // active storage — keeps the live dataset small without losing history.
  const archiveCompleted = () => {
    const completed = state.trainees
      .filter((t) => t.status === "Completed" && inScope(t) && !owesFinal(t, Date.now()))
      .map((t) => ({ ...t, specialistName: (state.specialists.find((s) => s.id === t.specialistId) || {}).name || null }));
    if (completed.length === 0) return;
    const blob = new Blob([JSON.stringify(completed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `completed-trainees-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    commit({ ...state, trainees: state.trainees.filter((t) => !(t.status === "Completed" && inScope(t) && !owesFinal(t, Date.now()))) });
  };
  const seed = () => {
    let seq = state.seq;
    const nowMs = Date.now();
    const DEMO_RATINGS = { enthusiasm: 3, quality: 2, safety: 2, procedures: 2, pace: 2, teamwork: 3 };
    const DEMO_NOTES = { enthusiasm: "Eager, asks good questions.", quality: "A couple of missed torque checks — reviewed together." };
    const mk = (deptIdx, support, daysAgo, doneCount, loggedDays, opts = {}) => {
      const id = seq++;
      const enrolledAt = dateToStart(startToDate(nowMs - daysAgo * DAY_MS));
      const department = state.departments[deptIdx] || state.departments[0];
      const preset = resolvePreset(state.deptSkills, department, state.skills);
      const nDone = typeof doneCount === "string" ? Math.ceil((preset.length * parseInt(doneCount, 10)) / 100) : doneCount;
      const skills = preset.map((s, i) => ({ ...s, done: i < nDone }));
      const checkpoints = loggedDays.map((day, i) => {
        const dueDay = CHECKPOINT_DAYS[i];
        const kind = dueDay === PROGRAM_DAYS ? "final" : dueDay <= 28 ? "gate" : "check-in";
        const ratings = kind === "check-in" ? {} : { ...DEMO_RATINGS };
        if (opts.concern && kind !== "check-in") ratings.quality = 1;
        const gate = kind === "gate"
          ? { from: STAGES[i], to: STAGES[i + 1], decision: "advance", pct: GATES[i].minSkillPct + 10, target: GATES[i].minSkillPct, floorMet: true, skillsMet: true, override: false }
          : null;
        return {
          at: enrolledAt + day * DAY_MS, number: i + 1, dueDay, day, kind, gate,
          stage: kind === "gate" ? STAGES[i] : stageForDays(day), support: i === loggedDays.length - 1 ? support : "On track",
          ratings, areaNotes: i === 0 ? DEMO_NOTES : {},
          summary: kind === "check-in" ? "Steady progress; keeping up with the line." : "Good start overall — focus on double-checking torque values.",
        };
      });
      return {
        id: `TR-${id}`, num: id,
        name: ["Jordan Reyes", "Casey Nolan", "Priya Anand", "Marcus Webb", "Lena Ortiz", "Devon Park", "Sam Alvarez", "Noor Haddad"][id % 8],
        department, support, status: opts.status || stageForDays(daysAgo), enrolledAt, checkpoints, note: "", skills,
        specialistId: scopeId || null,
      };
    };
    const demo = [
      mk(0, "On track", 3, 2, []),                                    // day 3 — first check-in is 11 days away
      mk(2, "Needs support", 20, 5, [13]),                            // Light — check-in 1 done, stage review due day 28
      mk(1, "On track", 60, 7, [14, 28, 42], { concern: true }),      // Independent — quality rated low twice; #4 overdue
      mk(4, "At risk", 12, 1, []),                                    // Initial — first stage review due in 2 days
      mk(3, "On track", 190, 8, CHECKPOINT_DAYS),                     // Completed — every check-in logged
      mk(0, "On track", 31, 6, [14], { status: STAGES[1] }),          // Light, day-28 review overdue, skills below 80% -> needs review
      mk(1, "On track", 15, "60%", [], { status: STAGES[0] }),        // Initial, past day 14 with 60% skills -> ready to advance
    ];
    commit({ ...state, seq, trainees: [...demo, ...state.trainees] });
  };

  if (!state) return (
    <div style={styles.shell} className="theme-dark">
      <div style={{ margin: "auto", color: "var(--text-dim)", fontFamily: "ui-monospace, monospace" }}>Loading trainee list…</div>
    </div>
  );

  // Every screen that lists trainees gets only the selected specialist's — nothing else is passed down.
  const scopedState = { ...state, trainees: scopedTrainees };
  const scopeSpec = state.specialists.find((s) => s.id === scopeId);

  return (
    <div style={styles.shell} className={state.theme === "light" ? "theme-light" : "theme-dark"}>
      <style>{`
        input::placeholder { color: var(--placeholder); }
        select option { background: var(--card); color: var(--input-text); }
        .theme-dark {
          --bg: #0c0f14; --panel: #0f141b; --card: #0c1117;
          --border: #1b222b; --border-strong: #232c37; --border-input: #262f3a; --border-soft: #2a323c;
          --line-border: #1f2731; --chip-border: #222c37; --divider: #161d26;
          --text: #dfe5ec; --text-strong: #f5f7fa; --text-soft: #aeb7c4; --text-soft2: #c3cad4;
          --text-dim: #8a95a5; --text-dim2: #7a869a; --text-faint: #6b7686; --text-faint2: #5f6b7c; --text-faint3: #3a424d;
          --placeholder: #55606e; --input-text: #e6ebf1; --mono-text: #c7ccd6; --tab-active-bg: #131a22;
          --accent: #F58220; --accent-deep: #C1560D; --accent-ink: #1a1005; --accent-text: #F58220;
          --accent-wash-bg: rgba(245,130,32,0.10); --accent-wash-bg-2: rgba(245,130,32,0.16); --accent-wash-border: rgba(245,130,32,0.45);
          --ok-bg: #0e1f16; --ok-border: #14532d; --bad-bg: #2a0f0f; --bad-border: #7f1d1d;
          --warn-text: #f59e0b; --bad-text: #f87171;
        }
        .theme-light {
          --bg: #f3f4f6; --panel: #ffffff; --card: #f6f7f9;
          --border: #e2e5ea; --border-strong: #d7dbe1; --border-input: #d3d7dd; --border-soft: #d8dce1;
          --line-border: #dde1e6; --chip-border: #dde1e6; --divider: #edeff2;
          --text: #23262b; --text-strong: #0a0c10; --text-soft: #454b54; --text-soft2: #363c44;
          --text-dim: #5a6472; --text-dim2: #676f7c; --text-faint: #7a8290; --text-faint2: #8991a0; --text-faint3: #a7adb6;
          --placeholder: #9aa1ab; --input-text: #1c1f24; --mono-text: #3d4552; --tab-active-bg: #eef0f3;
          --accent: #F58220; --accent-deep: #C1560D; --accent-ink: #1a1005; --accent-text: #B8560D;
          --accent-wash-bg: rgba(245,130,32,0.12); --accent-wash-bg-2: rgba(245,130,32,0.18); --accent-wash-border: rgba(245,130,32,0.55);
          --ok-bg: #e6f6ec; --ok-border: #7fcf9d; --bad-bg: #fdeaea; --bad-border: #ee9f9f;
          --warn-text: #b45309; --bad-text: #b91c1c;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          #sheet { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
        }
      `}</style>
      <Header tab={tab} setTab={goTab} time={time} adminUnlocked={adminUnlocked}
        onManageDepartments={() => setShowDepartments(true)}
        theme={state.theme} onToggleTheme={toggleTheme} />
      <div style={styles.body}>
        <ErrorBoundary tabKey={tab}>
          {tab === "specialists" && (scopeSpec ? (
            <div style={{ width: "100%", maxWidth: SCOPE_WIDTH[view], margin: "0 auto" }}>
              <WorkspaceBar specialist={scopeSpec} view={view} setView={setView} onBack={() => selectSpecialist(null)}
                activeCount={scopedTrainees.filter((t) => t.status !== "Completed").length}
                dueCount={scopedTrainees.filter((t) => needsCheckpoint(t, now) && (t.status !== "Completed" || owesFinal(t, now))).length} />
              {view === "queue" && (
                <Dashboard state={scopedState} now={now} remove={removeTrainee}
                  reset={resetAll} seed={seed} archiveCompleted={archiveCompleted} openPrint={openPrint} openLog={(id) => setLogTraineeId(id)} />
              )}
              {view === "checkpoints" && (
                <Checkpoints state={scopedState} now={now} onLog={(id) => setLogTraineeId(id)} />
              )}
              {view === "print" && <PrintSheet state={scopedState} initialId={printTargetId} />}
            </div>
          ) : (
            <SpecialistPicker specialists={state.specialists} trainees={state.trainees} now={now}
              onSelect={selectSpecialist} onGoAdmin={() => goTab("admin")} />
          ))}
          {tab === "enroll" && (
            <Enroll onSubmit={addTrainee} departments={state.departments} skills={state.skills} deptSkills={state.deptSkills}
              specialists={state.specialists} activeSpecialistId={scopeId}
              onGoSpecialists={() => goTab("admin")}
              onManageDepartments={() => setShowDepartments(true)} onManagePresets={() => setShowPresets(true)} />
          )}
          {tab === "admin" && (adminUnlocked ? (
            <AdminPage state={state} now={now} onLock={() => setAdminUnlocked(false)}
              onChangePassword={changeAdminPassword} onStartDate={setStartDate}>
              <Specialists state={state}
                onAddSpecialist={addSpecialist} onUpdateSpecialist={updateSpecialist} onRemoveSpecialist={removeSpecialist}
                onAddTrainee={(t) => addTrainee(t, { stay: true })} onAssign={assignTrainee}
                onLog={(id) => setLogTraineeId(id)} onManageDepartments={() => setShowDepartments(true)} />
            </AdminPage>
          ) : (
            <AdminLogin hasPassword={!!state.admin} onCreate={createAdminPassword} onLogin={tryAdminPassword} />
          ))}
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
          <LogMode trainee={t} now={now}
            onToggleSkill={(skillId) => toggleSkillDone(t.id, skillId)}
            onSkillComment={(skillId, text) => setSkillComment(t.id, skillId, text)}
            onSave={(payload) => logCheckpoint(t.id, payload)}
            onClose={() => setLogTraineeId(null)} />
        );
      })()}
    </div>
  );
}

/* ------------------------------ Header ----------------------------------- */
function Header({ tab, setTab, time, adminUnlocked, onManageDepartments, theme, onToggleTheme }) {
  const { w, mobile } = useViewport();
  // Five tabs don't fit beside the title on a laptop/tablet. Measured widths (incl. a
  // Windows scrollbar): single row needs ~1290px trimmed / ~1540px full, tab labels ~770px.
  const narrow = w < 1320;    // nav drops to its own row
  const compact = w < 1580;   // trim extras (group labels, subtitle, "Depts" text)
  const iconOnly = w < 820;   // small tablets: icons only, the active tab keeps its label
  const groups = [
    { label: "Program", tabs: [
      { k: "specialists", label: "Specialists", icon: Users },
      { k: "enroll", label: "New trainee", icon: UserPlus },
      { k: "admin", label: "Admin", icon: adminUnlocked ? Unlock : Lock },
    ]},
  ];
  return (
    <header style={{ ...styles.header, flexWrap: narrow ? "wrap" : "nowrap", rowGap: 10 }} className="no-print">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={styles.logoMark}>◇</div>
        <div>
          <div style={{ fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>Training Specialist Tracker</div>
          {!mobile && (narrow || !compact) && (
            <div style={{ fontSize: 11, color: "var(--text-dim2)", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Leland Facility — New Hire Onboarding</div>
          )}
        </div>
      </div>
      <nav style={{ display: "flex", alignItems: "center", order: narrow ? 3 : 2, width: narrow ? "100%" : "auto" }}>
        {groups.map((g, gi) => (
          <React.Fragment key={g.label}>
            {gi > 0 && <div style={styles.navDivider} />}
            <div style={styles.navGroup}>
              {!mobile && !compact && <span style={styles.navGroupLabel}>{g.label}</span>}
              {g.tabs.map((t) => {
                const active = tab === t.k;
                const Icon = t.icon;
                const badge = 0;
                const showLabel = !mobile && (!iconOnly || active);
                return (
                  <button key={t.k} onClick={() => setTab(t.k)} title={t.label} aria-label={t.label}
                    style={{ ...styles.tabBtn, padding: mobile ? "12px 8px" : "10px 12px", ...(active ? styles.tabBtnActive : {}) }}>
                    <Icon size={17} />
                    {showLabel && <span>{t.label}</span>}
                    {badge > 0 && <span style={{ ...styles.badge, background: t.k === "checkpoints" ? "#ef4444" : "var(--accent)", color: t.k === "checkpoints" ? "#fff" : "var(--accent-ink)" }}>{badge}</span>}
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 10, order: narrow ? 2 : 3, marginLeft: "auto" }}>
        <button onClick={onToggleTheme} title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"} style={{ ...styles.tabBtn, padding: 9 }}>
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button onClick={onManageDepartments} title="Manage departments" style={{ ...styles.tabBtn, padding: 9 }}>
          <Settings size={17} />
          {!mobile && !compact && <span>Depts</span>}
        </button>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, color: "var(--text-soft)", minWidth: 96, textAlign: "right", whiteSpace: "nowrap" }}>{time}</div>
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
  return <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-text)", fontWeight: 700, marginBottom: 10, ...style }}>{children}</div>;
}

/* ------------------------------ Enroll form -------------------------------
   Now just two decisions: name, and department. The department's preset
   drives the skills checklist automatically — nothing to search or add.
---------------------------------------------------------------------------- */
function Enroll({ onSubmit, departments, skills, deptSkills, specialists, activeSpecialistId, onGoSpecialists, onManageDepartments, onManagePresets }) {
  const { narrow } = useViewport();
  // Start on the specialist currently being viewed (if any), using their main department.
  const startSpec = (specialists || []).find((s) => s.id === activeSpecialistId);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(startSpec && departments.includes(startSpec.department) ? startSpec.department : departments[0]);
  useEffect(() => { if (!departments.includes(department)) setDepartment(departments[0]); }, [departments]); // eslint-disable-line
  const [note, setNote] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const startDay = daysInTraining({ enrolledAt: Math.min(dateToStart(startDate || todayStr()), Date.now()) }, Date.now());
  const [specialistId, setSpecialistId] = useState(startSpec ? startSpec.id : "");
  // If the chosen specialist gets removed, the choice is cleared.
  const chosenSpecialist = (specialists || []).find((s) => s.id === specialistId);
  // Picking a specialist fills in their main department (still changeable).
  const pickSpecialist = (id) => {
    setSpecialistId(id);
    const sp = (specialists || []).find((s) => s.id === id);
    if (sp && departments.includes(sp.department)) setDepartment(sp.department);
  };

  const preset = useMemo(() => resolvePreset(deptSkills, department, skills), [deptSkills, department, skills]);

  const submit = () => {
    if (!name.trim() || preset.length === 0 || !chosenSpecialist) return;
    onSubmit({ name: name.trim(), department, note, specialistId: chosenSpecialist.id, startDate });
    setName(""); setNote("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1.3fr) minmax(0,1fr)", gap: 20, maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      <div style={styles.panel}>
        <div style={styles.roleNote}>
          Enroll a new hire here. Choose the training specialist they'll work under and the date their training started — their stage and checkpoint schedule follow from that date. Their skills checklist is assigned automatically from their department's preset.
        </div>

        <Step n={1} label="Who">
          <label style={styles.fieldLabel}>Trainee name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" style={styles.input} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16 }}>
            <label style={styles.fieldLabel}>Training specialist</label>
            <button onClick={onGoSpecialists} style={styles.linkBtn}>Manage specialists (Admin)</button>
          </div>
          {(specialists || []).length === 0 ? (
            <div style={{ ...styles.hint, color: "#f59e0b", marginBottom: 0 }}>
              There are no specialists yet. Add one on the Admin page first — every trainee is enrolled under a specialist.
            </div>
          ) : (
            <select value={chosenSpecialist ? chosenSpecialist.id : ""} onChange={(e) => pickSpecialist(e.target.value)} style={styles.select}>
              <option value="">Select a specialist…</option>
              {(specialists || []).map((s) => <option key={s.id} value={s.id}>{s.name} — {s.department}</option>)}
            </select>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16 }}>
            <label style={styles.fieldLabel}>Department & shift</label>
            <button onClick={onManageDepartments} style={styles.linkBtn}>Manage departments</button>
          </div>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={styles.select}>
            {(departments || []).map((d) => <option key={d}>{d}</option>)}
          </select>

          <label style={{ ...styles.fieldLabel, marginTop: 16 }}>Training start date</label>
          <input type="date" value={startDate} max={todayStr()} onChange={(e) => setStartDate(e.target.value || todayStr())} style={styles.input} />
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>
            Stages and checkpoints are timed from this date. {startDay === 0 ? "Starts today." : `That's day ${startDay} — they begin in ${stageForDays(startDay)}.`}
          </div>
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
                These {preset.length} skills are the preset for <b style={{ color: "var(--text-soft2)" }}>{department}</b> — every trainee in this department gets this checklist automatically.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {preset.map((s) => (
                  <span key={s.id} style={styles.chip}>
                    <span style={{ ...styles.mono, flexShrink: 0, whiteSpace: "nowrap" }}>{s.id}</span>
                    <span style={{ color: "var(--text-dim)" }}>{s.desc}</span>
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
          <span style={{ color: "var(--text-dim2)" }}>·</span>
          <span style={{ color: "var(--text-soft)", fontSize: 14 }}>{department}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 4 }}>
          Specialist: {chosenSpecialist ? chosenSpecialist.name : <span style={{ color: "#f59e0b" }}>not selected yet</span>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 4 }}>
          Starts {fmtDate(Math.min(dateToStart(startDate || todayStr()), Date.now()))} · day {startDay} · {stageForDays(startDay)}
        </div>
        {preset.length === 0 ? (
          <div style={{ color: "var(--text-faint)", padding: "28px 0", textAlign: "center", fontSize: 14 }}>
            No preset skills for this department — nothing to enroll into yet.
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {preset.map((s) => (
              <div key={s.id} style={styles.lineItem}>
                <span style={{ ...styles.mono, minWidth: 68 }}>{s.id}</span>
                <span style={{ flex: 1, color: "var(--text-soft2)", fontSize: 13, marginLeft: 10 }}>{s.desc}</span>
                <span style={{ color: "var(--text-faint2)", fontSize: 12 }}>{s.category}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={submit} disabled={!name.trim() || preset.length === 0 || !chosenSpecialist}
          style={{ ...styles.submitBtn, opacity: (!name.trim() || preset.length === 0 || !chosenSpecialist) ? 0.4 : 1, cursor: (!name.trim() || preset.length === 0 || !chosenSpecialist) ? "not-allowed" : "pointer" }}>
          Enroll trainee <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Checkpoints -------------------------------
   Same shape as the warehouse app's Receiving screen.
---------------------------------------------------------------------------- */
function Checkpoints({ state, now, onLog, onStartDate }) {
  const [dept, setDept] = useState("All departments");
  const specById = new Map((state.specialists || []).map((s) => [s.id, s]));
  const due = state.trainees
    .filter((t) => t.status !== "Completed" || owesFinal(t, now))
    .filter((t) => dept === "All departments" || t.department === dept)
    .sort((a, b) => {
      const ia = checkpointInfo(a, now), ib = checkpointInfo(b, now);
      const da = ia ? ia.daysLeft : 9999, db = ib ? ib.daysLeft : 9999;
      if (da !== db) return da - db;                         // most overdue / soonest due first
      return (SUPPORT_RANK[a.support] - SUPPORT_RANK[b.support]) || (a.num - b.num);
    });
  const recentlyCompleted = state.trainees.filter((t) => t.status === "Completed").slice(0, 3);

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
      <div style={styles.roleNote}>
        Check-ins come due every two weeks from each trainee's start date. Performance evaluations (the six-area ratings) are done only at stage reviews and the final evaluation. A stage move is a decision made at a stage review: advancing needs the minimum time, the skills target (40% for Light, 80% for Independent) and the specialist's and supervisor's sign-off. Day 180 completion is fixed.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Show department:</span>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ ...styles.select, width: "auto", minWidth: 220 }}>
          <option>All departments</option>
          {(state.departments || []).map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {due.length === 0 ? (
        <div style={{ ...styles.panel, textAlign: "center", padding: 44, color: "var(--text-dim2)" }}>
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
                    <div style={{ fontSize: 17, color: "var(--text-strong)", fontWeight: 700 }}>{t.name}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 9, background: s.color }} />
                      <span style={{ fontSize: 13, color: s.color, fontWeight: 700 }}>{t.support}</span>
                      <span style={{ color: "var(--text-dim2)" }}>·</span>
                      <span style={{ fontSize: 13, color: "var(--text-soft)" }}>{t.department}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                      Specialist: {specById.has(t.specialistId) ? specById.get(t.specialistId).name : "Unassigned"}
                    </div>
                    <DueLine t={t} now={now} size={13} />
                    <StartDate t={t} onChange={onStartDate} size={12} />
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-dim)" }}>
                    <Clock size={14} /> Day {daysInTraining(t, now)} · {t.status}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span style={styles.chip}>
                    <span style={styles.mono}>{doneCount}/{t.skills.length}</span>
                    <span style={{ color: "var(--text-dim)" }}>skills mastered</span>
                  </span>
                </div>
                <StageBadges t={t} now={now} />
                {(() => {
                  const last = t.checkpoints[t.checkpoints.length - 1];
                  const text = last && (last.summary || last.note);
                  return text ? (
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)", fontStyle: "italic" }}>
                      Last check-in (day {last.day ?? "—"}): “{text}”
                    </div>
                  ) : null;
                })()}
                <button onClick={() => onLog(t.id)} style={{ ...styles.touchBtn, background: s.color, borderColor: s.color, color: "#04120f" }}>
                  <ClipboardCheck size={17} /> {(() => { const i = checkpointInfo(t, now); return i && i.kind === "gate" ? "Log stage review" : i && i.kind === "final" ? "Log final evaluation" : "Log check-in"; })()}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {recentlyCompleted.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-faint2)", fontWeight: 700, marginBottom: 8 }}>Recently completed</div>
          {recentlyCompleted.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--divider)", fontSize: 13, color: "var(--text-dim)" }}>
              <GraduationCap size={14} color="#10b981" />
              <span style={{ color: "var(--text-soft)" }}>{t.name}</span>
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

function Dashboard({ state, now, remove, reset, seed, archiveCompleted, openPrint, openLog, onStartDate }) {
  const { narrow } = useViewport();
  const [confirmReset, setConfirmReset] = useState(false);
  const active = state.trainees.filter((t) => t.status !== "Completed");
  const atRisk = active.filter((t) => t.support === "At risk").length;
  const dueCheckpoint = active.filter((t) => needsCheckpoint(t, now)).length + state.trainees.filter((t) => owesFinal(t, now)).length;
  const completed = state.trainees.filter((t) => t.status === "Completed").length;
  const archivable = state.trainees.filter((t) => t.status === "Completed" && !owesFinal(t, now)).length;
  const readyCount = active.filter((t) => (stageFlag(t, now) || {}).key === "ready").length;
  const reviewCount = active.filter((t) => ["review", "escalate"].includes((stageFlag(t, now) || {}).key)).length;

  const columns = STAGES.map((status) => ({
    status,
    trainees: state.trainees
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const r = SUPPORT_RANK[a.support] - SUPPORT_RANK[b.support];
        return r !== 0 ? r : (a.enrolledAt - b.enrolledAt) || (a.num - b.num);
      }),
  }));

  return (
    <div style={{ width: "100%", maxWidth: 1320, margin: "0 auto" }}>
      <div style={styles.kpiRow} className="no-print">
        <Kpi label="Active trainees" value={active.length} />
        <Kpi label="At risk" value={atRisk} accent="#ef4444" />
        <Kpi label="Check-in due" value={dueCheckpoint} accent="#f59e0b" />
        <Kpi label="Ready to advance" value={readyCount} accent="#22c55e" />
        <Kpi label="Needs stage review" value={reviewCount} accent="#ef4444" />
        <Kpi label="Completed (180-day)" value={completed} accent="#10b981" />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={seed} style={styles.ghostBtn}>Load demo trainees</button>
          <button onClick={archiveCompleted} disabled={archivable === 0} title="Downloads a backup file, then clears this specialist's completed trainees from the live list"
            style={{ ...styles.ghostBtn, opacity: archivable === 0 ? 0.4 : 1, cursor: archivable === 0 ? "not-allowed" : "pointer" }}>
            <Download size={14} /> Archive completed ({archivable})
          </button>
          {!confirmReset ? (
            <button key="reset" onClick={() => setConfirmReset(true)} disabled={state.trainees.length === 0}
              title="Removes every trainee listed for this specialist"
              style={{ ...styles.ghostBtn, opacity: state.trainees.length === 0 ? 0.4 : 1, cursor: state.trainees.length === 0 ? "not-allowed" : "pointer" }}>
              <RotateCcw size={14} /> Reset
            </button>
          ) : (
            <span key="confirm" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", border: "1px solid var(--bad-border)", background: "var(--bad-bg)", borderRadius: 8, padding: "5px 8px", fontSize: 12.5, color: "var(--text)" }}>
              Delete {state.trainees.length} trainee{state.trainees.length === 1 ? "" : "s"}?
              <button onClick={() => setConfirmReset(false)} style={styles.kGhost}>Cancel</button>
              <button onClick={() => { reset(); setConfirmReset(false); }} style={{ ...styles.kBtn, background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}>Delete</button>
            </span>
          )}
        </div>
      </div>

      {state.trainees.length === 0 ? (
        <div style={{ ...styles.panel, textAlign: "center", padding: 48, color: "var(--text-dim2)" }}>
          No trainees listed for this specialist yet. Enroll one from <b style={{ color: "var(--text-soft2)" }}>New trainee</b> or the <b style={{ color: "var(--text-soft2)" }}>Specialists</b> tab, or load demo trainees above.
        </div>
      ) : (
        <div style={styles.board(narrow)}>
          {columns.map((col) => (
            <BoardColumn key={col.status} status={col.status} trainees={col.trainees} now={now}
              specialists={state.specialists}
              remove={remove} openPrint={openPrint} openLog={openLog} onStartDate={onStartDate} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardColumn({ status, trainees, now, specialists, remove, openPrint, openLog, onStartDate }) {
  const Icon = STAGE_ICON[status];
  const dim = status === "Completed";
  return (
    <div style={styles.boardColumn}>
      <div style={styles.boardColumnHead}>
        <Icon size={15} style={{ color: dim ? "var(--text-faint2)" : "var(--accent-text)" }} />
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{status}</span>
        <span style={styles.boardCount}>{trainees.length}</span>
      </div>
      <div style={styles.boardColumnBody}>
        {trainees.length === 0 ? (
          <div style={styles.boardEmpty}>Nothing here</div>
        ) : (
          trainees.map((t) => (
            <TraineeCard key={t.id} t={t} now={now} specialist={(specialists || []).find((s) => s.id === t.specialistId)} remove={remove} openPrint={openPrint} openLog={openLog} onStartDate={onStartDate} />
          ))
        )}
      </div>
    </div>
  );
}

// Stage flag, skills-vs-target, rating trend and repeated-concern chips for a trainee card.
function StageBadges({ t, now, small }) {
  const done = t.status === "Completed";
  const flag = done ? null : stageFlag(t, now);
  const gs = done ? null : gateStatus(t, now);
  const trend = ratingTrend(t);
  const concerns = concernAreas(t);
  if (!flag && !gs && !trend && concerns.length === 0) return null;
  const fs = small ? 11.5 : 13, pad = small ? "2px 7px" : "3px 9px";
  const arrow = trend ? (trend.dir > 0 ? "↑" : trend.dir < 0 ? "↓" : "→") : "";
  const arrowColor = trend ? (trend.dir > 0 ? "#22c55e" : trend.dir < 0 ? "#ef4444" : "var(--text-dim)") : "";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
      {flag && (
        <span title={flag.detail} style={{ ...styles.chip, fontSize: fs, padding: pad, borderColor: flag.color, color: flag.color, fontWeight: 700 }}>
          {flag.label}
        </span>
      )}
      {gs && (
        <span title={`Time: day ${gs.floorDay} minimum ${gs.floorMet ? "(met)" : "(not yet)"}`} style={{ ...styles.chip, fontSize: fs, padding: pad }}>
          <span style={styles.mono}>{gs.pct}%</span>
          <span style={{ color: "var(--text-dim)" }}>skills · {gs.target}% for {shortStage(gs.to)}</span>
        </span>
      )}
      {trend && (
        <span title="Average of the six areas at the latest performance evaluation (1-3)" style={{ ...styles.chip, fontSize: fs, padding: pad }}>
          <span style={{ color: "var(--text-dim)" }}>Rating</span>
          <span style={styles.mono}>{trend.avg.toFixed(1)}</span>
          <span style={{ color: arrowColor, fontWeight: 800 }}>{arrow}</span>
        </span>
      )}
      {concerns.length > 0 && (
        <span title="Rated 'Needs improvement' at the last two check-ins" style={{ ...styles.chip, fontSize: fs, padding: pad, borderColor: "#ef4444", color: "#ef4444", fontWeight: 700 }}>
          Concern: {concerns.map((a) => a.label.split(" ")[0].replace(/[,&]$/, "")).join(", ")}
        </span>
      )}
    </div>
  );
}

// Areas x check-ins grid of the 1-3 ratings, so a slipping area stands out.
function RatingTrend({ trainee }) {
  const rated = (trainee.checkpoints || []).filter((c) => Object.keys(c.ratings || {}).length > 0).slice(-8);
  if (rated.length === 0) return null;
  const bg = { 1: "rgba(239,68,68,.30)", 2: "rgba(148,163,184,.16)", 3: "rgba(34,197,94,.30)" };
  const cell = { padding: "6px 8px", textAlign: "center", fontSize: 12.5, borderBottom: "1px solid var(--divider)" };
  return (
    <div style={{ border: "1px solid var(--border-strong)", background: "var(--card)", borderRadius: 11, padding: 14, marginBottom: 12, overflowX: "auto" }}>
      <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-text)", fontWeight: 700, marginBottom: 8 }}>
        Performance evaluations — last {rated.length}
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...cell, textAlign: "left", color: "var(--text-dim)", fontWeight: 600 }}>Area</th>
            {rated.map((c, i) => (
              <th key={i} style={{ ...cell, color: "var(--text-dim)", fontWeight: 600 }}>#{c.number ?? "·"}<div style={{ fontSize: 10.5, fontWeight: 400 }}>day {c.day ?? "—"}</div></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {EVAL_AREAS.map((a) => (
            <tr key={a.id}>
              <td style={{ ...cell, textAlign: "left", color: "var(--text-soft)" }}>{a.label}</td>
              {rated.map((c, i) => {
                const r = (c.ratings || {})[a.id];
                return <td key={i} style={{ ...cell, background: r ? bg[r] : "transparent", fontWeight: 700, color: "var(--text-strong)" }}>{r || "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 6 }}>1 = Needs improvement · 2 = Meets expectations · 3 = Exceeds expectations</div>
    </div>
  );
}

// "Checkpoint 3/13 · Due in 2 days (day 42)" — colored by urgency.
function DueLine({ t, now, size = 12 }) {
  if (t.status === "Completed") {
    return <div style={{ fontSize: size, marginTop: 3, color: "var(--text-dim)" }}>{t.checkpoints.length} of {CHECKPOINT_DAYS.length} check-ins logged</div>;
  }
  const info = checkpointInfo(t, now);
  if (!info) return <div style={{ fontSize: size, marginTop: 3, color: "var(--text-dim)" }}>All check-ins logged</div>;
  return (
    <div style={{ fontSize: size, marginTop: 3, color: CP_COLOR[info.state], fontWeight: info.state === "upcoming" ? 400 : 700 }}>
      {info.title} {info.number}/{info.total} · {info.label}{info.state === "upcoming" ? ` (day ${info.dueDay})` : ""}
    </div>
  );
}

// "Started Oct 1, 2026" — read-only on the main screens; the Change editor only appears on the Admin page.
function StartDate({ t, onChange, size = 12 }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(startToDate(t.enrolledAt));
  if (!onChange) return <div style={{ fontSize: size, color: "var(--text-dim2)", marginTop: 3 }}>Started {fmtDate(t.enrolledAt)}</div>;
  if (!editing) {
    return (
      <div style={{ fontSize: size, color: "var(--text-dim2)", marginTop: 3 }}>
        Started {fmtDate(t.enrolledAt)}{" "}
        <button onClick={() => { setVal(startToDate(t.enrolledAt)); setEditing(true); }} style={{ ...styles.linkBtn, fontSize: size }}>Change</button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
      <input type="date" value={val} max={todayStr()} onChange={(e) => setVal(e.target.value)}
        style={{ ...styles.input, width: "auto", padding: "5px 8px", fontSize: 12.5 }} />
      <button onClick={() => { onChange(t.id, val); setEditing(false); }} disabled={!val}
        style={{ ...styles.kBtn, background: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-ink)" }}>Save</button>
      <button onClick={() => setEditing(false)} style={styles.kGhost}>Cancel</button>
    </div>
  );
}

function TraineeCard({ t, now, specialist, remove, openPrint, openLog, onStartDate }) {
  const [confirming, setConfirming] = useState(false);
  const s = supportMeta(t.support);
  const day = daysInTraining(t, now);
  const done = t.status === "Completed";
  const finalOwed = owesFinal(t, now);
  const doneCount = t.skills.filter((k) => k.done).length;

  return (
    <div style={{ ...styles.kCard, borderLeft: `4px solid ${s.color}`, opacity: done && !finalOwed ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, color: "var(--text-strong)" }}>{t.name}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-dim2)" }}>
          <Clock size={12} /> Day {day}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color }} />
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{t.support} · {t.department}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-dim2)", marginTop: 3 }}>
        Specialist: <span style={{ color: specialist ? "var(--text-soft)" : "var(--text-faint)", fontWeight: specialist ? 600 : 400 }}>{specialist ? specialist.name : "Unassigned"}</span>
      </div>
      <DueLine t={t} now={now} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
        <span style={{ ...styles.chip, fontSize: 11.5, padding: "2px 7px" }}>
          <span style={styles.mono}>{doneCount}/{t.skills.length}</span>
          <span style={{ color: "var(--text-dim)" }}>mastered</span>
        </span>
      </div>
      <StageBadges t={t} now={now} small />
      {!done && <StartDate t={t} onChange={onStartDate} size={11.5} />}
      {t.note && <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 6, fontStyle: "italic" }}>“{t.note}”</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }} className="no-print">
        {(!done || finalOwed) && (
          <>
            <button onClick={() => openLog(t.id)} style={{ ...styles.kBtn, background: s.color, borderColor: s.color, color: "#04120f" }}>
              <ClipboardCheck size={14} /> {finalOwed ? "Log final evaluation" : "Skills & check-in"}
            </button>
            {!done && <button onClick={() => openPrint(t.id)} style={styles.kGhost}><Printer size={14} /> Print checkpoint sheet</button>}
          </>
        )}
        {done && (
          <div style={{ ...styles.kGhost, borderStyle: "dashed", color: "#10b981", justifyContent: "center", cursor: "default" }}>
            <GraduationCap size={14} /> 180-day complete
          </div>
        )}

        {!confirming ? (
          <button onClick={() => setConfirming(true)} style={{ ...styles.kGhost, color: "var(--text-faint2)" }}>Remove trainee</button>
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
      <div style={{ fontSize: 12, color: "var(--text-dim2)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: accent || "var(--text-strong)", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

/* ------------------------- Choosing whose trainees to see ------------------
   Trainees are only ever shown for one specialist at a time. ScopeBar is the
   dropdown above each trainee screen; SpecialistPicker is what those screens
   show until a specialist has been chosen.
---------------------------------------------------------------------------- */
function SpecialistPicker({ specialists, trainees, now, onSelect, onGoAdmin, maxWidth = 900 }) {
  const mine = (id) => trainees.filter((t) => t.specialistId === id);
  return (
    <div style={{ width: "100%", maxWidth, margin: "0 auto" }}>
      <div style={styles.panel}>
        <SectionLabel>Training specialists</SectionLabel>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 }}>
          Choose a specialist to see their trainees and how they're progressing.
        </div>
        {specialists.length === 0 ? (
          <div style={{ color: "var(--text-dim2)", fontSize: 14, padding: "6px 0" }}>
            There are no specialists yet.{" "}
            <button onClick={onGoAdmin} style={styles.linkBtn}>Add one on the Admin page</button> (password required).
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {specialists.map((s) => {
              const list = mine(s.id);
              const active = list.filter((t) => t.status !== "Completed");
              const due = list.filter((t) => (t.status !== "Completed" || owesFinal(t, now)) && needsCheckpoint(t, now)).length;
              const risk = active.filter((t) => t.support === "At risk").length;
              return (
                <button key={s.id} onClick={() => onSelect(s.id)} style={styles.pickerBtn}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>{s.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>{s.department}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    <span style={{ ...styles.chip, fontSize: 12, padding: "2px 8px" }}><span style={styles.mono}>{active.length}</span><span style={{ color: "var(--text-dim)" }}>active</span></span>
                    {due > 0 && <span style={{ ...styles.chip, fontSize: 12, padding: "2px 8px", borderColor: "#f59e0b", color: "#f59e0b" }}><span style={{ fontWeight: 800 }}>{due}</span> due</span>}
                    {risk > 0 && <span style={{ ...styles.chip, fontSize: 12, padding: "2px 8px", borderColor: "#ef4444", color: "#ef4444" }}><span style={{ fontWeight: 800 }}>{risk}</span> at risk</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Header inside a specialist: back to the list, who this is, and the three views.
function WorkspaceBar({ specialist, view, setView, onBack, activeCount, dueCount }) {
  const tabs = [
    { k: "queue", label: "Training queue", icon: Monitor, badge: activeCount },
    { k: "checkpoints", label: "Check-ins due", icon: ClipboardCheck, badge: dueCount, alert: true },
    { k: "print", label: "Checkpoint sheet", icon: Printer },
  ];
  return (
    <div className="no-print" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={onBack} style={styles.ghostBtn}><ChevronLeft size={15} /> All specialists</button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "var(--text-strong)" }}>{specialist.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Main department: <b style={{ color: "var(--text-soft)" }}>{specialist.department}</b></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = view === t.k;
          return (
            <button key={t.k} onClick={() => setView(t.k)} style={{ ...styles.tabBtn, padding: "10px 12px", ...(on ? styles.tabBtnActive : {}) }}>
              <Icon size={17} /><span>{t.label}</span>
              {t.badge > 0 && <span style={{ ...styles.badge, background: t.alert ? "#ef4444" : "var(--accent)", color: t.alert ? "#fff" : "var(--accent-ink)" }}>{t.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Admin (password protected) ------------------
   Add / edit / remove training specialists, move trainees between them, and
   correct trainee start dates. Locks again whenever you leave the page.
---------------------------------------------------------------------------- */
function AdminLogin({ hasPassword, onCreate, onLogin }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { if (!lockedUntil) return; const t = setInterval(() => setTick(Date.now()), 500); return () => clearInterval(t); }, [lockedUntil]);
  const waitLeft = Math.max(0, Math.ceil((lockedUntil - tick) / 1000));

  const submit = async () => {
    if (busy || waitLeft > 0) return;
    setErr("");
    if (!hasPassword) {
      if (pw.length < MIN_PW) return setErr(`Use at least ${MIN_PW} characters.`);
      if (pw !== pw2) return setErr("The two passwords don't match.");
      setBusy(true); await onCreate(pw); setBusy(false);
      return;
    }
    setBusy(true);
    const ok = await onLogin(pw);
    setBusy(false);
    if (!ok) {
      const n = fails + 1;
      setFails(n); setPw("");
      if (n % 5 === 0) { setLockedUntil(Date.now() + 30000); setTick(Date.now()); setErr("Too many attempts — wait 30 seconds."); }
      else setErr("Incorrect password.");
    }
  };
  const ready = hasPassword ? pw.length > 0 : pw.length > 0 && pw2.length > 0;

  return (
    <div style={{ width: "100%", maxWidth: 440, margin: "40px auto" }}>
      <div style={styles.panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Lock size={20} color="var(--accent-text)" />
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)" }}>{hasPassword ? "Admin page" : "Set the admin password"}</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 14 }}>
          {hasPassword
            ? "Adding training specialists and editing trainee start dates is password protected."
            : "No admin password has been set yet. Choose one now — whoever sets it first controls the Admin page, so do this before handing the app to anyone else."}
        </div>
        <label style={styles.fieldLabel}>{hasPassword ? "Password" : "New password"}</label>
        <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }} style={styles.input} />
        {!hasPassword && (
          <>
            <label style={{ ...styles.fieldLabel, marginTop: 12 }}>Confirm password</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} style={styles.input} />
          </>
        )}
        {(err || waitLeft > 0) && (
          <div style={{ fontSize: 12.5, color: "var(--bad-text)", marginTop: 10 }}>{waitLeft > 0 ? `Too many attempts — try again in ${waitLeft}s.` : err}</div>
        )}
        <button onClick={submit} disabled={!ready || busy || waitLeft > 0}
          style={{ ...styles.submitBtn, marginTop: 16, opacity: !ready || busy || waitLeft > 0 ? 0.4 : 1, cursor: !ready || busy || waitLeft > 0 ? "not-allowed" : "pointer" }}>
          {hasPassword ? "Unlock" : "Set password & unlock"} <ChevronRight size={17} />
        </button>
        {!hasPassword && (
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 10, lineHeight: 1.5 }}>
            Write it down somewhere safe — there is no password recovery. If it's lost, the app's saved data has to be cleared to start over.
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPage({ state, now, onLock, onChangePassword, onStartDate, children }) {
  return (
    <div style={{ width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Unlock size={18} color="var(--accent-text)" />
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)" }}>Admin</span>
          <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>— unlocked until you leave this page</span>
        </div>
        <button onClick={onLock} style={styles.ghostBtn}><Lock size={14} /> Lock now</button>
      </div>
      {children}
      <StartDatesPanel state={state} now={now} onStartDate={onStartDate} />
      <PasswordPanel onChange={onChangePassword} />
    </div>
  );
}

// Correct a trainee's start date. The check-in schedule follows; their stage is kept.
function StartDatesPanel({ state, now, onStartDate }) {
  const [filter, setFilter] = useState("");
  const known = new Set(state.specialists.map((s) => s.id));
  const nameOf = (t) => (state.specialists.find((s) => s.id === t.specialistId) || {}).name || "Unassigned";
  const list = state.trainees
    .filter((t) => !filter || (filter === UNASSIGNED ? !known.has(t.specialistId) : t.specialistId === filter))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || a.name.localeCompare(b.name));
  return (
    <div style={{ ...styles.panel, marginTop: 18 }}>
      <SectionLabel>Trainee start dates</SectionLabel>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 12, lineHeight: 1.5 }}>
        Fix a start date here if it was entered wrong. The check-in schedule re-times from the new date; the trainee's current stage stays as it is.
      </div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...styles.select, width: "auto", minWidth: 260, marginBottom: 12 }}>
        <option value="">All specialists</option>
        {state.specialists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        <option value={UNASSIGNED}>Unassigned</option>
      </select>
      {list.length === 0 ? (
        <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "10px 0" }}>No trainees to show.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map((t) => (
            <div key={t.id} style={{ ...styles.lineRow, flexWrap: "wrap", gap: 10, padding: "10px 12px", opacity: t.status === "Completed" ? 0.6 : 1 }}>
              <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                <div style={{ fontWeight: 700, color: "var(--text-strong)" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{nameOf(t)} · {t.department} · {t.status} · day {daysInTraining(t, now)}</div>
              </div>
              <StartDate key={`${t.id}-${t.enrolledAt}`} t={t} onChange={onStartDate} size={13} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PasswordPanel({ onChange }) {
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [msg, setMsg] = useState(null);
  const submit = async () => {
    setMsg(null);
    if (n1.length < MIN_PW) return setMsg({ bad: true, text: `Use at least ${MIN_PW} characters.` });
    if (n1 !== n2) return setMsg({ bad: true, text: "The new passwords don't match." });
    const ok = await onChange(cur, n1);
    if (ok) { setCur(""); setN1(""); setN2(""); setMsg({ text: "Password changed." }); }
    else setMsg({ bad: true, text: "Current password is incorrect." });
  };
  return (
    <div style={{ ...styles.panel, marginTop: 18 }}>
      <SectionLabel>Admin password</SectionLabel>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px" }}><label style={styles.fieldLabel}>Current</label>
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} style={styles.input} /></div>
        <div style={{ flex: "1 1 180px" }}><label style={styles.fieldLabel}>New</label>
          <input type="password" value={n1} onChange={(e) => setN1(e.target.value)} style={styles.input} /></div>
        <div style={{ flex: "1 1 180px" }}><label style={styles.fieldLabel}>Confirm new</label>
          <input type="password" value={n2} onChange={(e) => setN2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} style={styles.input} /></div>
        <button onClick={submit} disabled={!cur || !n1 || !n2} style={{ ...styles.primaryBtn, opacity: cur && n1 && n2 ? 1 : 0.4, cursor: cur && n1 && n2 ? "pointer" : "not-allowed" }}>Change</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, marginTop: 10, color: msg.bad ? "var(--bad-text)" : "#22c55e" }}>{msg.text}</div>}
    </div>
  );
}

/* ------------------------------ Specialists --------------------------------
   Add training specialists (each with a main department). A specialist's
   trainees stay hidden until you open that specialist; from there you can add
   a new trainee, claim an unassigned one, or move a trainee to someone else.
---------------------------------------------------------------------------- */
const bySupportThenAge = (a, b) => {
  const aDone = a.status === "Completed" ? 1 : 0;
  const bDone = b.status === "Completed" ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  const r = SUPPORT_RANK[a.support] - SUPPORT_RANK[b.support];
  return r !== 0 ? r : (a.enrolledAt - b.enrolledAt) || (a.num - b.num);
};

function Specialists({ state, onAddSpecialist, onUpdateSpecialist, onRemoveSpecialist, onAddTrainee, onAssign, onLog, onManageDepartments }) {
  const { departments, specialists, trainees } = state;
  const [activeId, onSelect] = useState(null);      // which specialist card is open (Admin page only)
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(departments[0]);
  useEffect(() => { if (!departments.includes(department)) setDepartment(departments[0]); }, [departments]); // eslint-disable-line

  const submit = () => {
    if (!name.trim()) return;
    onAddSpecialist({ name: name.trim(), department });
    setName("");
  };

  const presetCount = (dept) => resolvePreset(state.deptSkills, dept, state.skills).length;
  const knownIds = new Set(specialists.map((s) => s.id));
  const unassigned = trainees.filter((t) => !knownIds.has(t.specialistId)).sort(bySupportThenAge);

  return (
    <div style={{ width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={styles.roleNote}>
        Add each training specialist with their main department. A specialist's trainees only appear once you open them
        ("View trainees") — then you can add a new trainee under them, or move trainees between specialists.
      </div>

      <div style={{ ...styles.panel, marginBottom: 18 }}>
        <SectionLabel>Add a training specialist</SectionLabel>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 220px" }}>
            <label style={styles.fieldLabel}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="First and last name" style={styles.input} />
          </div>
          <div style={{ flex: "2 1 240px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={styles.fieldLabel}>Main department</label>
              <button onClick={onManageDepartments} style={styles.linkBtn}>Manage departments</button>
            </div>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={styles.select}>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={!name.trim()}
            style={{ ...styles.primaryBtn, opacity: name.trim() ? 1 : 0.4, cursor: name.trim() ? "pointer" : "not-allowed" }}>
            <Plus size={16} /> Add specialist
          </button>
        </div>
      </div>

      {specialists.length === 0 ? (
        <div style={{ ...styles.panel, textAlign: "center", padding: 44, color: "var(--text-dim2)" }}>
          No specialists yet. Add the first one above, then add trainees under them.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {specialists.map((sp) => (
            <SpecialistCard key={sp.id} sp={sp} state={state} expanded={activeId === sp.id} presetCount={presetCount}
              onSelect={onSelect} onUpdate={onUpdateSpecialist} onRemove={onRemoveSpecialist}
              onAddTrainee={onAddTrainee} onAssign={onAssign} onLog={onLog} />
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <UnassignedCard list={unassigned} specialists={specialists} expanded={activeId === UNASSIGNED}
          onSelect={onSelect} onAssign={onAssign} onLog={onLog} />
      )}
    </div>
  );
}

// The rows of trainees under one specialist (or the unassigned group when currentId is null).
function TraineeRows({ list, specialists, currentId, onAssign, onLog }) {
  const others = specialists.filter((s) => s.id !== currentId);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {list.map((t) => {
        const s = supportMeta(t.support);
        const done = t.status === "Completed";
        const mastered = t.skills.filter((k) => k.done).length;
        return (
          <div key={t.id} style={{ ...styles.lineRow, flexWrap: "wrap", gap: 10, padding: "10px 12px", opacity: done ? 0.6 : 1 }}>
            <div style={{ minWidth: 0, flex: "1 1 200px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: "var(--text-strong)" }}>{t.name}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{t.department} · {t.status} · {t.support}</div>
            </div>
            <span style={styles.chip}>
              <span style={styles.mono}>{mastered}/{t.skills.length}</span>
              <span style={{ color: "var(--text-dim)" }}>mastered</span>
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {!done && (
                <button onClick={() => onLog(t.id)} style={{ ...styles.kBtn, background: s.color, borderColor: s.color, color: "#04120f" }}>
                  <ClipboardCheck size={14} /> Skills & check-in
                </button>
              )}
              {(currentId || others.length > 0) && (
                <select value="" onChange={(e) => e.target.value && onAssign(t.id, e.target.value === "__none" ? null : e.target.value)}
                  style={{ ...styles.select, width: "auto", minWidth: 120, padding: "7px 8px", fontSize: 12.5 }}>
                  <option value="">{currentId ? "Reassign…" : "Assign to…"}</option>
                  {currentId && <option value="__none">Unassigned</option>}
                  {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Open/close button for a specialist card. Distinct keys so React swaps the element
// instead of restyling it (the two buttons use different border styles).
function ToggleBtn({ expanded, onOpen, onClose }) {
  return expanded
    ? <button key="close" onClick={onClose} style={styles.kGhost}>Close</button>
    : <button key="open" onClick={onOpen} style={{ ...styles.kBtn, background: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-ink)" }}>View trainees</button>;
}

function SpecialistCard({ sp, state, expanded, presetCount, onSelect, onUpdate, onRemove, onAddTrainee, onAssign, onLog }) {
  const { departments, specialists, trainees } = state;
  // Keep the current value selectable even if that department was later removed.
  const deptOptions = departments.includes(sp.department) ? departments : [sp.department, ...departments];

  const mine = trainees.filter((t) => t.specialistId === sp.id).sort(bySupportThenAge);
  const active = mine.filter((t) => t.status !== "Completed");
  const atRisk = active.filter((t) => t.support === "At risk").length;
  // Trainees nobody has yet — the only ones that can be pulled in from here.
  const claimable = trainees.filter((t) => t.status !== "Completed" && !specialists.some((s) => s.id === t.specialistId));

  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState(sp.name);
  const [eDept, setEDept] = useState(sp.department);
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tName, setTName] = useState("");
  const [tDept, setTDept] = useState(sp.department);
  const [tNote, setTNote] = useState("");
  const [tStart, setTStart] = useState(todayStr());

  const skillCount = presetCount(tDept);
  const canEnroll = tName.trim() && skillCount > 0;

  const startEdit = () => { setEName(sp.name); setEDept(sp.department); setConfirming(false); setEditing(true); };
  const saveEdit = () => { onUpdate(sp.id, { name: eName.trim() || sp.name, department: eDept }); setEditing(false); };
  const submitTrainee = () => {
    if (!canEnroll) return;
    onAddTrainee({ name: tName.trim(), department: tDept, note: tNote, specialistId: sp.id, startDate: tStart });
    setTName(""); setTNote("");
  };

  return (
    <div style={{ ...styles.panel, border: expanded ? "1px solid var(--accent-wash-border)" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        {editing ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "1 1 360px" }}>
            <input value={eName} onChange={(e) => setEName(e.target.value)} style={{ ...styles.input, flex: "1 1 160px", width: "auto" }} />
            <select value={eDept} onChange={(e) => setEDept(e.target.value)} style={{ ...styles.select, flex: "1 1 200px", width: "auto" }}>
              {deptOptions.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button onClick={saveEdit} style={styles.primaryBtn}>Save</button>
            <button onClick={() => setEditing(false)} style={styles.ghostBtn}>Cancel</button>
            {!confirming && (
              <button onClick={() => setConfirming(true)} style={{ ...styles.ghostBtn, color: "var(--text-faint2)" }}>Remove specialist</button>
            )}
          </div>
        ) : (
          <>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)" }}>{sp.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>
                Main department: <span style={{ color: "var(--text-soft)", fontWeight: 600 }}>{sp.department}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={styles.chip}><span style={styles.mono}>{active.length}</span><span style={{ color: "var(--text-dim)" }}>active</span></span>
              {atRisk > 0 && (
                <span style={styles.chip}><span style={{ color: "#ef4444", fontWeight: 700 }}>{atRisk}</span><span style={{ color: "var(--text-dim)" }}>at risk</span></span>
              )}
              <button onClick={startEdit} style={styles.ghostBtn}>Edit</button>
              <ToggleBtn expanded={expanded} onOpen={() => onSelect(sp.id)} onClose={() => onSelect(null)} />
            </div>
          </>
        )}
      </div>

      {confirming && (
        <div style={{ border: "1px solid var(--bad-border)", background: "var(--bad-bg)", borderRadius: 8, padding: 10, marginTop: 12 }}>
          <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 8, fontWeight: 600 }}>
            Remove {sp.name}?{mine.length > 0 ? ` Their ${mine.length} trainee${mine.length > 1 ? "s" : ""} will become unassigned (not deleted).` : ""}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setConfirming(false)} style={{ ...styles.kGhost, flex: 1 }}>Keep</button>
            <button onClick={() => onRemove(sp.id)} style={{ ...styles.kBtn, flex: 1, background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}>Remove</button>
          </div>
        </div>
      )}

      {expanded && (
        <>
          <div style={{ marginTop: 14 }}>
            {mine.length === 0 ? (
              <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "14px 0", textAlign: "center" }}>
                No trainees under {sp.name} yet. Add one below.
              </div>
            ) : (
              <TraineeRows list={mine} specialists={specialists} currentId={sp.id} onAssign={onAssign} onLog={onLog} />
            )}
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            {!adding ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => { setTDept(deptOptions.includes(sp.department) ? sp.department : deptOptions[0]); setAdding(true); }} style={styles.primaryBtn}>
                  <Plus size={16} /> Add trainee
                </button>
                {claimable.length > 0 && (
                  <select value="" onChange={(e) => e.target.value && onAssign(e.target.value, sp.id)}
                    style={{ ...styles.select, width: "auto", minWidth: 240, maxWidth: "100%" }}>
                    <option value="">Add an unassigned trainee…</option>
                    {claimable.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.department}</option>)}
                  </select>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", color: "var(--accent-text)", fontWeight: 700 }}>
                  New trainee under {sp.name}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={tName} onChange={(e) => setTName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitTrainee(); }}
                    placeholder="Trainee name" style={{ ...styles.input, flex: "1 1 200px", width: "auto" }} />
                  <select value={tDept} onChange={(e) => setTDept(e.target.value)} style={{ ...styles.select, flex: "1 1 220px", width: "auto" }}>
                    {deptOptions.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <input value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="Note (optional)" style={styles.input} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ ...styles.fieldLabel, margin: 0 }}>Training start date</label>
                  <input type="date" value={tStart} max={todayStr()} onChange={(e) => setTStart(e.target.value || todayStr())}
                    style={{ ...styles.input, width: "auto", padding: "7px 9px" }} />
                </div>
                <div style={{ fontSize: 12.5, color: skillCount === 0 ? "#f59e0b" : "var(--text-dim)" }}>
                  {skillCount === 0
                    ? `No preset skills are set for ${tDept} yet — add some from "Edit skill presets" on the New trainee tab before enrolling.`
                    : `${skillCount} skills will be assigned automatically from the ${tDept} preset.`}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={submitTrainee} disabled={!canEnroll}
                    style={{ ...styles.primaryBtn, opacity: canEnroll ? 1 : 0.4, cursor: canEnroll ? "pointer" : "not-allowed" }}>
                    Enroll under {sp.name}
                  </button>
                  <button onClick={() => setAdding(false)} style={styles.ghostBtn}>Done</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function UnassignedCard({ list, specialists, expanded, onSelect, onAssign, onLog }) {
  const active = list.filter((t) => t.status !== "Completed").length;
  return (
    <div style={{ ...styles.panel, marginTop: 18, border: expanded ? "1px solid var(--accent-wash-border)" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)" }}>Unassigned trainees</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>
            Not under a specialist yet — assign each one to a specialist.
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={styles.chip}><span style={styles.mono}>{active}</span><span style={{ color: "var(--text-dim)" }}>active</span></span>
          <ToggleBtn expanded={expanded} onOpen={() => onSelect(UNASSIGNED)} onClose={() => onSelect(null)} />
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 14 }}>
          <TraineeRows list={list} specialists={specialists} currentId={null} onAssign={onAssign} onLog={onLog} />
        </div>
      )}
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
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Trainee:</span>
        <select value={selId || ""} onChange={(e) => setSelId(e.target.value)} style={{ ...styles.select, width: "auto", minWidth: 260 }}>
          {printable.length === 0 && <option>No active trainees</option>}
          {printable.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.status} — {x.department}</option>)}
        </select>
        <button onClick={() => window.print()} disabled={!t} style={{ ...styles.primaryBtn, opacity: t ? 1 : 0.4 }}>
          <Printer size={16} /> Print sheet
        </button>
        <span style={{ color: "var(--text-faint)", fontSize: 12 }}>Page 1 = skills checklist · Page 2 = trainer / supervisor sign-off.</span>
      </div>

      {!t ? (
        <div style={{ ...styles.panel, textAlign: "center", padding: 40, color: "var(--text-dim2)" }}>Nothing to print — enroll a trainee first.</div>
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
                {(state.specialists || []).find((s) => s.id === t.specialistId) && (
                  <div>Specialist: <b>{(state.specialists || []).find((s) => s.id === t.specialistId).name}</b></div>
                )}
                <div>Started {new Date(t.enrolledAt).toLocaleDateString()} · Day <b>{daysInTraining(t, Date.now())}</b> of {PROGRAM_DAYS}</div>
                {(() => { const ci = checkpointInfo(t, Date.now()); return ci ? <div>Next: {ci.title.toLowerCase()} {ci.number} of {ci.total} · due day {ci.dueDay}</div> : null; })()}
              </div>
            </div>
            {t.note && <div style={{ margin: "8px 0", fontStyle: "italic", color: "#444" }}>Note: {t.note}</div>}
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Category", "Skill", "Status", "Comment"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...t.skills].sort((a, b) => a.category.localeCompare(b.category)).map((s) => (
                  <tr key={s.id}>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{s.category}</td>
                    <td style={styles.td}>{s.desc}</td>
                    <td style={{ ...styles.td, textAlign: "center" }}>{s.done ? `✔ Mastered${s.doneAt ? ` (${new Date(s.doneAt).toLocaleDateString()})` : ""}` : "☐ Not yet"}</td>
                    <td style={styles.td}>{s.comment || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...styles.sheetPage, marginTop: 18, borderTop: "2px dashed #ccc", paddingTop: 18 }}>
            {(() => {
              const last = t.checkpoints[t.checkpoints.length - 1];
              if (!last) return null;
              const rows = EVAL_AREAS.filter((a) => (last.ratings || {})[a.id] || (last.areaNotes || {})[a.id]);
              return (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, letterSpacing: 2, color: "#555", textTransform: "uppercase", marginBottom: 8 }}>
                    Latest {(KIND_LABEL[last.kind] || "Check-in").toLowerCase()} — #{last.number ?? t.checkpoints.length} · day {last.day ?? "—"} · {new Date(last.at).toLocaleDateString()}
                  </div>
                  {rows.length > 0 && (
                    <table style={styles.table}>
                      <thead><tr>{["Area", "Rating", "Notes"].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {rows.map((a) => (
                          <tr key={a.id}>
                            <td style={{ ...styles.td, fontWeight: 700 }}>{a.label}</td>
                            <td style={styles.td}>{(last.ratings || {})[a.id] ? ratingLabel(last.ratings[a.id]) : "—"}</td>
                            <td style={styles.td}>{(last.areaNotes || {})[a.id] || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ marginTop: 8, fontSize: 13, color: "#222" }}><b>Overall:</b> {last.support || "On track"}</div>
                  {(last.summary || last.note) && <div style={{ marginTop: 4, fontSize: 13, color: "#222" }}><b>Comments:</b> {last.summary || last.note}</div>}
                </div>
              );
            })()}
            {(() => {
              const ci = checkpointInfo(t, Date.now());
              const g = ci && ci.gate;
              if (!g) return null;
              return (
                <div style={{ marginBottom: 18, fontSize: 13, color: "#222", lineHeight: 1.6 }}>
                  <div style={{ fontSize: 12, letterSpacing: 2, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>
                    Stage decision — {shortStage(g.from)} → {shortStage(g.to)}
                  </div>
                  <div>Minimum time: day {g.floorDay} · <b>{g.floorMet ? "met" : "not yet"}</b></div>
                  <div>Skills mastered: {g.done}/{g.total} ({g.pct}%) · target {g.target}% · <b>{g.skillsMet ? "met" : "below target"}</b></div>
                  <div style={{ marginTop: 6 }}>☐ Advance to {shortStage(g.to)} &nbsp;&nbsp; ☐ Extend 2 weeks &nbsp;&nbsp;
                    <span style={{ color: "#666" }}>(advancing below the skills target needs a written reason)</span></div>
                </div>
              );
            })()}
            <div style={{ fontSize: 12, letterSpacing: 2, color: "#555", textTransform: "uppercase", marginBottom: 14 }}>
              Check-in sign-off — {t.name}
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
function LogMode({ trainee, now, onToggleSkill, onSkillComment, onSave, onClose }) {
  const [step, setStep] = useState("skills");
  const [ratings, setRatings] = useState({});
  const [areaNotes, setAreaNotes] = useState({});
  const [summary, setSummary] = useState("");
  const [support, setSupport] = useState(trainee.support);
  const [decision, setDecision] = useState(null);      // null = use the default (advance if ready, else extend)
  const [commentFor, setCommentFor] = useState(null);   // skill id whose comment box is open
  const [draft, setDraft] = useState("");
  const s = supportMeta(trainee.support);
  const doneCount = trainee.skills.filter((k) => k.done).length;
  const total = trainee.skills.length;
  const info = checkpointInfo(trainee, now);
  const day = daysInTraining(trainee, now);
  const rated = EVAL_AREAS.filter((a) => ratings[a.id]).length;
  const gate = info ? info.gate : null;
  const decisionEff = gate ? (decision || (gate.ready ? "advance" : "extend")) : null;
  const advancing = !!gate && decisionEff === "advance" && gate.floorMet;
  const override = advancing && !gate.skillsMet;               // advancing below the skills target
  const needsReason = override && !summary.trim();
  // Performance ratings are only for stage moves: stage reviews (once the minimum day is reached) and the final evaluation.
  const evalRequired = !!info && (info.kind === "final" || (info.kind === "gate" && gate.floorMet));
  const mustRateAll = evalRequired;
  const canSave = !!info && (!evalRequired || rated === EVAL_AREAS.length) && !needsReason;
  // Marking a skill mastered opens an optional comment box; mastered skills can always get or edit a comment.
  const toggleSkill = (sk) => {
    onToggleSkill(sk.id);
    if (!sk.done) { setCommentFor(sk.id); setDraft(""); } else if (commentFor === sk.id) setCommentFor(null);
  };
  const openComment = (sk) => { setCommentFor(sk.id); setDraft(sk.comment || ""); };
  const saveComment = () => { if (commentFor) onSkillComment(commentFor, draft.trim()); setCommentFor(null); };
  const history = [...trainee.checkpoints].reverse();
  const tabBtn = (key, label) => (
    <button onClick={() => setStep(key)} style={{ ...styles.pickTab, padding: "12px 6px", ...(step === key ? styles.pickTabOn : {}) }}>{label}</button>
  );

  const save = () => {
    const cleanNotes = {};
    EVAL_AREAS.forEach((a) => { const v = (areaNotes[a.id] || "").trim(); if (v) cleanNotes[a.id] = v; });
    const cleanRatings = {};
    EVAL_AREAS.forEach((a) => { if (ratings[a.id]) cleanRatings[a.id] = ratings[a.id]; });
    onSave({ support, ratings: cleanRatings, areaNotes: cleanNotes, summary: summary.trim(), decision: advancing ? "advance" : "extend" });
    onClose();
  };

  return (
    <div style={styles.pickOverlay} className="no-print">
      <div style={styles.pickHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 12, height: 12, borderRadius: 12, background: s.color, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, color: "var(--text-strong)", fontWeight: 700 }}>{trainee.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Day {day} · {trainee.status} · {trainee.department}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ ...styles.touchGhost, width: "auto", padding: "10px 14px" }}>
          <X size={16} /> Close
        </button>
      </div>

      <div style={styles.pickTabs}>
        {tabBtn("skills", `1 · Skills (${doneCount}/${total})`)}
        {tabBtn("checkpoint", "2 · Check-in")}
        {tabBtn("history", `3 · History (${history.length})`)}
      </div>

      <div style={styles.pickBody}>
        {step === "skills" && (
          <>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ height: "100%", width: `${total ? (doneCount / total) * 100 : 0}%`, background: s.color, transition: "width .2s" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trainee.skills.map((sk) => {
                const on = !!sk.done;
                const editing = commentFor === sk.id;
                return (
                  <div key={sk.id}>
                    <button onClick={() => toggleSkill(sk)} style={{ ...styles.pickRow, width: "100%", borderColor: on ? "var(--ok-border)" : "var(--border-strong)", background: on ? "var(--ok-bg)" : "var(--card)" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, border: `2px solid ${on ? "#22c55e" : "var(--text-faint3)"}`, background: on ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <CheckMark size={18} color="#04120f" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left", opacity: on ? 0.6 : 1 }}>
                        <div style={{ fontSize: 15 }}>{sk.desc}</div>
                        <div style={{ fontSize: 12, color: "var(--text-dim2)" }}>{sk.category}</div>
                      </div>
                      <span style={styles.mono}>{sk.id}</span>
                    </button>
                    {on && !editing && (
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", padding: "6px 4px 0 14px" }}>
                        {sk.comment && <span style={{ fontSize: 13, color: "var(--text-soft)", fontStyle: "italic" }}>“{sk.comment}”</span>}
                        <button onClick={() => openComment(sk)} style={{ ...styles.linkBtn, fontSize: 12.5 }}>{sk.comment ? "Edit comment" : "Add comment"}</button>
                      </div>
                    )}
                    {on && editing && (
                      <div style={{ padding: "8px 0 0 14px" }}>
                        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveComment(); }}
                          placeholder="Optional comment — how did they do on this skill?" style={styles.input} />
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <button onClick={saveComment} style={{ ...styles.kBtn, background: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-ink)" }}>Save comment</button>
                          <button onClick={() => setCommentFor(null)} style={styles.kGhost}>{sk.comment ? "Cancel" : "Skip"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setStep("checkpoint")} style={{ ...styles.touchBtn, background: s.color, borderColor: s.color, color: "#04120f", marginTop: 18 }}>
              Go to checkpoint <ChevronRight size={18} />
            </button>
          </>
        )}

        {step === "checkpoint" && (!info ? (
          <div style={{ ...styles.hint, textAlign: "center", padding: 24 }}>
            All {CHECKPOINT_DAYS.length} check-ins have been logged for {trainee.name}. See the History tab for the record.
          </div>
        ) : (
          <>
            <div style={{ border: "1px solid var(--border-strong)", background: "var(--card)", borderRadius: 11, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>
                {info.title} {info.number} of {info.total}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: CP_COLOR[info.state], marginTop: 3 }}>
                {info.label} · day {info.dueDay}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                Day {day} of {PROGRAM_DAYS} · started {fmtDate(trainee.enrolledAt)}
              </div>
              {info.kind === "gate" && (
                <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 8, lineHeight: 1.45 }}>
                  This is a stage review: after rating the six areas, decide with the supervisor whether {trainee.name.split(" ")[0]} moves up from <b>{shortStage(gate.from)}</b> to <b>{shortStage(gate.to)}</b> or gets two more weeks.
                </div>
              )}
              {info.kind === "final" && (
                <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 8, lineHeight: 1.45 }}>
                  Final performance evaluation for the 180-day program.
                </div>
              )}
              {info.state === "upcoming" && (
                <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6 }}>Not due yet — you can still save it early.</div>
              )}
            </div>

            {evalRequired ? (
              <>
            <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-text)", fontWeight: 700, marginBottom: 10 }}>
              Performance evaluation — rate each area
            </div>

            {EVAL_AREAS.map((a) => (
              <div key={a.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)" }}>
                  {a.label}{mustRateAll && <span style={{ color: "var(--bad-text)" }}> *</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 7 }}>{a.hint}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {RATINGS.map((r) => {
                    const on = ratings[a.id] === r.v;
                    return (
                      <button key={r.v} onClick={() => setRatings((p) => ({ ...p, [a.id]: on ? undefined : r.v }))}
                        style={{ flex: "1 1 30%", minHeight: 44, padding: "6px 4px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: on ? 800 : 600,
                          border: on ? "1px solid var(--accent-wash-border)" : "1px solid var(--border-strong)",
                          background: on ? "var(--accent-wash-bg-2)" : "var(--card)", color: on ? "var(--text-strong)" : "var(--text-soft)" }}>
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                <input value={areaNotes[a.id] || ""} onChange={(e) => setAreaNotes((p) => ({ ...p, [a.id]: e.target.value }))}
                  placeholder="Note (optional) — what did you see?" style={{ ...styles.input, marginTop: 7 }} />
              </div>
            ))}

              </>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 16 }}>
                {info.kind === "gate"
                  ? "It's too early for a stage move, so there's no performance evaluation yet. Just note how they're doing."
                  : "No performance evaluation at this check-in — those are done only at stage reviews and the final evaluation. Just note how they're doing."}
              </div>
            )}

            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)", marginBottom: 7 }}>Overall — how is {trainee.name.split(" ")[0]} doing?</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {SUPPORT_LEVELS.map((l) => {
                const on = support === l.key;
                return (
                  <button key={l.key} onClick={() => setSupport(l.key)}
                    style={{ flex: "1 1 30%", minHeight: 44, padding: "6px 4px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 800,
                      border: `1px solid ${on ? l.color : "var(--border-strong)"}`, background: on ? l.color : "var(--card)", color: on ? "#04120f" : "var(--text-soft)" }}>
                    {l.key}
                  </button>
                );
              })}
            </div>

            {gate && (
              <div style={{ border: "1px solid var(--border-strong)", background: "var(--card)", borderRadius: 11, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-text)", fontWeight: 700, marginBottom: 8 }}>
                  Stage decision — {shortStage(gate.from)} → {shortStage(gate.to)}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
                  <div>Time in training: day {day} · minimum day {gate.floorDay} — <b style={{ color: gate.floorMet ? "#22c55e" : "var(--bad-text)" }}>{gate.floorMet ? "met" : "not yet"}</b></div>
                  <div>Skills mastered: {gate.done}/{gate.total} (<b>{gate.pct}%</b>) · target {gate.target}% — <b style={{ color: gate.skillsMet ? "#22c55e" : "var(--warn-text)" }}>{gate.skillsMet ? "met" : "below target"}</b></div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {[
                    { key: "advance", label: `Advance to ${shortStage(gate.to)}${gate.floorMet && !gate.skillsMet ? " (override)" : ""}`, color: "#22c55e", disabled: !gate.floorMet },
                    { key: "extend", label: "Extend 2 weeks", color: "#f59e0b", disabled: false },
                  ].map((o) => {
                    const on = decisionEff === o.key && !(o.key === "advance" && !gate.floorMet);
                    return (
                      <button key={o.key} disabled={o.disabled} onClick={() => setDecision(o.key)}
                        style={{ flex: "1 1 45%", minHeight: 46, padding: "6px 8px", borderRadius: 9, fontSize: 13.5, fontWeight: 800,
                          cursor: o.disabled ? "not-allowed" : "pointer", opacity: o.disabled ? 0.4 : 1,
                          border: `1px solid ${on ? o.color : "var(--border-strong)"}`, background: on ? o.color : "var(--card)", color: on ? "#04120f" : "var(--text-soft)" }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12.5, color: needsReason ? "var(--warn-text)" : "var(--text-dim)", marginTop: 8, lineHeight: 1.45 }}>
                  {!gate.floorMet
                    ? `Too early to advance — the minimum is day ${gate.floorDay}. This check-in will be recorded as an extension.`
                    : override
                      ? "Advancing below the skills target is an override — add a comment below explaining why."
                      : gate.ready
                        ? "Time and skills requirements are met. Confirm the decision with the supervisor."
                        : "Skills are below target, so the default is two more weeks. Check more skills off first if they've been mastered."}
                </div>
              </div>
            )}

            <label style={styles.fieldLabel}>Overall comments{override ? " (required for an override)" : ""}</label>
            <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Strengths, errors to work on, next focus…" style={styles.input} />

            <button onClick={save} disabled={!canSave}
              style={{ ...styles.touchBtn, background: "#22c55e", borderColor: "#22c55e", color: "#04120f", marginTop: 18, opacity: canSave ? 1 : 0.4, cursor: canSave ? "pointer" : "not-allowed" }}>
              <ClipboardCheck size={18} /> {info.kind === "gate" ? "Save stage review" : info.kind === "final" ? "Save final evaluation" : "Save check-in"}
            </button>
            {!canSave && (
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>
                {evalRequired && rated < EVAL_AREAS.length
                  ? `Rate all ${EVAL_AREAS.length} areas to save (${rated} of ${EVAL_AREAS.length} so far).`
                  : "Add a comment explaining why you're advancing below the skills target."}
              </div>
            )}
            <button onClick={() => setStep("skills")} style={{ ...styles.touchGhost, marginTop: 8 }}>
              <ChevronLeft size={16} /> Back to skills
            </button>
          </>
        ))}

        {step === "history" && (
          history.length === 0 ? (
            <div style={{ ...styles.hint, textAlign: "center", padding: 24 }}>No check-ins logged yet for {trainee.name}.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <RatingTrend trainee={trainee} />
              {history.map((c, i) => {
                const lv = supportMeta(c.support);
                const rows = EVAL_AREAS.filter((a) => (c.ratings || {})[a.id] || (c.areaNotes || {})[a.id]);
                return (
                  <div key={i} style={{ border: "1px solid var(--border-strong)", background: "var(--card)", borderRadius: 11, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)" }}>
                        {KIND_LABEL[c.kind] || "Check-in"} {c.number ?? history.length - i}
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 9, background: lv.color }} /> {c.support || "On track"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                      Day {c.day ?? "—"} · {fmtDate(c.at)}{c.stage ? ` · ${c.stage}` : ""}
                    </div>
                    {c.gate && (
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6, color: c.gate.decision === "advance" ? "#22c55e" : "var(--warn-text)" }}>
                        {c.gate.decision === "advance"
                          ? `Advanced ${shortStage(c.gate.from)} → ${shortStage(c.gate.to)}${c.gate.override ? ` (override — skills ${c.gate.pct}% vs ${c.gate.target}% target)` : ""}`
                          : `Extended — stays in ${shortStage(c.gate.from)} (skills ${c.gate.pct}% vs ${c.gate.target}% target)`}
                      </div>
                    )}
                    {(c.summary || c.note) && <div style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.45 }}>{c.summary || c.note}</div>}
                    {rows.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {rows.map((a) => (
                          <div key={a.id} style={{ fontSize: 12.5, color: "var(--text-soft)" }}>
                            <b>{a.label}:</b> {(c.ratings || {})[a.id] ? ratingLabel(c.ratings[a.id]) : ""}{(c.areaNotes || {})[a.id] ? ` — ${c.areaNotes[a.id]}` : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
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
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 }}>
          These fill the "Department & shift" dropdown when enrolling a trainee. A new department starts with its family's default skill preset — adjust it from "Edit skill presets."
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {departments.map((d) => (
            <div key={d} style={styles.lineRow}>
              <span style={{ fontSize: 14 }}>{d}</span>
              <button onClick={() => onRemove(d)} disabled={departments.length <= 1}
                title={departments.length <= 1 ? "Keep at least one department" : "Remove"}
                style={{ ...styles.iconBtn, color: departments.length <= 1 ? "var(--text-faint3)" : "#c66", cursor: departments.length <= 1 ? "not-allowed" : "pointer" }}>
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
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 }}>
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
              <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-faint2)", fontWeight: 700, marginBottom: 6 }}>{cat}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {byCategory[cat].map((s) => {
                  const on = included.has(s.id);
                  return (
                    <button key={s.id} onClick={() => onToggle(dept, s.id)}
                      style={{ ...styles.lineRow, justifyContent: "flex-start", gap: 10, cursor: "pointer", border: `1px solid ${on ? "var(--ok-border)" : "var(--line-border)"}`, background: on ? "var(--ok-bg)" : "var(--card)" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${on ? "#22c55e" : "var(--text-faint3)"}`, background: on ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <CheckMark size={14} color="#04120f" />}
                      </div>
                      <span style={{ ...styles.mono, flexShrink: 0 }}>{s.id}</span>
                      <span style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "left" }}>{s.desc}</span>
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
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 }}>
          The master list of checklist items. To decide which apply to which department, use "Edit skill presets" instead — this screen only manages the catalog itself.
        </div>

        <SectionLabel>Load from file</SectionLabel>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
          Pick a CSV file (columns: <span style={styles.mono}>id, description, category</span>). This replaces the whole catalog.
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={onFile} style={{ display: "none" }} />
        <button onClick={() => fileRef.current && fileRef.current.click()} style={styles.primaryBtn}>Choose CSV file…</button>
        {msg && <div style={{ fontSize: 12.5, color: "var(--accent-text)", marginTop: 8 }}>{msg}</div>}

        <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />

        <SectionLabel>Bulk paste</SectionLabel>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>
          One skill per line: <span style={styles.mono}>id, description, category</span>. Commas or tabs.
        </div>
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5}
          placeholder={"SAF-05, Fire extinguisher location, Safety\nOPS-05, Second machine cross-train, Machine Ops"}
          style={{ ...styles.input, width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12.5, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={doReplace} disabled={!bulk.trim()} style={{ ...styles.primaryBtn, opacity: bulk.trim() ? 1 : 0.4 }}>Replace catalog</button>
          <button onClick={doAppend} disabled={!bulk.trim()} style={{ ...styles.touchGhost, width: "auto", padding: "10px 16px" }}>Add to catalog</button>
        </div>

        <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />

        <SectionLabel>Current skills</SectionLabel>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" style={{ ...styles.input, marginBottom: 8 }} />
        <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
          {shown.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13, padding: 6 }}>No skills{skills.length ? " match the filter" : " yet — import or add below"}.</div>}
          {shown.slice(0, 100).map((s) => (
            <div key={s.id} style={styles.lineRow}>
              <div style={{ minWidth: 0 }}>
                <span style={styles.mono}>{s.id}</span>
                <span style={{ color: "var(--text-dim)", fontSize: 13, marginLeft: 8 }}>{s.desc}</span>
                {s.category ? <span style={{ color: "var(--text-faint2)", fontSize: 12, marginLeft: 8 }}>{s.category}</span> : null}
              </div>
              <button onClick={() => onRemove(s.id)} title="Remove" style={{ ...styles.iconBtn, color: "#c66" }}><Trash2 size={15} /></button>
            </div>
          ))}
          {shown.length > 100 && <div style={{ color: "var(--text-faint)", fontSize: 12, padding: 6 }}>Showing 100 of {shown.length} — type in the filter to narrow.</div>}
        </div>

        <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />

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
const sans = "Arial, Helvetica, sans-serif";
const styles = {
  shell: { minHeight: "100vh", width: "100%", background: "var(--bg)", color: "var(--text)", fontFamily: sans, display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", gap: 20, padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--panel)", position: "sticky", top: 0, zIndex: 10 },
  logoMark: { width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, var(--accent-deep), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-ink)", fontSize: 18, fontWeight: 900 },
  body: { flex: 1, padding: "26px 20px", display: "flex", flexDirection: "column" },
  tabBtn: { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: "transparent", background: "transparent", color: "var(--text-dim)", fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" },
  tabBtnActive: { background: "var(--accent-wash-bg)", borderColor: "var(--accent-wash-border)", color: "var(--accent-text)" },
  badge: { background: "#ef4444", color: "#fff", borderRadius: 20, fontSize: 11, padding: "1px 7px", fontWeight: 800 },
  panel: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 },
  fieldLabel: { display: "block", fontSize: 13, color: "var(--text-dim)", marginBottom: 6 },
  select: { width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--card)", border: "1px solid var(--border-input)", color: "var(--input-text)", fontSize: 14, outline: "none" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--card)", border: "1px solid var(--border-input)", color: "var(--input-text)", fontSize: 14, outline: "none", boxSizing: "border-box" },
  hint: { fontSize: 12.5, color: "var(--text-dim2)", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5 },
  dropdown: { marginTop: 8, border: "1px solid var(--border-input)", borderRadius: 8, overflowY: "auto", maxHeight: 280, background: "var(--card)" },
  optionRow: { display: "flex", alignItems: "center", width: "100%", padding: "9px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--divider)", color: "var(--text)", cursor: "pointer", textAlign: "left" },
  mono: { fontFamily: "ui-monospace, Menlo, Consolas, monospace", letterSpacing: 0.5, color: "var(--mono-text)" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8, background: "var(--accent)", border: "1px solid var(--accent)", color: "var(--accent-ink)", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  touchBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px 14px", borderRadius: 9, border: "1px solid", fontWeight: 700, fontSize: 15, cursor: "pointer", minHeight: 46 },
  touchGhost: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 14px", borderRadius: 9, background: "transparent", border: "1px solid var(--border-soft)", color: "var(--text-soft)", fontWeight: 600, fontSize: 14, cursor: "pointer", minHeight: 44 },
  roleNote: { fontSize: 12.5, color: "var(--text)", background: "var(--accent-wash-bg)", border: "1px solid var(--accent-wash-border)", borderRadius: 8, padding: "9px 11px", marginBottom: 16, lineHeight: 1.5 },
  linkBtn: { background: "transparent", border: "none", color: "var(--accent-text)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" },
  overlay: { position: "fixed", inset: 0, background: "rgba(4,7,11,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  modal: { width: "100%", maxWidth: 440, boxSizing: "border-box", background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: 14, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,.5)" },
  lineRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--card)", border: "1px solid var(--line-border)", borderRadius: 8, padding: "9px 8px 9px 12px" },
  pickOverlay: { position: "fixed", inset: 0, background: "var(--bg)", zIndex: 60, display: "flex", flexDirection: "column" },
  pickHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border)", background: "var(--panel)" },
  pickTabs: { display: "flex", gap: 8, padding: "12px 16px 0" },
  pickTab: { flex: 1, padding: "12px", borderRadius: "9px 9px 0 0", borderWidth: "1px 1px 0 1px", borderStyle: "solid", borderColor: "var(--border)", background: "var(--panel)", color: "var(--text-dim)", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  pickTabOn: { background: "var(--tab-active-bg)", color: "var(--accent-text)", borderColor: "var(--accent-wash-border)" },
  pickBody: { flex: 1, overflowY: "auto", padding: "18px 16px 28px", maxWidth: 620, width: "100%", margin: "0 auto", boxSizing: "border-box" },
  pickRow: { display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 11, border: "1px solid", cursor: "pointer", width: "100%", minHeight: 64 },
  submitBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 18, padding: "13px", borderRadius: 10, background: "var(--accent)", border: "none", color: "var(--accent-ink)", fontWeight: 800, fontSize: 15 },
  iconBtn: { background: "transparent", border: "none", color: "var(--text-faint2)", cursor: "pointer", padding: 4, marginLeft: 6 },
  lineItem: { display: "flex", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--divider)" },
  kpiRow: { display: "flex", gap: 12, marginBottom: 16, alignItems: "stretch", flexWrap: "wrap" },
  kpi: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", minWidth: 120 },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "1px solid var(--border-input)", color: "var(--text-soft)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  card: { display: "flex", gap: 16, alignItems: "flex-start", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--chip-border)", borderRadius: 7, padding: "3px 9px", fontSize: 13 },
  sheet: { background: "#fff", color: "#111", borderRadius: 8, padding: 34, boxShadow: "0 10px 40px rgba(0,0,0,.4)" },
  sheetPage: {},
  sheetHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #111", paddingBottom: 10 },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 12 },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#666", borderBottom: "1.5px solid #ccc", padding: "7px 8px" },
  td: { padding: "9px 8px", borderBottom: "1px solid #eee", fontSize: 14, color: "#222", verticalAlign: "top" },
  navGroup: { display: "flex", alignItems: "center", gap: 6 },
  navGroupLabel: { fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--text-faint2)", fontWeight: 700, padding: "0 4px 0 6px" },
  navDivider: { width: 1, height: 22, background: "var(--border-strong)", margin: "0 8px" },
  board: (narrow) => ({ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(4, minmax(0,1fr))", gap: 14, alignItems: "start" }),
  boardColumn: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", flexDirection: "column", minHeight: 140 },
  boardColumnHead: { display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--border)" },
  boardCount: { marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--text-dim2)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 20, padding: "1px 8px" },
  boardColumnBody: { padding: 10, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: "calc(100vh - 300px)" },
  boardEmpty: { color: "var(--text-faint3)", fontSize: 12.5, textAlign: "center", padding: "20px 6px" },
  kCard: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 },
  kBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 10px", borderRadius: 7, border: "1px solid", fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  kGhost: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 7, background: "transparent", border: "1px solid var(--border-soft)", color: "var(--text-soft)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  stepRow: { display: "flex", gap: 14 },
  stepRail: { display: "flex", flexDirection: "column", alignItems: "center", width: 26, flexShrink: 0 },
  stepDot: { width: 24, height: 24, borderRadius: 24, background: "var(--accent-wash-bg-2)", border: "1.5px solid var(--accent)", color: "var(--accent-text)", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepLine: { flex: 1, width: 2, background: "var(--line-border)", marginTop: 4, minHeight: 24 },
  stepContent: { flex: 1, paddingBottom: 26, minWidth: 0 },
  stepLabel: { fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", color: "var(--accent-text)", fontWeight: 700, marginBottom: 10 },
  pickerBtn: { display: "block", width: "100%", textAlign: "left", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 14, cursor: "pointer", color: "var(--text)" },
  signBox: { border: "1px solid #ddd", borderRadius: 8, padding: "14px 14px 10px" },
};
