# Prevailer Matatu Journey — Scroll Animation

## Folder Structure

```
prevailer-journey/
├── index.html       ← Main file, open this in browser
├── style.css        ← All styles and layer sizing
├── scroll.js        ← Vanilla JS scroll engine
└── assets/
    ├── s1/          ← Scene 1: Jungle intro
    │   ├── road.svg
    │   ├── b-road.svg
    │   ├── t-road.svg
    │   └── matatu-top.svg
    ├── s2/          ← Scene 2: Jungle story
    ├── s3/          ← Scene 3: Jungle detail
    ├── s4/          ← Scene 4: Savanna transition
    │   ├── road.svg
    │   ├── clouds.svg
    │   ├── trees.svg
    │   └── building.svg
    ├── s5/          ← Scene 5: City arrival
    │   ├── road.svg
    │   ├── clouds.svg
    │   ├── trees.svg
    │   ├── buildings.svg
    │   └── matatu.svg
    └── s6/          ← Scene 6: City close-up
        ├── road.svg
        ├── clouds.svg
        ├── buildings.svg
        └── matatu.svg
```

## How to Run

Open `index.html` directly in any modern browser.  
No server or build step required.

## How to Customise

### Change text panel content
Edit the `<div class="text-panel">` blocks in `index.html`.

### Change scroll speed
In `scroll.js`, find:
```js
const SCENE_SCROLL = 1.2;
```
- Increase → slower scroll per scene
- Decrease → faster scroll per scene

### Adjust layer sizing / positions
In `style.css`, find the layer classes:
```css
.layer-troad img    { width: 140%; bottom: 0; }
.layer-matatu img   { width: 35%; bottom: 18%; left: 30%; }
```
Adjust `width`, `bottom`, `left`, `right` per layer.

### Adjust when text panels appear
In `scroll.js`, find:
```js
const show = inScene && sceneLocal > 0.3 && sceneLocal < 0.92;
```
- `0.3` = show at 30% through the scene
- `0.92` = hide at 92% through the scene

## Navigation
- **Scroll** vertically — scene moves horizontally
- **Swipe** left/right on mobile
- **Click dots** at bottom to jump to any scene
- **Arrow keys** (← →) to navigate scenes

## Browser Support
Works in all modern browsers (Chrome, Firefox, Safari, Edge).
