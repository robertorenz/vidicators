# Vindicators — Arcade Tribute

A browser remake of Atari Games' 1988 twin-tank arcade game **Vindicators**, written in plain HTML5 Canvas + JavaScript with no build step and no dependencies.

Drive your SR-88 battle tank through 14 Tangent Empire space stations. Blast gun turrets, enemy tanks and tank factories, grab fuel and battle stars, destroy each station's control center, and escape before it explodes.

## Running

Open `index.html` in a modern browser. If your browser blocks local files, serve the folder instead:

```
python -m http.server 8000
```

Then browse to http://localhost:8000.

## What's faithful to the original

- **Fuel is life.** It drains over time, and every enemy hit burns more. When it runs out, press your start button to continue (free play).
- **Battle stars** are the currency. After each station, the **Equipment Room** sells Speed, Shot Speed, Shot Range, Shot Power, Shields, a bigger Fuel Tank, and Refuel.
- **Tread controls.** Classic mode maps each tank tread to its own stick or key pair, just like the cabinet's twin joysticks.
- **Limited shields** block all damage while held and recharge slowly.
- **Stations have 3 levels.** The top level holds the control center. Destroy it and the exit unlocks, then a 30-second escape countdown starts.
- **Two players** share one screen at the same time and can join or continue at any time.
- The oblique 3/4 view has raised metal walls, the resolution is 512×384 (Atari System 2), and digitized-style voice callouts are provided by the browser's speech synthesis.

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Drive (simple) | W A S D | Arrow keys |
| Left tread (classic) | Q / A | U / J |
| Right tread (classic) | E / D | O / L |
| Fire | Space / F | Enter / . |
| Shield | G / Left Shift | Right Shift / / |
| Start / Join / Continue | 1 | 2 |

Press **P** or **Esc** to pause. Gamepads are supported: pad 1 is Player 1 and pad 2 is Player 2. In classic mode, the left and right sticks drive the two treads.

## Project layout

```
index.html        page shell, modals
styles.css        page theme
js/core.js        constants, RNG, settings, high-score storage
js/audio.js       Web Audio synthesized SFX, engine rumble, speech
js/input.js       keyboard / gamepad, simple + classic tread modes
js/level.js       seeded station generator (rooms, corridors, spawns)
js/render.js      map pre-rendering, sprites, HUD, title/equipment screens
js/game.js        game state machine, AI, combat, main loop
js/ui.js          settings / controls / high-score / initials modals
```

Settings and the high-score table are saved in `localStorage`.

*Fan tribute. Vindicators is a trademark of its respective owners.*
