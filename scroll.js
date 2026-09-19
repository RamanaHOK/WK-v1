/* ============================================
   PREVAILER MATATU JOURNEY — scroll.js
   Continuous rAF engine: scroll-driven + time-based motion
   ============================================ */

const SCENES = 32; // ends after scene-73, the Figma-numbered CREDITS screen (2 more content
// screens added after the scene-60 closing chapter — see SCENE_LABELS below for the real
// scene numbers, which don't run contiguously with the array index)
// Per-scene scroll multipliers — how many viewport-widths of scroll each scene consumes.
// Lower = faster transition. Scene 4 (savanna) is intentionally quick.
const SCENE_SCROLL = [
  1.8,  // 0  → scene-1  (jungle intro — extra scroll room added as a "start" beat: PARK_AT
        // and panel-1's timing are local fractions, so this just stretches the existing
        // bus-drives-in-and-parks entrance over more actual scrolling, no new content, no
        // index/renumbering risk)
  1.2,  // 1  → scene-2  (jungle story)
  1.2,  // 2  → scene-3  (jungle detail)
  0.4,  // 3  → scene-4  (savanna — intentionally fast)
  1.2,  // 4  → scene-5  (city arrival)
  1.2,  // 5  → scene-6  (city continued)
  1.5,  // 6  → scene-7  (bus stop characters)
  14.0, // 7  → scene-8  (problem plaza + zoom sequence)
  1.5,  // 8  → scene-12 (wide city s12-s15, part A)
  11.0, // 9  → scene-13 (wide city — zoom + popups — was 8.0, raised so the zoom feels slower
        // per scroll-tick; the zoom/popup timings are all local fractions of this total, so
        // raising it stretches everything proportionally without changing any of their
        // relative timing to each other)
  4.0,  // 10 → scene-21 (top-down road — 3 vehicles in 3 lanes)
  2.0,  // 11 → scene-26 (street arrival — ambient characters)
  1.3,  // 12 → scene-27 (Asmelash Teka Hadgu & Away Ly swap in together)
  1.3,  // 13 → scene-28 (Chris Emezue & Kathleen Siminyu swap in together)
  1.3,  // 14 → scene-29 (Sadik Shahadu & Samuel Rutunda swap in together)
  3.5,  // 15 → scene-30 (zoom + Awa Ly's message — widened so the hold has real scroll room)
  5.0,  // 16 → scene-32 (inside the matatu — extra "dummy" scroll runway, not new visual content, so the 4 popups/characters don't feel clubbed together)
  16.0,  // 17 → scene-33 (extra scroll runway — 5 popups + 4 characters (Asmelash x2,
        // pregnant woman x2, Sadik) packed into a small scene, was 1.5)
  1.5,  // 18 → scene-34
  6,  // 19 → scene-44 (slides down from the top over scene-34 — see #s44-overlay/animateS44 in scroll.js)
  6.0,  // 20 → scene-45 (inside the matatu, continued — Kathleen/toto moto/red lady/wheelchair man sequence — extra scroll runway so each one gets real time on screen, especially wheelchair man at the end)
  5.0,  // 21 → scene-46 (wheelchair man: approach pan -> zoom-in -> hold with the Huniki/Big
        // Tech popups -> release; extra scroll runway so each beat plays out gradually
        // instead of racing past, same reasoning as scene-45 above. Was 1.5.)
  20.5,  // 22 → scene-47 (wheelchair man ambient)
  5.4,  // 23 → scene-55 (street scene — matatu parked outside Municipal Federation building)
  0.01,  // 24 → scene-56 (second popup)
  0.4,  // 25 → scene-57 (third, bigger popup)
  0.3,  // 26 → scene-58 (pans past the street into clear sky)
  // Total 1.5 viewport-widths, matching #s55-s58-bg's new 150vw width (was 5.7/400vw) — no
  // dead scroll past where the content actually ends.
  2.5,  // 27 → scene-59 (park/lake — bridge, trees, bus driving through; first popup) —
    // slowed down further (was 0.3, then 0.7): the bus's own drive-in and the zoom-out
    // already use the full scene-local range, so more scroll room is the only way to make
    // both play out more gradually — same lever for "bus speed" and "scroll speed" here
  2.3,  // 28 → scene-60 (second popup — kids playing catch on the path; also the dramatic
    // zoom-out-leaving-scene-59 transition, was briefly bumped to 40 while the cloud cover was
    // scroll-scrubbed — that made reaching the end of the scene take tens of thousands of px
    // of scrolling (read as "stuck"). Reverted back now that s5973CloudsLottie triggers
    // instantly off s61PostZoomT instead of being scrubbed by scroll amount.)
  0.3,  // 29 → scene-63 (closing message — was briefly bumped to 40 for the same
    // now-obsolete scroll-scrub reason as scene-60 above; reverted (was 0.15 originally,
    // nudged up slightly so the ending message has a bit more comfortable scroll room)

  0.4,  // 30 → scene-72 (RESOURCES screen — was mislabeled scene-62 here, same renumbering)
  0.4,  // 31 → scene-73 (CREDITS screen — was mislabeled scene-63 here — story ends here)
];

// Real, on-screen scene number for each currentScene index above — the numbering a sighted
// viewer (and the ref-row-1/2/3 storyboard) actually uses, not the internal 0-based index.
// Shared by the debug scene readout (frame()) and the sceneBeats key lookup (checkSceneExtras)
// below, so both always agree with SCENE_SCROLL's own comments. The last 3 values (63, 72,
// 73) reflect the Figma storyboard's actual numbering for the closing chapter, confirmed
// against the storyboard screenshots — not the original 61/62/63 this array used to have.
const SCENE_LABELS = [1,2,3,4,5,6,7,8,12,13,21,26,27,28,29,30,32,33,34,44,45,46,47,55,56,57,58,59,60,63,72,73];

// ---- Per-scene configuration ----
// Tune each scene independently here.
const SCENE_CONFIG = {
  // Jungle bus keyframes — one continuous journey across scenes 1–3.
  // `scene` : which jungle scene (1, 2, or 3)
  // `at`    : 0–100  — percentage through THAT scene  (easy to read in the debug bar)
  // `x`     : bus left-edge position in vw  (negative = off-screen left, 0–70 = visible, 100+ = off-screen right)
  // Add as many stops as you like — engine interpolates between them.
  jungleBus: [
    { scene: 1, at:   0, x: -35 },   // scene 1,   0% — fully off-screen left
    { scene: 1, at:  5, x:   5 },   // scene 1,  50% — bus fully visible
    { scene: 1, at:  10, x:   10 },   // scene 1,  50% — bus fully visible
    { scene: 1, at:  15, x:   15 },   // scene 1,  50% — bus fully visible
    { scene: 1, at:  20, x:   15 },   // bus parks here
    { scene: 1, at:  50, x:   15 },   // hold stopped — no movement until scene 2
    { scene: 2, at:   0, x:  30 },   // scene 2,   0% — cruising
    { scene: 2, at: 100, x:  60 },   // scene 2, 100%
    { scene: 3, at:   0, x:  60 },   // scene 3,   0%
    { scene: 3, at:   5, x:  70 },   // scene 3,   5% — bus stops here (right edge = viewport edge)
    { scene: 3, at: 100, x:  70 },   // scene 3, 100% — frozen until scene 4 enters from right
  ],

  // City buses (scenes 5 & 6) — single speed per scene
  5: { hasBus: true, busSpeed: 1.5, busOffset: 0.26 },  // enters from left, fully visible at scene4 70%
  6: { hasBus: true, busSpeed: 1.5, busOffset: 0.085, noPreEntry: true }, // continues from scene5 bus exit position
  4: { hasBus: false },
};

// Scenes that share the single fixed jungle bus
const JUNGLE_BUS_SCENES = [1, 2, 3];

// Scene-8 shared constants
const S8_EXIT          = 0.77;  // legacy ref kept for nearBusClose offset
const ZOOM_END         = 0.36;  // zoom-in phase ends here
const S8_PAN_MAX       = 0.40;  // vw units the background strip pans left during zoom
const BUS_CLOSE        = 0.75;  // bus close-up zoom starts here (after second popup)
const BUS_SCROLL_START = 0.88;  // bus slides off right from here; strip transitions to scene 11
const BUS_CLOSE_MULT   = 0.6;     // ← tune this: how many × zoomMax the bus zooms during close-up

// Scene 45's own local range used by the scene-44 exit zoom (see animateS44's exitT) —
// how fast the old overlay fades/zooms away. Independent from S45_STICKY_RANGE below.
const S45_EXIT_RANGE = 0.3;
// How long scene 45 stays fully still (no pan) before normal scrolling resumes — covers
// Kathleen's whole appearance so nothing moves while she's on screen.
const S45_STICKY_RANGE = 1.0;
// Scene 46's pan eases (not snaps) toward the position that centers the wheelchair man on
// screen by S46_HOLD_START, stays pinned there through S46_HOLD_END while he zooms in and
// his popup shows, then eases back to the normal continuous pan by the scene's end. Slower/
// gentler than a hard freeze+snap — see frame()'s effectiveTx and animateS45S48.
const S46_HOLD_START = 0.05;
// Shrunk from 0.8 — the zoom itself finishes at S46_ZOOM_END_LOCAL (0.62), so the gap between
// there and the old 0.8 was pure "dummy" scroll: pan pinned, zoom already done, popups playing
// on their own wall-clock timer regardless. Only a small buffer past the zoom now.
const S46_HOLD_END = 0.65;
// Bus drive-in settle point at the start of scene 59 — how far through scene 59 (sceneLocal,
// 0-1) the bus takes to slide from half-visible to fully parked (see animateCityBus's
// scene===27 branch). Used to also gate an early wall-clock zoom-out here (removed per
// request — see the comment above _s61PostZoomT0), now it's just this drive-in's own timing.
const S5960_ZOOM_START_PHASE = 0.2;
// (Scenes 55-57's slow-pan blend was removed — SCENE_SCROLL there is now small enough,
// 0.4/0.4/0.4/0.3 total, that natural panning alone doesn't feel frozen; the blend was tuned
// against the old, much larger values and became badly mismatched once those shrank, causing
// it to overshoot and run the background out of content too early — see #s55-s58-bg's width.)
// The zoom-in is scroll-driven (was a wall-clock S46_ZOOM_MS timer that fired once the pan
// settled him into center — that played out on its own regardless of scroll speed, which read
// as a jerk, and never reversed on scroll-back). Now it eases 0->1 across sceneLocal
// S46_HOLD_START -> S46_ZOOM_END_LOCAL, exactly like scene 30's s30Scale ramp: a pure
// function of scroll position, so it tracks the wheel smoothly and is symmetric both
// directions. S46_ZOOM_MS is kept only for the popups' own wall-clock queue below.
// Was 0.62, then 0.20 — the pan is completely frozen at targetTx for the WHOLE zoom
// (S46_HOLD_START through here), and since tx itself always moves a fixed ~1 full
// viewport-width across a scene's entire local range regardless of SCENE_SCROLL, freezing
// across any chunk of that range banks up a proportional catch-up gap — a gap no easing can
// make gentle, and the direct cause of the release "jump"/rush. 0.20 was fine while
// SCENE_SCROLL[21] was 10.0, but once that got raised (to slow the scene's overall feel), the
// SAME pixel-sized gap suddenly had to be paid back against a much slower baseline pan speed —
// same absolute catch-up motion, now standing out far more by contrast (measured: ~0.2px/tick
// baseline vs ~4.5px/tick sustained during the catch-up, a 23x difference — read as "scrolling
// too fast" through a big chunk of the scene, not a single jump). Shrunk further so the banked
// gap stays small regardless of SCENE_SCROLL — 0.03 of local range at SCENE_SCROLL[21]=35.0 is
// still ~1 viewport-width of real scroll for the zoom to play out over, plenty smooth.
const S46_ZOOM_END_LOCAL = 0.08;
const S46_ZOOM_MS = 900;
// Once the (now scroll-driven) zoom-in finishes, the Huniki popup shows first for a stretch of
// local, then fades out and the Big Tech popup takes over for the next stretch, then that
// hides too and plain scrolling resumes — scroll-driven (via sceneLocal), not wall-clock, so
// they open/close on scroll position instead of playing out on their own regardless of it.
const S46_HUNIKI_LOCAL_END = 0.23;
const S46_BIGTECH_LOCAL_END = 0.38;

// ---- DOM ----
const pinnedWrap  = document.getElementById('pinned-wrap');
const scrollX     = document.getElementById('scroll-x');
const spacer      = document.getElementById('scroll-spacer');
const progressBar      = document.getElementById('progress-bar');
const navProgressFill  = document.getElementById('navProgressFill');
const scrollHint  = document.getElementById('scroll-hint');
const dots        = document.querySelectorAll('.dot');

const panels = {
  1: document.getElementById('panel-1'),
  2: document.getElementById('panel-2'),
  3: document.getElementById('panel-3'),
  5: document.getElementById('panel-5'),
  6: document.getElementById('panel-6'),
  8: document.getElementById('panel-8'),
  9: document.getElementById('panel-9'),
  10: document.getElementById('panel-12'),  // panel-12 popup shown at scroll index 9 (new scene-13)
  24: document.getElementById('panel-55'),  // scroll index 23 (scene-55) — was 25/index24 before scene-48 was removed
  25: document.getElementById('panel-56'),  // scroll index 24 (scene-56)
  26: document.getElementById('panel-57'),  // scroll index 25 (scene-57)
};
const panel55b = document.getElementById('panel-55b'); // second half of panel-55's own window — kept outside `panels` (not numeric-key-driven, just a straight handoff from show55)
const panel1Start = document.getElementById('panel-1-start');
const s1s3Troad = document.querySelector('.s1s3-troad');
const s1s3Broad = document.querySelector('.s1s3-broad');
const panel5Driver = document.getElementById('panel-5-driver');
const popup8a    = document.getElementById('panel-8a');
const popup8b    = document.getElementById('panel-8b');
const popup13a   = document.getElementById('panel-13a');
const panelS13_1 = document.getElementById('panel-s13-1');
const panelS13_2 = document.getElementById('panel-s13-2');
const panelS13_3 = document.getElementById('panel-s13-3');
const panel26_1 = document.getElementById('panel-26-1');
const panel26_2 = document.getElementById('panel-26-2');
const panel26_3 = document.getElementById('panel-26-3');
let _s26EnterTs = null; // timestamp scene 26 was last (re)entered — opens both popups 1s later
const panelS21Meta1     = document.getElementById('panel-s21-meta-1');
const panelS21Google1   = document.getElementById('panel-s21-google-1');
const panelS21Meta2     = document.getElementById('panel-s21-meta-2');
const panelS21Google2   = document.getElementById('panel-s21-google-2');
const panelS21Microsoft = document.getElementById('panel-s21-microsoft');
const panelS21OpenAI    = document.getElementById('panel-s21-openai');

// Single fixed bus across all jungle scenes
const jungleBus = document.getElementById('jungle-bus');

// Debug scale refs
const dbgScene  = document.getElementById('dbg-scene');
const dbgTime   = document.getElementById('dbg-time');
const dbgBus    = document.getElementById('dbg-bus');
const dbgCursor = document.getElementById('dbg-cursor');

// Single fixed bus that rides across city scenes 5–6
const cityBus       = document.getElementById('city-bus');
const s12s15bg      = document.getElementById('s12-s15-bg');
const s21Preview    = document.getElementById('s21-preview');
const cityBusEmpty  = document.getElementById('city-bus-empty');
const cityBusPeople = document.getElementById('city-bus-people');
const cityBusFull    = document.getElementById('city-bus-full');
const cityBusPeople1 = document.getElementById('city-bus-people1');
const cityBusS26     = document.getElementById('city-bus-s26');
const cityBusInside  = document.getElementById('city-bus-inside');
const cityBusS55     = document.getElementById('city-bus-s55');
const s8BusTransitionWrap   = document.getElementById('s8-bus-transition');
const s8BusTransitionPlayer = document.getElementById('s8-bus-transition-player');
if (s8BusTransitionPlayer) {
  // Force full-bleed cropping (cover, not letterboxed contain) so the animation always fills
  // the whole viewport width regardless of window size/aspect ratio — lottie-player has no
  // attribute for this, so the shadow-DOM svg's own preserveAspectRatio has to be patched.
  const forceSlice = () => {
    const svg = s8BusTransitionPlayer.shadowRoot && s8BusTransitionPlayer.shadowRoot.querySelector('svg');
    if (!svg) return;
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    // Zoom out a bit: widen the viewBox around the same center so more of the composition
    // shows instead of a tight crop.
    const ZOOM_OUT = 1.12;
    const w = 3923 * ZOOM_OUT, h = 2242 * ZOOM_OUT;
    svg.setAttribute('viewBox', `${(3923 - w) / 2} ${(2242 - h) / 2} ${w} ${h}`);
  };
  s8BusTransitionPlayer.addEventListener('ready', forceSlice);
  s8BusTransitionPlayer.addEventListener('load', forceSlice);
}
const s5558Car        = document.getElementById('s5558-car');
const s5558Car2       = document.getElementById('s5558-car2');
const s5558Car3       = document.getElementById('s5558-car3');
const s5558TransitionFrameFront = document.getElementById('s5558-transition-frame-front');
const s5558TransitionFrameLottie = document.getElementById('s5558-transition-frame-lottie');
const s4548Bg = document.getElementById('s45-s48-bg');
// Scenes 59-61 popups — closing chapter, shares #s59-s73-bg with the park/lake art
const s5973Panels = [59,60,61].map(n => document.getElementById(`panel-${n}`));
const panelPurpleMan = document.getElementById('panel-purple-man'); // second popup, tied to
  // the purple-man character's position (.s5973-purple-man in style.css), not a scene boundary
const panelLanguageJustice = document.getElementById('panel-language-justice'); // third popup
const s5973BgArt = document.getElementById('s5973-bg-art');
const s5973Bg = document.getElementById('s59-s73-bg');
// Scenes 62-63 (content screens) — root-level fixed full-viewport overlay (NOT part of the
// #scroll-x pan strip), switched screen-by-screen instead of continuously panned. See the
// _s6263* state below and its wheel handler/frame() logic.
const s6263Bg = document.getElementById('s62-s63-bg');
const s6263Slides = [
  document.querySelector('.s6263-slide-0'),
  document.querySelector('.s6263-slide-1'),
  document.querySelector('.s6263-slide-2'),
];
const s6263Panels = [62,63,64].map(n => document.getElementById(`panel-${n}`));
const s6061Puffs = Array.from(document.querySelectorAll('.s6061-puff')); // 8 waterfall puffs, staggered
const cityAwayStand  = document.getElementById('city-awayly-stand');
const cityAwayHandle = document.getElementById('city-awayly-handle');
const cityBusHandleProp = document.getElementById('city-bus-handle-prop');
const s30ZoomPeople  = document.getElementById('s30-zoom-people');
const panel29Welcome = document.getElementById('panel-29-welcome');
const panel30Popup1  = document.getElementById('panel-30-popup1');
const panel30Popup2  = document.getElementById('panel-30-popup2');
const panel30AwayLy  = document.getElementById('panel-30-awayly');
const soundCaptionAwaLy = document.getElementById('sound-caption-awayly');
const soundCaptionSamuel   = document.getElementById('sound-caption-s32');
const soundCaptionAsmelash = document.getElementById('sound-caption-asmelash');
const soundCaptionSadik    = document.getElementById('sound-caption-sadik');
const char27Asmelash = document.querySelector('.char-wrap.char-s27-asmelash'); // scene-27 boarding portrait — distinct from char37Asmelash's later in-bus quote
const panel32Intro   = document.getElementById('panel-32-intro');
const panel32Umuganda = document.getElementById('panel-32-umuganda');
const panel32Lesan    = document.getElementById('panel-32-lesan');
const panel32Samuel   = document.getElementById('panel-32-samuel');
const panel32Asmelash = document.getElementById('panel-32-asmelash');
const panel32Asmelash2 = document.getElementById('panel-32-asmelash2');
const panel32PregnantUp   = document.getElementById('panel-32-pregnant-up');
const panel32PregnantDown = document.getElementById('panel-32-pregnant-down');
const panel32Sadik = document.getElementById('panel-32-sadik');
const s44Overlay = document.getElementById('s44-overlay');
const panel44_1 = document.getElementById('panel-44-1');
const s44TotoMoto = document.querySelector('.s44-toto-moto');
const s4548Visual = document.getElementById('s45-s48-visual');
const char45Kathleen   = document.querySelector('.char-s45-kathleen');
const char45TotoMoto   = document.querySelector('.char-s45-totomoto');
const char45RedLady    = document.querySelector('.char-s45-redlady');
const char45Wheelchair = document.querySelector('.char-s45-wheelchair');
const char47NewGuy     = document.querySelector('.char-s47-newguy'); // PLACEHOLDER — see index.html
const panel45Kathleen = document.getElementById('panel-45-kathleen');
const soundCaptionKathleen = document.getElementById('sound-caption-kathleen');
const soundCaptionTotoMoto = document.getElementById('sound-caption-totomoto');
const s47CrossingMatatu = document.getElementById('s47-crossing-matatu');
const s47CrossingFrame  = document.getElementById('s47-crossing-frame');
const s5973BridgeFront = document.getElementById('s5973-bridge-front');
const s5973TreesFront  = document.getElementById('s5973-trees-front');
const panel45TotoMoto = document.getElementById('panel-45-totomoto');
const panel47NewGuy = document.getElementById('panel-47-newguy'); // PLACEHOLDER — see index.html
const soundCaptionS47NewGuy = document.getElementById('sound-caption-s47newguy');
const panel45RedLady = document.getElementById('panel-45-redlady');
const panel46Huniki = document.getElementById('panel-46-huniki');
const panel46BigTech = document.getElementById('panel-46-bigtech');
// Chris Emezue + the last red-topped woman are baked directly into Seats%20extended.svg's
// own art (not a separate movable sprite) — confirmed in-browser at scene 47, local ~17%,
// see panel-47-newguy's showChris window below.
const char32OldLady   = document.querySelector('.char-s32-oldlady');
const char33GirlPhone = document.querySelector('.char-s33-girlphone');
const char39Samuel     = document.querySelector('.char-s39-samuel');
const char37Asmelash   = document.querySelector('.char-s37-asmelash');
const char37Asmelash2  = document.querySelector('.char-s37-asmelash2');
const char35Pregnant   = document.querySelector('.char-s35-pregnant');
const char32Sadik      = document.querySelector('.char-s32-sadik');
const char34Kid1       = document.querySelector('.char-s34-kid1'); // lollipop kid — shown/hidden together with Sadik, see showSadik in animateS32S43

// Fixed trees overlay for scene 4 — sits above #jungle-bus (z:11 vs z:10)
const s4TreesOverlay = document.getElementById('s4-trees');
const s4TreesPlayer  = document.getElementById('s4-trees-player');
let _s4TreesPlaying  = false;
// Fixed trees overlay for scene 5 — sits above #city-bus in root stacking context
const cityTrees5    = document.getElementById('city-trees-5');
const s1215TreesFront = document.getElementById('s1215-trees-front');
const s5s8FenceFront = document.getElementById('s5s8-fence-front');
// Fixed seller overlay for scenes 55-58 — sits above #s5558-car in root stacking context
// (see the HTML/CSS comments on #s5558-seller-front for why this can't just be a z-index
// bump on the in-background .s5558-* version)
const s5558SellerFront = document.getElementById('s5558-seller-front');
const s5558ConesFront  = document.getElementById('s5558-cones-front');
// Fixed character + tree overlays for scenes 7, 8 & 9
const cityOverlay7  = document.getElementById('city-overlay-7');
const cityOverlay8  = document.getElementById('city-overlay-8');
const s8PlazaSign   = document.getElementById('s8-plaza-sign');
const cityOverlay9   = document.getElementById('city-overlay-9');
const cityOverlay12  = document.getElementById('city-overlay-12');
const s12AvenueSign  = document.getElementById('s12-avenue-sign');
const s55HunikiSign  = document.getElementById('s55-huniki-sign');
const panel12b       = document.getElementById('panel-12b');

// City scene parallax — img elements targeted directly.
// applyCityParallax runs AFTER animateLayerReveals (which clears img transforms),
// so the pattern is: clear → re-set every frame with no flicker.
const s5ParallaxEls = {
  buildingImg: document.querySelector('.scene-5 .layer-city-buildings img'),
  cloudImg:    document.querySelector('.scene-5 .layer-city-clouds img'),
};
const s6ParallaxEls = {
  buildingImg: document.querySelector('.scene-6 .layer-city-buildings img'),
  cloudImg:    document.querySelector('.scene-6 .layer-city-clouds img'),
};
const s7ParallaxEls = {
  treeImg:     document.querySelector('.scene-7 .layer-city-trees img'),
  buildingImg: document.querySelector('.scene-7 .layer-city-buildings img'),
  cloudImg:    document.querySelector('.scene-7 .layer-city-clouds img'),
  redGirl:     document.querySelector('.char-s7-red-girl'),
  granny:      document.querySelector('.char-s7-granny'),
  orangeMan:   document.querySelector('.char-s7-orange-man'),
  greenMan:    document.querySelector('.char-s7-green-man'),
};
const s8ParallaxEls = {
  buildingImg: document.querySelector('.scene-8 .layer-city-buildings img'),
  treeImg:     document.querySelector('.scene-8 .layer-city-trees img'),
  cloudImg:    document.querySelector('.scene-8 .layer-city-clouds img'),
  purpleMan:   document.querySelector('.char-s8-purple-man'),
  blueGirl:    document.querySelector('.char-s8-blue-girl'),
  limeMan:     document.querySelector('.char-s8-lime-man'),
  greenMan:    document.querySelector('.char-s8-green-man'),
};
const s9ParallaxEls = {
  buildingImg: document.querySelector('.scene-9 .layer-city-buildings img'),
  cloudImg:    document.querySelector('.scene-9 .layer-city-clouds img'),
};

// ---- Parallax elements for new scenes 12–19 ----
// Each object mirrors the layer structure defined in style.css.
// Null-safe: querySelector returns null for missing layers, move() handles that gracefully.

// Scene 12: bus stop with 3 characters
const s12ParallaxEls = {
  cloudImg:    document.querySelector('.scene-12 .layer-s12-clouds img'),
  buildingImg: document.querySelector('.scene-12 .layer-s12-buildings img'),
  treeImg:     document.querySelector('.scene-12 .layer-s12-tree img'),
  greenMan:    document.querySelector('.char-s12-green-man'),
  blueMan:     document.querySelector('.char-s12-blue-man'),
  blueGirl:    document.querySelector('.char-s12-blue-girl'),
};

// Scene 13: Algorithm Avenue bus stop (no people)
const s13ParallaxEls = {
  cloudImg:    document.querySelector('.scene-13 .layer-s13-clouds img'),
  buildingImg: document.querySelector('.scene-13 .layer-s13-buildings img'),
  treeImg:     document.querySelector('.scene-13 .layer-s13-tree img'),
};

// Scene 21: top-down road — 3 vehicles in 3 lanes
// Scene-21 vehicles — all in fixed overlay
const s21Vehicles   = document.getElementById('s21-vehicles');
const s21CloudsWrap = document.getElementById('s21-clouds');
const s21vMeta      = document.getElementById('s21v-meta');
const s21vMatatu    = document.getElementById('s21v-matatu');
const s21vGoogle    = document.getElementById('s21v-google');
const s21vMicrosoft = document.getElementById('s21v-microsoft');
const s21vOpenAI    = document.getElementById('s21v-openai');
// Scene-21 clouds — fixed overlay z:2, fade in near end of scene
const s21cLottie    = document.getElementById('s21c-lottie');
const s5973CloudsLottie = document.getElementById('s5973-clouds-lottie');
const s60ZoomExtras = Array.from(document.querySelectorAll('.s60-zoom-extra'));

// Scene 26–30 overlay — 500vw wide, translates in sync with the strip
const cityOverlay26 = document.getElementById('city-overlay-26');
const cityOverlay26Behind = document.getElementById('city-overlay-26-behind'); // fruit-lady lottie — stays below #city-bus, see animateS26S30
const s2630Bg        = document.getElementById('s26-s30-bg');

// Scene 32–43 overlay — 1300vw wide, ambient passengers, translates in sync with the strip
const cityOverlay32 = document.getElementById('city-overlay-32');
const s3243Bg        = document.getElementById('s32-s43-bg');
const s32People       = document.getElementById('s32-people');

// Interviewee swap, batched by scene pair (2 people at a time) instead of one by one:
// batch 0 = scene-27 (Asmelash + Awa), batch 1 = scene-28 (Chris + Kathleen),
// batch 2 = scene-29 (Sadik + Samuel) — each batch fades together during its own scene.
const s2630Pairs = [
  [document.querySelector('.char-s29-samuel'),   document.querySelector('.char-s29-samuel-1')],
  [document.querySelector('.char-s27-awayly'),   document.querySelector('.char-s27-awayly-1')],
  [document.querySelector('.char-s28-chris'),    document.querySelector('.char-s28-chris-1')],
  [document.querySelector('.char-s27-asmelash'), document.querySelector('.char-s27-asmelash-1')],
  [document.querySelector('.char-s29-sadik'),    document.querySelector('.char-s29-sadik-1')],
  [document.querySelector('.char-s28-kathleen'), document.querySelector('.char-s28-kathleen-1')],
];
const s2630Batch = [2, 0, 1, 0, 2, 1]; // batch index per s2630Pairs entry, in the order above
const s2630G1Op = [1, 1, 1, 1, 1, 1]; // running opacity — group1 standing chars
const s2630G2Op = [0, 0, 0, 0, 0, 0]; // running opacity — group2 name cards
let _s2630BoardFade    = 0;    // time-lerped 0→1 once all swaps done; fades out all characters
let _s32OverlayOpacity = 0; // fade-in high-water mark — never decreases within scene 32, so a small scroll-back doesn't fade it out
let _s32DampedTx  = null; // slow-motion scroll follow into scene 32, while the intro popup appears
let _s32DampRate  = 0.02; // ramps up from a heavy slow-mo lerp back to a direct 1:1 follow
let _s32FrozenTx  = null; // pan held stable during the initial zoom window (local 0-0.15)
let _s32ZoomOutT0 = null; // wall-clock timestamp when the zoom-out + Samuel reveal started
const S32_ZOOMOUT_MS = 1200; // duration of the auto-playing zoom-out — plays like a video, no scroll needed

// Scene 59-61 final pull-back: a wall-clock auto-play in EITHER direction, like a video —
// crossing S61_POSTZOOM_TRIGGER_LOCAL forward (once panel-61 has closed) triggers the zoom-out;
// crossing back below S61_POSTZOOM_REVERSE_TRIGGER_LOCAL backward triggers the mirror-image
// zoom-in. Either way scroll is fully blocked (no "stepped"/scroll-tick-driven motion) until it
// finishes on its own — same freeze/hard-pin-scrollY mechanism both directions share with
// every other wall-clock sequence on this site (see _scrollFreezeUntil). Once the forward
// sequence finishes, the clouds scrub in and cover the screen as the permanent backdrop for
// the closing scene 61 (matching the reference — no reveal/fade-out on its own; reversing this
// wall-clock sequence is the only way they part again). The two triggers use DIFFERENT
// thresholds (a hysteresis gap, not one shared boundary) so a small scroll wobble right at the
// line can't flip back and forth re-triggering either direction — you have to scroll
// meaningfully past one or the other. _s61PostZoomT0/_s61PostZoomReverseT0 are mutually
// exclusive: triggering one always clears the other. There used to be an EARLIER wall-clock
// zoom too, triggered partway through scene 59 (S5960_ZOOM_START_PHASE) — removed per request
// so scrolling through scene 59 (and the start of scene 60) is ordinary/scroll-driven the whole
// way, right up to this one remaining forward/reverse pair.
let _s61PostZoomT0 = null;         // wall-clock timestamp the FORWARD (zoom-out) sequence started
let _s61PostZoomFrozenTx = null;   // pan held stable for the whole forward sequence
let _s61PostZoomReverseT0 = null;      // wall-clock timestamp the REVERSE (zoom-in) sequence started
let _s61PostZoomReverseFrozenTx = null; // pan held stable for the whole reverse sequence

