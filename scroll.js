/* ============================================
   PREVAILER MATATU JOURNEY — scroll.js
   Continuous rAF engine: scroll-driven + time-based motion
   ============================================ */

const SCENES = 32; // ends at scene-73 (CREDITS) — see SCENE_LABELS for real (non-contiguous) numbers
// Per-scene scroll multipliers — how many viewport-widths of scroll each scene consumes.
// Lower = faster transition. Scene 4 (savanna) is intentionally quick.
const SCENE_SCROLL = [
  1.8,  // 0  → scene-1  (jungle intro — extra scroll room for the bus-parks-in entrance)
  1.2,  // 1  → scene-2  (jungle story)
  1.2,  // 2  → scene-3  (jungle detail)
  0.4,  // 3  → scene-4  (savanna — intentionally fast)
  1.2,  // 4  → scene-5  (city arrival)
  1.2,  // 5  → scene-6  (city continued)
  1.5,  // 6  → scene-7  (bus stop characters)
  14.0, // 7  → scene-8  (problem plaza + zoom sequence)
  1.5,  // 8  → scene-12 (wide city s12-s15, part A)
  11.0, // 9  → scene-13 (wide city — zoom + popups)
  4.0,  // 10 → scene-21 (top-down road — 3 vehicles in 3 lanes)
  2.0,  // 11 → scene-26 (street arrival — ambient characters)
  1.3,  // 12 → scene-27 (Asmelash Teka Hadgu & Away Ly swap in together)
  1.3,  // 13 → scene-28 (Chris Emezue & Kathleen Siminyu swap in together)
  1.3,  // 14 → scene-29 (Sadik Shahadu & Samuel Rutunda swap in together)
  3.5,  // 15 → scene-30 (zoom + Awa Ly's message)
  5.0,  // 16 → scene-32 (inside the matatu — extra dummy scroll runway)
  16.0,  // 17 → scene-33 (5 popups + 4 characters packed into a small scene)
  1.5,  // 18 → scene-34
  6,  // 19 → scene-44 (slides down from the top over scene-34 — see animateS44)
  6.0,  // 20 → scene-45 (inside the matatu, continued — Kathleen/toto moto/red lady/wheelchair man)
  5.0,  // 21 → scene-46 (wheelchair man: approach pan -> zoom-in -> popups -> release)
  20.5,  // 22 → scene-47 (wheelchair man ambient)
  5.4,  // 23 → scene-55 (street scene — matatu parked outside Municipal Federation building)
  0.01,  // 24 → scene-56 (second popup)
  0.4,  // 25 → scene-57 (third, bigger popup)
  0.3,  // 26 → scene-58 (pans past the street into clear sky)
  2.5,  // 27 → scene-59 (park/lake — bridge, trees, bus driving through; first popup)
  2.3,  // 28 → scene-60 (second popup — kids playing catch on the path)
  0.3,  // 29 → scene-63 (closing message)
  0.4,  // 30 → scene-72 (RESOURCES screen)
  0.4,  // 31 → scene-73 (CREDITS screen — story ends here)
];

// Real, on-screen scene numbers (Figma numbering) — shared by the debug readout and
// checkSceneExtras's key lookup below, so both stay in sync with SCENE_SCROLL's comments.
const SCENE_LABELS = [1,2,3,4,5,6,7,8,12,13,21,26,27,28,29,30,32,33,34,44,45,46,47,55,56,57,58,59,60,63,72,73];

