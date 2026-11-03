# DON'T LOOK BEHIND YOU

A 3D first-person psychological horror game that runs in your browser. No install, no build step.

You wake up in an unfamiliar apartment building. Something is following you.
**It only moves when you are not looking at it.** The longer you survive, the smarter it gets.

## Play it

**Easiest:** double-click `index.html` (use Chrome, Edge or Firefox on a computer).

**Or run a tiny local server:**
```
python -m http.server 8000
```
then open http://localhost:8000

**Online (GitHub Pages):** upload everything in this folder to a repo, then Settings > Pages > Deploy from branch `main` / `(root)`.

## Controls
| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look |
| Shift | Sprint (uses stamina) |
| Ctrl or C | Crouch (quieter) |
| E | Interact / open / pick up |
| F | Flashlight |
| R | Use battery |
| H | Use medkit |
| Tab | Inventory |
| J | Journal / notes |
| Esc | Pause (releases mouse) |

Tip: Ctrl+W closes a browser tab, so use **C** to crouch.

## Features
- Real enemy AI: line-of-sight, frozen while watched, flanks and rushes when your back is turned, changes floors
- 3 floors: apartments, lobby and offices, and a basement; stairs, elevator, doors, keys, safe rooms (not always safe)
- Flashlight with battery, health, stamina, 6-slot inventory, notes, a code safe
- 5 chapters and 3 endings: THE LOOP, RELEASE, ASHES
- Procedural textures and fully synthesized 3D positional audio (headphones recommended)
- Psychological events: flickering lights, footsteps behind you, knocking, whispers, shifting props
- Save and Continue, settings (volume, sensitivity, FOV, quality, brightness)

## Files
```
index.html      page and menus
css/style.css   look and feel
js/             game modules (util, textures, audio, input, fx, props, world, story, player, creature, events, ui, game)
vendor/         three.js r159 (MIT licence included)
```
If the game is slow, set Quality to Low in Settings.