const S61_POSTZOOM_TRIGGER_LOCAL = 1.2; // combinedLocal5973 point where panel-61 has closed — must match show61's own close bound above
const S61_POSTZOOM_TOTAL_MS = 2000; // duration of the pull-back's auto-play, either direction
// Reverse trigger point — deliberately LOWER than S61_POSTZOOM_TRIGGER_LOCAL (hysteresis), so
// a small backward wobble right at the forward trigger line can't immediately re-trigger a
// reverse (and vice versa scrolling forward again right after a reverse). Only scrolling back
// meaningfully past this point starts the reverse.
const S61_POSTZOOM_REVERSE_TRIGGER_LOCAL = 0.9;

// Zoom cycle spanning the whole Asmelash + pregnant-woman sequence: zooms IN right
// after the 4th popup (Lesan) is dismissed, stays zoomed through Asmelash/Asmelash2/
// both pregnant-woman popups, then zooms back OUT once local reaches S33_ZOOM_HOLD
// (after the 8th popup) — see asmelashZoomInT/pregnantZoomT/s32Scale in animateS32S43.
let _sAsmelashZoomInT0 = null; // wall-clock timestamp when the zoom-IN started (right after Lesan dismissed)
const ASMELASH_ZOOMIN_MS = 800;
let _s33FrozenTx  = null;
let _s33ZoomOutT0 = null;
const S33_ZOOM_HOLD    = 0.95; // zoom-OUT triggers here, after both pregnant-woman popups have had time to show
const S33_ZOOMOUT_MS   = 1200;

let _s44FrozenTx = null; // pan held stable during scene 44 (see animateS44) — the strip freezes, only the overlay slides

let _s46ZoomT0 = null; // wall-clock timestamp when the wheelchair-man hold was entered (see frame() and animateS45S48)
let _s46HoldReleased = false; // true the instant the zoom-in finishes — pan starts releasing right away, no extra scroll wait
let _s46ReleaseStartLocal = null; // sceneLocal captured at the exact moment of release, so the release-ease math has a valid start point

let _panel55Shown = false; // same, for panel-55/55b/56/57 (scenes 55-57)
let _panel55bShown = false;
let _panel56Shown = false;
let _panel57Shown = false;
let _panel47NewGuyShown = false; // same, for the PLACEHOLDER popup near scene 47's two people
let _panel47PrevDiff = null; // previous frame's (popup center - viewport center), for sign-flip crossing detection
let _panel47FreezeEndsAt = null; // when the center-freeze below will end
let _panel47FreezeReleaseScrollY = null; // scrollY at the moment the freeze timer finishes — popup hides once scrollY moves away from this (i.e. on the next actual scroll), not on the timer itself
let _s47PopupHiddenLocal = null; // scene 22's local fraction captured the instant the popup hides — the crossing-matatu sequence starts from here instead of a fixed local fraction
let _s47CrossingFreezeTriggered = false; // edge-trigger latch for the crossing-matatu's own end-of-sequence freeze
let _s47CrossingFreezeEndsAt = null; // when that freeze will end
let _s47CrossingFreezeReleaseScrollY = null; // same hide-on-next-scroll pattern as Chris's popup, not a timer
let _s47CrossingSkipDone = false; // edge-trigger latch — skips the rest of scene 47's dead scroll budget straight to scene 55's start once the crossing sequence is dismissed
let _s47CrossingBackSkipDone = false; // mirror of the above for backward scrolling — skips back to just before the crossing's own end instead of crawling through the dead zone in reverse
let _s47PrevScrollY = null; // for detecting scroll direction around the dead zone (raw scrollY, not local/effectiveTx, which can be pinned/blended)


// Popup scroll-freeze: the instant a scene-32 popup opens, wheel scroll is swallowed for
// a short grace period (see the 'wheel' listener below) so it doesn't get scrolled past
// before there's been any time to read it.
let _scrollFreezeUntil = 0; // Date.now() timestamp; wheel input is ignored while now < this
let _frozenScrollY = null; // scrollY hard-pinned to this while frozen (see frame()) — defeats trackpad momentum, which keeps scrolling with no further 'wheel' events to block
const POPUP_SCROLL_FREEZE_MS = 700;
const S47_CENTER_FREEZE_MS = 1500; // Chris popup's own longer hold-at-center (see animateS45S48) — needs to read as a deliberate lock, not just a brief pause
const S47_CROSSING_FREEZE_MS = 1500; // crossing-matatu sequence's own end-of-sequence freeze (see animateS45S48)
const S47_CROSSING_DURATION = 0.1; // shared by both the effectiveTx scene-55 reveal blend AND animateS45S48's own crossingT — must match, or the two fall out of sync
const S47_CROSSING_FADE_START_T = 0.985; // crossingT fraction where the bus/frame start fading out — reaches opacity 0 exactly as crossingT reaches 1, no separate wait afterward (was 0.95 — narrower window here makes the opacity drop faster/snappier)
const S47_REVEAL_START_T = 0.1; // crossingT fraction where the background starts blending toward scene 55's start position

// Scenes 62-64 — discrete screen-by-screen slide switching (see the 'wheel' listener and
// frame() below). Once _s6263Active is true, wheel input drives _s6263Index directly instead
// of native scroll; a crossfade plays between adjacent slides on each step. Generalized to
// any slide count via S6263_SLIDE_COUNT/_s6263FromIndex (was hardcoded to exactly 2 slides —
// s6263Pos used to infer "which slide we're transitioning FROM" purely from the destination
// index, which only works for 2 states; a 3rd slide needs the from-index tracked explicitly).
// Counted in distinct scroll GESTURES ("ticks"), not accumulated deltaY — a single physical
// scroll (mouse click or trackpad swipe) fires many rapid wheel events that sum past any
// pixel threshold within the same gesture, so a deltaY accumulator alone still felt instant.
// Only the START of each burst (150ms of inactivity apart) counts as one tick, not every
// individual wheel event within it.
const S6263_SLIDE_COUNT = 3; // 0 = Resources (62), 1 = Credits (63), 2 = Contact (64)
let _s6263Active     = false; // true once we've entered the locked slide-switch zone
let _s6263Index      = 0;     // which slide is showing/target of the current crossfade
let _s6263FromIndex  = 0;     // which slide we're crossfading AWAY from (only meaningful while _s6263TransT0 !== null)
let _s6263TransT0    = null;  // wall-clock start of the current crossfade; null = settled
let _s6263Ticks      = 0;     // distinct scroll gestures counted so far in _s6263TickDir
let _s6263TickDir    = 0;     // direction (+1/-1) the current tick count applies to
let _s6263BurstActive = false;
let _s6263BurstTimer  = null;
const S6263_TICKS_REQUIRED = 2; // gestures needed before a step actually triggers — was 2
  // (the first scroll was a "dummy" absorbed with nothing happening, only the second advanced
  // the slide, which read as needing several scrolls to do anything) — now advances right away
  // on the very next scroll once the panel's own content is at the bottom/top.
const S6263_TRANS_MS = 500;       // crossfade duration
let _panel32IntroShown     = false;
let _panel32UmugandaShown  = false;
let _panel32LesanShown     = false;
let _panel32SamuelShown    = false;
let _s32LesanDismissed = false; // becomes true on the next scroll input once the 4th popup (Lesan AI) is shown
let _s33AsmelashShown     = false;
let _s33AsmelashTicks     = 0;     // scroll-gesture count since the 5th popup (Asmelash) opened
let _s33AsmelashDismissed = false; // becomes true once 2 scroll gestures happen — hides the popup
let _s33AsmelashBurstActive = false;
let _s33AsmelashBurstTimer  = null;

// Scene-32 timing anchors — no zoom/pan-freeze effect anymore, just reference points
// the popup/character fade timing below is built around (PEOPLE_FADE_END, SAMUEL_FADE_END).
const S32_ZOOM_TRIGGER = 0.20; // two women (old lady + girl-with-phone) start showing here
const S32_ZOOM_HOLD    = 0.68; // gap after panel-32-umuganda hides (0.60) — Samuel's zoom-out/reveal triggers here, Lesan (4th) follows once Samuel hides at local 0.90 (see animateS32S43)



// Scene-8 bus zoom + pan — read live from CSS every frame so DevTools / file edits take effect immediately.
// To change them, edit  #city-bus { --s8-zoom: X; --s8-pan: Y }  in style.css.
function s8BusZoom() {
  const v = cityBus ? parseFloat(getComputedStyle(cityBus).getPropertyValue('--s8-zoom')) : NaN;
  return Number.isFinite(v) ? v : 1.5;
}

// Returns the bus vertical center as a viewport-% (for transformOrigin Y).
// Uses offsetHeight (transform-independent) + the CSS bottom:30% rule.
function busCenterY() {
  if (!cityBus) return 55;
  const vh = window.innerHeight;
  // bottom:30% → bus bottom-edge is at 70% from top
  const centerPx = vh * 0.70 - cityBus.offsetHeight * 0.5;
  return Math.max(20, Math.min(85, centerPx / vh * 100));
}
function s8BusPan() {
  const v = cityBus ? parseFloat(getComputedStyle(cityBus).getPropertyValue('--s8-pan')) : NaN;
  return Number.isFinite(v) ? v : 0.20;
}

// Parallax mouse state — 4 independent tiers with different lerp speeds.
// Each tier settles at a different rate, so elements stagger in time rather than all moving together.
let _rawPX = 0, _rawPY = 0;
let _s13TotalScale = 1; // wrap × bus scale in scene 13 — used to counter-scale popups
let _popup3ShowTs  = null; // timestamp when popup 3 first became visible

let prlxX1 = 0, prlxY1 = 0;  // tier 1 slowest  (0.03) — clouds
let prlxX2 = 0, prlxY2 = 0;  // tier 2 medium   (0.07) — buildings, bus
let prlxX3 = 0, prlxY3 = 0;  // tier 3 fast     (0.12) — trees, mid-depth people
let prlxX4 = 0, prlxY4 = 0;  // tier 4 fastest  (0.20) — closest people