// ---- Per-scene configuration ----
// Tune each scene independently here.
const SCENE_CONFIG = {
  // Jungle bus keyframes — one continuous journey across scenes 1–3.
  // `scene`/`at` (0-100% through that scene) / `x` (bus left-edge, vw). Interpolates between stops.
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

// Scene 45's own local range for the scene-44 exit zoom fade (see animateS44's exitT).
const S45_EXIT_RANGE = 0.3;
// How long scene 45 stays fully still before normal scrolling resumes (covers Kathleen's appearance).
const S45_STICKY_RANGE = 1.0;
// Scene 46's pan eases toward centering the wheelchair man by S46_HOLD_START, holds through
// S46_HOLD_END while he zooms in and his popup shows, then eases back (see frame()'s effectiveTx).
const S46_HOLD_START = 0.05;
const S46_HOLD_END = 0.65;
// Bus drive-in settle point at scene 59's start (see animateCityBus's scene===27 branch).
const S5960_ZOOM_START_PHASE = 0.2;
// Wheelchair man's zoom-in, scroll-driven across sceneLocal S46_HOLD_START -> S46_ZOOM_END_LOCAL
// (kept small so the release doesn't bank up a visible scroll-catchup jump).
const S46_ZOOM_END_LOCAL = 0.08;
const S46_ZOOM_MS = 900; // popups' own wall-clock queue timing only
// Huniki popup shows first, then Big Tech, both scroll-driven off sceneLocal.
const S46_HUNIKI_LOCAL_END = 0.23;
const S46_BIGTECH_LOCAL_END = 0.38;
// #s45-s48-bg's own left/width from style.css — single source (was duplicated in 2-3 places).
const S45S48_BG_LEFT_VW = 2250; // must match #s45-s48-bg's `left` in style.css
const S45S48_BG_WIDTH_VW = 520; // must match #s45-s48-bg's `width` in style.css
const S46_CHAR_CENTER_VW = 250.5; // .char-s45-wheelchair center, within #s45-s48-bg

// Scenes 26-30: strip freezes at this vw offset past #s26-s30-bg's stripX once the bus parks
// (see S2630_FREEZE_TRIGGER below), holding all interviewees on screen through scene 29. Was
// 0.77 (matched the natural pan exactly at the trigger point, for a seamless snap-to-freeze);
// now shifted further right, so S2630_FREEZE_EASE_START/TRIGGER below ease into it instead of
// snapping, or moving this value creates a visible jump right at the freeze-engage point.
const S2630_FREEZE_VW = 1.10;
const S2630_FREEZE_EASE_START = 0.50; // sceneLocal (scene 26) where the ease-in begins
const S2630_FREEZE_TRIGGER = 0.77;    // sceneLocal (scene 26) where it's fully frozen — unchanged

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
  // Force full-bleed cropping (cover, not contain) — lottie-player has no attribute for
  // this, so the shadow-DOM svg's own preserveAspectRatio has to be patched.
  const forceSlice = () => {
    const svg = s8BusTransitionPlayer.shadowRoot && s8BusTransitionPlayer.shadowRoot.querySelector('svg');
    if (!svg) return;
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const ZOOM_OUT = 1.12; // widen the viewBox around the same center so more of the composition shows
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
const panelPurpleMan = document.getElementById('panel-purple-man'); // second popup, tied to purple-man's position (.s5973-purple-man), not a scene boundary
const panelLanguageJustice = document.getElementById('panel-language-justice'); // third popup
const s5973BgArt = document.getElementById('s5973-bg-art');
const s5973Bg = document.getElementById('s59-s73-bg');
// Scenes 62-63 — root-level fixed full-viewport overlay (not part of the #scroll-x pan strip),
// switched screen-by-screen instead of panned (see the _s6263* state below).
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
// Chris Emezue + the last red-topped woman are baked into Seats%20extended.svg's own art
// (not a separate sprite) — see panel-47-newguy's showChris window below.
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

// Scene 59-61 final pull-back: wall-clock auto-play either direction, like a video — crossing
// S61_POSTZOOM_TRIGGER_LOCAL forward triggers zoom-out, crossing back below
// S61_POSTZOOM_REVERSE_TRIGGER_LOCAL triggers the mirror zoom-in; scroll is fully blocked until
// it finishes (see _scrollFreezeUntil). Separate hysteresis thresholds stop a small scroll
// wobble from re-triggering either direction.
let _s61PostZoomT0 = null;         // wall-clock timestamp the FORWARD (zoom-out) sequence started
let _s61PostZoomFrozenTx = null;   // pan held stable for the whole forward sequence
let _s61PostZoomReverseT0 = null;      // wall-clock timestamp the REVERSE (zoom-in) sequence started
let _s61PostZoomReverseFrozenTx = null; // pan held stable for the whole reverse sequence

const S61_POSTZOOM_TRIGGER_LOCAL = 1.2; // combinedLocal5973 point where panel-61 has closed — must match show61's own close bound above
const S61_POSTZOOM_TOTAL_MS = 2000; // duration of the pull-back's auto-play, either direction
// Reverse trigger point — deliberately lower than S61_POSTZOOM_TRIGGER_LOCAL (hysteresis gap).
const S61_POSTZOOM_REVERSE_TRIGGER_LOCAL = 0.9;

// Zoom cycle spanning the Asmelash + pregnant-woman sequence: zooms in after the 4th popup
// (Lesan), zooms back out at S33_ZOOM_HOLD — see asmelashZoomInT/pregnantZoomT in animateS32S43.
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

let _panel26_1Shown = false; // scroll-freeze-on-open tracker, scene-26 popups
let _panel26_2Shown = false;
let _s2630BusDampedX = null; // damped bus X for scenes 26-30, see animateCityBus
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

// Scenes 62-64 — discrete screen-by-screen slide switching (see 'wheel' listener/frame()).
// Once _s6263Active is true, wheel input drives _s6263Index directly with a crossfade between
// slides, counted in distinct scroll gestures ("ticks", 150ms-apart bursts) not raw deltaY.
const S6263_SLIDE_COUNT = 3; // 0 = Resources (62), 1 = Credits (63), 2 = Contact (64)
let _s6263Active     = false; // true once we've entered the locked slide-switch zone
let _s6263Index      = 0;     // which slide is showing/target of the current crossfade
let _s6263FromIndex  = 0;     // which slide we're crossfading AWAY from (only meaningful while _s6263TransT0 !== null)
let _s6263TransT0    = null;  // wall-clock start of the current crossfade; null = settled
let _s6263Ticks      = 0;     // distinct scroll gestures counted so far in _s6263TickDir
let _s6263TickDir    = 0;     // direction (+1/-1) the current tick count applies to
let _s6263BurstActive = false;
let _s6263BurstTimer  = null;
const S6263_TICKS_REQUIRED = 2; // gestures needed before a step actually triggers
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

// Scene-32 timing anchors — reference points the popup/character fade timing is built around.
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

// CSS `vw` resolves against clientWidth (excludes scrollbar width), unlike window.innerWidth —
// using the wrong one compounds into a visible background seam by later scenes.
function getVw() {
  return document.documentElement.clientWidth || window.innerWidth;
}

// ---- Setup: scroll length ----
// SCROLL_MAP rescales on resize but window.scrollY doesn't, so capture the logical position
// (scene + local%) before rebuilding and re-apply it after, or a resize jerks the story backward.
function setup() {
  const prev = SCROLL_MAP.length ? scrollToState(window.scrollY) : null;
  buildScrollMap();
  spacer.style.height = (TOTAL_SCROLL + window.innerHeight) + 'px';
  document.body.style.height = (TOTAL_SCROLL + window.innerHeight) + 'px';
  if (prev) {
    const seg = SCROLL_MAP[prev.currentScene];
    if (seg) window.scrollTo(0, seg.scrollStart + prev.sceneLocal * (seg.scrollEnd - seg.scrollStart));
  }
  // *FrozenTx values are captured once in absolute pixels and don't rescale on resize like
  // SCROLL_MAP does — clear them here to force a fresh capture at the new scale.
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
    // Scene 21 (i=10): real DOM start is 1165vw (1000vw base + margin-left:165vw) — the extra
    // 165vw fudge below accounts for that offset; i>10 keeps everything after in sync.
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

// ---- Scrollable popups' own internal scroll (overflow-y:auto text wrappers) — must be
// registered BEFORE the main wheel listener and use stopImmediatePropagation, or the page's
// story-scroll listener also fires and hijacks the gesture. ----
const SCROLLABLE_POPUPS = [panel32Sadik, panel32Asmelash2, panel26_3, panel45RedLady];
window.addEventListener('wheel', e => {
  for (const panel of SCROLLABLE_POPUPS) {
    if (!panel || panel.style.opacity !== '1') continue;
    const wrapper = panel.querySelector('[data-i18n-panel-text]');
    if (!wrapper || wrapper.scrollHeight <= wrapper.clientHeight + 1) continue;
    if (!wrapper.contains(e.target)) continue; // only take over when the cursor is over this popup's own text
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

// ---- Popup scroll-freeze: swallow wheel input for a grace period after a popup opens
// (see _scrollFreezeUntil). Native wheel scroll only — dot nav and touch-drag are untouched. ----
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
    // If the active slide's content is taller than the viewport, let the wheel scroll it
    // first — only once at the scroll edge does this fall through to tick-counting below.
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
          // Already on first slide, scrolling back further — release the lock and land near
          // scene 61's start (not its end) so residual scroll momentum can't instantly re-trigger it.
          _s6263Active = false;
          window.scrollTo(0, SCROLL_MAP[29].scrollStart + 10);
        }
      }
    }
    clearTimeout(_s6263BurstTimer);
    _s6263BurstTimer = setTimeout(() => { _s6263BurstActive = false; }, 150);
    return;
  }

  // _s32LesanDismissed stays declared/reset in animateS32S43 but is closed by position now (LESAN_END_LOCAL), not gesture count.

  // 5th popup (Asmelash) dismisses itself after 3 wheel scrolls (burst-debounced, 150ms apart)
  // once open — doesn't freeze/preventDefault, the scene keeps panning underneath.
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

// ---- Nav bar button — dual purpose (see frame()'s label-update block): "RESOURCES" jumps
// forward to the Resources slide; "RESET" (last slide only) jumps to the very start. Both must
// clear any active popup scroll-freeze or frame()'s hard-pin guard snaps scrollY right back. ----
const restartBtn = document.getElementById('restartBtn');
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    _scrollFreezeUntil = 0;
    _frozenScrollY = null;
    const onLastSlide = _s6263Active && _s6263Index === S6263_SLIDE_COUNT - 1;
    if (onLastSlide) {
      // "RESET" — release the wheel-lock directly rather than waiting for frame() to notice.
      _s6263Active = false;
      _s6263TransT0 = null;
      window.scrollTo(0, 0);
    } else if (SCROLL_MAP[30]) {
      // "RESOURCES" — frame()'s engage logic picks this up next frame and re-locks at index 0.
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

  // Hard-pin scrollY while any freeze is active — preventDefault() alone can't stop a
  // trackpad flick's own momentum, which keeps moving scrollY with no further 'wheel' events.
  if (Date.now() < _scrollFreezeUntil) {
    if (_frozenScrollY === null) _frozenScrollY = window.scrollY;
    else if (window.scrollY !== _frozenScrollY) window.scrollTo(0, _frozenScrollY);
  } else {
    _frozenScrollY = null;
  }

  const scrollY = window.scrollY;
  const { tx, currentScene, sceneLocal, scrollPct } = scrollToState(scrollY);
  // Gates the scene 59->61 trigger to real forward scrolling only. Must persist the last ACTUAL
  // direction across idle frames (not recompute scrollY > prev every frame) — recomputing broke
  // both ways: caused the double-zoom-on-scroll-back bug, and separately missed the scene-60
  // zoom-extras trigger. See git history if this needs revisiting.
  if (scrollY !== _prevScrollYForS5960) {
    _scrollingForwardState = scrollY > _prevScrollYForS5960;
    _prevScrollYForS5960 = scrollY;
  }
  const _scrollingForward = _scrollingForwardState;

  // Scenes 62-63 — engage the discrete slide lock the first time scroll reaches this zone;
  // once active, the 'wheel' listener/_s6263Index drive which slide shows, not native scroll.
  if (!_s6263Active && (currentScene === 30 || currentScene === 31)) {
    _s6263Active = true;
    _s6263Index = currentScene === 31 ? 1 : 0;
    _s6263Ticks = 0;
    _s6263TickDir = 0;
    _s6263BurstActive = false;
    _s6263TransT0 = null;
  } else if (_s6263Active && currentScene !== 30 && currentScene !== 31) {
    // scrollY moved elsewhere (dot-nav, keyboard, programmatic jump) — release the lock.
    _s6263Active = false;
    _s6263TransT0 = null;
  }

  // Nav bar button: "RESOURCES" normally, "RESET" once on the last slide (see restartBtn below).
  if (restartBtn) {
    const onLastSlide = _s6263Active && _s6263Index === S6263_SLIDE_COUNT - 1;
    // t() can return undefined briefly before i18n.js's fetch resolves — keep the HTML fallback.
    const label = t(onLastSlide ? 'ui.restart' : 'ui.resources');
    if (label != null) restartBtn.textContent = label;
  }

  // Scenes 62-64 — continuous "position" across all slides (0=Resources, 1=Credits, 2=Contact),
  // including any in-progress crossfade. Reused below for the zoom-reversal and slide-opacity.
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
      // Bus slides up (0.92-1.0) while s21Preview covers the view — snap to scene-21's start.
      effectiveTx = -(SCROLL_MAP[10].stripX);
    } else {
      effectiveTx = s9Freeze;
    }
  } else if (currentScene === 10 && SCROLL_MAP[10]) {
    // Scene 21 needs exactly (300vw - 100vw) = 2vw of pan across sceneLocal 0-1 to reveal
    // edge-to-edge with no overshoot — 3vw overshoots into scene-26's empty marker div.
    effectiveTx = -(SCROLL_MAP[10].stripX + sceneLocal * 2 * _vw);
  } else if (SCROLL_MAP[11] && currentScene === 11 && sceneLocal >= S2630_FREEZE_EASE_START && sceneLocal < S2630_FREEZE_TRIGGER) {
    // Eases from the natural continuous pan into the frozen target below — S2630_FREEZE_VW no
    // longer matches the natural tx at the trigger point, so this bridges the gap smoothly
    // instead of snapping (see S2630_FREEZE_VW's own comment for why).
    const naturalTx = -(SCROLL_MAP[11].stripX + sceneLocal * _vw);
    const frozenTx  = -(SCROLL_MAP[11].stripX + S2630_FREEZE_VW * _vw);
    const easeT = easeInOutCubic((sceneLocal - S2630_FREEZE_EASE_START) / (S2630_FREEZE_TRIGGER - S2630_FREEZE_EASE_START));
    effectiveTx = naturalTx + easeT * (frozenTx - naturalTx);
  } else if (SCROLL_MAP[11] && (
    (currentScene === 11 && sceneLocal >= S2630_FREEZE_TRIGGER) ||
    (currentScene >= 12 && currentScene <= 13) ||
    (currentScene === 14 && sceneLocal < 0.85)
  )) {
    // Scene 26 (after bus parks) through scene 29: strip frozen so all interviewees
    // stay on screen while they swap in, two at a time per scene
    effectiveTx = -(SCROLL_MAP[11].stripX + S2630_FREEZE_VW * _vw);
  } else if (SCROLL_MAP[11] && currentScene === 14 && sceneLocal >= 0.85) {
    effectiveTx = -(SCROLL_MAP[11].stripX + S2630_FREEZE_VW * _vw);
  } else if (SCROLL_MAP[11] && currentScene === 15 && sceneLocal < 0.18) {
    // Scene 30's first stretch: the bus keeps genuinely driving forward (real strip pan,
    // not just a timing delay) before the 2 new popups open and the zoom takes over — eases
    // from wherever scene 29 left off to a bit further down the road.
    const s29Freeze  = -(SCROLL_MAP[11].stripX + S2630_FREEZE_VW * _vw);
    const s30DriveEnd = s29Freeze - 0.5 * _vw;
    const dT = easeInOutCubic(Math.min(1, sceneLocal / 0.18));
    effectiveTx = s29Freeze + dT * (s30DriveEnd - s29Freeze);
  } else if (SCROLL_MAP[11] && currentScene === 15) {
    // Frozen through the rest of scene 30 — any strip movement gets amplified by the
    // pinnedWrap zoom (4x-8x). Jumps to scene-32's position once it begins, but by then
    // #city-bus/Awa Ly are already faded out, so nothing visible jumps.
    effectiveTx = -(SCROLL_MAP[11].stripX + S2630_FREEZE_VW * _vw) - 0.5 * _vw;
  } else if (currentScene === 16 && sceneLocal >= S32_ZOOM_HOLD) {
    // Auto-playing zoom-out + Samuel reveal (wall-clock, see samuelT/s32Scale in animateS32S43).
    // Pan stays frozen for the same duration so it reads as a fixed-point animation.
    if (_s32ZoomOutT0 === null) {
      _s32ZoomOutT0 = ts;
      // Swallow wheel input for the whole freeze, not just a grace period, or the strip jerks/snaps on release.
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
    // Same auto-play zoom-out mechanic as scene 32, for the pregnant-woman reveal (animateS32S43).
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
    // Scene 44 slides down vertically over scene-34 (animateS44) — freeze the strip so the
    // background underneath doesn't keep shifting while the new scene covers it.
    if (_s44FrozenTx === null) { _s44FrozenTx = tx; }
    effectiveTx = _s44FrozenTx;
  } else if (currentScene === 20 && sceneLocal < S45_STICKY_RANGE && SCROLL_MAP[20]) {
    // Scene 45 pans at 0.2x speed (not frozen) during the character sequence. Deliberately
    // stateless (pure function of sceneLocal/stripX, no captured start point) so it's exactly
    // reversible regardless of scroll direction.
    const S45_PAN_SPEED = 0.2;
    const slowTx = -(SCROLL_MAP[20].stripX + sceneLocal * S45_PAN_SPEED * _vw);
    // Bridges the slow pan back up to the real tx by S45_STICKY_RANGE, or scene 46 would start
    // ~80% of a viewport-width ahead of where the slow pan left off.
    const S45_RELEASE_START = 0.402;
    if (sceneLocal >= S45_RELEASE_START) {
      const bridgeT = easeInOutCubic((sceneLocal - S45_RELEASE_START) / (S45_STICKY_RANGE - S45_RELEASE_START));
      effectiveTx = slowTx + bridgeT * (tx - slowTx);
    } else {
      effectiveTx = slowTx;
    }
  } else if (currentScene === 21) {
    // Eases the pan to center the wheelchair man (.char-s45-wheelchair, 250.5vw within
    // #s45-s48-bg), holds him there through his zoom-in/popup (animateS45S48), then eases back.
    // Stateless/pure function of sceneLocal, so it's exactly symmetric scrolling either direction.
    const targetStripXvw = S45S48_BG_LEFT_VW + S46_CHAR_CENTER_VW - 50;
    const entryTx = -SCROLL_MAP[21].stripX; // natural tx at local=0, matches scene 45's release-bridge
    // Math.min clamps so the approach never pans backward — his target sits ~8.5vw behind
    // scene 46's natural start, so unclamped interpolation blipped backward before continuing.
    const targetTx = Math.min(-(targetStripXvw * _vw / 100), entryTx);
    if (sceneLocal < S46_HOLD_START) {
      const approachT = easeInOutCubic(sceneLocal / S46_HOLD_START);
      effectiveTx = entryTx + approachT * (targetTx - entryTx);
      _s46HoldReleased = false; // reset so re-entering the hold zone replays it
      _s46ReleaseStartLocal = null;
    } else if (!_s46HoldReleased) {
      // Releases the INSTANT the scroll-driven zoom-in (wheelchairZoomT, animateS45S48) finishes
      // — waiting longer let tx drift ahead of the frozen targetTx, causing a release jump.
      if (_s46ZoomT0 === null) { _s46ZoomT0 = ts; }
      if (sceneLocal >= S46_ZOOM_END_LOCAL) {
        _s46HoldReleased = true;
      }
      effectiveTx = targetTx;
    } else {
      // Linear (not eased) release — an eased S-curve peaks ~4x the steady pan speed, which
      // reads as a jump through this scene's permanent 1.5x zoom.
      if (_s46ReleaseStartLocal === null) _s46ReleaseStartLocal = sceneLocal;
      const releaseT = Math.min(1, Math.max(0, (sceneLocal - _s46ReleaseStartLocal) / (1 - _s46ReleaseStartLocal)));
      effectiveTx = targetTx + releaseT * (tx - targetTx);
    }
  } else if (currentScene === 22 && SCROLL_MAP[23]) {
    // Tail of scene 47 — once the crossing-matatu sequence (animateS45S48) is
    // S47_REVEAL_START_T through, blend the pan toward scene 55's start (hidden behind the
    // frame+bus overlay) so there's no hard cut once currentScene reaches 23. Mirrors
    // animateS45S48's own crossingT calc (duplicated since effectiveTx is set earlier in the frame).
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
    // Mid FORWARD wall-clock sequence — checked by state, not currentScene, since wheel input
    // is blocked for the whole duration anyway (_scrollFreezeUntil).
    if (_s61PostZoomFrozenTx === null) { _s61PostZoomFrozenTx = tx; }
    effectiveTx = _s61PostZoomFrozenTx;
  } else if (_s61PostZoomReverseT0 !== null && ts - _s61PostZoomReverseT0 < S61_POSTZOOM_TOTAL_MS) {
    // Mid REVERSE wall-clock sequence — same freeze-pan technique, mirror-image zoom-in.
    if (_s61PostZoomReverseFrozenTx === null) { _s61PostZoomReverseFrozenTx = tx; }
    effectiveTx = _s61PostZoomReverseFrozenTx;
  } else if (currentScene >= 27 && currentScene <= 29 && ((currentScene - 27) + sceneLocal) >= S61_POSTZOOM_TRIGGER_LOCAL && _scrollingForward && _s61PostZoomT0 === null && _s61PostZoomReverseT0 === null) {
    // FORWARD trigger — only while actually scrolling forward, and not mid-reverse.
    _s61PostZoomT0 = ts;
    _s61PostZoomReverseT0 = null; // mutually exclusive with the reverse sequence
    _scrollFreezeUntil = Date.now() + S61_POSTZOOM_TOTAL_MS;
    _s61PostZoomFrozenTx = tx;
    effectiveTx = _s61PostZoomFrozenTx;
  } else if (currentScene >= 27 && currentScene <= 29 && ((currentScene - 27) + sceneLocal) <= S61_POSTZOOM_REVERSE_TRIGGER_LOCAL && !_scrollingForward && _s61PostZoomT0 !== null) {
    // REVERSE trigger — mirror of the forward trigger, only while scrolling backward and
    // already zoomed in (_s61PostZoomT0 !== null).
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

  // s5960ZoomT: only the scenes-62-64 reverse-zoom below still sets this nonzero; s61PostZoomT
  // (below) is the sole zoom driver for scenes 59-61 otherwise.
  let s5960ZoomT = 0;
  if (_s6263Active) {
    // Zoom reverses here, easing scale 0.5->1 over Resources->Credits, staying full-size for
    // Contact (Math.max saturates past 1) — driven by s6263Pos since scroll is locked in this zone.
    s5960ZoomT = Math.max(0, 1 - s6263Pos);
  }

  // Final pull-back — wall-clock driven either direction (see effectiveTx branch above):
  // _s61PostZoomT0 eases 0->1, _s61PostZoomReverseT0 eases 1->0, mutually exclusive.
  let s61PostZoomT = 0;
  if (_s61PostZoomT0 !== null) {
    s61PostZoomT = easeInOutCubic(Math.min(1, (ts - _s61PostZoomT0) / S61_POSTZOOM_TOTAL_MS));
  } else if (_s61PostZoomReverseT0 !== null) {
    s61PostZoomT = 1 - easeInOutCubic(Math.min(1, (ts - _s61PostZoomReverseT0) / S61_POSTZOOM_TOTAL_MS));
  } else if (currentScene === 29) {
    s61PostZoomT = 1;
  }

  // .scene-60 extras fade in together with the pull-back, driven by the same s61PostZoomT.
  s60ZoomExtras.forEach(el => { el.style.opacity = s61PostZoomT.toFixed(3); });

  // -- Horizontal strip --
  scrollX.style.transform = `translateX(${effectiveTx.toFixed(1)}px)`;

  // -- Scene-4 trees overlay: 140vw wide, starts 20vw left of scene 4 (mirrors .s4-extend) --
  if (s4TreesOverlay && SCROLL_MAP[3]) {
    const s4vx = SCROLL_MAP[3].stripX + effectiveTx - 0.20 * _vw;
    const s4TreesVisible = s4vx < _vw && s4vx > -1.40 * _vw;
    s4TreesOverlay.style.opacity   = s4TreesVisible ? '1' : '0';
    s4TreesOverlay.style.transform = `translateX(${s4vx.toFixed(1)}px)`;
    // Only animate while visible — this lottie is heavy (14 instances of a 185-layer precomp).
    if (s4TreesPlayer) {
      if (s4TreesVisible && !_s4TreesPlaying) { _s4TreesPlaying = true; s4TreesPlayer.play(); }
      else if (!s4TreesVisible && _s4TreesPlaying) { _s4TreesPlaying = false; s4TreesPlayer.pause(); }
    }
  }

  // -- Scene 55-58 seller: synced to his position (89vw) inside #s55-s58-bg but rendered as a
  // root-level fixed element so his z-index can beat #s5558-car's stacking context. --
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

  // -- Scenes 55-58 clouds+birds transition frame: root-level, same reasoning as the seller
  // above. Slides in, fades 0->1, then FREEZES fully opaque covering the bus/car for the rest
  // of the scene — frameVx is recomputed live so scrolling back naturally un-freezes it. --
  if (s5558TransitionFrameFront && SCROLL_MAP[23]) {
    const frameVx = SCROLL_MAP[23].stripX + 1.22 * _vw + effectiveTx;
    const frameVisible = currentScene >= 23 && currentScene <= 26;
    if (frameVisible) {
      // Hard on/off, no cross-fade — snaps to 0 once slid back out past this threshold.
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

  // -- #s45-s48-bg's right portion is masked out spatially in CSS (see #s45-s48-bg's mask-image
  // in style.css) — opacity here just stays 1 through scene 47 as a safety net past that point. --
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
    // Hide once scene-8 zoom starts, or scene-7 characters bleed in during the freeze.
    const show7 = currentScene < 7 && s7vx < _vw && s7vx > -_vw;
    cityOverlay7.style.opacity = show7 ? '1' : '0';
    cityOverlay7.style.transform = `translateX(${s7vx.toFixed(1)}px)`;
  }
  if (cityOverlay8 && SCROLL_MAP[7]) {
    const s8vx = SCROLL_MAP[7].stripX + effectiveTx;
    const show8overlay = (s8vx < _vw && s8vx > -_vw) ? '1' : '0';
    cityOverlay8.style.opacity = show8overlay;
    cityOverlay8.style.transform = `translateX(${s8vx.toFixed(1)}px)`;
    // Sign shows/hides together with panels[8]'s own show condition below (sceneLocal < 0.08).
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
      // Position-based, like city-overlay-7/8/9 — eases in as scrolling brings it on screen.
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

    // Tied to the bus's front edge approaching the ALGORITHM AVENUE sign: OPEN (fade in) ->
    // STAY (fully open) -> HIDE (fade out) zones, delayed past the sign by S12_POPUP_DELAY_VW.
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
    // Sign shows/hides together with the panel-10/panel-12b popup pair above.
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
    // Absolute strip position: #s5-s8-bg's left:400vw + fence's local left:19% of 415vw width.
    const fenceVx = 4.7885 * _vw + effectiveTx;
    s5s8FenceFront.style.transform = `translateX(${fenceVx.toFixed(1)}px)`;
    s5s8FenceFront.style.opacity   = (currentScene >= 4 && currentScene <= 7) ? '1' : '0';
  }

  // Scene 13 popups — position: fixed, screen-space coordinates
  // Bus exit shift on screen: bus moves right after 85%, amplified by pinnedWrap scale (3×)
  const _busShiftPx = currentScene === 9 && sceneLocal >= 0.85
    ? easeInOutCubic(Math.min(1, (sceneLocal - 0.85) / 0.10)) * 1.6 * getVw() * _s13TotalScale / 4
    : 0;
  // Positioned on the bus's live screen rect (same technique as panelS13_3/panel-8a/8b) — a
  // static top/left would only line up at one specific zoom/scroll state.
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
  // Fixed 30px block sliding along the track (must match .nav-track-fill's width in style.css).
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
  // (0-1). Optional `preShow` lets a panel appear near the end of the PREVIOUS scene instead.
  const PANEL_TIMING = {
    1: { start: 0.15, end: 0.92 }, // "Hop on the Prevailer matatu! TWENDE!"
    2: { start: 0.01, end: 0.92, preShow: 0.5 }, // also shows from the center of scene 1 onward
    3: { start: 0.01, end: 0.92, preShow: 0.5 }, // also shows from the center of scene 2 onward
    5: { start: 0.075, end: 0.92 }, // synced to the city bus's START position — it's already parked at ENTRY by scene-5's local:0 (drive-in happens during scene 4's final 40%, see animateCityBus scene===3 block), then eases ENTRY→CENTER over local 0-0.15 (scene===4 block) — this opens right as that move begins, not after it finishes.
    6: { start: 0.3, end: 0.92 },
    9: { start: 0.3, end: 0.92 },
    // panel-55/56/57 are NOT here — handled separately below via positionCenteredPopup, since
    // #s55-s58-bg pans on a nonlinear curve that a static CSS left would drift off from.
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

  // Scene 1 opening beat, before the bus drives in. Hides at 0.10, before panel-1's own
  // start (0.15), leaving a real gap so it reads as two distinct popups, not one morphing into another.
  if (panel1Start) {
    const HIDE_AT = 0.10;
    const showStart = currentScene === 0 && sceneLocal < HIDE_AT;
    panel1Start.style.opacity = showStart ? '1' : '0';
    panel1Start.classList.toggle('visible', showStart);
    // Blur uses a plain CSS transition (.s1s3-sharp), not a per-frame recompute — recalculating
    // filter:blur() every frame forces a re-rasterize and was the actual source of stutter.
    if (s1s3Troad) s1s3Troad.classList.toggle('s1s3-sharp', !showStart);
    if (s1s3Broad) s1s3Broad.classList.toggle('s1s3-sharp', !showStart);
  }

  // -- Scenes 55-57 popups: true CSS position:fixed (root level, not #scroll-x's pan). --
  if (SCROLL_MAP[23]) {
    // combinedLocal: 0 at scene-55 start .. 3 at scene-57 end — lets panel-55/56 overlap
    // (56 opens before 55 closes) instead of being strictly one-scene-each.
    const inHoldRange = currentScene >= 23 && currentScene <= 25;
    const combinedLocal = inHoldRange ? (currentScene - 23) + sceneLocal : -1;
    // panel-55's window splits into two sequential popups (55, 55b) instead of one 2-paragraph popup.
    const PANEL55_START = 0.28,  PANEL55_END = 0.315;
    const PANEL55B_END  = 0.35;
    const PANEL56_START = 0.39,  PANEL56_END = 0.41;
    const PANEL57_START = 0.42,  PANEL57_END = 0.5;
    const show55  = inHoldRange && combinedLocal > PANEL55_START  && combinedLocal < PANEL55_END;
    const show55b = inHoldRange && combinedLocal > PANEL55_END   && combinedLocal < PANEL55B_END;
    const show56 = inHoldRange && combinedLocal > PANEL56_START && combinedLocal < PANEL56_END;
    const show57 = inHoldRange && combinedLocal > PANEL57_START && combinedLocal < PANEL57_END;
    // Freeze scroll briefly on open — same pattern every popup in this file uses.
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

  // -- Scenes 59-73 popups: same dynamic-centering technique as scenes 55-57 (this wrapper is
  // 450vw, too wide for a static CSS left to track the pan). --
  if (SCROLL_MAP[27]) {
    const S5973_BG_LEFT_VW = 3089; // must match #s59-s73-bg's `left` in style.css (user-tuned)
    const vwPx2 = _vw / 100;
    const viewportCenterVw2 = -effectiveTx / vwPx2 + 50;
    const popupCenterVw2 = viewportCenterVw2 - S5973_BG_LEFT_VW;

    // Root-level bridge, local left:0vw within #s5973-bg-art — shown only scenes 59-60 (27-28),
    // when #city-bus is actually on the bridge.
    if (s5973BridgeFront) {
      const bridgeOnScreenVw = S5973_BG_LEFT_VW - viewportCenterVw2 + 50;
      // Same scale as the background art — needs its own copy since it's root-level, not a
      // child of #s5973BgArt that would inherit the transform automatically.
      const bridgeScale = 1 - 0.5 * s61PostZoomT;
      s5973BridgeFront.style.transform = `translateX(${(bridgeOnScreenVw * vwPx2).toFixed(1)}px) scale(${bridgeScale.toFixed(3)})`;
      s5973BridgeFront.style.opacity = (currentScene === 27 || currentScene === 28) ? '1' : '0';
    }

    // Trees — same on-screen-position formula and zoom-out scale as the bridge above.
    if (s5973TreesFront) {
      const treesOnScreenVw = S5973_BG_LEFT_VW - viewportCenterVw2 + 50;
      const treesScale = 1 - 0.5 * s61PostZoomT;
      s5973TreesFront.style.transform = `translateX(${(treesOnScreenVw * vwPx2).toFixed(1)}px) scale(${treesScale.toFixed(3)})`;
      s5973TreesFront.style.opacity = (currentScene === 27 || currentScene === 28) ? '1' : '0';
    }

    // 4 popups, same combinedLocal technique as scenes 55-57 — one value spanning scenes 27-29
    // (59-61). panel-60 stays disabled (duplicate text of panel-61).
    const inHoldRange5973 = currentScene >= 27 && currentScene <= 29;
    const combinedLocal5973 = inHoldRange5973 ? (currentScene - 27) + sceneLocal : -1;

    const show59              = inHoldRange5973 && combinedLocal5973 > 0.15 && combinedLocal5973 < 0.45;
    const showPurpleMan       = inHoldRange5973 && combinedLocal5973 > 0.45 && combinedLocal5973 < 0.7;
    const showLanguageJustice = inHoldRange5973 && combinedLocal5973 > 0.7  && combinedLocal5973 < 1.0;
    const show61              = inHoldRange5973 && combinedLocal5973 > 1.02 && combinedLocal5973 < 1.2;

    positionCenteredPopup(s5973Panels[0], show59, popupCenterVw2);
    if (panelPurpleMan) positionCenteredPopup(panelPurpleMan, showPurpleMan, popupCenterVw2);
    if (panelLanguageJustice) positionCenteredPopup(panelLanguageJustice, showLanguageJustice, popupCenterVw2);

    // #panel-61: track bus position, same technique as #panel-5 below — root-level/fixed
    // (see style.css) so live getBoundingClientRect() coords line up correctly.
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
    // autoplaying), triggered where the pull-back (s61PostZoomT) finishes.
    const cloudStart = S61_POSTZOOM_TRIGGER_LOCAL;
    const CLOUD_REVEAL_SPAN = 0.6; // smaller = clouds fully cover over less scroll (faster)
    const cloudSpan = CLOUD_REVEAL_SPAN;
    // Multiplied by s61PostZoomT (not gated by a hard >=1 check) so scrolling back fades the
    // clouds out smoothly instead of an instant cut.
    const cloudRawT = inHoldRange5973 ? Math.max(0, Math.min(1, (combinedLocal5973 - cloudStart) / cloudSpan)) : 0;
    const cloudT = cloudRawT * s61PostZoomT;
    if (s5973CloudsLottie) {
      s5973CloudsLottie.style.opacity = cloudT.toFixed(3);
      if (cloudT > 0 && typeof s5973CloudsLottie.getLottie === 'function') {
        const lottie = s5973CloudsLottie.getLottie();
        if (lottie && lottie.totalFrames) lottie.goToAndStop(cloudT * (lottie.totalFrames - 1), true);
      }
    }

    // -- Whole-background zoom: wall-clock driven by s61PostZoomT, shared with the bus's own
    // zoom in animateCityBus. transform-origin tracks the viewport center (popupCenterVw2). --
    if (s5973BgArt) {
      if (currentScene === 27 || currentScene === 28) {
        const bgScale = 1 - 0.5 * s61PostZoomT; // pull-back: 1.0 -> 0.5, synced with the bus
        s5973BgArt.style.transformOrigin = `${popupCenterVw2.toFixed(2)}vw 50%`;
        s5973BgArt.style.transform = `scale(${bgScale.toFixed(3)})`;
        s5973BgArt.style.opacity = '1';
      } else {
        // Scene 61 — renders normally, no special treatment.
        s5973BgArt.style.transform = 'scale(1)';
        s5973BgArt.style.opacity = '1';
      }
    }

  }

  // -- Scenes 62-64 — root-level fixed overlay, screen-by-screen switching, not part of the pan
  // strip. Each slide's opacity is a "tent" centered on its own index (s6263Pos), generalizing
  // to any slide count. --
  if (s6263Bg) {
    s6263Bg.classList.toggle('active', _s6263Active);
    s6263Slides.forEach((el, i) => {
      if (el) el.style.opacity = Math.max(0, 1 - Math.abs(s6263Pos - i)).toFixed(3);
    });
    // Content panels fade with their parent .s6263-slide; pointer-events toggled here so an
    // opacity:0 sibling doesn't intercept clicks/wheel meant for the visible slide.
    s6263Panels.forEach((el, i) => {
      if (!el) return;
      const active = _s6263Active && _s6263TransT0 === null && _s6263Index === i;
      el.style.pointerEvents = active ? 'auto' : 'none';
    });
  }

  // #panel-5: track bus position, `position: fixed`, so it moves with the bus's drive-in.
  // Bubble tail must land on the driver (~89% along the bus width) — a flat px offset drifted
  // off him at different viewport widths, so this computes left from his live position instead.
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

  // -- Spoken narration: checked after panel visibility resolves, throttled to ~6/sec (not
  // every rAF tick) — a screen reader is already CPU-heavy on its own, no need for 60fps here. --
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
        // Fast approach, braking to a stop as panel-1 appears (local 0.3) — a single continuous
        // easeInOutCubic curve so it's jerk-free at both the start and the post-PARK_AT hold.
        const PARK_AT = 0.32; // essentially stopped by here — just past the popup trigger
        // Starts 50% along the ENTRY->CENTER path and fully visible, not off-screen — the bus
        // is already on screen alongside panel-1-start's prompt from the first frame.
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
  if (scene < 11 || scene > 15) _s2630BusDampedX = null; // out of range — clear so no stale lag carries in next time
  const vw     = getVw();
  const vh     = window.innerHeight;
  const CENTER = 0.225 * vw;  // bus width 55vw → left edge at 22.5vw, dead-centered
  const ENTRY  = -0.1 * vw; // off-screen left (right edge at 0)

  let busY = 0; // vertical offset (px) applied to translateY — tune per-scene
  // .s1215-road's rendered height as a fraction of vw — constant across window sizes since
  // the road is sized off width. Used by scenes 8 and 9 to align the bus to the road.
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
      // Stays zoomed in for the exit slide — reset to 1x by the currentScene!==7 safety net elsewhere.
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
        // Eases zoom back to 1x as it exits, finishing in sync with pinnedWrap's reset and the scene-12 crossfade.
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
    // #city-bus's CSS (bottom:30%) is vh-based but .s1215-road is sized off vw — this
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
    // At 37% first zoom: pinnedWrap 1x->3x, holds during popups; eased back 3x->1x from 92%
    // (bus slide-up). Computed once and written once (two separate writes forced two layout
    // reflows per frame during 0.92-1.0, causing stutter).
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
    // Same road-alignment correction as scene 8, but pre-shrunk by wrapScale since #city-bus's
    // translateY sits inside #pinned-wrap and gets rendered wrapScale× larger as it zooms.
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
    // Conductor's welcome — independent timing from busSwapT, scoped to scene===14 specifically
    // since swapProg maxes at 3 for scene 30 too (it would never disappear otherwise).
    if (panel29Welcome) {
      // Opens once all 3 pairs have boarded, stays up into scene 30, closes before panel-30-popup1.
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
    } else {
      busX = CENTER;
    }
    // Damps choppy scroll input (mouse-wheel/trackpad ticks) into a smooth glide instead of
    // snapping straight to the raw scroll-driven target every frame — scoped to this scene
    // range only (_s2630BusDampedX resets to null outside it, at the top of this function).
    if (_s2630BusDampedX === null) _s2630BusDampedX = busX;
    _s2630BusDampedX += (busX - _s2630BusDampedX) * 0.25;
    busX = _s2630BusDampedX;
    // Scene-26 popups are scroll-position driven, not wall-clock — neither can appear just from
    // sitting still, only from the user actually scrolling further in. Each has its own
    // independent start/end (edit these 4 numbers directly) with a gap of "dummy" scroll
    // between them where neither shows.
    const PANEL26_1_START = 0.1,  PANEL26_1_END = 0.25;
    const PANEL26_2_START = 0.3,  PANEL26_2_END = 0.45;
    const show26_1 = scene === 11 && local >= PANEL26_1_START && local < PANEL26_1_END;
    const show26_2 = scene === 11 && local >= PANEL26_2_START && local < PANEL26_2_END;
    // Freezes scroll briefly on open so a fast scroll can't skip past the window — shorter than
    // the shared POPUP_SCROLL_FREEZE_MS (700ms) since these windows are already fairly wide and
    // a full 700ms hard stop read as glitchy here.
    const S26_POPUP_FREEZE_MS = 300;
    if (show26_1 && !_panel26_1Shown) _scrollFreezeUntil = Date.now() + S26_POPUP_FREEZE_MS;
    if (show26_2 && !_panel26_2Shown) _scrollFreezeUntil = Date.now() + S26_POPUP_FREEZE_MS;
    _panel26_1Shown = show26_1;
    _panel26_2Shown = show26_2;
    if (panel26_1) {
      panel26_1.style.opacity = show26_1 ? '1' : '0';
      panel26_1.classList.toggle('visible', show26_1);
    }
    if (panel26_2) {
      panel26_2.style.opacity = show26_2 ? '1' : '0';
      panel26_2.classList.toggle('visible', show26_2);
    }
    if (panel26_3) {
      // Shows a bit earlier now — during the tail of scene 27, ahead of the 2nd pair (Chris &
      // Kathleen, scene 28) — hides once the 3rd pair starts its own fade-out (busSwapT > 0)
      // so it hands off to the welcome popup instead of overlapping it.
      const show263 = swapProg >= 0.6 && busSwapT === 0;
      panel26_3.style.opacity = show263 ? '1' : '0';
      panel26_3.classList.toggle('visible', show263);
    }
    // Scene 30: 2 popups play first (no zoom), then zoom-in (34-55%), exterior->interior swap
    // at the peak (55-60%), hold through Awa Ly's message (60-90%, S30_HOLD_END), then zoom
    // back out + fade (90-100%) to hand off to the scene 32-43 interior overlay.
    if (scene === 15) {
      busX = CENTER;
      // Two popups in sequence at the same spot, both closed before the zoom-in begins at 0.34.
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
      const FADE_ZOOM_IN_PEAK = 4.10; // punches in further during fade-out, same direction as entry
      const ZOOM_ORIGIN_Y_OFFSET = -5; // nudges zoom anchor: negative reveals more of the bottom
      const ZOOM_ORIGIN_X_OFFSET = -8; // nudges zoom anchor: negative reveals more of the right
      const BUS_FADE_START = 0.95; // fades gradually, only down to 0.8 (not 0) — see busFadeT below

      // Crossfade to 0.8 (never further) — the scene-32 overlay (animateS32S43) fades in from
      // 0.5 to 1 over the same window, so the two meet in the middle with no gap.
      const busFadeT = Math.min(1, Math.max(0, (local - BUS_FADE_START) / (1 - BUS_FADE_START)));

      let s30Scale;
      if (local < ZOOM_IN_END) {
        const tIn = easeInOutCubic(Math.min(1, (local - 0.34) / (ZOOM_IN_END - 0.34)));
        s30Scale = 1 + (PEAK_SCALE - 1) * tIn;
      } else {
        // Holds flat at peak through the quote, then punches in further during fade-out.
        const tOut = easeInOutCubic(busFadeT);
        s30Scale = PEAK_SCALE + (FADE_ZOOM_IN_PEAK - PEAK_SCALE) * tOut;
      }

      const insideT = Math.min(1, Math.max(0, (local - SWAP_START) / (SWAP_END - SWAP_START)));
      const busFadeMul = 1 - busFadeT * 0.2; // floor at 0.8, not 0
      if (cityBusS26)    cityBusS26.style.opacity    = ((1 - insideT) * busFadeMul).toFixed(3);
      if (cityBusInside) cityBusInside.style.opacity = (insideT * busFadeMul).toFixed(3);

      // Awa Ly: fades in standing (62-66%), crossfades to holding the ceiling handle (70-75%).
      // Lives in her own #s30-zoom-people overlay, so busFadeT is applied to her directly.
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
        // Nudges the anchor up as fade-out progresses, so the zoom-out reveals the floor, not the ceiling.
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
    // Tail of scene 47 — the background pan already blends toward scene 55's start during the
    // crossing-matatu sequence, but `scene` can stay 22 a while after that freeze holds (it
    // only releases on the next real scroll). Fade the bus/cars in here too, but only to their
    // half-visible FAR_ENTRY position — the rest of the drive-in still plays out in scene 23.
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
    // Half of the bus's 55vw width, half on-screen — scene 23 below picks up from this same value.
    busX = -0.275 * vw;
    eff  = opacity * revealT;
    if (s5558Car) { s5558Car.style.opacity = (opacity * revealT).toFixed(3); s5558Car.style.transform = `translateX(${(-0.18 * vw).toFixed(1)}px)`; } // half of its own 36vw width
    // White Honda Fit (s5558Car2) stays fully hidden through scene 22 — its own fade-in/slide
    // happens entirely within scene 23 below, for a proper later entrance.
  } else if (scene >= 23 && scene <= 26) {
    // Scenes 55-58: matatu drives in and parks outside the Municipal Federation building,
    // same pattern as scene 5. Parked through 56-57, drives off as scene 58 ends.
    eff  = opacity;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty) cityBusEmpty.style.opacity = '0';
    if (cityBusS55)   cityBusS55.style.opacity   = '1';
    if (scene === 23) {
      // Continues from the half-visible position scene 22 faded it in at (FAR_ENTRY matches
      // busX there) — one continuous forward slide into fully parked.
      const FAR_ENTRY = -0.275 * vw;
      const t = easeInOutCubic(Math.min(1, local / 1.0));
      busX = FAR_ENTRY + t * (CENTER - FAR_ENTRY);
    } else if (scene <= 25) {
      // Scenes 56-57: stays parked
      busX = CENTER;
    } else {
      // Scene 58: the clouds+birds transition frame already wipes across and hides the bus
      // during scenes 56-57 — no separate drive-off/fade needed.
      busX = CENTER;
      eff  = 0;
    }
    // Companion cars — same drive-in/hold-sway/hide pattern, own timing per car so they don't
    // read as identical clones moving in lockstep.
    function driveCar(el, { farEntry, ahead, entryWindow, startDelay = 0, swayPhase, swayAmp }) {
      if (!el) return;
      let carX, carEff;
      if (scene === 23) {
        if (startDelay > 0) {
          // Stays at farEntry until `startDelay`, then slides in late, opacity flat at full.
          const t = easeInOutCubic(Math.min(1, Math.max(0, local - startDelay) / (entryWindow - startDelay)));
          carX   = farEntry + t * (CENTER + ahead - farEntry);
          carEff = opacity;
        } else {
          // Continues from the half-visible position scene 22 already faded it in at.
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
        // Scene 58: same reasoning as the bus above — already hidden by the transition frame.
        carX   = CENTER + ahead;
        carEff = 0;
      }
      el.style.opacity   = carEff.toFixed(3);
      el.style.transform = `translateX(${carX.toFixed(1)}px)`;
    }
    // Leads ahead of the bus; farEntry matches scene 22's half-visible fade-in position.
    driveCar(s5558Car,  { farEntry: -0.18 * vw, ahead:  0.15 * vw, entryWindow: 0.5,  swayPhase: 0,   swayAmp: 0.015 * vw });
    // Trails further back, enters slower, delayed until scene 23 is 15% scrolled.
    driveCar(s5558Car2, { farEntry: -0.15 * vw, ahead: -0.35 * vw, entryWindow: 0.65, startDelay: 0.15, swayPhase: 0.4, swayAmp: 0.02  * vw });
    // s5558Car3 (toyota probox) hidden per request — stays at default opacity 0.
  } else if (scene >= 27 && scene <= 29) {
    // Scenes 59-61: closing chapter — bus drives in at scene 59, then keeps a gentle bob
    // (not literally translating) through the park/lake stretch, and never exits.
    eff  = opacity;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty) cityBusEmpty.style.opacity = '0';
    if (cityBusS55)   cityBusS55.style.opacity   = '1';
    // Continuous phase across all 3 scenes so the bob doesn't jump at scene boundaries.
    const chapterPhase = (scene - 27) + local;
    // Zoom driven purely by s61PostZoomT (the final pull-back) — pulls back 1.0->0.5 in sync
    // with the bridge/trees/background art once panel-61 has closed.
    zoom = 1 - 0.5 * s61PostZoomT;
    if (scene === 27) {
      // Drive in already half-visible (bus is 50vw wide, -0.25vw left edge), then hold at
      // CENTER with a gentle bob for the rest of scene 59.
      const FAR_ENTRY = -0.25 * vw;
      const t = easeInOutCubic(Math.min(1, local / S5960_ZOOM_START_PHASE));
      const bob = Math.sin(chapterPhase * Math.PI * 2) * 0.006 * vw;
      busX = FAR_ENTRY + t * (CENTER + bob - FAR_ENTRY);
      eff  = opacity; // no fade-in — fully visible (half on-screen) from local:0
    } else if (scene === 28 && s61PostZoomT === 0) {
      // Before the second zoom triggers — same gentle bob as scene 59.
      const bob = Math.sin(chapterPhase * Math.PI * 2) * 0.006 * vw;
      busX = CENTER + bob;
    } else if (scene === 28) {
      // Second zoom triggered/finished — hard freeze, no bob, so scale doesn't fight it.
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

// ---- Scene 21 vehicles — 3 lanes (top: Meta, center: bus, bottom: Google), each driving in
// staggered and holding at rest, driven entirely by sceneLocal. After S21_PHASE2_LOCAL, Meta
// and Google pull forward to make room and Microsoft/OpenAI drive into the vacated spots.
const S21_ENTER_LOCAL        = 0.4; // drive-in duration per vehicle, phase 1 (fraction of scene scroll)
const S21_STAGGER_LOCAL      = 0.05; // scroll delay between each phase-1 vehicle's entrance start
const S21_POPUP_OPEN_FRACTION = 0.3; // how far into each truck's drive-in its popup opens (0-1)
const S21_POPUP_HOLD_LOCAL   = 0.20; // how long popup-1 stays open before swapping to popup-2
const S21_PHASE2_LOCAL       = 0.45; // sceneLocal at which phase 2 kicks off
const S21_FORWARD_X          = 0.95; // Meta/Google's new forward resting position — needs to clear OpenAI's own rest spot (0.30) plus its width (0.572), i.e. >0.872, or the two trucks statically overlap even once both are fully settled
// Meta/Google's forward-shift and Microsoft/OpenAI's drive-in are kept equal-paced so the
// new trucks arrive right as the old ones finish vacating, not while still mid-shift.
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
  // No .play()/.pause() — the trucks' wheel-spin is scrubbed from travel distance (scrubTruckLottie), purely scroll-driven.
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
  // When OpenAI arrives and how long its/Microsoft's popups stay open, computed from the
  // phase-2 timing constants so it can't go stale into an impossible window.
  const openAiArriveLocal = S21_PHASE2_LOCAL + S21_PHASE2_STAGGER_LOCAL + S21_PHASE2_ENTER_LOCAL;
  const s21Phase2PopupEnd = openAiArriveLocal + S21_PHASE2_POPUP_HOLD_LOCAL;
  // Each vehicle's own rendered width — sizes vary per truck, so a shared offset isn't enough.
  const offW = el => Math.round((el.offsetWidth || 0.32 * vw) * 1.05);
  // Scrubs a truck's wheel-spin lottie to the frame matching travel distance (xPx), looping via
  // modulo. S21_LOTTIE_PX_PER_FRAME tunes speed — lower = faster-spinning wheels.
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

  // Clouds fade in only after Microsoft/OpenAI's popups close (s21Phase2PopupEnd) — scrubbed
  // across the remaining scroll, same technique as scrubTruckLottie.
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

  // Truck popups — 3 waves, one per truck at a time: Meta-1/Google-1, then Meta-2/Google-2
  // swap in after S21_POPUP_HOLD_LOCAL, then Microsoft+OpenAI once phase 2 starts. Each opens
  // partway through its truck's drive-in (S21_POPUP_OPEN_FRACTION, 0=on entry, 1=fully arrived).
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

  // Popups are fixed to the center of the window — no per-frame position tracking needed.
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

  // Drops to 0 once the scene-30 zoom swap finishes (60%, animateCityBus's SWAP_END) and stays
  // there, or this overlay's backdrop pops back into view once the bus fades.
  let opacity;
  if (scene < 11)        opacity = 0;
  else if (scene === 15) opacity = local >= 0.60 ? 0 : 1;
  else if (scene <= 15)  opacity = 1;
  else                    opacity = 0;
  cityOverlay26.style.opacity = opacity.toFixed(3);
  if (cityOverlay26Behind) cityOverlay26Behind.style.opacity = opacity.toFixed(3);

  // #s26-s30-bg stays visible through the scene-30 zoom, only easing out at the very end
  // (95-100%) so the handoff into scene 32's fade-in isn't an instant snap.
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

  // Once all 3 batches are done, fade all characters out (they've boarded the bus).
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

  // Fades in at the start of scene 32, not during scene 30's frozen tail (would be
  // mispositioned). High-water mark so a small scroll-back doesn't fade it back out.
  let opacity;
  if (scene < 16) {
    opacity = 0;
    _s32OverlayOpacity = 0; // reset only once fully scrolled back out of scene 32
  } else if (scene === 16) {
    // Crossfade partner to scene 30's fade-out (busFadeMul): that fades to 0.8, this starts
    // at 0.8 and eases to 1, meeting in the middle.
    const t = easeInOutCubic(Math.min(1, Math.max(0, local / 0.15)));
    const raw = 0.8 + 0.2 * t;
    _s32OverlayOpacity = Math.max(_s32OverlayOpacity, raw);
    opacity = _s32OverlayOpacity;
  } else {
    opacity = 1;
    _s32OverlayOpacity = 1;
  }
  cityOverlay32.style.opacity = opacity.toFixed(3);

  // #s32-s43-bg relies on position math alone to stay clipped during scene 30 — explicitly
  // hiding it here guarantees it can never show through behind the zoom.
  if (s3243Bg) {
    s3243Bg.style.opacity = opacity.toFixed(3);
  }

  // Intro popup — appears once the interior overlay has faded in, dismissed by 60%.
  if (panel32Intro) {
    // Starts at 0.15, when #city-overlay-32's fade-in finishes — any sooner and its white
    // background looks washed-out from the still-fading ancestor's opacity.
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

  // Zoom in starts once Samuel's popup hides and Lesan takes over (lesanTriggered).
  // Ramps 1x -> 1.5x, wall-clock timed like the other zooms here.
  if (lesanTriggered && _sAsmelashZoomInT0 === null) _sAsmelashZoomInT0 = ts;
  if (!lesanTriggered) _sAsmelashZoomInT0 = null; // scrolled back out — reset so re-entering replays it
  const asmelashZoomInT = _sAsmelashZoomInT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _sAsmelashZoomInT0) / ASMELASH_ZOOMIN_MS)));

  // Pregnant woman: visible only within this local window in scene 17, both edges eased.
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

  // Zoom out once local reaches S33_ZOOM_HOLD — wall-clock timed via _s33ZoomOutT0 in frame().
  let pregnantZoomT;
  if (scene < 17) pregnantZoomT = 0;
  else if (scene > 17) pregnantZoomT = 1;
  else if (local < S33_ZOOM_HOLD) pregnantZoomT = 0;
  else pregnantZoomT = _s33ZoomOutT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _s33ZoomOutT0) / S33_ZOOMOUT_MS)));

  // Zoom locked at 1.5x while the two women are on screen, eases to 1x with Samuel (samuelT),
  // then zooms back in for Asmelash/pregnant-woman popups (asmelashZoomInT), eases out after
  // (pregnantZoomT). transform-origin is recomputed every frame (not a fixed CSS %) so the
  // zoom stays centered on-screen as the strip pans.
  if (s3243Bg) {
    let s32Scale;
    if (scene < 16) {
      s32Scale = 1;
    } else if (scene === 16 && !lesanTriggered) {
      s32Scale = 1.5 - 0.5 * samuelT; // original scene-32 zoom-out for Samuel's reveal
    } else if (scene >= 19) {
      // Scene 44: no longer zooms the frozen scene-34 content underneath — flat at 1x.
      s32Scale = 1;
    } else if (scene > 17 || (scene === 17 && local >= S33_ZOOM_HOLD)) {
      // Flat at 1.2 — matches where the zoomed-in phase below ends, so there's no jump.
      s32Scale = 1.2;
    } else {
      s32Scale = 1 + 0.2 * asmelashZoomInT; // zoomed-in phase: Lesan-dismiss through Asmelash + pregnant popups
    }
    const vwPx = getVw() / 100;
    const stripXvw = -etx / vwPx;             // strip coordinate currently at the viewport's left edge
    const viewportCenterVw = stripXvw + 50;   // center of the 100vw viewport, in strip coordinates
    const S3243_BG_LEFT_VW = 1965;             // must match #s32-s43-bg's `left` in style.css
    const S3243_BG_WIDTH_VW = 450;            // must match #s32-s43-bg's `width` in style.css
    const originXPct = Math.max(0, Math.min(100,
      ((viewportCenterVw - S3243_BG_LEFT_VW) / S3243_BG_WIDTH_VW) * 100));
    const originStr = `${originXPct.toFixed(2)}% 75%`;
    const scaleStr  = `scale(${s32Scale.toFixed(3)})`;
    s3243Bg.style.transformOrigin = originStr;
    s3243Bg.style.transform = scaleStr;
    // #s32-people shares the same 1300vw coordinate space as #s32-s43-bg, so the same
    // scale/origin keeps characters glued to their seats as it zooms.
    if (s32People) {
      s32People.style.transformOrigin = originStr;
      s32People.style.transform = scaleStr;
    }
  }

  // Old lady + girl-with-phone fade out as Samuel fades in (inverted samuelT) — a clean cast change.
  const behindT = peopleT * (1 - samuelT);
  if (char32OldLady)   char32OldLady.style.opacity   = behindT.toFixed(3);
  if (char33GirlPhone) char33GirlPhone.style.opacity = behindT.toFixed(3);

  // Samuel's quote — appears once fully faded in, hands off to the Lesan AI popup at 0.90.
  if (panel32Samuel) {
    const showSamuel = scene === 16 && samuelT >= 1 && local < 0.90;
    if (showSamuel && !_panel32SamuelShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32SamuelShown = showSamuel;
    panel32Samuel.style.opacity = showSamuel ? '1' : '0';
    panel32Samuel.classList.toggle('visible', showSamuel);
    if (soundCaptionSamuel) soundCaptionSamuel.style.opacity = showSamuel ? '1' : '0';
  }

  // Lesan AI popup — 4th popup, opens at LESAN_OPEN_LOCAL, auto-closes at LESAN_END_LOCAL,
  // or dismissed early via a scroll gesture (see 'wheel' listener above).
  const LESAN_END_LOCAL = 1.02; // combined (scene-16)+local position where it auto-closes
  if (panel32Lesan) {
    // Stays triggered past scene 32 into 33+, or the "dismissed, show Asmelash" state never fires.
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

  // 5th popup — near Asmelash's head, opens right after Lesan is dismissed, closes after
  // 2 scroll gestures (_s33AsmelashDismissed) with local < 0.55 as a safety-net fallback.
  if (!(scene === 17 && local >= 0.02)) {
    _s33AsmelashDismissed = false; // scrolled back out — reset so re-entering replays it
    _s33AsmelashTicks = 0;
  }
  const showAsmelashPopup = scene === 17 && local >= 0.02 && local < 0.15 && !_s33AsmelashDismissed;
  _s33AsmelashShown = showAsmelashPopup;
  // Guaranteed hide for the earlier scene-27 boarding portrait — only ever forces it off,
  // never touches its opacity otherwise (leaves animateS26S30's own fade alone).
  if (char27Asmelash && showAsmelashPopup) char27Asmelash.style.opacity = '0';
  if (panel32Asmelash) {
    if (showAsmelashPopup && panel32Asmelash.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Asmelash.style.opacity = showAsmelashPopup ? '1' : '0';
    panel32Asmelash.classList.toggle('visible', showAsmelashPopup);
  }
  // Asmelash hides/shows together with his popup above.
  if (char37Asmelash) char37Asmelash.style.opacity = showAsmelashPopup ? '1' : '0';

  // 6th popup — opens with the flipped Asmelash, right when the 5th popup is dismissed.
  const showAsmelash2Popup = scene === 17 && asmelash1Done && local < 0.35;
  if (char37Asmelash2) char37Asmelash2.style.opacity = showAsmelash2Popup ? '1' : '0';
  if (panel32Asmelash2) {
    if (showAsmelash2Popup && panel32Asmelash2.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Asmelash2.style.opacity = showAsmelash2Popup ? '1' : '0';
    panel32Asmelash2.classList.toggle('visible', showAsmelash2Popup);
  }
  // Name plate + sound icon tied only to the 5th popup, not the 6th.
  if (soundCaptionAsmelash) {
    soundCaptionAsmelash.style.opacity = showAsmelashPopup ? '1' : '0';
  }

  // Sadik — plain scroll-position rule, not tied to pregnantZoomT's wall-clock timer (which
  // could let local advance well past intended before completing).
  const showSadik = scene > 17 || (scene === 17 && local >= 0.97);
  if (char32Sadik) char32Sadik.style.opacity = showSadik ? '1' : '0';
  if (char34Kid1) char34Kid1.style.opacity = showSadik ? '1' : '0'; // lollipop kid, opens/hides together with Sadik per request

  // 7th popup — opens once pregnant woman is fully revealed. 8th — below her, staggered.
  // Both close once Sadik shows up (local>=0.97, same threshold as showSadik).
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

  // 9th popup — near Sadik, shown right alongside him.
  if (panel32Sadik) {
    if (showSadik && panel32Sadik.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Sadik.style.opacity = showSadik ? '1' : '0';
    panel32Sadik.classList.toggle('visible', showSadik);
  }
  if (soundCaptionSadik) soundCaptionSadik.style.opacity = showSadik ? '1' : '0';
}

// ---- Scene 44: slides down from the top over scene-34 instead of panning in horizontally.
// Continuously scroll-driven, so scrolling back up slides it off-screen again. ----
function animateS44(scene, local) {
  if (!s44Overlay) return;
  const slideT = scene < 19 ? 0 : scene > 19 ? 1 : easeInOutCubic(local);

  // Exit zoom uses the first S45_EXIT_RANGE of scene-45's local range, kept sticky (no pan)
  // for the same window — see frame()'s effectiveTx freeze.
  const exitT = scene < 20 ? 0 : scene > 20 ? 1 : easeInOutCubic(Math.min(1, local / S45_EXIT_RANGE));

  const translateY = (1 - slideT) * -100;
  const scale = 1 + 0.5 * exitT;
  s44Overlay.style.transform = `translateY(${translateY.toFixed(2)}%) scale(${scale.toFixed(3)})`;
  s44Overlay.style.opacity = (1 - exitT).toFixed(3);

  // #s45-s48-bg stays hidden until the overlay above starts revealing it (exitT).
  if (s4548Bg) s4548Bg.style.opacity = exitT.toFixed(3);

  // IMPORTANT: must run AFTER animateS32S43 in frame()'s call order — this intentionally
  // overrides #s32-s43-bg's opacity (which animateS32S43 otherwise holds at 1) during the
  // exit window, fading it opposite to exitT so it doesn't bleed through as #s44Overlay fades.
  if (s3243Bg) s3243Bg.style.opacity = (1 - exitT).toFixed(3);

  // "The guy" (toto-moto) fades in a bit before the popup; fades away during the exit zoom.
  if (s44TotoMoto) s44TotoMoto.classList.toggle('visible', slideT >= 0.75);

  // Popup — appears once the slide-down finishes (slideT reaches 1).
  if (panel44_1) {
    const showPanel44_1 = slideT >= 1;
    panel44_1.style.opacity = showPanel44_1 ? '1' : '0';
    panel44_1.classList.toggle('visible', showPanel44_1);
  }
}

// Centers a scene-45/48 popup on the current viewport, recomputed every frame from the live
// pan position — a static CSS left:Xvw only looks centered at one scroll position since
// #s45-s48-bg is 520vw wide (unlike single-viewport scenes where a fixed 50% works).
// Positions a popup next to #city-bus's driver window, tracking its live on-screen rect —
// used by panel-8a/8b since #city-bus moves and scales throughout scene 8. Both panels live
// at root level (outside #pinned-wrap/#scroll-x), so plain getBoundingClientRect() applies
// directly with no containing-block complications from #pinned-wrap's active transform.
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

// ---- Scenes 45-48: ambient bus-interior passengers, same plain scroll-position fade pattern
// as scenes 32-34's ambient characters. #s45-s48-bg pans automatically as a normal child of
// #scroll-x — this only toggles opacity. ----
function animateS45S48(scene, local, etx, ts) {
  // Viewport horizontal center in #s45-s48-bg's own coordinate space, reused by every
  // positionCenteredPopup() call below.
  const vwPx = getVw() / 100;
  const viewportCenterVw = -etx / vwPx + 50;
  const popupCenterVw = viewportCenterVw - S45S48_BG_LEFT_VW;

  // Sequence within scene 45 (fully pinned, S45_STICKY_RANGE): Kathleen -> toto moto -> red
  // lady -> toto moto's popup -> wheelchair man, one at a time, accumulating (no fade-out).
  const showKathleen = scene === 20 && local > 0.25 && local < 0.4;
  if (char45Kathleen)   char45Kathleen.classList.toggle('visible',   showKathleen);
  const showTotoMoto = scene === 20 && local >= 0.45;
  if (char45TotoMoto)   char45TotoMoto.classList.toggle('visible',   showTotoMoto);
  const showRedLadyChar = scene === 20 && local >= 0.65;
  if (char45RedLady)    char45RedLady.classList.toggle('visible',    showRedLadyChar);
  // Toto moto's name plate + quote hand off to the red lady the moment she shows up.
  const showTotoMotoLabel = showTotoMoto && !showRedLadyChar;
  if (soundCaptionTotoMoto) soundCaptionTotoMoto.style.opacity = showTotoMotoLabel ? '1' : '0';

  // Kathleen's quote — same window as Kathleen herself, positioned via CSS not positionCenteredPopup().
  if (panel45Kathleen) {
    panel45Kathleen.style.opacity = showKathleen ? '1' : '0';
    panel45Kathleen.classList.toggle('visible', showKathleen);
  }
  // Name plate + sound icon now hide/show together with her quote popup.
  if (soundCaptionKathleen) soundCaptionKathleen.style.opacity = showKathleen ? '1' : '0';

  // Red lady's quote — shown briefly, hides before toto moto's own popup takes its turn.
  const showRedLady = scene === 20 && local > 0.7 && local < 0.82;
  positionCenteredPopup(panel45RedLady, showRedLady, popupCenterVw);

  positionCenteredPopup(panel45TotoMoto, showTotoMotoLabel, popupCenterVw);

  // Wheelchair man — stays visible once he appears, into scenes 46/47/48, no hide.
  if (char45Wheelchair) char45Wheelchair.classList.toggle('visible', scene > 20 || (scene === 20 && local >= 0.9));

  // Zoom-in scroll-driven across S46_HOLD_START -> S46_ZOOM_END_LOCAL, stays zoomed through 46-48.
  const wheelchairZoomT = scene < 21 ? 0
    : scene > 21 ? 1
    : easeInOutCubic(Math.min(1, Math.max(0, (local - S46_HOLD_START) / (S46_ZOOM_END_LOCAL - S46_HOLD_START))));
  if (s4548Visual) {
    const s46Scale = 1 + 0.5 * wheelchairZoomT;
    // Recomputes origin from viewport center (same technique as animateS32S43's s3243Bg zoom).
    // Scales #s45-s48-visual only, not #s45-s48-bg — popups/nameplates are siblings outside it.
    const originXPct = Math.max(0, Math.min(100, (popupCenterVw / S45S48_BG_WIDTH_VW) * 100));
    s4548Visual.style.transformOrigin = `${originXPct.toFixed(2)}% 75%`;
    s4548Visual.style.transform = `scale(${s46Scale.toFixed(3)})`;
  }

  // Huniki popup shows first once the zoom-in finishes, then Big Tech takes over — scroll-driven off local.
  const showHuniki = scene === 21 && local >= S46_ZOOM_END_LOCAL && local < S46_HUNIKI_LOCAL_END;
  positionCenteredPopup(panel46Huniki, showHuniki, popupCenterVw);
  const showBigTech = scene === 21 && local >= S46_HUNIKI_LOCAL_END && local < S46_BIGTECH_LOCAL_END;
  positionCenteredPopup(panel46BigTech, showBigTech, popupCenterVw);

  // Chris Emezue's quote — he's baked into the seat art, so just a popup timed to when that
  // part is centered on screen. Excludes showHuniki/showBigTech so it never overlaps them.
  const showChris = ((scene === 21 && local >= 0.75) || (scene === 22 && local < 0.6)) && !showHuniki && !showBigTech;
  // Freezes when it reaches screen center instead of on-open (see _panel47PrevDiff below).

  // Hides for good once you scroll again after its center-freeze ends — not on a timer.
  const _s47FreezeTimerDone = _panel47FreezeEndsAt !== null && Date.now() >= _panel47FreezeEndsAt;
  if (_s47FreezeTimerDone && _panel47FreezeReleaseScrollY === null) {
    _panel47FreezeReleaseScrollY = window.scrollY; // where it was pinned, captured once the timer finishes
  }
  const _s47HiddenByScroll = _panel47FreezeReleaseScrollY !== null && window.scrollY !== _panel47FreezeReleaseScrollY;
  const showS47NewGuy = showChris && !_s47HiddenByScroll;
  // Captured once the popup hides (scene 22 only) — the crossing-matatu sequence below starts from here.
  if (_s47HiddenByScroll && scene === 22 && _s47PopupHiddenLocal === null) {
    _s47PopupHiddenLocal = local;
  }
  if (!showChris) { _panel47FreezeEndsAt = null; _panel47FreezeReleaseScrollY = null; _s47PopupHiddenLocal = null; } // re-arm for next time it opens
  _panel47NewGuyShown = showS47NewGuy;
  // Freezes for S47_CENTER_FREEZE_MS the moment the popup's live rect crosses viewport center
  // (sign flip of popup-center minus viewport-center between frames), not a fixed local fraction.
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
  // Fixed left (style.css) — lives inside #s45-s48-visual next to .char-s47-newguy, same pan+scale.
  if (panel47NewGuy) {
    panel47NewGuy.style.opacity = showS47NewGuy ? '1' : '0';
    panel47NewGuy.classList.toggle('visible', showS47NewGuy);
  }
  if (soundCaptionS47NewGuy) soundCaptionS47NewGuy.style.opacity = showS47NewGuy ? '1' : '0';

  // Tail of scene 47: once Chris's popup hides, another matatu crosses right-to-left through a
  // window frame as a brief beat before scene 55. Purely scroll-driven (crossingT below); 0.3
  // is a fallback if the popup never showed/hid.
  const CROSSING_START = _s47PopupHiddenLocal !== null ? _s47PopupHiddenLocal : 0.3;
  const CROSSING_END   = CROSSING_START + S47_CROSSING_DURATION;
  const crossingT = (scene === 22)
    ? Math.min(1, Math.max(0, (local - CROSSING_START) / (CROSSING_END - CROSSING_START)))
    : 0;
  // Once the bus finishes crossing, freeze the background for a beat (same "stays up until the
  // next real scroll" pattern as Chris's popup). Direction (raw scrollY) used below so scrolling
  // backward into the dead zone skips straight back to the crossing's end instead of crawling through it.
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
      // Scrolling backward through the dead zone — skip to just before the crossing's end,
      // clearing freeze/hide state so the sequence is immediately interactive again.
      _s47CrossingBackSkipDone = true;
      _s47CrossingFreezeTriggered = false;
      _s47CrossingFreezeEndsAt = null;
      _s47CrossingFreezeReleaseScrollY = null;
      const _crossEndLocal = (_s47PopupHiddenLocal !== null ? _s47PopupHiddenLocal : 0.3) + S47_CROSSING_DURATION;
      const _targetLocal = Math.max(0, _crossEndLocal - 0.02); // just inside the active window, not exactly on the boundary
      window.scrollTo(0, Math.round(SCROLL_MAP[22].scrollStart + _targetLocal * SCENE_SCROLL[22] * getVw()));
    }
  } else if (scene < 22 || (scene === 22 && crossingT < 1)) {
    // Only resets when genuinely before the crossing sequence, not simply "scene !== 22" (which
    // also matches scene 23+ and would re-arm/re-trigger the freeze every time you scroll back into it).
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
  // Once the freeze ends and you scroll again, skip straight to scene 55's start instead of a
  // long dead stretch — frame()'s effectiveTx already parked the background there, so this jump is invisible.
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

  // Scene 7 people — parallax removed per request (read as a jittery shake on mouse move).
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

// ---- Scene 8 character entrance: scroll-driven slide-up + fade, staggered per person. ----
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

// ---- Scene-32 sound icons: click plays audio for the active language, click again stops it.
// Three visual states (data-sound-state): landing, play, pause. ----
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

// ---- Spoken narration — always on. Watches every `.text-panel`'s hidden->visible toggle and
// announces whichever one just appeared, so narration matches what's on screen regardless of
// scroll input. #pinned-wrap/overlays are aria-hidden (a screen reader's own scroll cursor
// fights this site's custom engine), so #narration-live (aria-live="polite") is the only thing
// AT reads — deliberately text-only, not window.speechSynthesis, to avoid two overlapping voices. ----
const _narrationPanels = Array.from(document.querySelectorAll('.text-panel'));
const _narrationSeen = new WeakSet();
const narrationLive = document.getElementById('narration-live');

function _panelIsVisible(el) {
  return el.classList.contains('visible') || parseFloat(el.style.opacity || '0') >= 0.5;
}

// A fast scene-jump can cross several popups' visibility windows within milliseconds — queue
// and drain one at a time instead of overwriting #narration-live before it's been read.
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

// ---- Auto-advance: steps forward automatically once the current part finishes, so an AT/
// keyboard user isn't pressing Next after every panel. Only starts on first Previous/Next
// button press (never on page load), pauses permanently on the user's first manual scroll. ----
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

// Live-announces text, shared by panel narration and scene-beat descriptions. Once
// auto-advance is active, estimates read time so the story doesn't step forward too early.
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

// Short descriptions of what's visually happening in a scene (vehicles, boarding, zooms),
// covering story beats a sighted user picks up from visuals alone. Content lives in
// i18n/<lang>.json under "sceneBeats", keyed by the real on-screen scene number (or range,
// e.g. "8-11") — not the internal currentScene index — via sceneBeatKeyFor() below. Also folds
// in #char-bubble stats for "8"/13-20 (that click-popup system isn't a .text-panel, so
// checkNarration() never picks it up otherwise).
// Full key list (real-scene grouping, per request): 1-3, 4, 5-6, 7, 8, 9, 10, 11, 12, 13-20,
// 21-25, 26-31, 32-33, 34-43, 44, 45-47, 48-51, 52, 53-55, 56, 57-58, 59-61, 62-63, 72, 73.
let _lastExtraKey = null;

// Merges several currentScene indices into one sceneBeats key so they narrate once instead of
// re-firing at each swap-in (e.g. indices 0-2 = the jungle drive, 11-15 = interviewees
// boarding). checkSceneExtras dedupes by the computed key, not the raw scene index.
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

// idx7 (scene 8) has 4 distinct beats as the viewer scrolls through it — thresholds mirror
// the popup8a/popup8b show windows so narration switches as each appears/finishes.
const SCENE8_BEAT_THRESHOLDS = [[0.42, '9'], [0.60, '10'], [0.75, '11']]; // below first = '8'

// idx22 (scene 47) splits into 3 beats. 0.6 is an exact anchor matching showChris's own cutoff;
// 0.72 approximates the crossing sequence's start (deliberately not reusing the mutable
// _s47PopupHiddenLocal state, to keep narration decoupled from the animation logic).
const SCENE47_BEAT_THRESHOLDS = [[0, '48-51'], [0.6, '52'], [0.72, '53-55']];

// currentScene index -> its "sceneBeats" key, e.g. 12 -> "13-20" (scenes with no own
// SCENE_SCROLL entry share their predecessor's slot — see SCENE_LABELS above).
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
// jumpScroll: full scene skip. stepScroll: incremental move, clamped to what's left in the
// current scene, so nothing gated on sceneLocal (trees reveal, popups) gets skipped entirely.
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
// ArrowRight/Left jump to the next/previous scene's start; Down/PageDown/Space and
// Up/PageUp/Shift+Space step scrollY incrementally instead, like a normal page.
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

// ---- Story Previous/Next buttons — always-focusable real controls for screen reader users,
// since #pinned-wrap itself is aria-hidden. Auto-advance starts on focus, not just click. ----
const storyPrevBtn = document.getElementById('storyPrevBtn');
const storyNextBtn = document.getElementById('storyNextBtn');
if (storyPrevBtn) storyPrevBtn.addEventListener('click', () => { startAutoAdvance(); stepScroll(-1, true); });
if (storyNextBtn) storyNextBtn.addEventListener('click', () => { startAutoAdvance(); stepScroll(1, true); });

// focusin (bubbles, unlike focus) — more reliable across browser/AT combinations.
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
  // If clamping pushes the bubble within 5% of the edge, hide it instead of showing it squished.
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
  // try/catch so one bad frame can't permanently kill the whole animation loop.
  try {
    if (!_paused) {
      frame(ts);
      // Re-track the open popup's position every frame so it stays anchored to its character's marker.
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