document.addEventListener('mousemove', e => {
  _rawPX = (e.clientX / window.innerWidth  - 0.5) * 2;
  _rawPY = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

// CSS `vw` units resolve against document.documentElement.clientWidth, which excludes any
// visible vertical scrollbar's own width — window.innerWidth includes it instead. On a page
// with a scrollbar those two differ (by the scrollbar's width), and since virtually this
// entire horizontal layout is built in `vw` units, that small per-vw gap compounds across
// every `vw` in the strip into a real, visible drift by the time you reach later scenes
// (surfaced as a background seam around scene 26). This is the "vw" every position
// calculation in this file should read, not window.innerWidth directly.
function getVw() {
  return document.documentElement.clientWidth || window.innerWidth;
}

// ---- Setup: scroll length ----
// Every value in SCROLL_MAP is a multiple of getVw(), so rebuilding it on resize
// (scrollbar toggling, DevTools panel resizing, display scaling, etc.) rescales every scene
// boundary — but window.scrollY itself is an absolute pixel count that doesn't rescale with
// it. Without correcting for that, the exact same scrollY can suddenly land on a completely
// different (often much earlier) scene right after a resize, reading as the story jerking
// backward on its own. Capture the current logical position (scene + local%) before rebuilding
// and re-apply it in the new map's coordinates afterward, so a resize never moves the story.
function setup() {
  const prev = SCROLL_MAP.length ? scrollToState(window.scrollY) : null;
  buildScrollMap();
  spacer.style.height = (TOTAL_SCROLL + window.innerHeight) + 'px';
  document.body.style.height = (TOTAL_SCROLL + window.innerHeight) + 'px';
  if (prev) {
    const seg = SCROLL_MAP[prev.currentScene];
    if (seg) window.scrollTo(0, seg.scrollStart + prev.sceneLocal * (seg.scrollEnd - seg.scrollStart));
  }
  // All the *FrozenTx values below are captured once (in absolute pixels) the first frame a
  // freeze window is entered, then reused as-is for as long as that freeze stays active. They
  // don't rescale with window.innerWidth the way SCROLL_MAP's own vw-based values just did
  // above — so if a resize happens while a freeze is still active, the stale pixel value no
  // longer lines up with the (now-rescaled) CSS background it's supposed to match, showing as
  // a gap. Clearing them here forces a fresh capture, at the new scale, on the very next frame.
  _s32DampedTx = null;
  _s32FrozenTx = null;
  _s32ZoomOutT0 = null;
  _s33FrozenTx = null;
  _s33ZoomOutT0 = null;
  _s44FrozenTx = null;
  _s46ZoomT0 = null;
}

// ---- Easing ----
function easeOutCubic(t) {
  return 1 - Math.pow(1 - Math.min(t, 1), 3);
}
// Starts from rest, accelerates to mid-point, decelerates smoothly to stop.
// Derivative = 0 at both ends → no velocity spike on entry or exit.
function easeInOutCubic(t) {
  t = Math.min(Math.max(t, 0), 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- Keyframe interpolation ----
// Normalises {scene, at(0-100), x} keyframes to global 0→1 then interpolates.
function normaliseJungleKeyframes(keyframes) {
  const total = JUNGLE_BUS_SCENES.length;
  return keyframes.map(kf => ({
    at: (kf.scene - 1 + kf.at / 100) / total,
    x:  kf.x,
  }));
}

// Catmull-Rom spline interpolation.
// Smooths velocity at every keyframe — no abrupt speed changes (no jerk).
// Each keyframe's tangent is derived from its two neighbours.
function interpolateKeyframes(kf, t) {
  if (t <= kf[0].at)             return kf[0].x;
  if (t >= kf[kf.length - 1].at) return kf[kf.length - 1].x;

  // Find the segment [i, i+1] that contains t
  let i = 0;
  while (i < kf.length - 2 && kf[i + 1].at < t) i++;

  const k0 = kf[Math.max(0, i - 1)];
  const k1 = kf[i];
  const k2 = kf[i + 1];
  const k3 = kf[Math.min(kf.length - 1, i + 2)];

  // Local progress within this segment [0, 1]
  const u  = (t - k1.at) / (k2.at - k1.at);
  const u2 = u * u;
  const u3 = u2 * u;

  // Non-uniform Catmull-Rom tangents (accounts for unequal spacing)
  const d01 = k1.at - k0.at || 1e-6;
  const d12 = k2.at - k1.at;
  const d23 = k3.at - k2.at || 1e-6;
  const m1  = d12 * (k2.x - k0.x) / (d01 + d12);
  const m2  = d12 * (k3.x - k1.x) / (d12 + d23);

  // Cubic Hermite evaluation
  return (2*u3 - 3*u2 + 1) * k1.x
       + (u3 - 2*u2 + u)   * m1
       + (-2*u3 + 3*u2)    * k2.x
       + (u3 - u2)         * m2;
}

// Pre-normalise once at startup
const JUNGLE_KF = normaliseJungleKeyframes(SCENE_CONFIG.jungleBus);

// ---- Non-uniform scroll map ----
// Maps scrollY → {currentScene, sceneLocal, tx, scrollPct}
let SCROLL_MAP   = [];
let TOTAL_SCROLL = 0;

function buildScrollMap() {
  const vw = getVw();
  SCROLL_MAP   = [];
  TOTAL_SCROLL = 0;
  for (let i = 0; i < SCENES; i++) {
    const len    = SCENE_SCROLL[i] * vw;
    // Scene 21 (i=10): real DOM start is 1165vw (1000vw base + margin-left:165vw), 165vw more
    // than the 1000vw a normal-index scene would land on — was 0.65vw here (a stale value
    // from before scene-9's display:none was fixed, see that rule in style.css), which put
    // scene 21's own vehicle/road pan 100vw to the left of its real position for its entire
    // duration. i>10 term unchanged — scene 21 ends at 1465vw exactly as before either way.
    const stripX = i * vw
      + (i === 10 ? 1.65 * vw : 0)
      + (i > 10   ? 3.65 * vw : 0);
    SCROLL_MAP.push({ scrollStart: TOTAL_SCROLL, scrollEnd: TOTAL_SCROLL + len, stripX });
    TOTAL_SCROLL += len;
  }
}

function scrollToState(scrollY) {
  const vw = getVw();
  const y  = Math.min(scrollY, TOTAL_SCROLL);
  for (let i = 0; i < SCROLL_MAP.length; i++) {
    const seg = SCROLL_MAP[i];
    if (y < seg.scrollEnd || i === SCROLL_MAP.length - 1) {
      const local = Math.min(1, Math.max(0, (y - seg.scrollStart) / (seg.scrollEnd - seg.scrollStart)));
      return {
        currentScene: i,
        sceneLocal:   local,
        tx:           -(seg.stripX + local * vw),
        scrollPct:    y / TOTAL_SCROLL,
      };
    }
  }
}

// ---- Scroll time tracker (exposed as window.scrollTimer for future use) ----
window.scrollTimer = {
  firstScrollAt:  null,   // Date of very first scroll
  totalMs:        0,      // cumulative ms the user has been scrolling
  isScrolling:    false,
  _sessionStart:  null,
  _idleHandle:    null,
};

const IDLE_TIMEOUT = 400; // ms without scroll = considered idle

window.addEventListener('scroll', () => {
  const t   = Date.now();
  const st  = window.scrollTimer;

  if (!st.firstScrollAt) st.firstScrollAt = new Date(t);

  if (!st.isScrolling) {
    st.isScrolling   = true;
    st._sessionStart = t;
  }

  clearTimeout(st._idleHandle);
  st._idleHandle = setTimeout(() => {
    st.totalMs  += Date.now() - st._sessionStart;
    st.isScrolling = false;
  }, IDLE_TIMEOUT);
}, { passive: true });

// ---- panel-32-sadik's own internal scroll (its text wrapper has max-height+overflow-y:
// auto — see style.css). .text-panel is pointer-events:none site-wide, so the wrapper's own
// pointer-events:auto override lets the wheel "hit" it, but the page's main wheel listener
// below still fires on every wheel event regardless (window-level listeners aren't scoped to
// a hit-tested target) and would otherwise ALSO drive the story's scroll position at the same
// time. This must be registered BEFORE that listener and use stopImmediatePropagation (not
// stopPropagation, which only stops bubbling between elements, not sibling listeners on the
// same window target) so it actually pre-empts it — but only while there's still more of the
// wrapper's own content left to reveal in the gesture's direction; once at that edge, this
// does nothing and control falls through to the normal page-scroll listener below. ----
const SCROLLABLE_POPUPS = [panel32Sadik, panel32Asmelash2, panel26_3, panel45RedLady];
window.addEventListener('wheel', e => {
  for (const panel of SCROLLABLE_POPUPS) {
    if (!panel || panel.style.opacity !== '1') continue;
    const wrapper = panel.querySelector('[data-i18n-panel-text]');
    if (!wrapper || wrapper.scrollHeight <= wrapper.clientHeight + 1) continue;
    // Window-level listeners fire on every wheel event regardless of what's under the
    // cursor, so without this check scrolling the STORY (mouse anywhere else on the page)
    // would also hijack this popup's internal scroll just because it happens to be open.
    // Only take over when the cursor is actually over this popup's own text.
    if (!wrapper.contains(e.target)) continue;
    const dir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
    const atTop = wrapper.scrollTop <= 0;
    const atBottom = wrapper.scrollTop + wrapper.clientHeight >= wrapper.scrollHeight - 1;
    if ((dir > 0 && atBottom) || (dir < 0 && atTop) || dir === 0) continue;
    e.preventDefault();
    e.stopImmediatePropagation();
    wrapper.scrollTop += e.deltaY;
    return;
  }
}, { passive: false });

// ---- Popup scroll-freeze: swallow wheel input for a grace period right after a
// scene-32 popup opens (see _scrollFreezeUntil, set in animateS32S43) so it doesn't get
// scrolled past before there's been any time to read it. Native wheel scroll only —
// programmatic scrollTo (dot nav) and touch-drag are untouched. ----
window.addEventListener('wheel', e => {
  pauseAutoAdvance(); // manual scroll input — user is taking control themselves
  if (Date.now() < _scrollFreezeUntil) { e.preventDefault(); return; }

  // Scenes 62-63 — discrete slide lock (see _s6263Active in frame()). While active, wheel
  // input drives _s6263Index directly instead of native scroll. Steps on the very next scroll
  // gesture (S6263_TICKS_REQUIRED=1) once the active slide's own content is at the bottom/top
  // — no extra "dummy" scrolls needed first.
  if (_s6263Active) {
    if (_s6263TransT0 !== null) { e.preventDefault(); return; } // mid-crossfade — ignore input
    const dir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
    // If the active slide's content is taller than the viewport (.s6263-content-panel is
    // overflow-y:auto), let the wheel scroll IT first instead of immediately counting toward a
    // slide switch — otherwise there'd be no way to read content past the fold. Only once
    // it's already at the scroll edge in the gesture's direction does this fall through to the
    // normal tick-counting/switch logic below.
    const activePanel = s6263Panels[_s6263Index];
    if (dir !== 0 && activePanel && activePanel.scrollHeight > activePanel.clientHeight + 1) {
      const atTop    = activePanel.scrollTop <= 0;
      const atBottom = activePanel.scrollTop + activePanel.clientHeight >= activePanel.scrollHeight - 1;
      if ((dir > 0 && !atBottom) || (dir < 0 && !atTop)) return; // let native scroll happen inside the panel
    }
    e.preventDefault();
    if (dir !== 0 && !_s6263BurstActive) {
      _s6263BurstActive = true;
      if (dir !== _s6263TickDir) { _s6263TickDir = dir; _s6263Ticks = 0; } // direction changed — restart the count
      _s6263Ticks++;
      if (_s6263Ticks >= S6263_TICKS_REQUIRED) {
        _s6263Ticks = 0;
        if (dir > 0) {
          if (_s6263Index < S6263_SLIDE_COUNT - 1) {
            _s6263FromIndex = _s6263Index;
            _s6263Index += 1;
            _s6263TransT0 = performance.now();
          }
          // else: already on the last slide (Contact) — nothing further to advance to.
        } else if (_s6263Index > 0) {
          _s6263FromIndex = _s6263Index;
          _s6263Index -= 1;
          _s6263TransT0 = performance.now();
        } else if (SCROLL_MAP[29]) {
          // Already on the first slide (scene 62), scrolling back further — release the lock
          // and hand back to the normal continuous pan. Lands near the START of scene 61 (not
          // its end) — landing only 10px before the 62 boundary meant any residual scroll
          // momentum (trackpad inertia continuing to fire wheel events after the user's finger
          // lifts) could shove scrollY straight back across the boundary and re-trigger the
          // lock almost instantly, making "scroll back" feel stuck/not working. Starting from
          // scene 61's own start gives its whole (small but non-trivial) scroll budget as a
          // buffer before that can happen.
          _s6263Active = false;
          window.scrollTo(0, SCROLL_MAP[29].scrollStart + 10);
        }
      }
    }
    clearTimeout(_s6263BurstTimer);
    _s6263BurstTimer = setTimeout(() => { _s6263BurstActive = false; }, 150);
    return;
  }

  // 4th popup (Lesan AI) dismiss-on-next-scroll REMOVED per request — it now closes purely
  // by position (LESAN_END_LOCAL in animateS32S43), not by scroll gesture. _s32LesanDismissed
  // stays declared (still reset in animateS32S43) but nothing sets it true any more.

  // Wheelchair man's hold (scene 46) now releases the instant his zoom-in finishes — see
  // frame()'s currentScene===21 branch. No gesture-count/wheel-listener wiring needed here
  // any more.

  // 5th popup (Asmelash — "Many people may not know...") dismisses itself after 3 wheel
  // *scrolls* once it's open, same burst-debounce technique as the old Lesan counter: one
  // physical scroll fires many rapid 'wheel' events, not one, so only the START of each
  // burst (150ms of inactivity apart) counts as a single "scroll". Doesn't freeze/preventDefault
  // — the scene keeps panning normally underneath while these 3 scrolls happen.
  if (_s33AsmelashShown && !_s33AsmelashDismissed) {
    if (!_s33AsmelashBurstActive) {
      _s33AsmelashBurstActive = true;
      _s33AsmelashTicks++;
      if (_s33AsmelashTicks >= 3) _s33AsmelashDismissed = true;
    }
    clearTimeout(_s33AsmelashBurstTimer);
    _s33AsmelashBurstTimer = setTimeout(() => { _s33AsmelashBurstActive = false; }, 150);
  }
}, { passive: false });

// (A 'scroll'-listener hard-clamp for "no forward scroll past scene 61" lived here briefly —
// removed: calling window.scrollTo() from inside a 'scroll' handler re-fires that same
// handler, and it broke forward scrolling generally instead of just capping the very end.
// The pan is already frozen for all of scene 61 (see the effectiveTx branch in frame()), so
// nothing visibly moves even with a little residual native scroll room left — that's enough.)

// ---- Nav bar button — dual purpose (see the label-update block in frame(), right after the
// _s6263Active engage/release logic): "RESOURCES" everywhere jumps forward to the Resources
// slide; "RESET" (shown only once you're on the last slide, Contact) jumps back to the very
// start instead. Either way this must clear any active popup scroll-freeze, not just jump
// scrollY — frame()'s own "hard-pin scrollY while frozen" guard (see _scrollFreezeUntil there)
// would otherwise snap the page straight back to wherever it was within a frame or two, the
// same way it defeats trackpad momentum. ----
const restartBtn = document.getElementById('restartBtn');
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    _scrollFreezeUntil = 0;
    _frozenScrollY = null;
    const onLastSlide = _s6263Active && _s6263Index === S6263_SLIDE_COUNT - 1;
    if (onLastSlide) {
      // "RESET" — release the wheel-lock directly instead of waiting for frame() to notice
      // scrollY moved elsewhere, then jump to the very start.
      _s6263Active = false;
      _s6263TransT0 = null;
      window.scrollTo(0, 0);
    } else if (SCROLL_MAP[30]) {
      // "RESOURCES" — jump straight to the Resources slide; frame()'s own engage logic (see
      // above) picks this up next frame and turns the wheel-lock on at index 0 automatically.
      window.scrollTo(0, SCROLL_MAP[30].scrollStart + 10);
    }
  });
}

// ---- Bus opacity: hidden until first scroll, then fades in ----
let busOpacity  = 1;    // bus visible from scroll position 0
let hasScrolled = true;

// ---- Continuous animation loop ----
let lastTs = 0;
let _prevScrollYForS5960 = 0; // see _scrollingForward in frame()
let _scrollingForwardState = false; // persists across idle frames — see _scrollingForward in frame()
let _lastNarrationCheck = 0;

function frame(ts) {
  lastTs = ts;

  // Read bus rect BEFORE any style writes to avoid forced synchronous layout
  const _busRect = (cityBus && cityBus.style.opacity !== '0') ? cityBus.getBoundingClientRect() : null;
  // Same reasoning — read before cityOverlay12's transform gets written below, or this
  // forces a synchronous reflow every frame instead of using the previous frame's layout.
  const _signRect = s12AvenueSign ? s12AvenueSign.getBoundingClientRect() : null;

  // Hard-pin scrollY itself while any freeze is active (universal — covers every
  // _scrollFreezeUntil use on the site, not just one popup). The 'wheel' listener's
  // preventDefault() only blocks scrolling from NEW wheel events — it can't stop a trackpad
  // flick's own momentum/inertia, which keeps animating scrollY on its own with no further
  // 'wheel' events firing at all. Actively resetting scrollY back every frame stops that too.
  if (Date.now() < _scrollFreezeUntil) {
    if (_frozenScrollY === null) _frozenScrollY = window.scrollY;
    else if (window.scrollY !== _frozenScrollY) window.scrollTo(0, _frozenScrollY);
  } else {
    _frozenScrollY = null;
  }

  const scrollY = window.scrollY;
  const { tx, currentScene, sceneLocal, scrollPct } = scrollToState(scrollY);
  // Not-decreasing since last frame — used to gate the scene 59->61 trigger below so it only
  // fires while actually scrolling FORWARD into it, not when arriving already past the
  // threshold by scrolling BACKWARD from scene 60/61 (sceneLocal starts near 1 re-entering
  // scene 27 from above, which used to satisfy ">= threshold" and re-trigger every time).
  // Only update the remembered direction when scrollY actually MOVED this frame — on idle
  // animation frames where it hasn't (very common at 60fps between real wheel events),
  // leave it exactly as it was. A plain scrollY > prev (or >=) recomputed every frame instead
  // breaks in both directions: >= treats an idle no-movement frame as "forward" (this caused
  // the double-zoom-on-the-way-back bug — an idle frame landing right as sceneLocal was back
  // near 1 after crossing back into this scene re-armed the whole forward sequence); a bare >
  // instead treats that same idle frame as "not forward", which can just as easily land on the
  // one frame where a real forward trigger needs "still scrolling forward" to be true, silently
  // missing the trigger (this broke the scene-60 zoom extras — s61PostZoomT's own trigger uses
  // this same flag). Persisting the last REAL direction across idle frames avoids both.
  if (scrollY !== _prevScrollYForS5960) {
    _scrollingForwardState = scrollY > _prevScrollYForS5960;
    _prevScrollYForS5960 = scrollY;
  }
  const _scrollingForward = _scrollingForwardState;

  // Scenes 62-63 — engage the discrete slide lock the first time continuous scroll reaches
  // this zone (forward from scene 61, or landing here directly e.g. on page reload/dot-nav).
  // Once active, native scroll stops driving which slide shows — see the 'wheel' listener
  // and _s6263Index below instead.
  if (!_s6263Active && (currentScene === 30 || currentScene === 31)) {
    _s6263Active = true;
    _s6263Index = currentScene === 31 ? 1 : 0;
    _s6263Ticks = 0;
    _s6263TickDir = 0;
    _s6263BurstActive = false;
    _s6263TransT0 = null;
  } else if (_s6263Active && currentScene !== 30 && currentScene !== 31) {
    // scrollY moved elsewhere by some path other than the wheel-lock exit (dot-nav, keyboard,
    // programmatic jump) — release the lock so the overlay doesn't stay stuck covering an
    // unrelated scene.
    _s6263Active = false;
    _s6263TransT0 = null;
  }

  // Nav bar button: "RESOURCES" everywhere else, jumps forward to the Resources slide when
  // clicked; "RESET" once you've reached the last slide (Contact), where jumping further
  // forward makes less sense than restarting — see restartBtn's click handler below.
  if (restartBtn) {
    const onLastSlide = _s6263Active && _s6263Index === S6263_SLIDE_COUNT - 1;
    // t() can return undefined for a frame or two before i18n.js's async JSON fetch resolves
    // — leave the HTML's own fallback text ("RESOURCES") alone until there's a real value,
    // rather than briefly showing the literal string "undefined".
    const label = t(onLastSlide ? 'ui.restart' : 'ui.resources');
    if (label != null) restartBtn.textContent = label;
  }

  // Scenes 62-64 — continuous "position" across all slides (0 = fully Resources, 1 = fully
  // Credits, 2 = fully Contact), including any in-progress crossfade. Single source of truth
  // reused below for both the bus/background zoom-reversal and the slide-opacity render block
  // further down. Uses _s6263FromIndex (set explicitly at tick-time) rather than inferring the
  // "from" slide purely from the destination index — that only worked for exactly 2 slides.
  let s6263Pos = _s6263Index;
  if (_s6263TransT0 !== null) {
    const s6263T  = Math.min(1, (ts - _s6263TransT0) / S6263_TRANS_MS);
    const s6263Te = easeInOutCubic(s6263T);
    s6263Pos = _s6263FromIndex + (_s6263Index - _s6263FromIndex) * s6263Te;
    if (s6263T >= 1) _s6263TransT0 = null;
  }

  // junglePhase: 0→1 across the jungle scroll segment (scenes 1–3, may differ from scrollPct)
  const jungleScrollLen = SCENE_SCROLL.slice(0, JUNGLE_BUS_SCENES.length)
                            .reduce((s, r) => s + r, 0) * getVw();
  const junglePhase = Math.min(scrollY / jungleScrollLen, 1);

  const _vw = getVw();

  // Smooth cursor parallax — 4 tiers, each at a different lerp speed.
  // Active across all city scenes (5–19); lerp target goes to 0 just before the bus exits.
  const inCityScene    = currentScene >= 4 && currentScene <= 15; // all city scenes (5–19)
  const nearBusClose   = (currentScene === 7 || currentScene === 10) && sceneLocal >= BUS_CLOSE - 0.06;
  const tgtX = (inCityScene && !nearBusClose) ? _rawPX : 0;
  const tgtY = (inCityScene && !nearBusClose) ? _rawPY : 0;
  prlxX1 += (tgtX - prlxX1) * 0.03;  prlxY1 += (tgtY - prlxY1) * 0.03;
  prlxX2 += (tgtX - prlxX2) * 0.07;  prlxY2 += (tgtY - prlxY2) * 0.07;
  prlxX3 += (tgtX - prlxX3) * 0.12;  prlxY3 += (tgtY - prlxY3) * 0.12;
  prlxX4 += (tgtX - prlxX4) * 0.20;  prlxY4 += (tgtY - prlxY4) * 0.20;

  // Scene 8: freeze strip during zoom + popup phases; stay frozen during exit so the
  // next scene does not bleed in from the right while the bus is still leaving.
  let effectiveTx;
  if (currentScene === 7 && SCROLL_MAP[7]) {
    const freezeX = -SCROLL_MAP[7].stripX;
    const holdX   = freezeX + S8_PAN_MAX * _vw;
    if (sceneLocal <= ZOOM_END) {
      const t = easeInOutCubic(sceneLocal / ZOOM_END);
      effectiveTx = freezeX + t * S8_PAN_MAX * _vw;
    } else {
      effectiveTx = holdX;
    }
  } else if (currentScene === 9 && sceneLocal >= 0.37 && SCROLL_MAP[9]) {
    // Scene 13: freeze strip during zoom + popup + slide-up phases
    const s9Freeze = -(SCROLL_MAP[9].stripX + 0.37 * _vw);
    if (sceneLocal >= 0.92 && SCROLL_MAP[10]) {
      // Bus slides up (0.92–1.0) while s21Preview covers the view — snap straight to
      // scene-21's natural start so the strip is already in place under the bus, with
      // no visible pan while the bus is sliding up.
      effectiveTx = -(SCROLL_MAP[10].stripX);
    } else {
      effectiveTx = s9Freeze;
    }
  } else if (currentScene === 10 && SCROLL_MAP[10]) {
    // Scene 21 is 300vw wide but the viewport only ever shows 1vw of it at a time, so
    // revealing it edge-to-edge with no overshoot needs (300vw - 100vw) = 2vw of pan across
    // sceneLocal 0→1, not 3vw (that only matches the distance to scene-26's own strip start,
    // which overshoots scene-21's own content once sceneLocal passes 2/3 — visible as a
    // background seam bleeding into scene-26's empty marker div well before the scene ends).
    // Was 4vw before that, stale from when scene-21 was still 400vw wide.
    effectiveTx = -(SCROLL_MAP[10].stripX + sceneLocal * 2 * _vw);
  } else if (SCROLL_MAP[11] && (
    (currentScene === 11 && sceneLocal >= 0.77) ||
    (currentScene >= 12 && currentScene <= 13) ||
    (currentScene === 14 && sceneLocal < 0.85)
  )) {
    // Scene 26 (after bus parks) through scene 29: strip frozen so all interviewees
    // stay on screen while they swap in, two at a time per scene
    effectiveTx = -(SCROLL_MAP[11].stripX + 0.77 * _vw);
  } else if (SCROLL_MAP[11] && currentScene === 14 && sceneLocal >= 0.85) {
    effectiveTx = -(SCROLL_MAP[11].stripX + 0.77 * _vw);
  } else if (SCROLL_MAP[11] && currentScene === 15 && sceneLocal < 0.18) {
    // Scene 30's first stretch: the bus keeps genuinely driving forward (real strip pan,
    // not just a timing delay) before the 2 new popups open and the zoom takes over — eases
    // from wherever scene 29 left off to a bit further down the road.
    const s29Freeze  = -(SCROLL_MAP[11].stripX + 0.77 * _vw);
    const s30DriveEnd = s29Freeze - 0.5 * _vw;
    const dT = easeInOutCubic(Math.min(1, sceneLocal / 0.18));
    effectiveTx = s29Freeze + dT * (s30DriveEnd - s29Freeze);
  } else if (SCROLL_MAP[11] && currentScene === 15) {
    // Frozen from here through the rest of scene 30 (zoom onward) — any strip movement
    // gets visually amplified by the pinnedWrap zoom (4x-8x), which is what read as
    // "clouds/road scrolling behind the bus". It jumps straight to scene-32's natural
    // position the instant scene 32 begins (the `else` branch below), but by then
    // #city-bus/Awa Ly/panel-30 are already faded to 0 (see busFadeT in animateCityBus)
    // and #city-overlay-32 hasn't started fading in yet (its fade-in now lives in scene
    // 32's own local range — see animateS32S43), so nothing visible jumps.
    effectiveTx = -(SCROLL_MAP[11].stripX + 0.77 * _vw) - 0.5 * _vw;
  } else if (currentScene === 16 && sceneLocal >= S32_ZOOM_HOLD) {
    // Auto-playing zoom-out + Samuel reveal: once scrolled up to this point, it plays on
    // its own like a video (wall-clock timed via _s32ZoomOutT0/S32_ZOOMOUT_MS — see the
    // matching samuelT/s32Scale computation in animateS32S43), no further scroll needed.
    // Pan stays frozen for the same duration so it reads as a fixed-point animation.
    if (_s32ZoomOutT0 === null) {
      _s32ZoomOutT0 = ts;
      // Swallow wheel input for the whole freeze duration, not just a short grace period —
      // otherwise local keeps advancing past the frozen visual position while scrolling,
      // and the strip jerks/snaps forward the instant the freeze releases.
      _scrollFreezeUntil = Date.now() + S32_ZOOMOUT_MS;
    }
    if (ts - _s32ZoomOutT0 < S32_ZOOMOUT_MS) {
      if (_s32FrozenTx === null) { _s32FrozenTx = tx; }
      effectiveTx = _s32FrozenTx;
    } else {
      _s32FrozenTx = null;
      effectiveTx = tx;
    }
  } else if (currentScene === 17 && sceneLocal >= S33_ZOOM_HOLD) {
    // Same auto-playing zoom-out mechanic as scene 32, reused for the pregnant-woman
    // reveal — see pregnantZoomT/s32Scale in animateS32S43.
    if (_s33ZoomOutT0 === null) {
      _s33ZoomOutT0 = ts;
      _scrollFreezeUntil = Date.now() + S33_ZOOMOUT_MS;
    }
    if (ts - _s33ZoomOutT0 < S33_ZOOMOUT_MS) {
      if (_s33FrozenTx === null) { _s33FrozenTx = tx; }
      effectiveTx = _s33FrozenTx;
    } else {
      _s33FrozenTx = null;
      effectiveTx = tx;
    }
  } else if (currentScene === 19) {
    // Scene 44 slides down vertically over scene-34 (see animateS44) instead of panning
    // in horizontally — freeze the strip here so the background underneath doesn't keep
    // shifting (and running off the edge of its own width) while the new scene covers it.
    if (_s44FrozenTx === null) { _s44FrozenTx = tx; }
    effectiveTx = _s44FrozenTx;
  } else if (currentScene === 20 && sceneLocal < S45_STICKY_RANGE && SCROLL_MAP[20]) {
    // Scene 45 pans at a fraction of normal speed (not a hard freeze) — covers scene 44's
    // overlay zooming/fading away (the shorter S45_EXIT_RANGE, see animateS44) plus the whole
    // character sequence, while still drifting slowly so it doesn't feel completely static.
    // Deliberately stateless (computed straight from stripX(20), not captured on first entry)
    // so it's exactly reversible — the same sceneLocal always gives the same effectiveTx,
    // regardless of whether you arrived scrolling forward or backward. A captured/frozen
    // starting point would differ depending on direction (local=0 arriving forward vs
    // local=1 arriving backward from scene 46), making forward/backward scroll amounts
    // mismatch — same class of bug as any other direction-dependent captured state here.
    const S45_PAN_SPEED = 0.2;
    const slowTx = -(SCROLL_MAP[20].stripX + sceneLocal * S45_PAN_SPEED * _vw);
    // At 0.2x speed, by the end of the scene the slow pan has only covered 20% of a
    // viewport-width while scene 46 expects to start a full viewport-width further along —
    // an 80%-of-screen jump right at the boundary. Bridge the last stretch from the slow
    // position to the real tx so they meet exactly by sceneLocal=S45_STICKY_RANGE. Stays
    // stateless (pure function of sceneLocal and tx, no captured variables) so it's still
    // exactly reversible scrolling either direction.
    const S45_RELEASE_START = 0.402;
    if (sceneLocal >= S45_RELEASE_START) {
      const bridgeT = easeInOutCubic((sceneLocal - S45_RELEASE_START) / (S45_STICKY_RANGE - S45_RELEASE_START));
      effectiveTx = slowTx + bridgeT * (tx - slowTx);
    } else {
      effectiveTx = slowTx;
    }
  } else if (currentScene === 21) {
    // Eases the pan toward the exact position that centers the wheelchair man on screen
    // (.char-s45-wheelchair: left:240vw + width:21vw/2 = 250.5vw within #s45-s48-bg), holds
    // him there while he zooms in and his popup shows (see animateS45S48), then eases back
    // to the normal continuous pan before scene 47 begins. The pan itself stays a pure
    // function of sceneLocal/tx/vw (no captured state), so it's exactly symmetric scrolling
    // either direction. The zoom-in triggered below is the one piece of wall-clock state —
    // it plays out on its own once he's centered, independent of further scrolling.
    const S46_CHAR_CENTER_VW = 250.5;
    const S45S48_BG_LEFT_VW = 2250; // must match #s45-s48-bg's `left` in style.css — was stale at 2256
    const targetStripXvw = S45S48_BG_LEFT_VW + S46_CHAR_CENTER_VW - 50;
    const entryTx = -SCROLL_MAP[21].stripX; // natural tx at local=0 — matches where scene
      // 45's own release-bridge was already easing toward, so there's no jump at entry.
    // Clamped so the approach never pans backward (right-to-left only, matching the
    // story's own forward travel direction): his target position sits slightly BEHIND
    // where scene 46 naturally starts (targetStripXvw < entry's own stripX by ~8.5vw), so
    // interpolating there un-clamped meant a brief backward/rightward blip before
    // continuing forward. Math.min picks whichever pan value is further forward already —
    // if the target is behind the entry point, just hold at the entry point instead of
    // stepping back to reach him (he ends up ~8.5vw off perfectly-centered, traded for
    // never visibly reversing direction).
    const targetTx = Math.min(-(targetStripXvw * _vw / 100), entryTx);
    if (sceneLocal < S46_HOLD_START) {
      const approachT = easeInOutCubic(sceneLocal / S46_HOLD_START);
      effectiveTx = entryTx + approachT * (targetTx - entryTx);
      _s46HoldReleased = false; // reset so re-entering the hold zone replays it
      _s46ReleaseStartLocal = null;
    } else if (!_s46HoldReleased) {
      // He's centered — the zoom-in itself is scroll-driven now (see wheelchairZoomT in
      // animateS45S48). Releases the INSTANT the zoom finishes (no extra scroll wait) — used
      // to wait for a 2-scroll gesture count first, but since this hold is non-blocking
      // (scroll keeps advancing sceneLocal underneath while the pan stays visually pinned),
      // any extra waiting let the natural pan (tx) drift arbitrarily far ahead of the frozen
      // targetTx before release ever fired — the longer/faster you scrolled during that wait,
      // the bigger the gap, and the release then had to close that whole gap at once, which
      // read as a jump no matter how it was eased (tried spreading it over the remaining
      // scene, then over a fixed 700ms — both just relocated the rush instead of removing
      // it). Releasing right at S46_ZOOM_END_LOCAL keeps that gap fixed and small. The
      // Huniki/Big Tech popups (see animateS45S48) are scroll-driven off local too now, not
      // wall-clock, so they just play out naturally as panning resumes.
      if (_s46ZoomT0 === null) { _s46ZoomT0 = ts; }
      if (sceneLocal >= S46_ZOOM_END_LOCAL) {
        _s46HoldReleased = true;
      }
      effectiveTx = targetTx;
    } else {
      // Capture wherever sceneLocal actually was at the exact moment of release as the
      // interpolation's start point (always S46_ZOOM_END_LOCAL now, but computed rather than
      // hardcoded in case a future tweak decouples them again).
      // Linear, not eased — an eased S-curve necessarily peaks faster than its own average
      // rate partway through (measured live: ~4x the steady pan speed right around scene 46's
      // 55% mark), and viewed through the permanent 1.5x zoom on this scene that peak reads as
      // a jump even though the underlying value is continuous. Linear removes the peak
      // entirely — constant speed for the whole release, matching the ordinary pan rate.
      if (_s46ReleaseStartLocal === null) _s46ReleaseStartLocal = sceneLocal;
      const releaseT = Math.min(1, Math.max(0, (sceneLocal - _s46ReleaseStartLocal) / (1 - _s46ReleaseStartLocal)));
      effectiveTx = targetTx + releaseT * (tx - targetTx);
    }
  } else if (currentScene === 22 && SCROLL_MAP[23]) {
    // Tail of scene 47 — once the crossing-matatu sequence (see animateS45S48) is
    // S47_REVEAL_START_T (60%) of the way through, start blending the actual background pan
    // toward scene 55's own start position, hidden behind the frame+bus overlay — so by the
    // time the bus finishes crossing and the freeze holds, scene 55 is already sitting there
    // instead of a hard cut once currentScene actually reaches 23. Mirrors animateS45S48's own
    // crossingT calculation exactly (duplicated here since crossingT itself isn't computed
    // until later in the frame, and effectiveTx has to be set before then) — reads
    // _s47PopupHiddenLocal, set by the previous frame's animateS45S48 call (one-frame lag,
    // imperceptible).
    const _revealStart = _s47PopupHiddenLocal !== null ? _s47PopupHiddenLocal : 0.3;
    const _revealEnd = _revealStart + S47_CROSSING_DURATION;
    const _revealCrossingT = Math.min(1, Math.max(0, (sceneLocal - _revealStart) / (_revealEnd - _revealStart)));
    if (_revealCrossingT >= S47_REVEAL_START_T) {
      const revealT = easeInOutCubic(Math.min(1, (_revealCrossingT - S47_REVEAL_START_T) / (1 - S47_REVEAL_START_T)));
      const scene55Tx = -SCROLL_MAP[23].stripX;
      effectiveTx = tx + revealT * (scene55Tx - tx);
    } else {
      effectiveTx = tx;
    }
  } else if (_s61PostZoomT0 !== null && ts - _s61PostZoomT0 < S61_POSTZOOM_TOTAL_MS) {
    // Mid FORWARD wall-clock sequence (the scene-59-61 zoom-out — see the state comment above
    // _s61PostZoomT0) — checked by STATE, not currentScene, since wheel input is blocked for
    // the whole duration (_scrollFreezeUntil) so currentScene can't actually change during this
    // window anyway; state is just the more direct thing to check.
    if (_s61PostZoomFrozenTx === null) { _s61PostZoomFrozenTx = tx; }
    effectiveTx = _s61PostZoomFrozenTx;
  } else if (_s61PostZoomReverseT0 !== null && ts - _s61PostZoomReverseT0 < S61_POSTZOOM_TOTAL_MS) {
    // Mid REVERSE wall-clock sequence — same freeze-pan technique as the forward branch above,
    // just for the mirror-image zoom-in.
    if (_s61PostZoomReverseFrozenTx === null) { _s61PostZoomReverseFrozenTx = tx; }
    effectiveTx = _s61PostZoomReverseFrozenTx;
  } else if (currentScene >= 27 && currentScene <= 29 && ((currentScene - 27) + sceneLocal) >= S61_POSTZOOM_TRIGGER_LOCAL && _scrollingForward && _s61PostZoomT0 === null && _s61PostZoomReverseT0 === null) {
    // FORWARD trigger: crossing this point starts the zoom-out, but only while actually
    // scrolling FORWARD (_scrollingForward) — same reasoning as every other forward-only
    // wall-clock trigger on this site. _s61PostZoomReverseT0 === null keeps this from firing
    // while a reverse is still active (can't happen, that branch is checked first above, but
    // matches the defensive style used elsewhere).
    _s61PostZoomT0 = ts;
    _s61PostZoomReverseT0 = null; // mutually exclusive with the reverse sequence
    _scrollFreezeUntil = Date.now() + S61_POSTZOOM_TOTAL_MS;
    _s61PostZoomFrozenTx = tx;
    effectiveTx = _s61PostZoomFrozenTx;
  } else if (currentScene >= 27 && currentScene <= 29 && ((currentScene - 27) + sceneLocal) <= S61_POSTZOOM_REVERSE_TRIGGER_LOCAL && !_scrollingForward && _s61PostZoomT0 !== null) {
    // REVERSE trigger: mirror image of the forward trigger above — only fires while actually
    // scrolling BACKWARD, past the (lower, hysteresis) reverse threshold, and only if we're
    // actually in the "zoomed" state to begin with (_s61PostZoomT0 !== null — nothing to
    // reverse otherwise, e.g. scrolling around below the threshold before ever zooming in).
    _s61PostZoomReverseT0 = ts;
    _s61PostZoomT0 = null; // mutually exclusive with the forward sequence
    _scrollFreezeUntil = Date.now() + S61_POSTZOOM_TOTAL_MS;
    _s61PostZoomReverseFrozenTx = tx;
    effectiveTx = _s61PostZoomReverseFrozenTx;
  } else {
    if (currentScene < 21) { _s46ZoomT0 = null; } // scrolled back out — reset so re-entering replays it
    _s32FrozenTx = null; // out of the freeze window — reset so re-entering starts fresh
    _s32DampedTx = null;
    _s32ZoomOutT0 = null; // scrolled back out — reset so re-entering replays the animation
    _s33FrozenTx = null;
    _s33ZoomOutT0 = null;
    _s44FrozenTx = null;
    _s61PostZoomFrozenTx = null;
    _s61PostZoomReverseFrozenTx = null;
    effectiveTx = tx;
  }


  // Reset whole-scene zoom when outside scene 8 and scene 13
  if (currentScene !== 7 && currentScene !== 9 && pinnedWrap) {
    pinnedWrap.style.transform = '';
    _s13TotalScale = 1;
  }

  // s5960ZoomT used to also drive an early scene-59 wall-clock zoom-out, shared with the bus
  // (passed into animateCityBus), background art, and bridge/trees — removed per request, so
  // scrolling through scene 59 is now ordinary (no wall-clock takeover, no early pull-back).
  // The only thing still setting this nonzero is the scenes-62-64 closing-screens reverse-zoom
  // just below; everywhere else it stays 0, leaving s61PostZoomT (the final pull-back,
  // computed further down) as the sole zoom driver for scenes 59-61.
  let s5960ZoomT = 0;
  if (_s6263Active) {
    // Scenes 62-64 (Resources/Credits/Contact) — the zoom REVERSES here, easing scale back
    // from 0.5 up to 1 (full size) over the Resources->Credits step, staying at full size for
    // Contact too (Math.max saturates once s6263Pos passes 1) — instead of staying permanently
    // zoomed. Driven by s6263Pos (computed above from _s6263Index/_s6263FromIndex/
    // _s6263TransT0), not currentScene/sceneLocal — scroll is locked once inside this zone, so
    // sceneLocal stops advancing.
    s5960ZoomT = Math.max(0, 1 - s6263Pos);
  }

  // Final pull-back stage — wall-clock driven in EITHER direction now (see the effectiveTx
  // branch above): _s61PostZoomT0 eases 0->1 (zooming out), _s61PostZoomReverseT0 eases the
  // mirror image 1->0 (zooming back in). The two are mutually exclusive (triggering one always
  // clears the other — see effectiveTx branch), so at most one of these ever applies at a time;
  // each naturally clamps and stays at its own end value once its own sequence finishes,
  // needing no separate "permanent hold" branch — except for a direct-nav jump straight into
  // scene 29 (never having played either trigger), where scene 29 alone is enough to know it
  // should already be fully zoomed out.
  let s61PostZoomT = 0;
  if (_s61PostZoomT0 !== null) {
    s61PostZoomT = easeInOutCubic(Math.min(1, (ts - _s61PostZoomT0) / S61_POSTZOOM_TOTAL_MS));
  } else if (_s61PostZoomReverseT0 !== null) {
    s61PostZoomT = 1 - easeInOutCubic(Math.min(1, (ts - _s61PostZoomReverseT0) / S61_POSTZOOM_TOTAL_MS));
  } else if (currentScene === 29) {
    s61PostZoomT = 1;
  }

  // .scene-60 extras (matatu 5/8, Group 898) — fade in together with the second bus/background
  // pull-back, same s61PostZoomT driving the zoom itself (not a separate scroll-based window).
  s60ZoomExtras.forEach(el => { el.style.opacity = s61PostZoomT.toFixed(3); });

  // -- Horizontal strip --
  scrollX.style.transform = `translateX(${effectiveTx.toFixed(1)}px)`;

  // -- Scene-4 trees overlay: 140vw wide, starts 20vw left of scene 4 (mirrors .s4-extend) --
  if (s4TreesOverlay && SCROLL_MAP[3]) {
    const s4vx = SCROLL_MAP[3].stripX + effectiveTx - 0.20 * _vw;
    const s4TreesVisible = s4vx < _vw && s4vx > -1.40 * _vw;
    s4TreesOverlay.style.opacity   = s4TreesVisible ? '1' : '0';
    s4TreesOverlay.style.transform = `translateX(${s4vx.toFixed(1)}px)`;
    // Only animate while actually visible — this lottie is heavy (14 instances of a 185-layer
    // precomp), so leaving it playing for the whole site visit (previously loop+autoplay,
    // unconditional) was a constant background cost, not just while scene 4 is on screen.
    if (s4TreesPlayer) {
      if (s4TreesVisible && !_s4TreesPlaying) { _s4TreesPlaying = true; s4TreesPlayer.play(); }
      else if (!s4TreesVisible && _s4TreesPlaying) { _s4TreesPlaying = false; s4TreesPlayer.pause(); }
    }
  }

  // -- Scene 55-58 seller: synced to his position (89vw) inside #s55-s58-bg so he tracks
  // the pan exactly, but rendered as a root-level fixed element (see #s5558-seller-front)
  // so his z-index can actually beat #s5558-car's instead of being trapped inside
  // #s55-s58-bg's own stacking context. --
  if (s5558SellerFront && SCROLL_MAP[23]) {
    const sellerVx = SCROLL_MAP[23].stripX + 0.89 * _vw + effectiveTx;
    s5558SellerFront.style.opacity   = (currentScene >= 23 && currentScene <= 26 && sellerVx < _vw && sellerVx > -0.1 * _vw) ? '1' : '0';
    s5558SellerFront.style.transform = `translateX(${sellerVx.toFixed(1)}px)`;
  }

  // -- Scenes 55-58 traffic cones: same root-level stacking-context-escape technique as the
  // seller above — synced to their original 104vw position inside #s55-s58-bg so they track
  // the pan exactly, but rendered outside it so their z-index can actually beat #s5558-car's. --
  if (s5558ConesFront && SCROLL_MAP[23]) {
    const conesVx = SCROLL_MAP[23].stripX + 1.04 * _vw + effectiveTx;
    s5558ConesFront.style.opacity   = (currentScene >= 23 && currentScene <= 26 && conesVx < _vw && conesVx > -0.1 * _vw) ? '1' : '0';
    s5558ConesFront.style.transform = `translateX(${conesVx.toFixed(1)}px)`;
  }

  // -- Scenes 55-58 clouds+birds transition frame: synced to its 122vw slot inside
  // #s55-s58-bg, same reasoning as the seller above — rendered root-level so its z-index
  // (12) genuinely beats #city-bus/#s5558-car/#s5558-seller-front instead of being trapped
  // inside #s55-s58-bg's stacking context. Slides in and fades 0->1 as it approaches center,
  // then FREEZES there fully opaque (not a pass-through wipe that fades back out) — it
  // covers the bus/car and stays covering them for the rest of the scene, ending the
  // sequence on the birds instead of revealing empty background again. Still exactly
  // reversible scrolling backward: frameVx is recomputed live every frame, so scrolling up
  // naturally un-freezes it (frameVx goes positive again) and it slides back out. --
  if (s5558TransitionFrameFront && SCROLL_MAP[23]) {
    const frameVx = SCROLL_MAP[23].stripX + 1.22 * _vw + effectiveTx;
    const frameVisible = currentScene >= 23 && currentScene <= 26;
    if (frameVisible) {
      // Hard on/off now, no gradual cross-fade — opacity is 1 by default whenever the frame
      // is in reach, snapping straight to 0 once it's slid back out past this same threshold.
      // Threshold was a full viewport-width (frameVx <= _vw), which started covering the
      // scene quite early — reduced to half a viewport-width so it starts later, per request.
      const FRAME_REVEAL_VW = 5.5 * _vw;
      s5558TransitionFrameFront.style.opacity   = (frameVx <= FRAME_REVEAL_VW) ? '1' : '0';
      s5558TransitionFrameFront.style.transform = `translateX(${Math.max(0, frameVx).toFixed(1)}px)`;
    } else {
      s5558TransitionFrameFront.style.opacity = '0';
    }
    // Lottie plays as a function of scroll (not autoplay/loop) — scrubbed across scenes
    // 23-26 overall progress, same technique as #s5973-clouds-lottie below.
    if (s5558TransitionFrameLottie && typeof s5558TransitionFrameLottie.getLottie === 'function') {
      const frameProgress = Math.max(0, Math.min(1, ((currentScene - 23) + sceneLocal) / 3));
      const lottie = s5558TransitionFrameLottie.getLottie();
      if (lottie && lottie.totalFrames) lottie.goToAndStop(frameProgress * (lottie.totalFrames - 1), true);
    }
  }

  // -- #s45-s48-bg's own right portion is masked out spatially in CSS now (fades out right
  // where #s55-s58-bg's real content begins, 2665vw — a fixed strip position, independent of
  // scroll speed/direction — see the mask-image comment on #s45-s48-bg in style.css). That
  // replaces trying to time a flat opacity fade against sceneLocal, which can't be correct on
  // both sides at once: the viewport's left edge only reaches 2665vw at the very end of scene
  // 47, while the right edge starts overlapping #s55-s58-bg's territory from scene 47's very
  // start, so a scroll-timed fade is always either patchworking (fades too late) or leaving a
  // premature empty gap (fades too early) on one side. Opacity here now stays 1 through all of
  // scene 47 itself — the mask handles the real crossfade — and only drops once we're fully
  // past it, as a safety net so it can't reappear later in the strip.
  if (s4548Bg) {
    let s4548Opacity;
    if (currentScene <= 22) s4548Opacity = 1;
    else s4548Opacity = 0;
    s4548Bg.style.opacity = s4548Opacity.toFixed(3);
  }

  // -- Scene-5 trees overlay: sync to scene-5 viewport position so it sits above city-bus --
  if (cityTrees5 && SCROLL_MAP[4]) {
    const s5vx = SCROLL_MAP[4].stripX + effectiveTx;
    const inView = s5vx < _vw && s5vx > -0.22 * _vw;
    cityTrees5.style.opacity = inView ? '1' : '0';
    cityTrees5.style.transform = `translateX(${s5vx.toFixed(1)}px)`;
  }

  // -- Scene 7 & 8 overlays (characters + trees): sync to their scene positions --
  if (cityOverlay7 && SCROLL_MAP[6]) {
    const s7vx = SCROLL_MAP[6].stripX + effectiveTx;
    // Hide once we enter scene-8 zoom (currentScene >= 7) so scene-7 characters
    // don't bleed into the left edge of the viewport during the freeze.
    const show7 = currentScene < 7 && s7vx < _vw && s7vx > -_vw;
    cityOverlay7.style.opacity = show7 ? '1' : '0';
    cityOverlay7.style.transform = `translateX(${s7vx.toFixed(1)}px)`;
  }
  if (cityOverlay8 && SCROLL_MAP[7]) {
    const s8vx = SCROLL_MAP[7].stripX + effectiveTx;
    const show8overlay = (s8vx < _vw && s8vx > -_vw) ? '1' : '0';
    cityOverlay8.style.opacity = show8overlay;
    cityOverlay8.style.transform = `translateX(${s8vx.toFixed(1)}px)`;
    // Sign shows/hides together with panels[8] (panel-8, "Language is the foundational
    // inheritance..." — see its own show condition below, sceneLocal < 0.08).
    if (s8PlazaSign) {
      const showSign = currentScene === 7 && sceneLocal < 0.08;
      const signOpacity = (show8overlay === '0' || !showSign) ? 0 : 1;
      s8PlazaSign.style.opacity = signOpacity.toFixed(3);
    }
  }
  if (cityOverlay9 && SCROLL_MAP[8]) {
    const s9vx = SCROLL_MAP[8].stripX + effectiveTx;
    cityOverlay9.style.opacity = (s9vx < _vw && s9vx > -_vw) ? '1' : '0';
    cityOverlay9.style.transform = `translateX(${s9vx.toFixed(1)}px)`;
  }
  if (cityOverlay12 && SCROLL_MAP[9]) {
    const s12vx = SCROLL_MAP[9].stripX + effectiveTx;
    cityOverlay12.style.transform = `translateX(${s12vx.toFixed(1)}px)`;

    let ov12Op = 0;
    if (currentScene === 8) {
      // Position-based, like city-overlay-7/8/9 — characters ease into view as normal
      // scrolling brings them on screen, instead of popping to full opacity all at once
      // the moment the scene starts.
      ov12Op = (s12vx < _vw && s12vx > -_vw) ? 1 : 0;
    } else if (currentScene === 9) {
      if (sceneLocal < 0.18) {
        ov12Op = 1;
      } else {
        // fade out over 10% of the scene
        ov12Op = Math.max(0, 1 - (sceneLocal - 0.18) / 0.10);
      }
    }
    cityOverlay12.style.opacity = ov12Op.toFixed(3);

    // Tied to the bus's own front edge approaching the ALGORITHM AVENUE sign, as 3 distance
    // zones (fractions of viewport width) walked through in order as the bus moves right:
    //   OPEN  — fades in over this distance, ending STAY before the sign
    //   STAY  — fully open for this distance, right up to the (delayed) trigger point
    //   HIDE  — fades back out over this distance, starting once the bus has crossed it
    // S12_POPUP_DELAY_VW pushes the whole trigger later than the sign's own position — the
    // bus has to travel this much further past the sign before the popup opens.
    const S12_POPUP_OPEN_VW = 0.01; // fade-in distance, before the stay zone
    const S12_POPUP_STAY_VW = 0.05; // fully-open distance, ending right at the trigger point
    const S12_POPUP_HIDE_VW = 2.15; // fade-out distance, after the trigger point
    const S12_POPUP_DELAY_VW = 0.35; // how much later than the sign itself to trigger
    const signRect = _signRect;
    const busFrontX = _busRect ? _busRect.right : null;
    let show12op = 0;
    if (currentScene === 8 && signRect && busFrontX != null) {
      const openPx = S12_POPUP_OPEN_VW * _vw;
      const stayPx = S12_POPUP_STAY_VW * _vw;
      const hidePx = S12_POPUP_HIDE_VW * _vw;
      const delayPx = S12_POPUP_DELAY_VW * _vw;
      const triggerX = signRect.left + delayPx;
      const d = busFrontX - (triggerX - stayPx); // 0 at start of stay zone, +stayPx at trigger point
      if (d < -openPx) show12op = 0;                                   // before open zone
      else if (d < 0) show12op = (d + openPx) / openPx;                // opening
      else if (d <= stayPx) show12op = 1;                              // stay
      else if (d <= stayPx + hidePx) show12op = 1 - (d - stayPx) / hidePx; // hiding
      else show12op = 0;                                               // fully hidden
    }
    const show12 = show12op > 0;
    const p12 = panels[10];
    if (p12) {
      p12.style.opacity = show12op.toFixed(3);
      p12.classList.toggle('visible', show12);
    }
    if (panel12b) {
      panel12b.style.opacity = show12op.toFixed(3);
      panel12b.classList.toggle('visible', show12);
    }
    // Sign now shows/hides together with the panel-10/panel-12b popup pair above, instead
    // of just always inheriting #city-overlay-12's own opacity for the whole scene.
    if (s12AvenueSign) {
      s12AvenueSign.style.opacity = show12op.toFixed(3);
    }
  }

  // Scene 21 preview: fade in road behind pinned-wrap as s12-s15-bg fades out during close-up
  if (currentScene === 9 && sceneLocal >= 0.70) {
    const tFade = Math.min(1, (sceneLocal - 0.70) / 0.22); // 70%→92%
    if (s12s15bg)   s12s15bg.style.opacity   = (1 - tFade).toFixed(3);
    if (s21Preview) s21Preview.style.opacity = tFade.toFixed(3);
  } else if (currentScene >= 10) {
    if (s12s15bg)   s12s15bg.style.opacity   = '0';
    if (s21Preview) s21Preview.style.opacity = '0'; // strip scene-21+ has taken over
  } else {
    if (s12s15bg)   s12s15bg.style.opacity   = '1';
    if (s21Preview) s21Preview.style.opacity = '0';
  }
  if (s1215TreesFront) {
    const treesVx = 7.46 * _vw + effectiveTx;
    s1215TreesFront.style.transform = `translateX(${treesVx.toFixed(1)}px)`;
    s1215TreesFront.style.opacity   = s12s15bg ? s12s15bg.style.opacity : '0';
  }
  if (s5s8FenceFront) {
    // Absolute strip position = #s5-s8-bg's own left:400vw + the fence's old local
    // left:19% of that container's 415vw width (400 + 0.19*415 = 478.85vw).
    const fenceVx = 4.7885 * _vw + effectiveTx;
    s5s8FenceFront.style.transform = `translateX(${fenceVx.toFixed(1)}px)`;
    s5s8FenceFront.style.opacity   = (currentScene >= 4 && currentScene <= 7) ? '1' : '0';
  }

  // Scene 13 popups — position: fixed, screen-space coordinates
  // Bus exit shift on screen: bus moves right after 85%, amplified by pinnedWrap scale (3×)
  const _busShiftPx = currentScene === 9 && sceneLocal >= 0.85
    ? easeInOutCubic(Math.min(1, (sceneLocal - 0.85) / 0.10)) * 1.6 * getVw() * _s13TotalScale / 4
    : 0;
  // Positioned on the bus's live screen rect, same technique as panelS13_3 below (and
  // panel-8a/8b in scene 8) — a static top/left only lined up with the bus at one specific
  // zoom/scroll state, and scene 13's bus goes through heavy scale changes (wrapScale/zoom,
  // up to _s13TotalScale) throughout this range.
  if (panelS13_1) {
    const show = currentScene === 9 && sceneLocal >= 0.64 && sceneLocal < 0.70;
    const WIN_X = 0.64; // ← horizontal fraction of bus image (0=left, 1=right)
    const WIN_Y = 0.35; // ← vertical fraction of bus image (0=top, 1=bottom)
    if (_busRect && show) {
      panelS13_1.style.left = `${(_busRect.left + _busRect.width  * WIN_X).toFixed(0)}px`;
      panelS13_1.style.top  = `${(_busRect.top  + _busRect.height * WIN_Y).toFixed(0)}px`;
    }
    panelS13_1.style.opacity = show ? '1' : '0';
    panelS13_1.style.transform = '';
    panelS13_1.classList.toggle('visible', show);
  }
  if (panelS13_2) {
    const show = currentScene === 9 && sceneLocal >= 0.70 && sceneLocal < 0.72;
    const WIN_X = 0.64; // ← horizontal fraction of bus image (0=left, 1=right)
    const WIN_Y = 0.36; // ← vertical fraction of bus image (0=top, 1=bottom)
    if (_busRect && show) {
      panelS13_2.style.left = `${(_busRect.left + _busRect.width  * WIN_X).toFixed(0)}px`;
      panelS13_2.style.top  = `${(_busRect.top  + _busRect.height * WIN_Y).toFixed(0)}px`;
    }
    panelS13_2.style.opacity = show ? '1' : '0';
    panelS13_2.style.transform = '';
    panelS13_2.classList.toggle('visible', show);
  }
  if (panelS13_3) {
    const show = currentScene === 9 && sceneLocal >= 0.88;
    // Position popup on the bus's second window using live bus screen rect
    // Tune WIN_X (0–1 = left→right across bus) and WIN_Y (0–1 = top→bottom) to hit the window
    const WIN_X = 0.36; // ← horizontal fraction of bus image where second window is
    const WIN_Y = 0.24; // ← vertical fraction of bus image where second window is
    if (_busRect && show) {
      panelS13_3.style.left = `${(_busRect.left + _busRect.width  * WIN_X).toFixed(0)}px`;
      panelS13_3.style.top  = `${(_busRect.top  + _busRect.height * WIN_Y).toFixed(0)}px`;
    }
    panelS13_3.style.opacity   = show ? '1' : '0';
    panelS13_3.style.transform = '';
    panelS13_3.classList.toggle('visible', show);
  }

  // -- Progress bar --
  progressBar.style.width = (scrollPct * 100) + '%';
  // Fixed 30px block sliding along the track (must match .nav-track-fill's own width in
  // style.css) rather than growing a fill — left goes from 0% (flush at the start) to
  // calc(100% - 30px) (flush at the end, i.e. its right edge reaches the track's right edge
  // exactly at scrollPct 1).
  if (navProgressFill) navProgressFill.style.left = `calc(${(scrollPct * 100).toFixed(2)}% - ${(scrollPct * 30).toFixed(2)}px)`;

  // -- Scroll hint --
  if (scrollHint) scrollHint.classList.toggle('hidden', scrollY > 80);

  // -- Active dot --
  dots.forEach((d, i) => d.classList.toggle('active', i === currentScene));


  // -- Bus opacity: fade in via scroll in scene 1; instantly full in all later scenes --
  const st = window.scrollTimer;
  const elapsedMs = st.totalMs + (st.isScrolling && st._sessionStart ? Date.now() - st._sessionStart : 0);
  if (currentScene >= 1) {
    // Bus has completed its entry — lock opacity to 1 so there is no snap at any scene boundary
    busOpacity  = 1;
    hasScrolled = true;
  } else if (elapsedMs >= 1000) {
    hasScrolled = true;
  }
  busOpacity += ((hasScrolled ? 1 : 0) - busOpacity) * 0.08;

  // -- Matatu drive-in --
  animateMatatu(currentScene, sceneLocal, tx, junglePhase, busOpacity);
  animateCityBus(currentScene, sceneLocal, busOpacity, ts, s61PostZoomT);
  animateS21Vehicles(currentScene, sceneLocal, ts);
  animateS26S30(currentScene, sceneLocal, effectiveTx);
  animateS32S43(currentScene, sceneLocal, effectiveTx, ts);
  animateS44(currentScene, sceneLocal);
  animateS45S48(currentScene, sceneLocal, effectiveTx, ts);

  // -- Debug scale --
  const st2      = window.scrollTimer;
  const totalMs2 = st2.totalMs + (st2.isScrolling && st2._sessionStart ? Date.now() - st2._sessionStart : 0);
  const secs     = (totalMs2 / 1000).toFixed(1);
  const _inJungle  = JUNGLE_BUS_SCENES.includes(currentScene + 1);
  const _scenePct  = Math.round(sceneLocal * 100);
  const busVw      = _inJungle
    ? interpolateKeyframes(JUNGLE_KF, junglePhase).toFixed(0)
    : '–';
  const _sceneLabel  = SCENE_LABELS[currentScene] ?? (currentScene + 1);
  if (dbgScene)  dbgScene.textContent  = `scene ${_sceneLabel}  ${_scenePct}%`;
  if (dbgTime)   dbgTime.textContent   = `${secs}s`;
  if (dbgBus)    dbgBus.textContent    = `bus: ${busVw}vw`;
  if (dbgCursor) dbgCursor.style.left  = `${Math.min(((currentScene + sceneLocal) / SCENES) * 100, 96).toFixed(2)}%`;

  // -- Savanna / city layer reveals --
  animateLayerReveals(currentScene, sceneLocal);

  // -- City parallax for all city scenes (after layer clear so transforms aren't wiped) --
  applyCityParallax(currentScene, sceneLocal, prlxX1, prlxY1, prlxX2, prlxY2, prlxX3, prlxY3, prlxX4, prlxY4);

  // -- Text panel visibility -- each panel opens/closes at its own sceneLocal fraction
  // (0 = the very start of that scene's scroll, 1 = the very end) — edit start/end below to
  // change any one popup's timing independently, without affecting the others.
  // `preShow` is optional: it lets a panel also appear near the END of the PREVIOUS scene
  // (once that scene's own sceneLocal passes this fraction), instead of waiting for its own
  // scene to become current — this is how a popup can open "earlier than 0" (start can't go
  // below sceneLocal's own floor of 0, so earlier-than-that has to borrow time from the scene
  // before it).
  const PANEL_TIMING = {
    1: { start: 0.15, end: 0.92 }, // "Hop on the Prevailer matatu! TWENDE!"
    2: { start: 0.01, end: 0.92, preShow: 0.5 }, // also shows from the center of scene 1 onward
    3: { start: 0.01, end: 0.92, preShow: 0.5 }, // also shows from the center of scene 2 onward
    5: { start: 0.075, end: 0.92 }, // synced to the city bus's START position — it's already parked at ENTRY by scene-5's local:0 (drive-in happens during scene 4's final 40%, see animateCityBus scene===3 block), then eases ENTRY→CENTER over local 0-0.15 (scene===4 block) — this opens right as that move begins, not after it finishes.
    6: { start: 0.3, end: 0.92 },
    9: { start: 0.3, end: 0.92 },
    // panel-55/56/57 (keys 24/25/26) are NOT here — they're handled separately below via
    // positionCenteredPopup, not this generic left-fixed-in-CSS toggle. Reason: they live
    // inside #s55-s58-bg, which pans on a slow/nonlinear curve during the 55-57 hold (see
    // the S5557 blend in this function's effectiveTx block) — a static CSS `left` tuned for
    // a normal linear pan drifts off-screen once the curve isn't linear anymore. Same fix
    // already used for scenes 45-48's popups (see animateS45S48/positionCenteredPopup).
  };
  Object.keys(PANEL_TIMING).forEach(key => {
    const n = Number(key);
    if (!panels[n]) return;
    const { start, end, preShow } = PANEL_TIMING[n];
    const inOwnScene  = currentScene === n - 1 && sceneLocal > start && sceneLocal < end;
    const inPrevScene = preShow !== undefined && currentScene === n - 2 && sceneLocal >= preShow;
    const show = inOwnScene || inPrevScene;
    panels[n].style.opacity = show ? '1' : '0';
    panels[n].classList.toggle('visible', show);
  });

  // Scene 1 opening beat — shown before the bus has driven in at all. Hides at local 0.10,
  // a bit before panel-1's own PANEL_TIMING[1].start (0.15) — a real gap where neither is
  // visible, rather than an exact simultaneous handoff, so it reads as two distinct popups
  // in sequence instead of one instantly morphing into the other (and doesn't compete with
  // panel-1's own fade-in for paint time in the same instant).
  if (panel1Start) {
    // Plain boolean show/hide, same pattern as every other popup on the site — visible from
    // local 0 (page load) with no fade-in ramp, relying on #panel-1-start's own CSS
    // transition (opacity 0.4s ease, from the base .text-panel rule) for the smooth part.
    const HIDE_AT = 0.10;
    const showStart = currentScene === 0 && sceneLocal < HIDE_AT;
    panel1Start.style.opacity = showStart ? '1' : '0';
    panel1Start.classList.toggle('visible', showStart);
    // Blur uses a plain CSS transition (.s1s3-sharp in style.css), not a per-frame recompute —
    // recalculating filter:blur() every single frame forces the browser to re-rasterize the
    // whole image each time, which is expensive and was the actual source of continuous
    // stutter through the scroll range, worse than a single transition. Now that panel1Start
    // hides at 0.10 with a real gap before panel-1 shows at 0.15, this no longer collides with
    // the popup swap, so a simple CSS-timed transition here is smooth on its own.
    if (s1s3Troad) s1s3Troad.classList.toggle('s1s3-sharp', !showStart);
    if (s1s3Broad) s1s3Broad.classList.toggle('s1s3-sharp', !showStart);
  }

  // -- Scenes 55-57 popups: true CSS position:fixed now (see style.css) — moved to root level
  // in index.html specifically so they're genuinely relative to the viewport, not #scroll-x's
  // panning transform. No position math needed here at all any more, only opacity/.visible.
  if (SCROLL_MAP[23]) {
    // combinedLocal: 0 at scene-55 start .. 3 at scene-57 end (same combined scale as the
    // pan-speed blend above). Used so panel-55/56 can overlap (both open together for a
    // stretch) instead of being strictly one-scene-each — 56 opens before 55 closes, then
    // 56 closes exactly as 57 opens (no overlap there, a clean handoff).
    const inHoldRange = currentScene >= 23 && currentScene <= 25;
    const combinedLocal = inHoldRange ? (currentScene - 23) + sceneLocal : -1;
    // panel-55's own window split into two sequential popups (55 then 55b) instead of one
    // popup with two paragraphs — same total range (0.28-0.35), just handed off partway
    // through instead of both paragraphs showing at once.
    const show55  = inHoldRange && combinedLocal > 0.28  && combinedLocal < 0.315;
    const show55b = inHoldRange && combinedLocal > 0.315 && combinedLocal < 0.35;
    const show56 = inHoldRange && combinedLocal > 0.39 && combinedLocal < 0.41;
    const show57 = inHoldRange && combinedLocal > 0.42 && combinedLocal < 0.5;
    // Freeze scroll briefly on open — same universal pattern every other popup in this file
    // uses (POPUP_SCROLL_FREEZE_MS).
    if (show55 && !_panel55Shown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    if (show55b && !_panel55bShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    if (show56 && !_panel56Shown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    if (show57 && !_panel57Shown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel55Shown = show55;
    _panel55bShown = show55b;
    _panel56Shown = show56;
    _panel57Shown = show57;
    const setPanel = (el, show) => {
      if (!el) return;
      el.style.opacity = show ? '1' : '0';
      el.classList.toggle('visible', show);
    };
    setPanel(panels[24], show55);
    setPanel(panel55b, show55b);
    setPanel(panels[25], show56);
    setPanel(panels[26], show57);
    if (s55HunikiSign) s55HunikiSign.style.opacity = (show55 || show55b) ? '1' : '0';
  }

  // -- Scenes 59-73 popups: same dynamic-centering technique as scenes 55-57 above (this
  // wrapper is 450vw, way more than one viewport, so a static CSS left can't track the pan).
  // One popup per scene here (no overlap design yet, unlike 55/56) — each shows for the
  // middle 75% of its own scene's local range. S5973_BG_LEFT_VW must match #s59-s73-bg's
  // `left` in style.css. --
  if (SCROLL_MAP[27]) {
    const S5973_BG_LEFT_VW = 3089; // must match #s59-s73-bg's `left` in style.css (user-tuned)
    const vwPx2 = _vw / 100;
    const viewportCenterVw2 = -effectiveTx / vwPx2 + 50;
    const popupCenterVw2 = viewportCenterVw2 - S5973_BG_LEFT_VW;

    // Root-level bridge (see #s5973-bridge-front in style.css) — its local `left` (within
    // #s5973-bg-art) is 0vw, so its on-screen X (in vw from the viewport's left edge) is
    // S5973_BG_LEFT_VW - viewportCenterVw2 + 50; only shown during scenes 59-60 (27-28), the
    // same window #city-bus is actually on the bridge.
    if (s5973BridgeFront) {
      const bridgeOnScreenVw = S5973_BG_LEFT_VW - viewportCenterVw2 + 50;
      // Same scale as the background art (bgScale below) — so the bridge shrinks WITH the
      // rest of the scene during the zoom-out instead of staying a fixed size on its own
      // while everything around it pulls back (needs its own copy here since it's root-level,
      // not a child of #s5973BgArt that would inherit its transform automatically).
      const bridgeScale = 1 - 0.5 * s61PostZoomT;
      s5973BridgeFront.style.transform = `translateX(${(bridgeOnScreenVw * vwPx2).toFixed(1)}px) scale(${bridgeScale.toFixed(3)})`;
      s5973BridgeFront.style.opacity = (currentScene === 27 || currentScene === 28) ? '1' : '0';
    }

    // Trees — same on-screen-position formula as the bridge above (moved from its old
    // in-strip left:65vw to the bridge's own local origin, 0vw, per request — "near bridge
    // place"), same zoom-out scale so it shrinks together with everything else.
    if (s5973TreesFront) {
      const treesOnScreenVw = S5973_BG_LEFT_VW - viewportCenterVw2 + 50;
      const treesScale = 1 - 0.5 * s61PostZoomT;
      s5973TreesFront.style.transform = `translateX(${(treesOnScreenVw * vwPx2).toFixed(1)}px) scale(${treesScale.toFixed(3)})`;
      s5973TreesFront.style.opacity = (currentScene === 27 || currentScene === 28) ? '1' : '0';
    }

    // 4 popups here, same combinedLocal technique as scenes 55-57's inHoldRange/combinedLocal
    // above — one continuous value spanning scenes 27-29 (59-61) so all 4 windows read as
    // plain sequential bands instead of scattered separate blocks. panel-60 stays disabled
    // (duplicate text of panel-61, only the true final scene should open).
    const inHoldRange5973 = currentScene >= 27 && currentScene <= 29;
    const combinedLocal5973 = inHoldRange5973 ? (currentScene - 27) + sceneLocal : -1;

    const show59              = inHoldRange5973 && combinedLocal5973 > 0.15 && combinedLocal5973 < 0.45;
    const showPurpleMan       = inHoldRange5973 && combinedLocal5973 > 0.45 && combinedLocal5973 < 0.7;
    const showLanguageJustice = inHoldRange5973 && combinedLocal5973 > 0.7  && combinedLocal5973 < 1.0;
    const show61              = inHoldRange5973 && combinedLocal5973 > 1.02 && combinedLocal5973 < 1.2;

    positionCenteredPopup(s5973Panels[0], show59, popupCenterVw2);
    if (panelPurpleMan) positionCenteredPopup(panelPurpleMan, showPurpleMan, popupCenterVw2);
    if (panelLanguageJustice) positionCenteredPopup(panelLanguageJustice, showLanguageJustice, popupCenterVw2);

    // #panel-61: track bus position — same technique as #panel-5 (see the "#panel-5: track
    // bus position" block below), sitting above #city-bus with its long bubble__tail (left:
    // 66% of the box, per its CSS) pointing down at the bus's top-center. Root-level/
    // position:fixed (see style.css) so the live px coordinates from getBoundingClientRect()
    // line up correctly — a descendant of #scroll-x's transform would not (same gotcha as
    // #panel-5/#s47-crossing-matatu).
    const panel61 = s5973Panels[2];
    if (panel61) {
      panel61.style.opacity = show61 ? '1' : '0';
      panel61.classList.toggle('visible', show61);
      if (show61 && _busRect) {
        const boxWidth  = panel61.offsetWidth  || 0;
        const boxHeight = panel61.offsetHeight || 0;
        const tailTargetX = _busRect.left + _busRect.width * 0.5;
        const tailTargetY = _busRect.top;
        panel61.style.left   = `${(tailTargetX - boxWidth * 0.66).toFixed(0)}px`;
        panel61.style.top    = `${(tailTargetY - boxHeight - 20).toFixed(0)}px`;
        panel61.style.bottom = 'auto';
        panel61.style.right  = 'auto';
        panel61.style.transform = 'none';
      }
    }

    // Scenes 60-61 cloud cover — scrubbed frame-by-frame from combinedLocal5973 (not
    // autoplaying), same technique as scene 21's s21cLottie above (now that SCENE_SCROLL[28]/
    // [29] are back to normal values, this scrubs at a normal pace instead of needing tens of
    // thousands of px like it did while they were bumped to 40). Triggers right where the
    // second pull-back (s61PostZoomT) finishes — "after zoom out" — then scrubs as an ordinary
    // function of scroll for the rest of the closing chapter (combinedLocal5973 up to 3.0,
    // same upper bound show61 uses). Opacity tracks cloudT directly (not a separate shorter
    // fade span) so it and the lottie frame always move at the same rate.
    const cloudStart = S61_POSTZOOM_TRIGGER_LOCAL;
    const CLOUD_REVEAL_SPAN = 0.6; // smaller = clouds fully cover over less scroll (faster); was 3.0-cloudStart (1.8)
    const cloudSpan = CLOUD_REVEAL_SPAN;
    // Multiplied by s61PostZoomT (rather than gated by a hard s61PostZoomT>=1 check) so
    // scrolling back and un-zooming fades the clouds out smoothly in step with it, instead of
    // an instant cut to opacity 0 the moment s61PostZoomT drops off 1 even slightly.
    const cloudRawT = inHoldRange5973 ? Math.max(0, Math.min(1, (combinedLocal5973 - cloudStart) / cloudSpan)) : 0;
    const cloudT = cloudRawT * s61PostZoomT;
    if (s5973CloudsLottie) {
      s5973CloudsLottie.style.opacity = cloudT.toFixed(3);
      if (cloudT > 0 && typeof s5973CloudsLottie.getLottie === 'function') {
        const lottie = s5973CloudsLottie.getLottie();
        if (lottie && lottie.totalFrames) lottie.goToAndStop(cloudT * (lottie.totalFrames - 1), true);
      }
    }

    // -- Whole-background zoom: auto-playing, wall-clock driven by s61PostZoomT (computed
    // once, shared with the bus's own zoom in animateCityBus — see the freeze branch above).
    // transform-origin tracks the current viewport center (popupCenterVw2, already computed
    // above) so it zooms from what's actually on screen instead of some fixed point on the
    // 300vw-wide strip. --
    if (s5973BgArt) {
      if (currentScene === 27 || currentScene === 28) {
        // Same wall-clock s61PostZoomT as animateCityBus's zoom — kept at the same 0.5
        // fraction as the bus so the two stay in sync (matching the bridge/trees above).
        const bgScale = 1 - 0.5 * s61PostZoomT; // pull-back: 1.0 -> 0.5
        s5973BgArt.style.transformOrigin = `${popupCenterVw2.toFixed(2)}vw 50%`;
        s5973BgArt.style.transform = `scale(${bgScale.toFixed(3)})`;
        s5973BgArt.style.opacity = '1';
      } else {
        // Scene 61 — no special treatment anymore (was hidden, showing only a plain fill
        // color, back when the clouds needed something clean underneath their gaps; clouds
        // are disabled now, so this just left it as a pink void for no reason). Same as any
        // other scene: the park art (ground/bridge/trees) renders normally.
        s5973BgArt.style.transform = 'scale(1)';
        s5973BgArt.style.opacity = '1';
      }
    }

    // -- Scene 59->61 clouds cover — COMMENTED OUT (disabled on request). Was: the 3 cloud
    // images fading in ONE BY ONE (not all together), each getting its own equal slice of the
    // cover window (S5960_ZOOM_END_FRAC -> S5960_COVER_END_FRAC, driven by s5960Overall above).
    // s6061Puffs is now always empty (its elements are commented out in index.html too), so
    // this was already a no-op, but leaving the logic commented rather than deleted in case
    // it comes back.
    // const perPuffFrac = (S5960_COVER_END_FRAC - S5960_ZOOM_END_FRAC) / s6061Puffs.length;
    // s6061Puffs.forEach((puff, i) => {
    //   const myStart = S5960_ZOOM_END_FRAC + i * perPuffFrac;
    //   const t = easeInOutCubic(Math.max(0, Math.min(1, (s5960Overall - myStart) / perPuffFrac)));
    //   puff.style.opacity = t.toFixed(3);
    // });
    // (The scene-61 backdrop color swap to #F8DCD3 that used to live here was removed along
    // with hiding the park art above — same reasoning, leave the background as-is.)
  }

  // -- Scenes 62-64 (content screens) — root-level fixed overlay, screen-by-screen switching.
  // Not part of the pan strip at all anymore: #s62-s63-bg's own opacity shows/hides the whole
  // overlay, and each .s6263-slide crossfades via s6263Pos (computed above from _s6263Index/
  // _s6263FromIndex/_s6263TransT0, driven by the wheel-lock listener, not scroll position).
  // Each slide's own opacity is a "tent" centered on its own index — 1 exactly at s6263Pos===i,
  // fading to 0 by the time s6263Pos is 1 away — which generalizes correctly to any slide
  // count (the old hardcoded 2-slide version was `1-pos`/`pos`, a triangle across just 0..1). --
  if (s6263Bg) {
    s6263Bg.classList.toggle('active', _s6263Active);
    s6263Slides.forEach((el, i) => {
      if (el) el.style.opacity = Math.max(0, 1 - Math.abs(s6263Pos - i)).toFixed(3);
    });
    // Content panels (.s6263-content-panel, the real Resources/Credits/Contact design) fade
    // with their parent .s6263-slide's own opacity above — no separate opacity toggle needed.
    // pointer-events is toggled here instead: only the currently-active, settled slide's panel
    // should be clickable/scrollable — the other one sits at opacity:0 in the same spot and
    // must not intercept clicks/wheel meant for the visible one.
    s6263Panels.forEach((el, i) => {
      if (!el) return;
      const active = _s6263Active && _s6263TransT0 === null && _s6263Index === i;
      el.style.pointerEvents = active ? 'auto' : 'none';
    });
  }

  // #panel-5: track bus position — now `position: fixed` (see style.css), so it moves in
  // step with the bus's own drive-in animation instead of sitting at a static scene-relative
  // %. The bubble tail (CSS `.bubble__tail { left: 66% }`, tip pointing down-right) needs to
  // land on the driver, who sits at a fixed FRACTION of the bus's own width from its left
  // edge (~89%, measured directly off-screen at two very different viewport widths — the
  // bus's rendered width is vw-based, so the driver's absolute px position moves with it).
  // The old code anchored left to a flat `_busRect.left - 20` offset, which only happened to
  // line up with the driver at whatever width it was last tuned against — at any other width
  // the fixed 20px offset doesn't scale with the bus, so the tail drifts off the driver
  // entirely (confirmed: pointed at the wheel at ~1000px width, at a random passenger window
  // at ~1900px). Computing left from the driver's live position instead keeps the tail
  // pinned to him at any width. Box width read live too (panels[5].offsetWidth) since the
  // popup's own width is vmin-font-driven, not fixed either.
  const DRIVER_FRACTION_OF_BUS = 0.89; // driver's position along the bus, left edge = 0
  const TAIL_FRACTION_OF_BOX   = 0.66; // matches .bubble__tail's CSS `left: 66%`
  if (panels[5] && currentScene === 4 && _busRect) {
    const driverX = _busRect.left + _busRect.width * DRIVER_FRACTION_OF_BUS;
    const boxWidth = panels[5].offsetWidth || 0;
    panels[5].style.left = `${(driverX - boxWidth * TAIL_FRACTION_OF_BOX).toFixed(0)}px`;
    panels[5].style.top  = `${(_busRect.top + _busRect.height * 0.08).toFixed(0)}px`;
    panels[5].style.bottom = 'auto';
    panels[5].style.right  = 'auto';
  }

  // Scene 5: driver popup — fixed near bus driver window
  if (panel5Driver) {
    const showDriver = currentScene === 4 && sceneLocal > 0.3 && sceneLocal < 0.92;
    panel5Driver.style.opacity = showDriver ? '1' : '0';
    panel5Driver.classList.toggle('visible', showDriver);
  }

  // Scene 8: staggered sequence driven by sceneLocal (SCENE_SCROLL[7] = 3.0)
  // Panel-8 "PROBLEM PLAZA" — visible briefly on scene entry, gone before zoom
  if (panels[8]) {
    const show8 = currentScene === 7 && sceneLocal < 0.08;
    panels[8].style.opacity = show8 ? '1' : '0';
    panels[8].classList.toggle('visible', show8);
  }
  // Popup 1 — Africa's 2 000 languages — appears once bus is fully zoomed, stays ~2 "scrolls"
  // worth of time, then a ~1-"scroll" gap (both popups hidden) before popup 2 opens.
  if (popup8a) {
    const show = currentScene === 7 && sceneLocal > 0.42 && sceneLocal < 0.54;
    if (show) positionNearBusDriver(popup8a);
    popup8a.style.opacity = show ? '1' : '0';
    popup8a.classList.toggle('visible', show);
  }
  // Popup 2 — matatu comparison — appears after the gap, clears before bus close-up
  if (popup8b) {
    const show = currentScene === 7 && sceneLocal > 0.60 && sceneLocal < 0.68;
    if (show) positionNearBusDriver(popup8b);
    popup8b.style.opacity = show ? '1' : '0';
    popup8b.classList.toggle('visible', show);
  }
  // Bus transition flourish — scrubbed directly by scroll position (not autoplaying), right
  // after popup 2 (panel-8b) closes. sceneLocal 0.72-0.80 maps straight to the lottie's own
  // full frame range (0-87), so it starts from its true first frame, not partway in.
  if (s8BusTransitionWrap) {
    const S8_BUS_TRANS_ENABLED = false; // disabled for now — set true to re-enable
    const S8_BUS_TRANS_START = 0.72, S8_BUS_TRANS_END = 0.80;
    const inWindow = S8_BUS_TRANS_ENABLED && currentScene === 7 && sceneLocal >= S8_BUS_TRANS_START && sceneLocal < S8_BUS_TRANS_END;
    s8BusTransitionWrap.style.opacity = inWindow ? '1' : '0';
    if (inWindow && s8BusTransitionPlayer) {
      const t = (sceneLocal - S8_BUS_TRANS_START) / (S8_BUS_TRANS_END - S8_BUS_TRANS_START);
      const lottie = s8BusTransitionPlayer.getLottie && s8BusTransitionPlayer.getLottie();
      if (lottie) lottie.goToAndStop(t * 87, true);
    }
  }

  // -- Spoken narration: check after every panel's visibility has been resolved above.
  // Throttled to ~6/sec (not every rAF tick) — narration doesn't need 60fps precision, and
  // a screen reader like Narrator is already CPU-heavy right when it starts (it walks the
  // whole accessibility tree and spins up its own TTS engine), so this frees up some of the
  // budget competing with it instead of adding a 60/sec DOM-read loop on top. --
  if (ts - _lastNarrationCheck >= 150) {
    _lastNarrationCheck = ts;
    checkNarration();
    checkSceneExtras(currentScene, sceneLocal);
  }
}

// ---- Matatu animations ----
// Scene 1: bus enters from off-screen left → parks at center
// Scene 3 end: scene 4 slides in from right and covers the bus (clip-path)
function animateMatatu(scene, local, tx, junglePhase, opacity) {
  const vw     = getVw();
  const CENTER = 0.31 * vw;  // bus width 38vw → (100-38)/2 = 31vw, centred at 50vw
  const ENTRY  = -0.38 * vw; // off-screen left (right edge at 0)
  const inJungle = JUNGLE_BUS_SCENES.includes(scene + 1);

  if (jungleBus) {
    if (inJungle) {
      let busX;
      let busOpacityLocal;
      if (scene === 0) {
        // Fast approach, braking to a stop right as panel-1 appears (local 0.3, per
        // PANEL_TIMING) — compressing easeInOutCubic's own full accelerate/decelerate shape
        // into local 0-PARK_AT does this in a single continuous curve (unlike an earlier
        // version of this that stitched a linear phase to a separate easeOutCubic phase —
        // their velocities didn't match at the seam, which read as a jerk right there).
        // easeInOutCubic already starts AND ends at zero velocity, so both this curve's start
        // (local=0) and its clamped hold after PARK_AT are jerk-free too, not just the middle.
        const PARK_AT = 0.32; // essentially stopped by here — just past the popup trigger
        // Starts already 50% of the way along the ENTRY->CENTER path (and fully visible, no
        // fade-in) instead of fully off-screen — the bus is on screen from the very first
        // frame, alongside panel-1-start's "Scroll to get started!" prompt, rather than
        // appearing to drive in from nothing.
        const START_T = 0.5;
        const t = START_T + (1 - START_T) * easeInOutCubic(Math.min(1, local / PARK_AT));
        busX = ENTRY + t * (CENTER - ENTRY);
        busOpacityLocal = 1;
      } else {
        busX = CENTER;
        busOpacityLocal = opacity; // time-based opacity once parked
      }

      // #s4-trees overlay (z:11) sits above #jungle-bus (z:10), so trees naturally cover the bus.
      // Road stays behind the bus because it's inside #pinned-wrap (z:0 in root) — no clip needed.
      // Only hide the bus once scene 4's background edge has passed the bus's left edge.
      const sc4LeftPx = SCROLL_MAP[3].stripX + tx;
      jungleBus.style.clipPath = 'none';
      if (sc4LeftPx <= busX) {
        jungleBus.style.opacity = '0';
      } else {
        // translateY(-50%) centers the bus on the road regardless of its own image height —
        // see #jungle-bus's top:55% (road's own vertical center) in style.css.
        jungleBus.style.transform = `translateX(${busX.toFixed(1)}px) translateY(-50%)`;
        jungleBus.style.opacity   = busOpacityLocal.toFixed(3);
      }
    } else {
      jungleBus.style.opacity  = '0';
      jungleBus.style.clipPath = 'none';
    }
  }
}

// ---- City bus: starts entering when 30% of scene 4 (savanna) has passed ----
function animateCityBus(scene, local, opacity, ts, s61PostZoomT = 0) {
  if (!cityBus) return;
  const vw     = getVw();
  const vh     = window.innerHeight;
  const CENTER = 0.225 * vw;  // bus width 55vw → left edge at 22.5vw, dead-centered
  const ENTRY  = -0.1 * vw; // off-screen left (right edge at 0)

  let busY = 0; // vertical offset (px) applied to translateY — tune per-scene
  // .s1215-road's rendered height as a fraction of vw (window.innerWidth) — constant
  // regardless of window size since the road is sized off width, not height. Used by
  // scenes 8 and 9 to keep the bus aligned to the road at any window height — see there.
  const S1215_ROAD_HEIGHT_VW = 0.1687;

  // Reset every frame — scene-specific blocks override below
  if (cityBusEmpty)   cityBusEmpty.style.opacity   = '1';
  if (cityBusPeople)  cityBusPeople.style.opacity  = '0';
  if (cityBusFull)    cityBusFull.style.opacity    = '0';
  if (cityBusPeople1) cityBusPeople1.style.opacity = '0';
  if (cityBusS26)     cityBusS26.style.opacity     = '0';
  if (cityBusInside)  cityBusInside.style.opacity  = '0';
  if (cityBusS55)     cityBusS55.style.opacity     = '0';
  if (s5558Car)        s5558Car.style.opacity        = '0';
  if (s5558Car2)       s5558Car2.style.opacity       = '0';
  if (s5558Car3)       s5558Car3.style.opacity       = '0';
  if (cityAwayStand)  cityAwayStand.style.opacity  = '0';
  if (cityAwayHandle) cityAwayHandle.style.opacity = '0';
  if (cityBusHandleProp) cityBusHandleProp.style.opacity = '0';

  let eff  = 0;
  let busX = CENTER;
  let zoom = 1;

  if (scene === 3) {
    // Savanna (scene 4): city bus drives in from off-screen left in the final 40% of the scene
    // so it arrives at the left edge just as scene 5 begins — no fade, just a drive-in
    const t = easeInOutCubic(Math.min(1, Math.max(0, (local - 0.6) / 0.4)));
    busX = -0.6 * vw + t * (ENTRY - (-0.6 * vw));
    eff  = t > 0 ? opacity : 0;
  } else if (scene === 4) {
    // 10% of peak speed exactly at popup trigger (local=0.30): PARK_AT=0.356
    const t = easeInOutCubic(Math.min(1, local / 0.15));
    busX = ENTRY + t * (CENTER - ENTRY);
    eff  = opacity;
  } else if (scene === 5) {
    eff = opacity;
  } else if (scene === 6) {
    eff = opacity;
  } else if (scene === 7) {
    eff  = opacity;
    busX = CENTER;
    zoom = 1;
    const zoomMax = s8BusZoom();
    let targetZoom;
    if (local <= ZOOM_END) {
      targetZoom = 1 + (zoomMax - 1) * easeInOutCubic(local / ZOOM_END);
    } else if (local >= BUS_SCROLL_START) {
      // Background stays zoomed in for the whole exit slide — no visible zoom-out animation.
      // It gets reset to 1× instantly by the currentScene!==7 safety net elsewhere the moment
      // the scene actually ends, rather than easing down here.
      targetZoom = zoomMax;
    } else {
      targetZoom = zoomMax;
    }
    if (pinnedWrap) {
      pinnedWrap.style.transformOrigin = `75% ${busCenterY().toFixed(1)}%`;
      pinnedWrap.style.transform = targetZoom > 1.001 ? `scale(${targetZoom.toFixed(3)})` : '';
    }
    // Quick swap empty → people at local 0.15 (completes in 3% of scene — imperceptible)
    const peopleT = Math.min(1, Math.max(0, (local - 0.15) / 0.03));
    if (cityBusEmpty)  cityBusEmpty.style.opacity  = (1 - peopleT).toFixed(3);
    if (cityBusPeople) cityBusPeople.style.opacity = peopleT.toFixed(3);

    if (local >= BUS_CLOSE) {
      if (local < BUS_SCROLL_START) {
        const closeT = easeInOutCubic((local - BUS_CLOSE) / (BUS_SCROLL_START - BUS_CLOSE));
        zoom = 1 + (BUS_CLOSE_MULT * zoomMax - 1) * closeT;
        busX = CENTER;
      } else {
        const exitT = easeInOutCubic((local - BUS_SCROLL_START) / (1 - BUS_SCROLL_START));
        // Ease the bus's own zoom back down to 1× as it exits, in sync with pinnedWrap's own
        // zoom reset above and the scene-12 crossfade below — all three finish together
        // exactly as scene 8 ends, instead of the bus staying stuck at its close-up scale.
        zoom = BUS_CLOSE_MULT * zoomMax * (1 - exitT) + exitT;
        busX = CENTER + exitT * 1.5 * vw;
      }
      if (cityBus) cityBus.style.transformOrigin = '90% 50%';
    }
  } else if (scene === 8) {
    // Scene 12: bus with people, drive in from left
    eff  = opacity;
    zoom = 1;
    const t = easeInOutCubic(Math.min(1, local / 0.25));
    busX = local < 0.25 ? ENTRY + t * (CENTER - ENTRY) : CENTER;
    // #city-bus's own CSS (bottom:30%) is vh-based, but .s1215-road/.s1215-buildings are
    // sized off width (vw) — the two only agree at one specific window height/aspect ratio.
    // S1215_ROAD_HEIGHT_VW is .s1215-road's measured rendered height as a fraction of vw
    // (constant regardless of window size — verified across several widths/heights); this
    // correction keeps the bus visually planted on the road at any window height.
    busY = 0.40 * vh - S1215_ROAD_HEIGHT_VW * vw;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (local < 0.55) {
      if (cityBusEmpty)  cityBusEmpty.style.opacity  = '0';
      if (cityBusPeople) cityBusPeople.style.opacity = '1';
      if (cityBusFull)   cityBusFull.style.opacity   = '0';
    } else {
      if (cityBusEmpty)  cityBusEmpty.style.opacity  = '0';
      if (cityBusPeople) cityBusPeople.style.opacity = '0';
      if (cityBusFull)   cityBusFull.style.opacity   = '1';
    }
  } else if (scene === 9) {
    eff  = opacity;
    busX = CENTER;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    // Scene 13: before 18% full toto moto; at 18% crossfade to people1
    const t13 = Math.min(1, Math.max(0, (local - 0.18) / 0.10));
    if (cityBusFull)    cityBusFull.style.opacity    = (1 - t13).toFixed(3);
    if (cityBusPeople1) cityBusPeople1.style.opacity = t13.toFixed(3);
    if (cityBusEmpty)   cityBusEmpty.style.opacity   = '0';
    if (cityBusPeople)  cityBusPeople.style.opacity  = '0';
    // At 37% first zoom: pinnedWrap 1×→3×, holds during popups; eased back down 3×→1× from
    // 92% (bus slide-up). Computed as one final wrapScale value and written once below —
    // this used to be two separate writes (one here, one in the 92%+ block further down),
    // each preceded by its own busCenterY() call, which forces a synchronous layout reflow.
    // That meant two forced reflows every single frame during the 0.92-1.0 slide-up/zoom-out
    // window, on top of the already-expensive pinnedWrap repaint — the cause of the stutter
    // there.
    let wrapScale = 1;
    if (local >= 0.37) {
      const t1 = easeInOutCubic(Math.min(1, (local - 0.37) / 0.21));
      wrapScale = 1 + (3.0 - 1) * t1;
    }
    if (local >= 0.92) {
      const tUp92 = easeInOutCubic(Math.min(1, (local - 0.92) / 0.08));
      wrapScale = 3 - (3 - 1) * tUp92;
    }
    if (pinnedWrap && local >= 0.37) {
      pinnedWrap.style.transformOrigin = `75% ${busCenterY().toFixed(1)}%`;
      pinnedWrap.style.transform = `scale(${wrapScale.toFixed(3)})`;
    }
    // Same road-alignment correction as scene 8 (same .s1215-* background) — but divided by
    // wrapScale here. #city-bus's own translateY(busY) is part of ITS OWN transform, which
    // sits inside #pinned-wrap; once pinnedWrap scales, that local offset gets rendered
    // wrapScale× larger on screen right along with everything else. Scene 8 never scales
    // pinnedWrap, so the flat value works there unmodified — here it has to be pre-shrunk by
    // wrapScale so its on-screen size stays constant as the zoom ramps 1×→3×.
    const s1215AlignY = (0.40 * vh - S1215_ROAD_HEIGHT_VW * vw) / wrapScale;
    busY = s1215AlignY;
    // After 70%: second zoom on the bus element itself, framing the window area
    if (local >= 0.70) {
      const t2 = easeInOutCubic(Math.min(1, (local - 0.70) / 0.15));
      zoom  = 1 + (4.0 - 1) * t2;
      busY  = s1215AlignY + (-vh * -0.1 * t2);
      if (cityBus) cityBus.style.transformOrigin = '50% 35%';
    }
    // 85–90%: bus moves slightly right to stop position; 90–92%: fully stopped (popup 3)
    const EXIT_HOLD_X = CENTER + easeInOutCubic(1) * 0.39 * vw;
    if (local >= 0.85 && local < 0.90) {
      const tExit = easeInOutCubic((local - 0.85) / 0.05);
      busX = CENTER + tExit * (EXIT_HOLD_X - CENTER);
    } else if (local >= 0.90) {
      busX = EXIT_HOLD_X; // hold X while popup shows then during slide-up
    }
    // 92%+: slide bus straight up (pinnedWrap's own 3×→1× unscale is handled in the
    // wrapScale block above, written once instead of twice).
    if (local >= 0.92) {
      const tUp = easeInOutCubic(Math.min(1, (local - 0.92) / 0.08));
      busX = EXIT_HOLD_X;
      busY = s1215AlignY + 0.1 * vh - vh * 2 * tUp;
    }
    _s13TotalScale = wrapScale * zoom;
  } else if (scene >= 11 && scene <= 15) {
    // Scenes 26-30: matatu re-enters from left, same pattern as scene 5
    eff  = opacity;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty)   cityBusEmpty.style.opacity   = '0';
    if (cityBusPeople)  cityBusPeople.style.opacity  = '0';
    if (cityBusPeople1) cityBusPeople1.style.opacity = '0';
    // Bus variant: full-toto-moto until all 3 batches swapped, then cross-fade to interviewees
    // (kept in sync with the progress/threshold used in animateS26S30)
    const swapProg = scene < 12 ? -1 : scene > 14 ? 3 : (scene - 12) + local;
    const busSwapT = Math.min(1, Math.max(0, (swapProg - 2.7) / 0.3));
    if (cityBusFull) cityBusFull.style.opacity = (1 - busSwapT).toFixed(3);
    if (cityBusS26)  cityBusS26.style.opacity  = busSwapT.toFixed(3);
    // Conductor's welcome — own independent timing (not tied to busSwapT/the bus image
    // crossfade) so it gets more time on screen: starts earlier (swapProg 2.5, vs 2.7 for
    // the crossfade) and fades in over a slightly longer stretch. Scoped to scene===14
    // (scene 29) specifically — swapProg maxes out at 3 for all of scene 30 too, so without
    // this scene check the popup would never actually disappear once the zoom starts.
    if (panel29Welcome) {
      // Opens only once all 3 pairs have boarded (swapProg ~3, end of scene 29), then stays
      // up through the start of scene 30 — closing just before panel-30-popup1 takes over at
      // local 0.18 — so it gets real time on screen instead of a narrow window inside scene 29.
      let welcomeT = 0;
      if (scene === 14) {
        welcomeT = Math.min(1, Math.max(0, (swapProg - 2.85) / 0.1));
      } else if (scene === 15) {
        welcomeT = local < 0.15 ? 1 : Math.max(0, 1 - (local - 0.15) / 0.03);
      }
      const showWelcome = welcomeT > 0;
      panel29Welcome.style.opacity = welcomeT.toFixed(3);
      panel29Welcome.classList.toggle('visible', showWelcome);
    }
    if (scene === 11) {
      // Drive from off-screen left to center over first 40% of scene 26
      const t = easeInOutCubic(Math.min(1, local / 0.4));
      busX = ENTRY + t * (CENTER - ENTRY);
      if (_s26EnterTs == null) _s26EnterTs = ts;
    } else {
      busX = CENTER;
      _s26EnterTs = null;
    }
    // First two scene-26 popups open together, 1s after the bus enters
    const show26 = scene === 11 && _s26EnterTs != null && (ts - _s26EnterTs) >= 1000;
    if (panel26_1) {
      panel26_1.style.opacity = show26 ? '1' : '0';
      panel26_1.classList.toggle('visible', show26);
    }
    if (panel26_2) {
      panel26_2.style.opacity = show26 ? '1' : '0';
      panel26_2.classList.toggle('visible', show26);
    }
    if (panel26_3) {
      // Shows a bit earlier now — during the tail of scene 27, ahead of the 2nd pair (Chris &
      // Kathleen, scene 28) — hides once the 3rd pair starts its own fade-out (busSwapT > 0)
      // so it hands off to the welcome popup instead of overlapping it.
      const show263 = swapProg >= 0.6 && busSwapT === 0;
      panel26_3.style.opacity = show263 ? '1' : '0';
      panel26_3.classList.toggle('visible', show263);
    }
    // Scene 30: bus stays normal-sized at first while the 2 new popups play (05%→30%, see
    // showS30Popups below) — no zoom yet. Only once those close does the zoom-in begin
    // (34%→55%), swap exterior → interior bus right at the peak (55%→60%, fully cropped so
    // the swap is invisible), then HOLD at peak scale through Awa Ly's entrance and her
    // message (60%→90% — see S30_HOLD_END), and only then zoom back out + fade everything
    // (90%→100%) to hand off to the scene 32-43 interior overlay.
    if (scene === 15) {
      busX = CENTER;
      // Two popups, in sequence at the same spot — the scene itself keeps scrolling normally
      // first (see the effectiveTx branch above), then popup 1 opens, closes, and popup 2
      // opens in its place — all closed well before the zoom-in begins at 0.34.
      const showPopup1 = local >= 0.18 && local < 0.24;
      const showPopup2 = local >= 0.24 && local < 0.30;
      if (panel30Popup1) {
        panel30Popup1.style.opacity = showPopup1 ? '1' : '0';
        panel30Popup1.classList.toggle('visible', showPopup1);
      }
      if (panel30Popup2) {
        panel30Popup2.style.opacity = showPopup2 ? '1' : '0';
        panel30Popup2.classList.toggle('visible', showPopup2);
      }
    }
    if (scene === 15 && local >= 0.34) {
      const ZOOM_IN_END  = 0.45;
      const SWAP_START   = 0.45;
      const SWAP_END     = 0.50;
      const S30_HOLD_END = 0.90; // stays at peak scale until here — the "stay" the quote reads during
      const PEAK_SCALE   = 4.5;
      const FADE_ZOOM_IN_PEAK = 4.10; // zooms in even further during the fade-out (punch-in),
                                      // continuing the same direction as the entry ramp
                                      // instead of pulling back out.
      // Nudges the zoom's vertical anchor point (busCenterY()'s % from the top) — negative
      // moves the zoom-in focus UP (reveals more of the bottom), positive moves it DOWN
      // (reveals more of the top). 0 = unchanged (just busCenterY() on its own).
      const ZOOM_ORIGIN_Y_OFFSET = -5;
      // Nudges the zoom's horizontal anchor point (% from the left, base 50%) — negative
      // moves the zoom-in focus LEFT (reveals more of the right side), positive moves it
      // RIGHT (reveals more of the left side). 0 = unchanged (dead center).
      const ZOOM_ORIGIN_X_OFFSET = -8;
      const BUS_FADE_START = 0.95; // fades gradually, but only down to 0.8 (not 0) — see busFadeT below

      // Crossfade, not a hard cut and not a fade-to-nothing: this side fades from full
      // down to 0.8 (never further) by the end of scene 30. The scene-32 overlay (see
      // animateS32S43) starts its own fade-in AT 0.5 and ramps up to 1 — so the two meet
      // in the middle instead of leaving an empty gap or a washed-out lingering ghost.
      const busFadeT = Math.min(1, Math.max(0, (local - BUS_FADE_START) / (1 - BUS_FADE_START)));

      let s30Scale;
      if (local < ZOOM_IN_END) {
        const tIn = easeInOutCubic(Math.min(1, (local - 0.34) / (ZOOM_IN_END - 0.34)));
        s30Scale = 1 + (PEAK_SCALE - 1) * tIn;
      } else {
        // Holds flat at peak through the quote, then punches in FURTHER (up to
        // FADE_ZOOM_IN_PEAK) once the fade-out begins, instead of pulling back out.
        const tOut = easeInOutCubic(busFadeT);
        s30Scale = PEAK_SCALE + (FADE_ZOOM_IN_PEAK - PEAK_SCALE) * tOut;
      }

      const insideT = Math.min(1, Math.max(0, (local - SWAP_START) / (SWAP_END - SWAP_START)));
      const busFadeMul = 1 - busFadeT * 0.2; // floor at 0.8, not 0
      if (cityBusS26)    cityBusS26.style.opacity    = ((1 - insideT) * busFadeMul).toFixed(3);
      if (cityBusInside) cityBusInside.style.opacity = (insideT * busFadeMul).toFixed(3);

      // Awa Ly: fades in standing once the interior is settled (62%→66%), then crossfades
      // to holding the ceiling handle (70%→75%) — well inside the hold, so nothing about
      // her entrance competes with the zoom. She now lives in her own #s30-zoom-people
      // overlay (not inside #city-bus), so she needs the busFadeT fade-out applied
      // directly — she no longer inherits it from the container's opacity.
      const standInT = Math.min(1, Math.max(0, (local - 0.62) / 0.04));
      const handleT  = Math.min(1, Math.max(0, (local - 0.70) / 0.05));
      if (cityAwayStand)  cityAwayStand.style.opacity  = (standInT * (1 - handleT) * busFadeMul).toFixed(3);
      if (cityAwayHandle) cityAwayHandle.style.opacity = (standInT * handleT * busFadeMul).toFixed(3);
      // Ceiling handle prop: visible whenever she is (both poses), same fade in/out.
      if (cityBusHandleProp) cityBusHandleProp.style.opacity = (standInT * busFadeMul).toFixed(3);

      // Her message: appears once she's settled into the handle-hold pose, stays up for
      // the rest of the hold, and is dismissed right as the zoom-out/fade-out begins.
      if (panel30AwayLy) {
        const showQuote = local >= 0.76 && local < S30_HOLD_END;
        panel30AwayLy.style.opacity = showQuote ? '1' : '0';
        panel30AwayLy.classList.toggle('visible', showQuote);
        if (soundCaptionAwaLy) soundCaptionAwaLy.style.opacity = showQuote ? '1' : '0';
      }

      // Fade the whole #city-bus container too (not just its children) — floor at 0.8,
      // same as everything above.
      eff *= busFadeMul;

      if (cityBus) cityBus.style.transformOrigin = '50% 50%';
      if (pinnedWrap) {
        const originX = Math.max(0, Math.min(100, 50 + ZOOM_ORIGIN_X_OFFSET));
        const originYBase = Math.max(0, Math.min(100, busCenterY() + ZOOM_ORIGIN_Y_OFFSET));
        // Nudges the anchor UP as the fade-out progresses — shrinking toward a higher anchor
        // pulls content up and opens up room at the BOTTOM of the frame, so the zoom-out
        // above reveals more of the floor/bottom instead of the ceiling (anchoring down did
        // the opposite — revealed more of the top).
        const originY = Math.max(0, Math.min(100, originYBase - busFadeT * 4.5));
        pinnedWrap.style.transformOrigin = `${originX.toFixed(1)}% ${originY.toFixed(1)}%`;
        pinnedWrap.style.transform = `scale(${s30Scale.toFixed(3)})`;
      }
    } else {
      if (pinnedWrap) pinnedWrap.style.transform = 'scale(1)';
    }
    if (scene !== 15) {
      // Left scene 30 entirely — make sure the 2 popups don't linger.
      if (panel30Popup1) { panel30Popup1.style.opacity = '0'; panel30Popup1.classList.remove('visible'); }
      if (panel30Popup2) { panel30Popup2.style.opacity = '0'; panel30Popup2.classList.remove('visible'); }
    }
  } else if (scene === 22) {
    // Tail of scene 47 — frame()'s effectiveTx already blends the background pan toward scene
    // 55's start position during the crossing-matatu sequence (see the "currentScene === 22"
    // reveal blend there), fully arriving by the time crossingT reaches 1 and the freeze holds.
    // Since that freeze only releases on the NEXT scroll after it times out (not automatically —
    // same "wait for real input" pattern as Chris's popup elsewhere in this scene), `scene`
    // itself can stay 22 for a while after the street is already fully visible on screen,
    // leaving the Prevailer bus/companion cars invisible (their own branch starts at scene 23)
    // for that whole stretch. Fix: fade them in here too, but only up to their HALF-visible
    // "just arrived" position (FAR_ENTRY below) — held fixed there for the rest of scene 22,
    // not driven all the way to fully parked. The visible half-to-fully-parked slide itself
    // still plays out within scene 23's own scroll range below (see there), so scrolling
    // through the actual scene 55 street still shows the bus/cars visibly rolling in, instead
    // of arriving already fully parked with nothing left to animate.
    const _revealStart = _s47PopupHiddenLocal !== null ? _s47PopupHiddenLocal : 0.3;
    const _revealEnd = _revealStart + S47_CROSSING_DURATION;
    const _revealCrossingT = Math.min(1, Math.max(0, (local - _revealStart) / (_revealEnd - _revealStart)));
    const revealT = _revealCrossingT >= S47_REVEAL_START_T
      ? easeInOutCubic(Math.min(1, (_revealCrossingT - S47_REVEAL_START_T) / (1 - S47_REVEAL_START_T)))
      : 0;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty) cityBusEmpty.style.opacity = '0';
    if (cityBusS55)   cityBusS55.style.opacity   = '1';
    zoom = 1;
    // Half of the bus's own 55vw width — half on-screen rather than fully off, same "don't
    // read as a totally empty street" reasoning as everywhere else this trick is used. Scene
    // 23 below picks up from this exact same value, so there's no jump at the boundary.
    busX = -0.275 * vw;
    eff  = opacity * revealT;
    if (s5558Car) { s5558Car.style.opacity = (opacity * revealT).toFixed(3); s5558Car.style.transform = `translateX(${(-0.18 * vw).toFixed(1)}px)`; } // half of its own 36vw width
    // White Honda Fit (s5558Car2) deliberately NOT shown here at all — it stays fully hidden
    // (opacity 0, the "reset every frame" default above) through all of scene 22, instead of
    // also pre-appearing at its own half-visible position like the bus/lead car do. It gets
    // its own fade-in + slide entirely within scene 23 below, arriving later and reading as
    // a proper late entrance rather than "already sitting there, just needs to slide".
  } else if (scene >= 23 && scene <= 26) {
    // Scenes 55-58: matatu drives in and parks outside the Municipal Federation building —
    // same drive-in-then-park pattern as scene 5 (see scene===4 block above), using the
    // "full bus" exterior variant. Parked through 56-57, then drives off right as the
    // street pans away into clear sky at the end of scene 58.
    eff  = opacity;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty) cityBusEmpty.style.opacity = '0';
    if (cityBusS55)   cityBusS55.style.opacity   = '1';
    if (scene === 23) {
      // Continues from the exact half-visible position scene 22 above already faded it in
      // at (FAR_ENTRY here matches busX there) — one continuous forward slide into fully
      // parked, now playing out across scene 55's own scroll range where it's actually
      // visible, instead of finishing early during scene 47's hold.
      const FAR_ENTRY = -0.275 * vw;
      const t = easeInOutCubic(Math.min(1, local / 1.0));
      busX = FAR_ENTRY + t * (CENTER - FAR_ENTRY);
    } else if (scene <= 25) {
      // Scenes 56-57: stays parked
      busX = CENTER;
    } else {
      // Scene 58: the clouds+birds transition frame (#s5558-transition-frame-front) already
      // wipes across and hides the bus during scenes 56-57 (its own pan-synced position, see
      // frame()'s sync block) — no separate drive-off/fade needed here anymore, the bus is
      // simply gone once the birds have passed over it.
      busX = CENTER;
      eff  = 0;
    }
    // Companion cars — same drive-in/hold-sway/hide pattern, own timing per car so they
    // don't read as three identical clones moving in lockstep. ahead offsets their parked X
    // so they don't all stack on the same spot; swayPhase offsets the idle sway so they
    // drift independently during the hold.
    function driveCar(el, { farEntry, ahead, entryWindow, startDelay = 0, swayPhase, swayAmp }) {
      if (!el) return;
      let carX, carEff;
      if (scene === 23) {
        if (startDelay > 0) {
          // Stays at farEntry until `startDelay`, then SLIDES in late (see s5558Car2's call
          // below) — opacity stays flat at full (no fade-in transition), per request.
          const t = easeInOutCubic(Math.min(1, Math.max(0, local - startDelay) / (entryWindow - startDelay)));
          carX   = farEntry + t * (CENTER + ahead - farEntry);
          carEff = opacity;
        } else {
          // Continues from the same half-visible position scene 22 already faded it in at.
          const t = easeInOutCubic(Math.min(1, local / entryWindow));
          carX   = farEntry + t * (CENTER + ahead - farEntry);
          carEff = opacity;
        }
      } else if (scene <= 25) {
        const holdPhase = (scene - 24) + local + swayPhase;
        const sway = Math.sin(holdPhase * Math.PI * 1.5) * swayAmp;
        carX   = CENTER + ahead + sway;
        carEff = opacity;
      } else {
        // Scene 58: same reasoning as the bus above — the transition frame already hid it
        // during scenes 56-57, no separate drive-off/fade needed.
        carX   = CENTER + ahead;
        carEff = 0;
      }
      el.style.opacity   = carEff.toFixed(3);
      el.style.transform = `translateX(${carX.toFixed(1)}px)`;
    }
    // Leads ahead of the bus, a little earlier than it so it's already rolling into frame
    // before the bus catches up. farEntry matches scene 22's own half-visible fade-in position.
    driveCar(s5558Car,  { farEntry: -0.18 * vw, ahead:  0.15 * vw, entryWindow: 0.5,  swayPhase: 0,   swayAmp: 0.015 * vw });
    // Trails further back and enters slower — reads as a second car catching up from behind.
    // startDelay: stays hidden until scene 23 is already 15% scrolled, then fades in + slides.
    driveCar(s5558Car2, { farEntry: -0.15 * vw, ahead: -0.35 * vw, entryWindow: 0.65, startDelay: 0.15, swayPhase: 0.4, swayAmp: 0.02  * vw });
    // s5558Car3 (toyota probox) hidden per request — no driveCar() call, stays at its
    // default opacity 0 (set below) instead of driving in.
  } else if (scene >= 27 && scene <= 29) {
    // Scenes 59-61: closing chapter — matatu drives in once at scene 59, then keeps "driving"
    // continuously (a gentle bob, not literally translating) through the park/lake stretch
    // instead of parking dead still, since this chapter is meant to read as the bus still
    // moving. Never exits — scene 61 is the story's end, it just stays on screen.
    eff  = opacity;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty) cityBusEmpty.style.opacity = '0';
    if (cityBusS55)   cityBusS55.style.opacity   = '1';
    // Continuous phase across all 3 scenes so the bob doesn't reset/jump at each scene
    // boundary — 0 at scene-59 start, 2+local at scene-61.
    const chapterPhase = (scene - 27) + local;
    // Zoom scale — the early scene-59 auto-play pull-back (s5960ZoomT) was removed per
    // request, so this is now driven purely by s61PostZoomT (the second/final pull-back,
    // wall-clock/auto-playing once triggered — see the freeze branch + s61PostZoomT
    // computation in frame()). Bus stays full scale through all of scene 59 and the start of
    // scene 60, ordinary scroll-driven, right up until that second zoom takes over.
    // Pull-back: 1.0 -> 0.5 once panel-61 has closed (s61PostZoomT) — same 0.5 fraction as
    // the bridge/trees/background art, so everything pulls back together.
    zoom = 1 - 0.5 * s61PostZoomT;
    if (scene === 27) {
      // Drive in already half-visible at the very start (bus is 50vw wide, so -0.25vw left
      // edge = exactly half on-screen), not from fully off-screen like scene 55's entry, then
      // hold at CENTER with a gentle bob for the rest of scene 59 — ordinary scroll-driven,
      // no auto-play zoom anymore (removed per request).
      const FAR_ENTRY = -0.25 * vw;
      const t = easeInOutCubic(Math.min(1, local / S5960_ZOOM_START_PHASE));
      const bob = Math.sin(chapterPhase * Math.PI * 2) * 0.006 * vw;
      busX = FAR_ENTRY + t * (CENTER + bob - FAR_ENTRY);
      eff  = opacity; // no fade-in — fully visible (half on-screen) from local:0
    } else if (scene === 28 && s61PostZoomT === 0) {
      // Still scene 60, but before the second zoom has triggered — same gentle bob as scene
      // 59, ordinary scrolling continues right up to the trigger point.
      const bob = Math.sin(chapterPhase * Math.PI * 2) * 0.006 * vw;
      busX = CENTER + bob;
    } else if (scene === 28) {
      // The second zoom has triggered (or already finished) — hard freeze, no bob, while/
      // after the wall-clock pull-back plays, so the scale change doesn't fight the bob.
      // Only reachable in scene 28 now (scene 27's own branch above never freezes).
      busX = CENTER;
      busY = 0;
    } else {
      // Scene 61: the story has ended (clouds have covered/revealed it) — bus is gone for
      // good, same reasoning as scenes 58's car/seller above (hidden while still fully
      // covered by the clouds, so the disappearance itself is never visible).
      eff  = 0;
      busX = CENTER;
      busY = 0;
    }
  }

  // Apply cursor parallax across all city scenes (5–19, 55–58, 59–73); frozen only during bus close-up
  const inCityBus  = (scene >= 4 && scene <= 16) || (scene >= 23 && scene <= 26) || (scene >= 27 && scene <= 29);
  const inBusClose = scene === 7 && local >= S8_EXIT;
  // Also frozen during the scene-30 zoom-in/hold (scene===15, local>=0.34) — at PEAK_SCALE
  // (4.5x) the bus's own transform amplifies this same small mouse-parallax drift into a much
  // more visible shake, since the translate happens in the same transform that then scales it.
  const inS30Zoom = scene === 15 && local >= 0.34;
  const bpx = (inCityBus && !inBusClose && !inS30Zoom) ? prlxX2 * 12 : 0;
  const bpy = (inCityBus && !inBusClose && !inS30Zoom) ? prlxY2 * 6  : 0;

  if (eff > 0.001) {
    cityBus.style.opacity   = eff.toFixed(3);
    cityBus.style.transform = `translateX(${(busX + bpx).toFixed(1)}px) translateY(${(bpy + busY).toFixed(1)}px) scale(${zoom.toFixed(3)})`;
    cityBus.style.clipPath  = 'none';
  } else {
    cityBus.style.opacity   = '0';
    cityBus.style.transform = `translateX(${CENTER.toFixed(1)}px) scale(1)`;
    cityBus.style.clipPath  = 'none';
  }

  // #s30-zoom-people (Awa Ly, a separate root-level fixed overlay — see the scene-30 zoom
  // block) no longer follows the bus's mouse-parallax drift (bpx/bpy above) — that read as a
  // small shake on mouse move, so this now stays put instead of riding along with it.
  if (s30ZoomPeople) {
    s30ZoomPeople.style.transform = 'none';
  }
}

// ---- Scene 21 vehicles — 3 lanes (top: Meta, center: bus, bottom: Google). Each drives
// in from off-screen, staggered (bus, then Meta, then Google), and holds at a resting
// spot on screen once it arrives — driven entirely by sceneLocal (scroll position within
// the scene), so scrolling forward/back scrubs the drive-in directly instead of it playing
// on its own timer.
// After the viewer scrolls a bit further (S21_PHASE2_LOCAL), Meta and Google pull forward
// (not off-screen) to make room, and Microsoft/OpenAI drive into the spots they vacated —
// so all 4 trucks plus the bus are on screen together.
const S21_ENTER_LOCAL        = 0.4; // drive-in duration per vehicle, phase 1 (fraction of scene scroll)
const S21_STAGGER_LOCAL      = 0.05; // scroll delay between each phase-1 vehicle's entrance start
const S21_POPUP_OPEN_FRACTION = 0.3; // how far into each truck's drive-in its popup opens (0-1)
const S21_POPUP_HOLD_LOCAL   = 0.20; // how long popup-1 stays open before swapping to popup-2
const S21_PHASE2_LOCAL       = 0.45; // sceneLocal at which phase 2 kicks off
const S21_FORWARD_X          = 0.95; // Meta/Google's new forward resting position — needs to clear OpenAI's own rest spot (0.30) plus its width (0.572), i.e. >0.872, or the two trucks statically overlap even once both are fully settled
// Meta/Google's forward-shift and Microsoft/OpenAI's drive-in are kept equal — matching
// pace means Microsoft/OpenAI arrive at the vacated spot right as Meta/Google actually
// finish leaving it, instead of parking there while the previous truck is still mid-shift
// (visible as the two overlapping). S21_SHIFT_LOCAL was 0.5 (Meta/Google) against
// S21_PHASE2_ENTER_LOCAL's old 0.05 (Microsoft/OpenAI) — a 10x mismatch — before this fix.
const S21_SHIFT_LOCAL        = 0.15;
const S21_PHASE2_ENTER_LOCAL = 0.15;
const S21_PHASE2_STAGGER_LOCAL = 0.03; // scroll delay between Microsoft and OpenAI's entrance
const S21_PHASE2_POPUP_HOLD_LOCAL = 0.10; // how long Microsoft/OpenAI's popups stay open once OpenAI (the later one) arrives
// [element, entrance delay, resting position (fraction of viewport width from the left)] —
// different restX per vehicle so they don't all line up shoulder-to-shoulder like a race.
const S21_ORDER = [
  [s21vMeta,   0,                        0.22],
  [s21vGoogle, S21_STAGGER_LOCAL,        0.26],
  [s21vMatatu, S21_STAGGER_LOCAL * 2,    0.24],
];
const S21_PHASE2_ORDER = [
  [s21vMicrosoft, 0,                          0.14], // drives into the spot Meta vacated — pulled back a bit from 0.22 to clear more room from Meta's shifted-forward position
  [s21vOpenAI,    S21_PHASE2_STAGGER_LOCAL,   0.30], // drives into the spot Google vacated — pulled back a bit from 0.40 for the same reason
];
function animateS21Vehicles(scene, sceneLocal, ts) {
  const vw     = getVw();
  const active = scene === 10;
  if (s21Vehicles) s21Vehicles.style.opacity = active ? '1' : '0';
  // No .play()/.pause() here — the trucks' own wheel-spin animation is scrubbed frame-by-
  // frame from how far each has actually travelled (see scrubTruckLottie below), not left
  // to play on its own timer. That's what makes the whole truck (position AND its internal
  // animation) purely scroll-driven instead of auto-animating once the scene becomes active.
  if (!active) {
    // Release GPU layers when not in scene 21 so they don't compete with pinnedWrap animations
    [s21vMeta, s21vMatatu, s21vGoogle, s21vMicrosoft, s21vOpenAI].forEach(el => {
      if (el) el.style.transform = 'none';
    });
    if (s21cLottie) s21cLottie.style.opacity = '0';
    [panelS21Meta1, panelS21Google1, panelS21Meta2, panelS21Google2,
     panelS21Microsoft, panelS21OpenAI].forEach(p => {
      if (p) { p.style.opacity = '0'; p.classList.remove('visible'); }
    });
    return;
  }

  const inPhase2 = sceneLocal >= S21_PHASE2_LOCAL;
  const elapsed2 = inPhase2 ? (sceneLocal - S21_PHASE2_LOCAL) : null;
  // When OpenAI (the later of the two) actually arrives, and how far past that Microsoft/
  // OpenAI's popups stay open — computed from the phase-2 timing constants themselves so
  // this can never go stale into an impossible (close-before-open) window the way a
  // hardcoded cutoff did. The clouds' own fade-in (below) waits until this is done.
  const openAiArriveLocal = S21_PHASE2_LOCAL + S21_PHASE2_STAGGER_LOCAL + S21_PHASE2_ENTER_LOCAL;
  const s21Phase2PopupEnd = openAiArriveLocal + S21_PHASE2_POPUP_HOLD_LOCAL;
  // Each vehicle's own rendered width — sizes vary per truck now, so a shared fixed
  // offset isn't enough to fully hide the wider ones off-screen.
  const offW = el => Math.round((el.offsetWidth || 0.32 * vw) * 1.05);
  // Scrubs a truck's own wheel-spin lottie to the frame matching how far it's actually
  // travelled (xPx), instead of letting it play on its own clock — so the animation is
  // exactly as scroll-driven as the truck's position. Loops via modulo so the wheels keep
  // cycling round for however far the truck moves. S21_LOTTIE_PX_PER_FRAME tunes how many
  // px of travel correspond to one frame — lower = faster-spinning wheels.
  const S21_LOTTIE_PX_PER_FRAME = 6;
  const scrubTruckLottie = (el, xPx) => {
    if (!el || typeof el.getLottie !== 'function') return;
    const lottie = el.getLottie();
    if (!lottie || !lottie.totalFrames) return;
    const raw = (xPx / S21_LOTTIE_PX_PER_FRAME) % lottie.totalFrames;
    const frame = raw < 0 ? raw + lottie.totalFrames : raw;
    lottie.goToAndStop(frame, true);
  };

  // Bus stays put throughout — only Meta/Google are affected by phase 2.
  S21_ORDER.forEach(([el, delayLocal, restX]) => {
    if (!el) return;
    const w = offW(el);
    const restPx = restX * vw;
    const localElapsed = sceneLocal - delayLocal;
    let x;
    if (localElapsed <= 0) {
      x = -w; // still waiting its turn, parked off-screen left
    } else if (el !== s21vMatatu && elapsed2 != null) {
      // Phase 2: pull forward a bit (stay on screen) to make room for the new arrival —
      // linear, not eased, so the truck moves at a constant speed start to finish
      const t = Math.min(1, elapsed2 / S21_SHIFT_LOCAL);
      const forwardPx = S21_FORWARD_X * vw;
      x = restPx + t * (forwardPx - restPx);
    } else {
      // Linear drive-in — constant speed, no ease-in/ease-out
      const t = Math.min(1, localElapsed / S21_ENTER_LOCAL);
      x = -w + t * (restPx - (-w));
    }
    el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    scrubTruckLottie(el, x);
  });

  // Phase 2 entrants — Microsoft/OpenAI, hidden off-screen until phase 2 starts
  S21_PHASE2_ORDER.forEach(([el, delayLocal, restX]) => {
    if (!el) return;
    const w = offW(el);
    const restPx = restX * vw;
    let x = -w;
    if (elapsed2 != null) {
      const localElapsed2 = elapsed2 - delayLocal;
      if (localElapsed2 > 0) {
        // Linear drive-in — constant speed, no ease-in/ease-out
        const t = Math.min(1, localElapsed2 / S21_PHASE2_ENTER_LOCAL);
        x = -w + t * (restPx - (-w));
      }
    }
    el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    scrubTruckLottie(el, x);
  });

  // Clouds fade in only after Microsoft/OpenAI's popups have actually closed
  // (s21Phase2PopupEnd, computed above) — a hardcoded start point here would go stale the
  // same way the popups' own cutoff did whenever phase-2 timing is retuned. The lottie's
  // own frame is scrubbed across the remaining scroll (not autoplayed), same technique as
  // scrubTruckLottie — one full play-through spread across s21Phase2PopupEnd→end of scene.
  const S21_CLOUD_FADE_LOCAL = 0.08; // fade-in duration once clouds start appearing
  if (s21cLottie) {
    const cloudSpan = Math.max(0.0001, 1 - s21Phase2PopupEnd);
    const cloudT = Math.max(0, Math.min(1, (sceneLocal - s21Phase2PopupEnd) / cloudSpan));
    s21cLottie.style.opacity = Math.max(0, Math.min(1, (sceneLocal - s21Phase2PopupEnd) / S21_CLOUD_FADE_LOCAL)).toFixed(3);
    if (cloudT > 0 && typeof s21cLottie.getLottie === 'function') {
      const lottie = s21cLottie.getLottie();
      if (lottie && lottie.totalFrames) lottie.goToAndStop(cloudT * (lottie.totalFrames - 1), true);
    }
  }

  // Truck popups — 3 waves, one popup visible per truck at a time:
  //   wave 1: Meta-1, then Google-1 (staggered by each truck's own arrival)
  //   wave 2: Meta-2 swaps in for Meta-1 (same top spot), Google-2 swaps in for Google-1
  //           (same bottom spot) — after S21_POPUP_HOLD_LOCAL of wave 1
  //   wave 3: Microsoft + OpenAI, once phase 2 starts and each has driven in
  // Popups open partway through each truck's drive-in, not only once it's fully stopped —
  // S21_POPUP_OPEN_FRACTION is how far into the drive-in that is (0 = as soon as it starts
  // entering, 1 = only once fully arrived). Doesn't touch the truck's own drive-in speed.
  const metaArriveLocal    = S21_ENTER_LOCAL * S21_POPUP_OPEN_FRACTION;
  const googleArriveLocal  = S21_STAGGER_LOCAL + S21_ENTER_LOCAL * S21_POPUP_OPEN_FRACTION;
  const metaSwapLocal      = metaArriveLocal   + S21_POPUP_HOLD_LOCAL; // Meta-1 → Meta-2
  const googleSwapLocal    = googleArriveLocal + S21_POPUP_HOLD_LOCAL; // Google-1 → Google-2

  const showMeta1   = sceneLocal >= metaArriveLocal   && sceneLocal < metaSwapLocal;
  const showMeta2   = sceneLocal >= metaSwapLocal     && sceneLocal < S21_PHASE2_LOCAL;
  const showGoogle1 = sceneLocal >= googleArriveLocal && sceneLocal < googleSwapLocal;
  const showGoogle2 = sceneLocal >= googleSwapLocal   && sceneLocal < S21_PHASE2_LOCAL;
  const showMicrosoft = elapsed2 != null && elapsed2 >= S21_PHASE2_ENTER_LOCAL && sceneLocal < s21Phase2PopupEnd;
  const showOpenAI    = elapsed2 != null && (elapsed2 - S21_PHASE2_STAGGER_LOCAL) >= S21_PHASE2_ENTER_LOCAL && sceneLocal < s21Phase2PopupEnd;

  // Popups are fixed to the center of the window (see #panel-s21-* in style.css) — no
  // per-frame position tracking needed here, they don't move with their truck.

  [[panelS21Meta1, showMeta1], [panelS21Google1, showGoogle1],
   [panelS21Meta2, showMeta2], [panelS21Google2, showGoogle2],
   [panelS21Microsoft, showMicrosoft], [panelS21OpenAI, showOpenAI]].forEach(([p, show]) => {
    if (!p) return;
    p.style.opacity = show ? '1' : '0';
    p.classList.toggle('visible', show);
  });
}

// ---- Scene 26–30 overlay — 500vw wide, slides in sync with the strip ----
function animateS26S30(scene, local, etx) {
  if (!cityOverlay26 || !SCROLL_MAP[11]) return;
  const s26vx = SCROLL_MAP[11].stripX + etx;
  cityOverlay26.style.transform = `translateX(${s26vx.toFixed(1)}px)`;
  if (cityOverlay26Behind) cityOverlay26Behind.style.transform = `translateX(${s26vx.toFixed(1)}px)`;

  // Drops to 0 once the scene-30 zoom swap finishes (60%, see animateCityBus's SWAP_END)
  // and stays there — otherwise this overlay's own "Matatu with interviewees" backdrop
  // (.char-s30-matatu) is still sitting at full opacity behind the zoomed bus and pops
  // back into view once the bus fades, instead of just staying gone.
  let opacity;
  if (scene < 11)        opacity = 0;
  else if (scene === 15) opacity = local >= 0.60 ? 0 : 1;
  else if (scene <= 15)  opacity = 1;
  else                    opacity = 0;
  cityOverlay26.style.opacity = opacity.toFixed(3);
  if (cityOverlay26Behind) cityOverlay26Behind.style.opacity = opacity.toFixed(3);

  // #s26-s30-bg (trees/buildings/clouds art) stays visible through the scene-30 zoom instead
  // of fading to a plain backdrop — the buildings stay in view behind the bus. Only eases out
  // right at the very end (95%→100%) so the handoff into scene 32's own fade-in (see
  // animateS32S43) isn't an instant snap.
  if (s2630Bg) {
    let bgOpacity;
    if (scene < 11)        bgOpacity = 0;
    else if (scene === 15) bgOpacity = 1 - Math.min(1, Math.max(0, (local - 0.95) / 0.05));
    else if (scene < 15)   bgOpacity = 1;
    else                    bgOpacity = 0;
    s2630Bg.style.opacity = bgOpacity.toFixed(3);
  }

  // Batched character swap during scenes 27-29 (indices 12-14): 1 unit of progress
  // per scene, each scene's pair (batch) fades together over progress [b+0.3 → b+0.7].
  let progress;
  if (scene < 12)      progress = -1;
  else if (scene > 14) progress =  3;
  else                 progress = (scene - 12) + local;

  // Once all 3 batches are done, fade ALL characters out (they've boarded the bus) — group1
  // (standing chars) is already at opacity 0 by this point (its own swap already finished),
  // so in practice this rate is what's actually visible: how fast group2 (the name cards)
  // disappears. Sped up per request — was 0.018 (~3s to fade).
  const allDone = progress >= 2.7;
  if (!allDone) _s2630BoardFade = 0;
  else          _s2630BoardFade += (1 - _s2630BoardFade) * 0.06; // ~0.8s to full fade

  const LERP = 0.08;
  s2630Pairs.forEach(([g1, g2], i) => {
    const b  = s2630Batch[i];
    const t  = Math.min(1, Math.max(0, (progress - (b + 0.3)) / 0.4));
    s2630G1Op[i] += ((1 - t) - s2630G1Op[i]) * LERP;
    s2630G2Op[i] += (t       - s2630G2Op[i]) * LERP;
    const board = 1 - _s2630BoardFade;
    if (g1) g1.style.opacity = (s2630G1Op[i] * board).toFixed(3);
    if (g2) g2.style.opacity = (s2630G2Op[i] * board).toFixed(3);
  });
}

// ---- Scene 32–43 overlay — 1300vw wide, ambient passengers, slides in sync with the strip ----
function animateS32S43(scene, local, etx, ts) {
  if (!cityOverlay32 || !SCROLL_MAP[16]) return;
  const s32vx = SCROLL_MAP[16].stripX + etx;
  cityOverlay32.style.transform = `translateX(${s32vx.toFixed(1)}px)`;

  // Fades in right at the start of scene 32 (not during scene 30's tail) — scene 30's
  // strip is frozen the whole way through (see frame()'s effectiveTx), so this overlay
  // would be mispositioned (still using the frozen offset) if it faded in before the
  // freeze actually releases. Fading in here instead keeps position and opacity in sync.
  // Uses a high-water mark so a small scroll-back doesn't fade it back out.
  let opacity;
  if (scene < 16) {
    opacity = 0;
    _s32OverlayOpacity = 0; // reset only once fully scrolled back out of scene 32
  } else if (scene === 16) {
    // Crossfade partner to the scene-30 fade-out (see busFadeMul in animateCityBus):
    // that side fades from full down to 0.8, this side starts AT 0.8 and eases up to 1
    // — the two meet in the middle instead of either an empty gap or a lingering ghost.
    const t = easeInOutCubic(Math.min(1, Math.max(0, local / 0.15)));
    const raw = 0.8 + 0.2 * t;
    _s32OverlayOpacity = Math.max(_s32OverlayOpacity, raw);
    opacity = _s32OverlayOpacity;
  } else {
    opacity = 1;
    _s32OverlayOpacity = 1;
  }
  cityOverlay32.style.opacity = opacity.toFixed(3);

  // #s32-s43-bg has no opacity control of its own (unlike the overlay above), so it's
  // always fully opaque wherever the strip happens to place it. It's SUPPOSED to be
  // clipped out of view by the frozen strip during scene 30, but that's relying on
  // position math alone with no safety margin — explicitly hiding it here guarantees
  // scene 32's background can never show through behind the zoom.
  if (s3243Bg) {
    s3243Bg.style.opacity = opacity.toFixed(3);
  }

  // Intro popup — appears once the interior overlay has fully faded in (scene 32,
  // local 20%), stays up through most of the scene, dismissed by 60% so it's clear
  // before scene 33's own content would start competing for attention.
  if (panel32Intro) {
    // Starts at local 0.15, not earlier: that's when #city-overlay-32's own fade-in
    // finishes (see the crossfade in animateS32S43 below) — showing it any sooner made
    // its white background look washed-out/translucent since it inherits the still-
    // fading-in ancestor's opacity.
    const showIntro = scene === 16 && local >= 0.05 && local < 0.20;
    if (showIntro && !_panel32IntroShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32IntroShown = showIntro;
    panel32Intro.style.opacity = showIntro ? '1' : '0';
    panel32Intro.classList.toggle('visible', showIntro);
  }

  // Digital Umuganda popup — appears near old lady / girl-with-phone right after the
  // intro popup dismisses, and is gone before S32_ZOOM_HOLD (0.70) so it's dismissed
  // before the zoom finishes and the pan starts bridging into scene 33.
  if (panel32Umuganda) {
    const showUmuganda = scene === 16 && local >= 0.38 && local < 0.60;
    if (showUmuganda && !_panel32UmugandaShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32UmugandaShown = showUmuganda;
    panel32Umuganda.style.opacity = showUmuganda ? '1' : '0';
    panel32Umuganda.classList.toggle('visible', showUmuganda);
  }

  // Old lady + girl-with-phone: plain fade-in in place, reaching full opacity quickly
  // (a short 6% local window right after the trigger) rather than spread across the
  // whole zoom — still continuously scroll-driven, not a one-shot: scroll back and
  // they fade out again.
  const PEOPLE_FADE_END = S32_ZOOM_TRIGGER + 0.06;
  const peopleT = scene < 16 ? 0 : scene > 16 ? 1
    : Math.min(1, Math.max(0, (local - S32_ZOOM_TRIGGER) / (PEOPLE_FADE_END - S32_ZOOM_TRIGGER)));

  // Samuel Rutunda: same plain fade-in transition, but auto-plays on a wall-clock timer
  // once local reaches S32_ZOOM_HOLD (see _s32ZoomOutT0 in frame()) instead of tracking
  // scroll directly — it plays out like a video, no further scrolling needed.
  let samuelT;
  if (scene < 16) samuelT = 0;
  else if (scene > 16) samuelT = 1;
  else if (local < S32_ZOOM_HOLD) samuelT = 0;
  else samuelT = _s32ZoomOutT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _s32ZoomOutT0) / S32_ZOOMOUT_MS)));
  if (char39Samuel) char39Samuel.style.opacity = samuelT.toFixed(3);

  // True the instant Samuel's popup hides (local 0.90+) and the Lesan popup takes over —
  // used below to start the Asmelash zoom-in right away instead of waiting for Lesan to
  // actually be dismissed by scrolling.
  const LESAN_OPEN_LOCAL = 1; // scene 16 local where it first becomes eligible to open
  const lesanTriggered = scene > 16 || (scene === 16 && local >= LESAN_OPEN_LOCAL);

  // The 5th popup ("Many people may not know...") is "done" the instant it's dismissed
  // by the 3-scroll counter, or (fallback) once local reaches 0.20 anyway.
  const asmelash1Done = _s33AsmelashDismissed || local >= 0.30;

  // Zoom IN starts right away once Samuel's popup hides and Lesan takes over
  // (lesanTriggered, hoisted above) — used to wait for Lesan to actually be dismissed
  // (_s32LesanDismissed) instead, which made the zoom-in start noticeably later.
  // Ramps 1x -> 1.5x, wall-clock timed like the other zooms here.
  if (lesanTriggered && _sAsmelashZoomInT0 === null) _sAsmelashZoomInT0 = ts;
  if (!lesanTriggered) _sAsmelashZoomInT0 = null; // scrolled back out — reset so re-entering replays it
  const asmelashZoomInT = _sAsmelashZoomInT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _sAsmelashZoomInT0) / ASMELASH_ZOOMIN_MS)));

  // Pregnant woman: visible only within this local window in scene 17 — was fade-in-only
  // (never hid again once shown, staying visible into scene 18 too). Both edges ease over
  // PREGNANT_FADE_WIDTH.
  const PREGNANT_SHOW_LOCAL = 0.40; // starts fading in here
  const PREGNANT_HIDE_LOCAL = 0.95; // starts fading out here
  const PREGNANT_FADE_WIDTH = 0.05;
  let pregnantT;
  if (scene !== 17) {
    pregnantT = 0;
  } else {
    const fadeIn  = easeInOutCubic(Math.min(1, Math.max(0, (local - PREGNANT_SHOW_LOCAL) / PREGNANT_FADE_WIDTH)));
    const fadeOut = easeInOutCubic(Math.min(1, Math.max(0, (local - PREGNANT_HIDE_LOCAL) / PREGNANT_FADE_WIDTH)));
    pregnantT = fadeIn * (1 - fadeOut);
  }
  if (char35Pregnant) char35Pregnant.style.opacity = pregnantT.toFixed(3);

  // Zoom OUT once local reaches S33_ZOOM_HOLD (after both pregnant-woman popups have had
  // time to show) — wall-clock timed via _s33ZoomOutT0/S33_ZOOMOUT_MS in frame().
  let pregnantZoomT;
  if (scene < 17) pregnantZoomT = 0;
  else if (scene > 17) pregnantZoomT = 1;
  else if (local < S33_ZOOM_HOLD) pregnantZoomT = 0;
  else pregnantZoomT = _s33ZoomOutT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _s33ZoomOutT0) / S33_ZOOMOUT_MS)));

  // Zoom-out: locked at 1.5x while the two women are on screen, then eases back down to
  // 1x in step with Samuel fading in (same samuelT) — held stable until they're fully
  // seen, then zoom and cast change play out together. After that, a second cycle zooms
  // back IN once the 4th popup is dismissed (asmelashZoomInT), stays zoomed through
  // Asmelash + the pregnant-woman popups, then eases back OUT (pregnantZoomT) once
  // they're done.
  //
  // transform-origin is recomputed every frame instead of a fixed CSS %: with a hardcoded
  // origin, panning the strip while scale != 1 makes the zoomed content visibly drift
  // left/right (the origin point stays put in the div's own coordinates while the visible
  // viewport slides past it). Computing the origin as "whatever's centered in the viewport
  // right now" keeps the zoom centered on-screen regardless of where the strip has panned to.
  if (s3243Bg) {
    let s32Scale;
    if (scene < 16) {
      s32Scale = 1;
    } else if (scene === 16 && !lesanTriggered) {
      s32Scale = 1.5 - 0.5 * samuelT; // original scene-32 zoom-out for Samuel's reveal
    } else if (scene >= 19) {
      // Scene 44: no longer zooms the frozen scene-34 content underneath while the new
      // scene slides down over it — stays flat at 1x per request.
      s32Scale = 1;
    } else if (scene > 17 || (scene === 17 && local >= S33_ZOOM_HOLD)) {
      // Flat now, no zoom at all here — was 1.5 - 0.3*pregnantZoomT (eased down from 1.5 to
      // 1.2), but pregnantZoomT itself starts at 0 the instant this branch takes over from
      // the zoomed-in phase below (which ends at scale 1.2), so it jumped 1.2 -> 1.5 in one
      // frame and then eased back down to 1.2 — read as an unwanted zoom in+out right after
      // the pregnant-woman popups close. Removed per request; stays at the same 1.2 the
      // zoomed-in phase already ends at, so there's no jump either.
      s32Scale = 1.2;
    } else {
      s32Scale = 1 + 0.2 * asmelashZoomInT; // zoomed-in phase: Lesan-dismiss through Asmelash + pregnant popups
    }
    const vwPx = getVw() / 100;
    const stripXvw = -etx / vwPx;             // strip coordinate currently at the viewport's left edge
    const viewportCenterVw = stripXvw + 50;   // center of the 100vw viewport, in strip coordinates
    const S3243_BG_LEFT_VW = 1965;             // must match #s32-s43-bg's `left` in style.css
    const S3243_BG_WIDTH_VW = 450;            // must match #s32-s43-bg's `width` in style.css — needs to reach 2365vw (scene-44's frozen viewport right edge) with real margin; 380 gapped on the right during scene 44
    const originXPct = Math.max(0, Math.min(100,
      ((viewportCenterVw - S3243_BG_LEFT_VW) / S3243_BG_WIDTH_VW) * 100));
    const originStr = `${originXPct.toFixed(2)}% 75%`;
    const scaleStr  = `scale(${s32Scale.toFixed(3)})`;
    s3243Bg.style.transformOrigin = originStr;
    s3243Bg.style.transform = scaleStr;
    // #s32-people (old lady/girl-with-phone/Samuel/etc.) shares the exact same 1300vw
    // local coordinate space as #s32-s43-bg (both map to the same physical seat position
    // for a given local offset — see the matching S3243_BG_LEFT_VW/stripX relationship),
    // so the same scale + origin keeps them glued to their seats instead of drifting
    // independently of the background art as it zooms.
    if (s32People) {
      s32People.style.transformOrigin = originStr;
      s32People.style.transform = scaleStr;
    }
  }

  // Old lady + girl-with-phone fade back OUT as Samuel fades in (same samuelT, inverted)
  // — a clean "cast change" instead of all three staying on screen together.
  const behindT = peopleT * (1 - samuelT);
  if (char32OldLady)   char32OldLady.style.opacity   = behindT.toFixed(3);
  if (char33GirlPhone) char33GirlPhone.style.opacity = behindT.toFixed(3);

  // Samuel's quote — appears once he's fully faded in (samuelT reaches 1), stays up
  // until local 0.90, then hands off to the Lesan AI popup (4th popup, see below).
  if (panel32Samuel) {
    const showSamuel = scene === 16 && samuelT >= 1 && local < 0.90;
    if (showSamuel && !_panel32SamuelShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32SamuelShown = showSamuel;
    panel32Samuel.style.opacity = showSamuel ? '1' : '0';
    panel32Samuel.classList.toggle('visible', showSamuel);
    if (soundCaptionSamuel) soundCaptionSamuel.style.opacity = showSamuel ? '1' : '0';
  }

  // Lesan AI / community-centred practices popup — 4th popup, opens at LESAN_OPEN_LOCAL
  // (above, near lesanTriggered), auto-closes at LESAN_END_LOCAL below — plain scroll-
  // position numbers. Can also still be dismissed early via a scroll gesture (see the
  // 'wheel' listener above), whichever comes first.
  const LESAN_END_LOCAL = 1.02; // combined (scene-16)+local position where it auto-closes
  if (panel32Lesan) {
    // Stays triggered even after scrolling past scene 32 into 33+ (unlike the popup
    // itself, which is scene-32-only) — otherwise, scrolling through the tail of scene
    // 32 skips straight past the "popup dismissed, show Asmelash" state before it ever
    // gets a chance to happen. (lesanTriggered itself now hoisted above, near samuelT.)
    if (!lesanTriggered) {
      _s32LesanDismissed = false; // scrolled back out — reset so re-entering replays it
    }
    const lesanCombinedLocal = (scene - 16) + local;
    const showLesan = lesanTriggered && !_s32LesanDismissed && lesanCombinedLocal < LESAN_END_LOCAL;
    window.__lesanDebug = { scene, local, lesanTriggered, dismissed: _s32LesanDismissed, lesanCombinedLocal, LESAN_END_LOCAL, showLesan };
    if (showLesan && !_panel32LesanShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32LesanShown = showLesan;
    panel32Lesan.style.opacity = showLesan ? '1' : '0';
    panel32Lesan.classList.toggle('visible', showLesan);
  }

  // 5th popup — near Asmelash's head. Starts almost immediately on entering scene 17
  // (was 0.32) so he opens right after Lesan's popup is dismissed, instead of leaving a
  // long gap of empty scrolling before he shows up. Dismisses after 2 scroll gestures
  // (_s33AsmelashDismissed, counted in the 'wheel' listener) instead of waiting for a
  // fixed local threshold — local < 0.55 stays as a safety-net upper bound in case the
  // 2-scroll counter is somehow never reached (e.g. keyboard/programmatic scroll).
  if (!(scene === 17 && local >= 0.02)) {
    _s33AsmelashDismissed = false; // scrolled back out — reset so re-entering replays it
    _s33AsmelashTicks = 0;
  }
  const showAsmelashPopup = scene === 17 && local >= 0.02 && local < 0.15 && !_s33AsmelashDismissed;
  _s33AsmelashShown = showAsmelashPopup;
  // Explicit guaranteed hide for the earlier scene-27 boarding portrait (a distinct
  // element from char37Asmelash above) — forced off by the time this popup is up,
  // regardless of whatever else is meant to have already faded it out by here. Only
  // ever forces it OFF — never touches its opacity otherwise, so animateS26S30's own
  // fade animation (which runs earlier in the same frame) is left alone the rest of
  // the time.
  if (char27Asmelash && showAsmelashPopup) char27Asmelash.style.opacity = '0';
  if (panel32Asmelash) {
    if (showAsmelashPopup && panel32Asmelash.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Asmelash.style.opacity = showAsmelashPopup ? '1' : '0';
    panel32Asmelash.classList.toggle('visible', showAsmelashPopup);
  }
  // Asmelash (character) now hides/shows together with his popup above, instead of
  // staying visible independently through the rest of the scene.
  if (char37Asmelash) char37Asmelash.style.opacity = showAsmelashPopup ? '1' : '0';

  // 6th popup ("Here, data collection is an act of shared reflection...") — opens
  // together with the flipped Asmelash, right when the 5th popup is dismissed.
  // (asmelash1Done hoisted above, near samuelT/lesanTriggered.)
  const showAsmelash2Popup = scene === 17 && asmelash1Done && local < 0.35;
  // Flipped Asmelash (facing right) now hides/shows together with this popup, instead
  // of staying visible independently for the rest of the scene.
  if (char37Asmelash2) char37Asmelash2.style.opacity = showAsmelash2Popup ? '1' : '0';
  if (panel32Asmelash2) {
    if (showAsmelash2Popup && panel32Asmelash2.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Asmelash2.style.opacity = showAsmelash2Popup ? '1' : '0';
    panel32Asmelash2.classList.toggle('visible', showAsmelash2Popup);
  }
  // Name plate + sound icon tied only to the 5th popup ("Many people may not know..."),
  // not the 6th ("data collection...") — hides the moment this one does.
  if (soundCaptionAsmelash) {
    soundCaptionAsmelash.style.opacity = showAsmelashPopup ? '1' : '0';
  }

  // Sadik — last man in this sequence. Plain scroll-position rule (not tied to
  // pregnantZoomT's wall-clock timer) — that timer only completes 1200ms after local
  // hits 0.95, and if you keep scrolling during that window (keyboard/touch aren't
  // blocked by the wheel-only pan-freeze) local keeps advancing, so Sadik ended up not
  // showing until much later than intended.
  const showSadik = scene > 17 || (scene === 17 && local >= 0.97);
  if (char32Sadik) char32Sadik.style.opacity = showSadik ? '1' : '0';
  if (char34Kid1) char34Kid1.style.opacity = showSadik ? '1' : '0'; // lollipop kid, opens/hides together with Sadik per request

  // 7th popup — above the pregnant woman, opens first once she's fully zoomed-in-revealed
  // (pregnantT reaches 1). 8th popup — below her, opens a bit later (staggered, one by one).
  // Both close together once Sadik (the last man) shows up (local>=0.97, same threshold
  // showSadik itself uses).
  const PREGNANT_DOWN_OPEN = 0.57; // local — 8th popup's own (later) open point
  const PREGNANT_PAIR_END  = 0.7; // local — shared close point for both, same as showSadik
  if (panel32PregnantUp) {
    const showPregnantUp = scene === 17 && pregnantT >= 1 && local < PREGNANT_PAIR_END;
    if (showPregnantUp && panel32PregnantUp.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32PregnantUp.style.opacity = showPregnantUp ? '1' : '0';
    panel32PregnantUp.classList.toggle('visible', showPregnantUp);
  }

  if (panel32PregnantDown) {
    const showPregnantDown = scene === 17 && local >= PREGNANT_DOWN_OPEN && local < PREGNANT_PAIR_END;
    if (showPregnantDown && panel32PregnantDown.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32PregnantDown.style.opacity = showPregnantDown ? '1' : '0';
    panel32PregnantDown.classList.toggle('visible', showPregnantDown);
  }

  // 9th popup — near Sadik, shown right alongside him (same trigger — pregnantZoomT
  // already carries a wall-clock delay from the zoom-out itself, so no extra wait needed).
  if (panel32Sadik) {
    if (showSadik && panel32Sadik.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Sadik.style.opacity = showSadik ? '1' : '0';
    panel32Sadik.classList.toggle('visible', showSadik);
  }
  if (soundCaptionSadik) soundCaptionSadik.style.opacity = showSadik ? '1' : '0';
}

// ---- Scene 44: slides down from the top over scene-34, instead of panning in
// horizontally like every other scene. Continuously scroll-driven (not a one-shot), so
// scrolling back up slides it back off-screen. Once fully covering, scrolling on into
// scene 45 zooms the whole overlay away (scale up + fade) instead of leaving it frozen on
// screen forever — reveals scene 45 continuing underneath. ----
function animateS44(scene, local) {
  if (!s44Overlay) return;
  const slideT = scene < 19 ? 0 : scene > 19 ? 1 : easeInOutCubic(local);

  // Exit zoom uses the first S45_EXIT_RANGE of scene-45's own local range — scene 45 is kept
  // sticky (no pan) for this same window, see the effectiveTx freeze in frame().
  const exitT = scene < 20 ? 0 : scene > 20 ? 1 : easeInOutCubic(Math.min(1, local / S45_EXIT_RANGE));

  const translateY = (1 - slideT) * -100;
  const scale = 1 + 0.5 * exitT;
  s44Overlay.style.transform = `translateY(${translateY.toFixed(2)}%) scale(${scale.toFixed(3)})`;
  s44Overlay.style.opacity = (1 - exitT).toFixed(3);

  // #s45-s48-bg (scene 45-48's own background) stays at opacity 0 until the overlay above
  // actually starts revealing it (exitT), instead of being visible underneath the whole time.
  if (s4548Bg) s4548Bg.style.opacity = exitT.toFixed(3);

  // #s32-s43-bg (scenes 32-43's own background) stays at opacity 1 permanently past scene 16
  // (see animateS32S43's own opacity logic, which never reduces it again) — with #s45-s48-bg
  // above now correctly hidden until exitT reveals it, that left #s32-s43-bg visibly bleeding
  // through underneath/alongside it once the overlay faded away, a mismatch between the old
  // scene-32-43 art and the new scene-45-48 art. Runs AFTER animateS32S43 in frame() (see the
  // call order there), so this intentionally overrides its own opacity assignment for this
  // element during the exit window — fades out in the opposite direction of exitT so there's
  // no visible seam between the two backgrounds.
  if (s3243Bg) s3243Bg.style.opacity = (1 - exitT).toFixed(3);

  // "The guy" (toto-moto) — fades in a bit before the popup, so he's clearly visible by the
  // time the message appears rather than lagging behind it. Fades away with the rest of the
  // overlay during the exit zoom (its own opacity:1 stacks under the parent's).
  if (s44TotoMoto) s44TotoMoto.classList.toggle('visible', slideT >= 0.75);

  // Popup — appears once the slide-down finishes (slideT reaches 1).
  if (panel44_1) {
    const showPanel44_1 = slideT >= 1;
    panel44_1.style.opacity = showPanel44_1 ? '1' : '0';
    panel44_1.classList.toggle('visible', showPanel44_1);
  }
}

// Centers a scene-45/48 popup on the current viewport horizontally, recomputed every frame
// from the live pan position — same technique as the scene-46 zoom's transform-origin. A
// static CSS left:Xvw only happens to look centered at one particular scroll position and
// drifts everywhere else, which is exactly the bug this fixes: every other text-panel on the
// site stays centered on screen at all times (e.g. .scene-8 .text-panel's static
// left:50%/translateX(-50%) — that works as a plain constant there because that scene's own
// box is exactly one viewport-width; #s45-s48-bg is 520vw wide, so the equivalent "centered"
// vw value has to be computed live instead of being a fixed 50%).
// Positions a popup next to #city-bus's driver window, tracking its LIVE on-screen rect —
// used by panel-8a/8b, which used to sit at a fixed left/top (vw/%) that only lined up with
// the driver at one specific zoom/scroll state and window width. #city-bus moves and scales
// (BUS_CLOSE zoom) throughout scene 8, so this recomputes every frame while the popup is
// shown instead of once. Both panels live at root level (outside #pinned-wrap/#scroll-x), so
// plain viewport-relative getBoundingClientRect() coordinates apply directly, no containing-
// block complications from #pinned-wrap's own active transform during the zoom.
function positionNearBusDriver(el) {
  if (!el || !cityBus) return;
  const busRect = cityBus.getBoundingClientRect();
  const bh = el.offsetHeight;
  // Simplified to a fixed left margin — the bus-relative formula this used to have was being
  // pushed so far left it was permanently hitting this same 12px floor anyway, so the formula
  // was doing nothing. top still tracks the bus's live vertical position.
  el.style.left = '-350px';
  el.style.top = (busRect.top + busRect.height * 0.50 - bh / 2) + 'px';
}

function positionNearTruckFront(popupEl, truckEl, winX, winY, behind) {
  if (!popupEl || !truckEl) return;
  const rect = truckEl.getBoundingClientRect();
  const bw = popupEl.offsetWidth || 0;
  const anchorX = rect.left + rect.width * winX;
  // behind=true flushes the popup's own RIGHT edge against the anchor instead of its left,
  // so it sits fully outside/trailing the truck (in its wake) rather than overlapping it.
  popupEl.style.left      = `${(behind ? anchorX - bw : anchorX).toFixed(0)}px`;
  popupEl.style.top       = `${(rect.top  + rect.height * winY).toFixed(0)}px`;
  popupEl.style.transform = '';
}

function positionCenteredPopup(el, show, centerVw) {
  if (!el) return;
  el.style.left = `${centerVw.toFixed(2)}vw`;
  el.style.transform = `translateX(-50%) translateY(${show ? '0' : '8px'})`;
  el.style.opacity = show ? '1' : '0';
  el.classList.toggle('visible', show);
}

// ---- Scenes 45-48: ambient bus-interior passengers continue, same simple "plain
// scroll-position, no ratchet" fade pattern as scenes 32-34's ambient characters. No zoom
// sequence here, so no position sync is needed either — #s45-s48-bg is a normal child of
// #scroll-x and pans automatically with it; this only toggles each character's opacity. ----
function animateS45S48(scene, local, etx, ts) {
  // Where the viewport's horizontal center currently sits, in #s45-s48-bg's own container-
  // local coordinate space — recomputed every frame from the live pan (etx), reused below
  // by every popup's positionCenteredPopup() call so they all stay centered on screen.
  const S45S48_BG_LEFT_VW = 2250; // must match #s45-s48-bg's `left` in style.css — was stale at 2256
  const vwPx = getVw() / 100;
  const viewportCenterVw = -etx / vwPx + 50;
  const popupCenterVw = viewportCenterVw - S45S48_BG_LEFT_VW;

  // Sequence within scene 45, which stays fully pinned the whole time (S45_STICKY_RANGE
  // covers the whole scene, now stretched to 4.0 viewport-widths of scroll so everyone gets
  // real time on screen) — nobody shows at the very start (a small scroll-in delay first),
  // then Kathleen (with popup) → toto moto → red lady (with popup) → toto moto's popup →
  // wheelchair man, one at a time. Each one stays visible once shown (no fade-out) — they
  // accumulate instead of replacing each other.
  // Kathleen now hides together with her own quote popup (showKathleen) instead of staying
  // seated through scenes 46-48 the way the wheelchair man does.
  const showKathleen = scene === 20 && local > 0.25 && local < 0.4;
  if (char45Kathleen)   char45Kathleen.classList.toggle('visible',   showKathleen);
  const showTotoMoto = scene === 20 && local >= 0.45;
  if (char45TotoMoto)   char45TotoMoto.classList.toggle('visible',   showTotoMoto);
  const showRedLadyChar = scene === 20 && local >= 0.65;
  if (char45RedLady)    char45RedLady.classList.toggle('visible',    showRedLadyChar);
  // Toto moto's name plate + quote hand off to the red lady — they hide the moment she
  // shows up, even though toto moto himself stays in frame.
  const showTotoMotoLabel = showTotoMoto && !showRedLadyChar;
  if (soundCaptionTotoMoto) soundCaptionTotoMoto.style.opacity = showTotoMotoLabel ? '1' : '0';
  // Toto moto and red lady don't carry into 46-48 — only Kathleen and wheelchair man stay
  // seated together for the scene-47/48 popups below.

  // Kathleen's quote — same window as Kathleen herself (showKathleen, hoisted above), so
  // the two open and hide together. Plain opacity/visible toggle only — no auto left/
  // transform (positioned via CSS instead, unlike the other positionCenteredPopup() calls).
  if (panel45Kathleen) {
    panel45Kathleen.style.opacity = showKathleen ? '1' : '0';
    panel45Kathleen.classList.toggle('visible', showKathleen);
  }
  // Name plate + sound icon now hide/show together with her quote popup.
  if (soundCaptionKathleen) soundCaptionKathleen.style.opacity = showKathleen ? '1' : '0';

  // Red lady's quote — shown once she's been visible a moment, hides again before toto
  // moto's own popup takes its turn.
  const showRedLady = scene === 20 && local > 0.7 && local < 0.82;
  positionCenteredPopup(panel45RedLady, showRedLady, popupCenterVw);

  // Toto moto's quote — opens with toto moto himself and hides as soon as the red lady
  // shows up (showTotoMotoLabel above), same as his name plate.
  positionCenteredPopup(panel45TotoMoto, showTotoMotoLabel, popupCenterVw);

  // Wheelchair man — next guy in the sequence, stays for the rest of the scene once he
  // appears, giving him real time on screen before scene 46 begins.
  // Stays visible even past scene 45 (scrolling into 46/47/48) — no hide once he's appeared.
  if (char45Wheelchair) char45Wheelchair.classList.toggle('visible', scene > 20 || (scene === 20 && local >= 0.9));


  // Wheelchair man zoom-in — wall-clock timed (see _s46ZoomT0, stamped in frame() the moment
  // the pan settles him into center), so it plays out on its own like a video, no further
  // scrolling needed. Stays fully zoomed through the rest of scene 46 and scenes 47/48 too,
  // since Kathleen and he stay in frame together for their popups there (see below).
  // Scroll-driven (see S46_ZOOM_END_LOCAL) — eases 0->1 across the pan's own hold window, so
  // it follows the wheel smoothly and reverses on scroll-back, instead of a one-shot timer.
  const wheelchairZoomT = scene < 21 ? 0
    : scene > 21 ? 1
    : easeInOutCubic(Math.min(1, Math.max(0, (local - S46_HOLD_START) / (S46_ZOOM_END_LOCAL - S46_HOLD_START))));
  if (s4548Visual) {
    const s46Scale = 1 + 0.5 * wheelchairZoomT;
    // Same "recompute origin from the current viewport center" technique as
    // animateS32S43's s3243Bg zoom — keeps the zoom centered on-screen regardless of where
    // the strip has panned to (a fixed CSS % origin would visibly drift while panning).
    // Scales #s45-s48-visual (background art + character sprites only), not #s45-s48-bg
    // itself — the popups/nameplates are siblings outside that wrapper (see index.html),
    // so they stay normal-sized instead of stretching along with the zoomed visuals.
    // Reuses popupCenterVw (computed once at the top of this function) — it's the same
    // "viewport center in #s45-s48-bg's own coordinate space" value the popups use.
    const S45S48_BG_WIDTH_VW = 520;  // must match #s45-s48-bg's `width` in style.css
    const originXPct = Math.max(0, Math.min(100, (popupCenterVw / S45S48_BG_WIDTH_VW) * 100));
    s4548Visual.style.transformOrigin = `${originXPct.toFixed(2)}% 75%`;
    s4548Visual.style.transform = `scale(${s46Scale.toFixed(3)})`;
  }

  // Huniki popup shows first once the zoom-in finishes (S46_ZOOM_END_LOCAL), stays up until
  // S46_HUNIKI_LOCAL_END, then the Big Tech popup takes over until S46_BIGTECH_LOCAL_END —
  // scroll-driven off local (like every other popup in this file), not wall-clock, so they
  // open/close on scroll position — was wall-clock (2s each, off a stamp taken the instant the
  // zoom finished), which made them open and close automatically regardless of scrolling.
  const showHuniki = scene === 21 && local >= S46_ZOOM_END_LOCAL && local < S46_HUNIKI_LOCAL_END;
  positionCenteredPopup(panel46Huniki, showHuniki, popupCenterVw);
  const showBigTech = scene === 21 && local >= S46_HUNIKI_LOCAL_END && local < S46_BIGTECH_LOCAL_END;
  positionCenteredPopup(panel46BigTech, showBigTech, popupCenterVw);

  // Chris Emezue's quote — he and the last red-topped woman are baked into the seat art
  // itself, so there's no character reveal here, just the popup timed to when that part of
  // the art is roughly centered on screen (confirmed in-browser: scene 47, local ~4%).
  // Triggers right at the scene 46/47 boundary (scene 22 local=0) — no early offset. A "200px
  // earlier" adjustment used to live here, which meant the freeze often fired and finished
  // before the pan actually reached this exact frame, leaving nothing frozen by the time you
  // got here.
  // Excludes !showHuniki && !showBigTech so this can NEVER overlap those two, regardless of
  // whatever local thresholds end up chosen above/below — confirmed live they were opening
  // at the same time (both visible, overlapping text) once this popup's own window was
  // widened to start earlier in scene 21.
  const showChris = ((scene === 21 && local >= 0.75) || (scene === 22 && local < 0.6)) && !showHuniki && !showBigTech;
  // No freeze-on-open here any more — this popup now freezes when it reaches screen center
  // instead (see the _panel47CenterReached check below, on panel47NewGuy).

  // .char-s47-newguy/#panel-47-newguy — hosts Chris Emezue's popup + sound caption.
  // Mirrors showChris's own window (same two people, same timing), except it hides itself
  // for good the instant you actually scroll again after its own center-freeze ends — not
  // on a timer. Stays up through the
  // freeze and keeps staying up afterward for as long as scrollY doesn't move (e.g. you just
  // sit there once it releases); the moment scrollY changes at all, it's gone.
  const _s47FreezeTimerDone = _panel47FreezeEndsAt !== null && Date.now() >= _panel47FreezeEndsAt;
  if (_s47FreezeTimerDone && _panel47FreezeReleaseScrollY === null) {
    _panel47FreezeReleaseScrollY = window.scrollY; // where it was pinned, captured once the timer finishes
  }
  const _s47HiddenByScroll = _panel47FreezeReleaseScrollY !== null && window.scrollY !== _panel47FreezeReleaseScrollY;
  const showS47NewGuy = showChris && !_s47HiddenByScroll;
  // Captured once, the instant the popup actually hides (scene 22 only — if it hid back in
  // scene 21's tail, local resets on entering scene 22 anyway, so there's nothing meaningful
  // to capture yet) — the crossing-matatu sequence below starts from here instead of a fixed
  // local fraction, so it runs right on the popup's own position instead of independently.
  if (_s47HiddenByScroll && scene === 22 && _s47PopupHiddenLocal === null) {
    _s47PopupHiddenLocal = local;
  }
  if (!showChris) { _panel47FreezeEndsAt = null; _panel47FreezeReleaseScrollY = null; _s47PopupHiddenLocal = null; } // re-arm for next time it opens
  _panel47NewGuyShown = showS47NewGuy;
  // Freeze not on open, but the moment the popup itself reaches the exact center of the
  // viewport — same reference point as the wheelchair man's own hold-at-center. Own longer
  // hold duration (S47_CENTER_FREEZE_MS, not the shared 700ms POPUP_SCROLL_FREEZE_MS every
  // other popup uses) — 700ms turned out to be shorter than a real trackpad/mouse's own
  // scroll-momentum decay, so it was completely imperceptible; this needs to read as a
  // deliberate lock, like wheelchair's hold does. Measured directly off the popup's own live
  // on-screen position (getBoundingClientRect, by now reflecting this frame's pan+zoom
  // transforms, both already applied above) instead of a hardcoded scroll fraction — a fixed
  // local-fraction threshold went stale within minutes of static-positioning this popup,
  // since its left/bottom keep getting tuned. Triggers on the sign of
  // (popup center - viewport center) flipping between frames — i.e. the exact frame it
  // crosses center — rather than a fixed pixel window, since a single real scroll tick can be
  // bigger than any fixed window and skip right over it, never firing at all.
  if (showS47NewGuy && panel47NewGuy) {
    const _p47Rect = panel47NewGuy.getBoundingClientRect();
    const _p47Diff = (_p47Rect.left + _p47Rect.right) / 2 - getVw() / 2;
    if (_panel47PrevDiff !== null && _panel47PrevDiff !== 0 && Math.sign(_panel47PrevDiff) !== Math.sign(_p47Diff)) {
      _scrollFreezeUntil = Date.now() + S47_CENTER_FREEZE_MS;
      _panel47FreezeEndsAt = _scrollFreezeUntil; // popup hides itself once this passes — see showS47NewGuy above
    }
    _panel47PrevDiff = _p47Diff;
  } else {
    _panel47PrevDiff = null; // re-arm for next time it opens
  }
  if (char47NewGuy) char47NewGuy.classList.toggle('visible', showS47NewGuy);
  // Fixed left (see style.css) — now living inside #s45-s48-visual right next to
  // .char-s47-newguy, same pan+scale treatment as the box, so they move together as one
  // unit instead of the popup drifting independently on screen.
  if (panel47NewGuy) {
    panel47NewGuy.style.opacity = showS47NewGuy ? '1' : '0';
    panel47NewGuy.classList.toggle('visible', showS47NewGuy);
  }
  if (soundCaptionS47NewGuy) soundCaptionS47NewGuy.style.opacity = showS47NewGuy ? '1' : '0';

  // Tail of scene 47: right when Chris's popup actually hides (_s47PopupHiddenLocal, captured
  // above — runs on the popup's own position instead of a fixed local fraction, since the
  // popup's hide point now varies with when you scroll after its freeze), another matatu
  // crosses the screen right-to-left (opposite to the story's own left-to-right travel), seen
  // through a window frame, as a brief beat before scene 55 begins. Purely scroll-driven
  // (crossingT below). 0.3 remains only as a fallback for the edge case where the popup never
  // actually showed/hid (e.g. Huniki/BigTech consumed its whole window).
  const CROSSING_START = _s47PopupHiddenLocal !== null ? _s47PopupHiddenLocal : 0.3;
  const CROSSING_END   = CROSSING_START + S47_CROSSING_DURATION;
  const crossingT = (scene === 22)
    ? Math.min(1, Math.max(0, (local - CROSSING_START) / (CROSSING_END - CROSSING_START)))
    : 0;
  // Once the bus finishes crossing, freeze the scene background for a beat before scene 55
  // continues — same reference point as the wheelchair/Chris holds. A 2.5s hard block used to
  // fire right at this exact point, which let trackpad/mouse momentum queue up while blocked
  // and then burst through all at once the instant it released (the "stuck then jump" bug) —
  // that's now fixed at the source (frame()'s per-frame scrollY re-pin, not just blocking new
  // wheel events), so it's safe to bring the freeze back using that same mechanism. Same
  // "stays up until the next real scroll after release" pattern as Chris's popup, not a timer.
  // Direction of travel (raw scrollY, not local/effectiveTx — those can be pinned/blended
  // right now) — used below so entering the dead zone backward skips straight back to the
  // crossing's own end instead of crawling through the same huge empty budget in reverse.
  const _scrollingForwardS47 = _s47PrevScrollY === null || window.scrollY >= _s47PrevScrollY;
  _s47PrevScrollY = window.scrollY;
  if (scene === 22 && crossingT >= 1) {
    if (_scrollingForwardS47) {
      _s47CrossingBackSkipDone = false; // re-arm the backward skip for next time
      if (!_s47CrossingFreezeTriggered) {
        _s47CrossingFreezeTriggered = true;
        _scrollFreezeUntil = Date.now() + S47_CROSSING_FREEZE_MS;
        _s47CrossingFreezeEndsAt = _scrollFreezeUntil;
      }
    } else if (!_s47CrossingBackSkipDone && SCROLL_MAP[22]) {
      // Scrolling backward through the dead zone (from scene 55, or from within the dead zone
      // itself) — skip straight back to just before the crossing's own end instead of leaving
      // the same long unresponsive stretch to crawl through in reverse. Clears the freeze/hide
      // state too so the crossing sequence is immediately visible and interactive again right
      // where it's landed, not still marked "dismissed".
      _s47CrossingBackSkipDone = true;
      _s47CrossingFreezeTriggered = false;
      _s47CrossingFreezeEndsAt = null;
      _s47CrossingFreezeReleaseScrollY = null;
      const _crossEndLocal = (_s47PopupHiddenLocal !== null ? _s47PopupHiddenLocal : 0.3) + S47_CROSSING_DURATION;
      const _targetLocal = Math.max(0, _crossEndLocal - 0.02); // just inside the active window, not exactly on the boundary
      window.scrollTo(0, Math.round(SCROLL_MAP[22].scrollStart + _targetLocal * SCENE_SCROLL[22] * getVw()));
    }
  } else if (scene < 22 || (scene === 22 && crossingT < 1)) {
    // Only resets when genuinely back BEFORE the crossing sequence — NOT simply "scene !== 22",
    // which also matches scene 23+ (already past it, moving forward) and used to reset this
    // state on every frame spent there. That meant landing back in scene 22's dead zone via
    // backward scroll always found everything freshly re-armed: the freeze re-triggered from
    // scratch and the skip re-fired, yanking scroll straight back forward the instant you tried
    // to go backward. Now scene 23+ leaves this state untouched (already "done" stays done).
    _s47CrossingFreezeTriggered = false;
    _s47CrossingFreezeEndsAt = null;
    _s47CrossingFreezeReleaseScrollY = null;
    _s47CrossingSkipDone = false;
    _s47CrossingBackSkipDone = false;
  }
  // Bus/frame opacity fades smoothly as the bus finishes crossing — the last stretch of its
  // own crossingT progress (CROSSING_FADE_START_T to 1) maps straight to opacity 1 to 0. No
  // separate wait: it's gone by the time crossingT reaches 1, instead of standing there fully
  // visible through the whole freeze and only starting to fade once you scroll again after.
  const crossingOpacity = (scene === 22 && crossingT > 0)
    ? (crossingT < S47_CROSSING_FADE_START_T ? 1 : Math.max(0, 1 - (crossingT - S47_CROSSING_FADE_START_T) / (1 - S47_CROSSING_FADE_START_T)))
    : 0;
  // Freeze release tracking is now purely for the skip-jump below (advancing past the dead
  // zone once you scroll again after the freeze) — the bus/frame are already invisible by this
  // point regardless, opacity no longer depends on this.
  const _s47CrossingTimerDone = _s47CrossingFreezeEndsAt !== null && Date.now() >= _s47CrossingFreezeEndsAt;
  if (_s47CrossingTimerDone && _s47CrossingFreezeReleaseScrollY === null) {
    _s47CrossingFreezeReleaseScrollY = window.scrollY;
  }
  const _s47CrossingReadyToSkip = _s47CrossingFreezeReleaseScrollY !== null && window.scrollY !== _s47CrossingFreezeReleaseScrollY;
  // Once the freeze naturally ends and you scroll again, skip straight to scene 55's actual
  // start instead of leaving a long dead stretch of scene 47's own remaining scroll budget
  // where nothing visually changes — the reveal blend in frame()'s effectiveTx already parked
  // the background exactly on scene 55's start position by this point, so jumping scrollY here
  // is completely invisible.
  if (scene === 22 && _s47CrossingReadyToSkip && !_s47CrossingSkipDone && SCROLL_MAP[23]) {
    _s47CrossingSkipDone = true;
    window.scrollTo(0, SCROLL_MAP[23].scrollStart);
  }
  if (s47CrossingMatatu) {
    const vw = getVw();
    const startX = vw;          // fully off-screen right
    const endX   = -vw * 1.5;   // fully off-screen left — matches the bus's own 137.5vw width (2.5x scale)   // fully off-screen left — matches the bus's own 110vw width (2x scale)
    const x = startX + (endX - startX) * crossingT;
    s47CrossingMatatu.style.transform = `translateY(-50%) translateX(${x.toFixed(1)}px)`;
    s47CrossingMatatu.style.opacity = crossingOpacity.toFixed(3);
  }
  if (s47CrossingFrame) s47CrossingFrame.style.opacity = crossingOpacity.toFixed(3);
}

// ---- Layer reveals — all layers static, clear any previously set transforms ----
function animateLayerReveals(scene, local) {
  // Clear transforms on all layer images across every scene
  document.querySelectorAll('.layer img').forEach(img => {
    img.style.transform = '';
  });

  const building = document.querySelector('.scene-4 .layer-s4-building img');
  if (building) building.style.opacity = '1';

  const buildings5 = document.querySelector('.scene-5 .layer-city-buildings img');
  if (buildings5) buildings5.style.opacity = '1';

  const trees5 = document.querySelector('.scene-5 .layer-city-trees img');
  if (trees5) trees5.style.opacity = '1';

  // Ensure all city+ scene layers stay at opacity 1 (parallax may write opacity elsewhere)
  [
    '.scene-7', '.scene-8',
    '.scene-12', '.scene-13',
    '.scene-21', '.scene-22', '.scene-23',
    '.scene-26', '.scene-27', '.scene-28', '.scene-29', '.scene-30',
  ].forEach(sel => {
    document.querySelectorAll(`${sel} .layer img`).forEach(img => {
      img.style.opacity = '1';
    });
  });
}

// ---- City parallax: cursor-driven depth layers for all city scenes (5–8) ----
// Each element is assigned a different speed tier so they settle at different times,
// creating a natural staggered-depth feel instead of everything moving as one frame.
//   tier1 (px1) = slowest 0.03 — clouds
//   tier2 (px2) = medium  0.07 — buildings, bus
//   tier3 (px3) = fast    0.12 — trees, mid-depth people
//   tier4 (px4) = fastest 0.20 — closest foreground people
function applyCityParallax(scene, local, px1, py1, px2, py2, px3, py3, px4, py4) {
  function move(el, active, px, py, mx, my) {
    if (!el) return;
    el.style.transform = active
      ? `translateX(${(px * mx).toFixed(1)}px) translateY(${(py * my).toFixed(1)}px)`
      : '';
  }

  // Original city scenes (scenes 5–9, scroll indices 4–8)
  const inS5 = scene === 4;   // scene 5  — city arrival
  const inS6 = scene === 5;   // scene 6
  const inS7 = scene === 6;   // scene 7  — bus stop characters
  const inS8 = scene === 7;   // scene 8  — problem plaza
  const inS9 = false;  // scene-11 removed; scene-9 (display:none) has no parallax

  const inScene12 = scene === 8;
  const inScene13 = scene === 9;
  const inScene21 = scene === 10;

  // Clouds — tier 1 (slowest drift, feels very far)
  move(s5ParallaxEls.cloudImg,    inS5, px1, py1, 10,  5);
  move(s6ParallaxEls.cloudImg,    inS6, px1, py1, 10,  5);
  move(s7ParallaxEls.cloudImg,    inS7, px1, py1, 10,  5);
  move(s8ParallaxEls.cloudImg,    inS8, px1, py1, 10,  5);
  move(s9ParallaxEls.cloudImg,    inS9, px1, py1, 10,  5);

  // Buildings — tier 2 (medium, responds after the bus)
  move(s5ParallaxEls.buildingImg, inS5, px2, py2, 30, 12);
  move(s6ParallaxEls.buildingImg, inS6, px2, py2, 30, 12);
  move(s7ParallaxEls.buildingImg, inS7, px2, py2, 30, 12);
  move(s8ParallaxEls.buildingImg, inS8, px2, py2, 30, 12);
  move(s9ParallaxEls.buildingImg, inS9, px2, py2, 30, 12);

  // Scene 7 people — parallax removed per request (read as a jittery "shake" on mouse
  // move/hover, much more pronounced than anywhere else on the site since these used the
  // fast tiers (px3/px4) with unusually large multipliers). `false` disables each the same
  // way inS9 above permanently disables its own tier — clouds/buildings above are untouched.
  move(s7ParallaxEls.redGirl,   false, px3, py3, 40, 18);
  move(s7ParallaxEls.granny,    false, px2, py2, 30, 14);
  move(s7ParallaxEls.orangeMan, false, px1, py1, 20, 10);
  move(s7ParallaxEls.greenMan,  false, px4, py4, 50, 22);

  // Scene 8 people — parallax + fade-out + blur as bus zooms in
  // Fade starts at 20 % through scene 8, fully gone by 70 %.
  // People fade out in sync with the bus swap (local 0.15, same 0.03 duration — imperceptible)
  // so it looks like they've boarded the Matatu-with-people version
  const s8FadeT   = inS8 ? Math.min(1, Math.max(0, (local - 0.15) / 0.03)) : 0;
  const s8Opacity = inS8 ? (1 - s8FadeT) : 1;
  const s8Blur    = inS8 ? s8FadeT * 10 : 0;   // 0 → 10 px blur

  const s8Chars = [s8ParallaxEls.purpleMan, s8ParallaxEls.greenMan, s8ParallaxEls.blueGirl, s8ParallaxEls.limeMan];
  s8Chars.forEach(el => {
    if (!el) return;
    el.style.opacity = s8Opacity.toFixed(3);
    el.style.filter  = s8Blur > 0.05 ? `blur(${s8Blur.toFixed(1)}px)` : '';
  });

  // Same parallax removal as scene 7's people above, same reasoning.
  move(s8ParallaxEls.purpleMan, false, px4, py4, 45, 20);
  move(s8ParallaxEls.greenMan,  false, px3, py3, 40, 18);
  move(s8ParallaxEls.blueGirl,  false, px2, py2, 35, 16);
  move(s8ParallaxEls.limeMan,   false, px4, py4, 55, 25);

  // Scenes 12–13 — wide s12-s15 background; no per-layer parallax needed

  // Scene 21: vehicles are fixed on the 400vw road; the viewport pans across them via effectiveTx

}

// ---- Scene 8 character entrance: scroll-driven slide-up + fade, staggered per person ----
// Runs alongside the strip freeze so sceneLocal (0→1) drives the animation while the
// viewport stays locked. Parallax offsets are blended in on top.
function animateScene8Entry(active, local, px2, py2, px3, py3, px4, py4) {
  // [element, stagger-start (0–1), parallax px, py, mx, my]
  const chars = [
    [s8ParallaxEls.purpleMan, 0.00, px4, py4, 45, 20],
    [s8ParallaxEls.greenMan,  0.10, px3, py3, 40, 18],
    [s8ParallaxEls.blueGirl,  0.20, px2, py2, 35, 16],
    [s8ParallaxEls.limeMan,   0.30, px4, py4, 55, 25],
  ];

  chars.forEach(([el, delay, px, py, mx, my]) => {
    if (!el) return;
    if (!active) {
      el.style.transform = 'translateY(90px)'; // pre-position so entry starts with no jump
      return;
    }
    const t      = easeOutCubic(Math.min(1, Math.max(0, (local - delay) / 0.35)));
    const entryY = (1 - t) * 90;           // slides up 90 px as t goes 0→1
    const prlxX  = px * mx;
    const prlxY  = py * my;
    el.style.transform = `translateX(${prlxX.toFixed(1)}px) translateY(${(entryY + prlxY).toFixed(1)}px)`;
  });
}

// ---- Scene-32 sound icon (Samuel Rutunda): click plays the audio matching the active
// site language; clicking again while it's playing stops it; changing the language also
// stops it, since a src mid-playback would no longer match the newly selected language ----
// Three visual states (data-sound-state, crossfaded via CSS): "landing" (default, never
// clicked), "play" (currently playing), "pause" (currently paused/stopped) — so the icon
// always shows the user which state it's actually in.
const _s32Audios = []; // one Audio instance per sound icon (Samuel's, Asmelash's, ...)
document.querySelectorAll('.sound-icon-s32').forEach(icon => {
  const audio = new Audio();
  _s32Audios.push(audio);
  audio.addEventListener('ended', () => icon.dataset.soundState = 'pause');
  audio.addEventListener('error', () => {
    console.error('Sound icon: failed to load', audio.src, audio.error);
    icon.dataset.soundState = 'pause';
  });
  icon.addEventListener('click', () => {
    if (!audio.paused) {
      audio.pause();
      icon.dataset.soundState = 'pause';
      return;
    }
    const lang = window.i18nCurrentLang || 'en';
    const src  = icon.dataset[`audio${lang.charAt(0).toUpperCase()}${lang.slice(1)}`];
    if (!src) { console.error('Sound icon: no data-audio-* found for lang', lang); return; }
    audio.src = encodeURI(src);
    audio.currentTime = 0;
    audio.play()
      .then(() => icon.dataset.soundState = 'play')
      .catch(err => {
        console.error('Sound icon: play() rejected —', err.name, err.message, audio.src);
        icon.dataset.soundState = 'pause';
      });
  });
});

// ---- Spoken narration (Web Speech API) — always on. Every `.text-panel` across the whole
// site (scenes 1-44) is already shown/hidden via the same opacity + "visible" toggle pattern
// as it becomes relevant to the current scroll position (see the inline panel-visibility
// blocks in frame(), and animateCityBus/animateS26S30/animateS32S43/animateS44 below). Rather
// than hand-listing text per scene, narration just watches those same panels for their
// hidden→visible transition and speaks whichever one just appeared — so what's read out loud
// always matches what's actually on screen, in the same order and pacing as the visual story,
// no matter whether the user is scrolling with a mouse, the arrow/space keys, or a screen
// reader's own navigation.
//
// #pinned-wrap and every fixed scene overlay are permanently aria-hidden (see index.html) —
// a screen reader's own reading cursor auto-scrolls the page to wherever it lands next, which
// fights with this site's custom scroll/transform engine and has no concept of "scene". So
// #narration-live (role="status", aria-live="polite") is the only thing a screen reader
// actually reads: a live region this function writes to, which every major screen reader
// (Narrator, NVDA, JAWS, VoiceOver) announces automatically — in the user's own configured
// voice, rate and language — with no navigation or scrolling needed on their part. This is
// deliberately text-only, not also spoken via window.speechSynthesis: a screen reader user
// already has their AT reading it, so adding our own voice on top would mean two overlapping
// voices reading the same sentence at once. ----
const _narrationPanels = Array.from(document.querySelectorAll('.text-panel'));
const _narrationSeen = new WeakSet();
const narrationLive = document.getElementById('narration-live');

function _panelIsVisible(el) {
  return el.classList.contains('visible') || parseFloat(el.style.opacity || '0') >= 0.5;
}

// A fast scene-jump (see jumpScroll) can cross several popups' visibility windows within one
// smooth-scroll animation, each wanting to announce within milliseconds of each other — faster
// than a screen reader can speak them. Queue and drain one at a time instead of overwriting
// #narration-live's text before it's had a chance to be read.
let _liveQueue = [];
let _liveDraining = false;

function _queueLiveText(text) {
  _liveQueue.push(text);
  _drainLiveQueue();
}

function _drainLiveQueue() {
  if (_liveDraining || _liveQueue.length === 0 || !narrationLive) return;
  _liveDraining = true;
  const text = _liveQueue.shift();
  narrationLive.textContent = text;
  // Roughly proportional to length at a typical reading pace, so longer quotes get more time
  // before the next queued item overwrites this one.
  const readMs = Math.max(1200, Math.min(9000, text.length * 55));
  setTimeout(() => { _liveDraining = false; _drainLiveQueue(); }, readMs);
}

// ---- Auto-advance: once the current part finishes, automatically step forward to the next
// one — so a screen reader / keyboard user isn't pressing Next after every single panel. NOT
// started on page load (a sighted mouse user would never touch it, so it should never move on
// its own for them) — instead it only starts the first time the Previous/Next story button is
// pressed, since that's specifically the accessible control an AT/keyboard user interacts with.
// Pauses permanently the first time the user scrolls with their own wheel/touch/arrow input,
// read as them taking manual control. ----
let _autoAdvanceActive = false;
let _autoAdvanceTimer = null;

function startAutoAdvance() {
  if (_autoAdvanceActive) return;
  _autoAdvanceActive = true;
  scheduleAutoAdvance(600);
}

function scheduleAutoAdvance(delay) {
  if (!_autoAdvanceActive) return;
  clearTimeout(_autoAdvanceTimer);
  _autoAdvanceTimer = setTimeout(() => {
    if (!_autoAdvanceActive) return;
    const { currentScene, sceneLocal } = scrollToState(window.scrollY);
    if (currentScene >= SCENES - 1 && sceneLocal >= 1) return; // reached the very end
    stepScroll(1, true);
    // Some scenes have long gaps between narrated panels — keep checking shortly after each
    // step in case several steps are needed before the next thing to narrate becomes visible.
    scheduleAutoAdvance(900);
  }, delay);
}

function pauseAutoAdvance() {
  _autoAdvanceActive = false;
  clearTimeout(_autoAdvanceTimer);
}

// Live-announces one piece of text — shared by panel narration and the scene-beat
// descriptions above. #narration-live always updates (harmless with no screen reader present,
// and it's what Narrator/NVDA/JAWS/VoiceOver actually reads). Deliberately does NOT also
// speak via window.speechSynthesis (see the #narration-live comment above) — a screen reader
// user already has their AT reading this live region in their own configured voice; adding a
// second synthesized voice on top spoke every line twice. The auto-advance timing below still
// runs once _autoAdvanceActive is true (i.e. after the user has engaged the accessible
// Previous/Next controls), estimating how long the text takes to read so the story doesn't
// step forward before the current line has finished.
function narrate(text) {
  _queueLiveText(text);
  if (_autoAdvanceActive) {
    const readMs = Math.max(1200, Math.min(9000, text.length * 55));
    scheduleAutoAdvance(readMs + 400);
  }
}

function checkNarration() {
  _narrationPanels.forEach(el => {
    const visible = _panelIsVisible(el);
    if (visible && !_narrationSeen.has(el)) {
      _narrationSeen.add(el);
      const text = el.textContent.trim();
      if (text) narrate(text);
    } else if (!visible && _narrationSeen.has(el)) {
      // Scrolling back to a panel later re-narrates it — no permanent "already read" state.
      _narrationSeen.delete(el);
    }
  });
}

// Short descriptions of what's visually happening in a scene — vehicles on the road,
// characters boarding, a camera zoom, a transition — covering story beats a sighted user
// picks up from the visuals alone, whether or not a .text-panel is also playing nearby.
// Content lives in i18n/<lang>.json under "sceneBeats", never hardcoded here (same
// never-content-in-JS rule as panels/chars — see i18n.js). Keyed by the REAL, on-screen
// scene number (or a range, e.g. "8-11", when several real scenes play out as one
// continuous stretch with no separate SCENE_SCROLL entry of their own in between — see
// SCENE_LABELS above) — not the internal currentScene index, so the JSON reads the same
// way the ref-row-1/2/3 storyboard numbers the scenes, and a non-developer can find and
// edit the right line without knowing anything about the scroll engine.
// sceneBeatKeyFor() below derives that key from currentScene on every call; nothing here
// needs updating if scenes are ever renumbered or SCENE_SCROLL/SCENE_LABELS changes shape
// — except SCENE_BEAT_KEY_MERGE/SCENE47_BEAT_THRESHOLDS just below, see their own comments.
// "8" and 13-20 also fold in the #char-bubble stats (language + speaker counts) that the
// s8/s12 ambient characters show on click — that popup system isn't .text-panel, so
// checkNarration() never picks it up on its own; this is the only place that content reaches
// a screen reader. idx7 (real scene-8's slot) is the one place a single SCENE_SCROLL segment
// covers several real scenes that each get their OWN beat instead of being bundled into one
// range — see SCENE8_BEAT_THRESHOLDS and sceneBeatKeyFor's scene===7 special case just below;
// scenes 9 and 10 are Toto Moto's two separate speeches (popup8a/popup8b) and need to narrate
// as they actually appear, not lumped in with scene 8's arrival or scene 11's exit. t() falls
// back to English the same way it does for panels, so a scene with no configured beat simply
// narrates nothing extra.
// Full key list, matching the real-scene grouping requested (not a literal SCENE_LABELS
// span for every merged range — see SCENE_BEAT_KEY_MERGE's own comment):
// 1-3, 4, 5-6, 7, 8, 9, 10, 11, 12, 13-20, 21-25, 26-31, 32-33, 34-43, 44, 45-47, 48-51, 52,
// 53-55, 56, 57-58, 59-61, 62-63, 72, 73.
// ui.sceneIntroDesc (a static block read once before scrolling starts) is a preamble, not a
// substitute for this — it still fires as the user actually scrolls in.
let _lastExtraKey = null;

// currentScene indices 0/1/2 (real scenes 1/2/3, the opening jungle drive) share ONE
// sceneBeats entry ("1-3") by request — unlike every other range here, this one genuinely
// spans 3 separate SCENE_SCROLL segments, not real-scene-numbers bundled into a single
// segment. checkSceneExtras below dedupes by the computed KEY rather than the raw scene
// index specifically so scrolling 0→1→2 doesn't re-fire the same text three times.
// Indices 11-15 (real scenes 26-31, the 6 interviewees boarding one by one) merge the same
// way by request — narrated once as a single stretch instead of re-firing at every swap-in.
// idx4/5, idx16/17, idx20, idx21, idx23, idx25/26, idx27/28, idx29 all relabelled by request
// (matching the user's own real-scene grouping) — these are label choices, not claims that
// the merged span mathematically covers every number in the string (same as "26-31" above,
// which per SCENE_LABELS only reaches real scene 30, or idx16/17's "32-33", which spans two
// full SCENE_SCROLL segments rather than one). idx16/17 merging scene 33 into scene 32's own
// beat also preserves the original "33 is dense enough with its own dialogue, no separate
// beat needed" intent (see SCENE47_BEAT_THRESHOLDS's own note on scene 46) — the key just
// stops changing once you're inside scene 33, so nothing new narrates there.
const SCENE_BEAT_KEY_MERGE = {
  0: '1-3', 1: '1-3', 2: '1-3',
  4: '5-6', 5: '5-6',
  11: '26-31', 12: '26-31', 13: '26-31', 14: '26-31', 15: '26-31',
  16: '32-33', 17: '32-33',
  20: '45-47',
  21: '48-51',
  23: '53-55',
  25: '57-58', 26: '57-58',
  27: '59-61', 28: '59-61',
  29: '62-63',
};

// idx7 (real scene-8's slot) actually contains 4 distinct beats as the viewer scrolls
// through it — the plaza arrival/zoom, then the conductor's two separate speeches (popup8a
// then popup8b), then the exit toward Algorithm Avenue — not one continuous moment. These
// thresholds mirror the popup8a/popup8b show windows above (0.42-0.54 and 0.60-0.68) so the
// narration switches right as each one actually appears/finishes on screen.
const SCENE8_BEAT_THRESHOLDS = [[0.42, '9'], [0.60, '10'], [0.75, '11']]; // below first = '8'

// idx22 (real scene-47's slot, 20.5vw — wheelchair man ambient, Chris Emezue's popup, then
// the crossing-matatu sequence, then the tail leading into scene 55) also splits into 3
// beats by request. The first threshold (0.6) is an exact anchor — it's the same value
// showChris above uses to cut off Chris's popup for this scene (see "scene === 22 && local
// < 0.6"). The second (0.72) is an approximation: the actual crossing sequence starts at
// _s47PopupHiddenLocal (whenever the popup's own freeze-release actually happens — varies
// with real scroll timing, not a fixed fraction) and runs for S47_CROSSING_DURATION (0.1) —
// deliberately NOT reusing that exact mutable state here, to keep narration timing decoupled
// from the freeze/crossing animation logic itself (per request, no scene-animation changes).
// Revisit this fraction if the crossing narration ("52") fires noticeably early/late live.
const SCENE47_BEAT_THRESHOLDS = [[0, '48-51'], [0.6, '52'], [0.72, '53-55']];

// currentScene index -> the "sceneBeats" key that covers it, e.g. 12 -> "13-20" (idx12 is
// real scene-13's slot, and covers real scenes 13-20 since scenes 14-20 have no SCENE_SCROLL
// entry of their own — see SCENE_LABELS above). Single-scene stretches return just the
// number, e.g. "27".
function sceneBeatKeyFor(scene, sceneLocal) {
  if (scene === 7) {
    let key = '8';
    for (const [t, k] of SCENE8_BEAT_THRESHOLDS) { if (sceneLocal >= t) key = k; }
    return key;
  }
  if (scene === 22) {
    let key = '48-51';
    for (const [t, k] of SCENE47_BEAT_THRESHOLDS) { if (sceneLocal >= t) key = k; }
    return key;
  }
  if (SCENE_BEAT_KEY_MERGE[scene] !== undefined) return SCENE_BEAT_KEY_MERGE[scene];
  const lo = SCENE_LABELS[scene];
  if (lo == null) return null;
  const hi = (scene + 1 < SCENE_LABELS.length) ? SCENE_LABELS[scene + 1] - 1 : lo;
  return hi > lo ? `${lo}-${hi}` : String(lo);
}

function checkSceneExtras(scene, sceneLocal) {
  const key = sceneBeatKeyFor(scene, sceneLocal);
  if (key === _lastExtraKey) return;
  _lastExtraKey = key;
  const text = key ? t(`sceneBeats.${key}`) : null;
  if (text) narrate(text);
}

// ---- Dot click: jump to scene ----
dots.forEach(dot => {
  dot.addEventListener('click', () => {
    pauseAutoAdvance(); // manual scroll input — user is taking control themselves
    const scene   = parseInt(dot.dataset.scene);
    const targetY = SCROLL_MAP[scene] ? SCROLL_MAP[scene].scrollStart + 10 : 0;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  });
});

// ---- Touch: horizontal swipe → vertical scroll ----
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
  pauseAutoAdvance(); // manual scroll input — user is taking control themselves
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
  const dx = touchStartX - e.touches[0].clientX;
  const dy = touchStartY - e.touches[0].clientY;
  if (Math.abs(dx) > Math.abs(dy)) {
    window.scrollBy(0, dx * 1.5);
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
}, { passive: true });

// ---- Scroll navigation: shared by keyboard input and the Previous/Next story buttons ----
// jumpScroll: full scene skip (chapter-skip). stepScroll: incremental move, clamped to what's
// left in the CURRENT scene — a jump bigger than a scene's own scroll length (some, like
// scene-4, are intentionally very short) would skip straight over it, so nothing gated on
// sceneLocal inside that scene (trees reveal, popups) would ever get a frame to appear.
// behavior:'smooth' (only available via the options-object form of scrollTo, not scrollBy's
// two-argument form) makes the browser animate through every intermediate scrollY over several
// frames instead of teleporting to it in one paint.
function jumpScroll(dir) {
  const { currentScene } = scrollToState(window.scrollY);
  if (dir > 0 && currentScene < SCENES - 1) {
    const targetY = SCROLL_MAP[currentScene + 1] ? SCROLL_MAP[currentScene + 1].scrollStart + 10 : TOTAL_SCROLL;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  } else if (dir < 0 && currentScene > 0) {
    const targetY = SCROLL_MAP[currentScene - 1] ? SCROLL_MAP[currentScene - 1].scrollStart + 10 : 0;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
}

const STEP_LINE = 80;                          // px per small step
const STEP_PAGE = () => window.innerHeight * 0.9; // px per large (page) step

function stepScroll(dir, big) {
  const { currentScene } = scrollToState(window.scrollY);
  const seg  = SCROLL_MAP[currentScene];
  const want = big ? STEP_PAGE() : STEP_LINE;
  let targetY;
  if (dir > 0) {
    const remaining = seg ? seg.scrollEnd - window.scrollY : want;
    targetY = window.scrollY + Math.max(20, Math.min(want, remaining));
  } else {
    const remaining = seg ? window.scrollY - seg.scrollStart : want;
    targetY = window.scrollY - Math.max(20, Math.min(want, remaining));
  }
  window.scrollTo({ top: targetY, behavior: 'smooth' });
}

// ---- Keyboard: arrow navigation ----
// ArrowRight/ArrowLeft jump straight to the next/previous scene's start (chapter-skip).
// Down/PageDown/Space and Up/PageUp/Shift+Space instead step scrollY incrementally, like a
// normal page — this matters because most content (bus drive-in, popups, zoom sequences) is
// gated on gradual scroll *position within* a scene, not just which scene is active.
const JUMP_FORWARD_KEYS  = ['ArrowRight'];
const JUMP_BACKWARD_KEYS = ['ArrowLeft'];
const STEP_FORWARD_KEYS  = ['ArrowDown', 'PageDown', ' '];
const STEP_BACKWARD_KEYS = ['ArrowUp', 'PageUp'];

const SCROLL_KEY_SKIP_TAGS = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];

document.addEventListener('keydown', e => {
  // Let Space/Arrow keys do their normal job (activate/navigate) on focusable controls —
  // only treat them as scroll input when focus is elsewhere (e.g. the document body).
  if (SCROLL_KEY_SKIP_TAGS.includes(e.target.tagName)) return;

  const jumpForward  = JUMP_FORWARD_KEYS.includes(e.key);
  const jumpBackward = JUMP_BACKWARD_KEYS.includes(e.key);
  const stepBackward = STEP_BACKWARD_KEYS.includes(e.key) || (e.key === ' ' && e.shiftKey);
  const stepForward  = STEP_FORWARD_KEYS.includes(e.key) && !(e.key === ' ' && e.shiftKey);

  if (!jumpForward && !jumpBackward && !stepForward && !stepBackward) return;
  pauseAutoAdvance(); // manual scroll input — user is taking control themselves

  if (jumpForward)       { e.preventDefault(); jumpScroll(1); }
  else if (jumpBackward) { e.preventDefault(); jumpScroll(-1); }
  else {
    e.preventDefault();
    const big = e.key === ' ' || e.key === 'PageDown' || e.key === 'PageUp';
    stepScroll(stepForward ? 1 : -1, big);
  }
});

// ---- Story Previous/Next buttons — always-focusable, real controls (not aria-hidden) for
// screen reader users. The story area itself is aria-hidden (see #pinned-wrap in index.html)
// because a screen reader's own reading-cursor navigation auto-scrolls the page in ways that
// fight with this site's custom scroll engine — so its virtual cursor has nothing left to
// land on there, meaning it no longer generates the arrow-key input the handler above listens
// for. These buttons are an unambiguous Tab+Enter alternative that drives the exact same step,
// one page-sized step per press. Auto-advance starts the moment either button receives focus
// (Tab landing on it, Narrator announcing its label) — not only on click — since these are
// specifically the controls a screen reader / keyboard user interacts with, not something a
// sighted mouse user would ever touch, so there's no need to wait for an explicit activation.
const storyPrevBtn = document.getElementById('storyPrevBtn');
const storyNextBtn = document.getElementById('storyNextBtn');
if (storyPrevBtn) storyPrevBtn.addEventListener('click', () => { startAutoAdvance(); stepScroll(-1, true); });
if (storyNextBtn) storyNextBtn.addEventListener('click', () => { startAutoAdvance(); stepScroll(1, true); });

// focusin (bubbles, unlike focus) — more reliable across browsers/AT combinations for
// detecting "did focus land on this element", including however Narrator synchronizes its
// own reading cursor to a real focusable control.
document.addEventListener('focusin', e => {
  if (e.target === storyPrevBtn || e.target === storyNextBtn) startAutoAdvance();
});

// ---- Resize ----
window.addEventListener('resize', setup);

// ---- Character speech bubble ----
// Content is sourced from i18n/<lang>.json via tChar() (see i18n.js) so every
// popup is multilingual with automatic fallback to English.

const charBubble    = document.getElementById('char-bubble');
const bubbleStat    = charBubble.querySelector('.char-bubble-stat');
const bubbleLang    = charBubble.querySelector('.char-bubble-lang');
let activeCrossBtn  = null;
let _lastCharBubbleClass = null; // per-character class (char-bubble-<popup-id>), see click handler below
let _charBubbleHideTimer = null; // 3s auto-hide, see click handler below

function closeCharBubble() {
  charBubble.classList.remove('visible', 'dialogue', 'pop-left');
  activeCrossBtn = null;
  if (_charBubbleHideTimer) { clearTimeout(_charBubbleHideTimer); _charBubbleHideTimer = null; }
}

document.querySelectorAll('.cross-btn, .plus-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();

    if (activeCrossBtn === btn) {
      closeCharBubble();
      return;
    }

    const data = tChar(btn.dataset.popup);
    if (!data) return;

    if (data.dialogue) {
      bubbleStat.textContent = '';
      bubbleLang.textContent = data.dialogue;
      charBubble.classList.add('dialogue');
    } else {
      bubbleStat.textContent = data.stat;
      bubbleLang.textContent = data.lang;
      charBubble.classList.remove('dialogue');
    }

    charBubble.classList.add('visible');
    activeCrossBtn = btn;
    charBubble.dataset.char = btn.dataset.popup;
    // Every character gets its own class (char-bubble-<popup-id>), not just s8-, so each
    // one can have its own style overrides in CSS instead of sharing --bx/--by generically.
    if (_lastCharBubbleClass) charBubble.classList.remove(_lastCharBubbleClass);
    _lastCharBubbleClass = 'char-bubble-' + btn.dataset.popup;
    charBubble.classList.add(_lastCharBubbleClass);
    positionCharBubble(btn);
    // Auto-hide 3s after opening, regardless of further interaction.
    if (_charBubbleHideTimer) clearTimeout(_charBubbleHideTimer);
    _charBubbleHideTimer = setTimeout(closeCharBubble, 5000);
  });
});

// Per-character fine-tune (px), added on top of the live-tracked position below — edit here
// instead of pinning left/top with !important in CSS, which breaks scroll-tracking.
const CHAR_BUBBLE_NUDGE = {
  's7-red-girl': { x: 350, y: 0 },
  's7-granny':   { x: 380, y: 0 },
  's7-green-men':   { x: 380, y: 0 },
};
function positionCharBubble(btn) {
  const rect = btn.getBoundingClientRect();
  const dir  = btn.dataset.dir || 'right';
  const bw = charBubble.offsetWidth;
  const n = CHAR_BUBBLE_NUDGE[btn.dataset.popup] || { x: 0, y: 0 };
  if (dir === 'right') {
    charBubble.classList.add('pop-left');
    charBubble.style.left = (rect.left - bw - 12 + n.x) + 'px';
  } else {
    charBubble.classList.remove('pop-left');
    charBubble.style.left = (rect.right + 12 + n.x) + 'px';
  }
  const minLeft = 12;
  const maxLeft = window.innerWidth - bw - 12;
  const clampedLeft = Math.min(Math.max(parseFloat(charBubble.style.left), minLeft), maxLeft);
  // If clamping has pushed the bubble within 5% of the window's left/right edge, it doesn't
  // fit its normal spot here — hide it immediately instead of showing it squished against
  // the edge (also covers scroll/resize moving the character toward the edge while open).
  const edge = window.innerWidth * 0.05;
  if (clampedLeft <= edge || clampedLeft + bw >= window.innerWidth - edge) {
    closeCharBubble();
    return;
  }
  charBubble.style.left = clampedLeft + 'px';
  const bh = charBubble.offsetHeight;
  charBubble.style.top = (rect.top + rect.height / 2 - bh / 2 + 26 + n.y) + 'px';
}

document.addEventListener('click', () => {
  closeCharBubble();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCharBubble();
  }
});

// Re-render an already-open bubble's text when the language changes
document.addEventListener('i18n:rendered', () => {
  _s32Audios.forEach(audio => audio.pause());
  document.querySelectorAll('.sound-icon-s32[data-sound-state="play"]').forEach(icon => icon.dataset.soundState = 'pause');
  if (!activeCrossBtn) return;
  const data = tChar(activeCrossBtn.dataset.popup);
  if (!data) return;
  if (data.dialogue) {
    bubbleStat.textContent = '';
    bubbleLang.textContent = data.dialogue;
  } else {
    bubbleStat.textContent = data.stat;
    bubbleLang.textContent = data.lang;
  }
});

// ---- Pause toggle (press P or Space to freeze rAF for DevTools inspection) ----
let _paused = false;
document.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P') {
    _paused = !_paused;
    console.log(_paused ? '⏸ rAF paused — DevTools edits will hold' : '▶ rAF resumed');
  }
});

function frameLoop(ts) {
  // Wrapped in try/catch so one bad frame can't permanently kill the whole animation loop —
  // requestAnimationFrame(frameLoop) below only runs if the whole function returns normally,
  // so an uncaught error anywhere in frame() would otherwise stop every scene update (scroll
  // freezes, popups, everything) for good, with no recovery short of a page reload.
  try {
    if (!_paused) {
      frame(ts);
      // Re-track the open popup's position every frame so it stays anchored to its
      // character's marker while scrolling continues (the marker itself keeps moving —
      // see #city-overlay-7's per-frame scroll sync — so the popup must follow it too).
      if (activeCrossBtn) positionCharBubble(activeCrossBtn);
    }
  } catch (err) {
    console.error('frameLoop error (recovered, loop continues):', err);
  }
  requestAnimationFrame(frameLoop);
}

// ---- Init ----
// Let the browser restore scroll position on refresh
if ('scrollRestoration' in history) history.scrollRestoration = 'auto';

setup();
requestAnimationFrame(frameLoop);
