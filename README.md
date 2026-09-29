# Vindicators — Arcade Tribute

A browser remake of Atari Games' 1988 twin-tank arcade game **Vindicators**, written in plain HTML5 Canvas + JavaScript with no build step and no dependencies.

Drive your SR-88 battle tank through 14 Tangent Empire space stations. Blast gun turrets, enemy tanks and tank factories, grab fuel and battle stars, destroy each station's control center, and escape before it explodes.

## Running

You need [Node.js](https://nodejs.org) 18 or newer. There are no dependencies to install.

```
npm start              # serves the game at http://localhost:8080
PORT=3000 npm start    # use a different port
npm test               # syntax-check the scripts and validate all 84 levels
```

You can also open `index.html` directly, or serve the folder with any static server, for example `python -m http.server`.

## What's faithful to the original

- **Fuel is life.** It drains over time, and every enemy hit burns more. When it runs out, press your start button to continue (free play).
- **Battle stars** are the currency. After each station, the **Equipment Room** sells Speed, Shot Speed, Shot Range, Shot Power, Shields, a bigger Fuel Tank, and Refuel.
- **Tread controls.** Classic mode maps each tank tread to its own stick or key pair, just like the cabinet's twin joysticks.
- **Limited shields** block all damage while held and recharge slowly.
- **Stations have 3 levels.** The top level holds the control center. Destroy it and the exit unlocks, then a 30-second escape countdown starts.
- **Two players** share one screen at the same time and can join or continue at any time.
- The oblique 3/4 view has raised metal walls, and digitized-style voice callouts are provided by the browser's speech synthesis.

## Display

The game fills the browser window. Gameplay uses the arcade's 384-line-tall logical screen, and the view widens from 4:3 up to 2:1 to match your window. Everything is drawn at your display's real pixel density, so it stays sharp at any size. The map is rendered in cached 8×8-tile chunks to keep memory use modest. Use **Fullscreen** for the biggest picture.

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Drive (simple) | W A S D | Arrow keys |
| Left tread (classic) | Q / A | U / J |
| Right tread (classic) | E / D | O / L |
| Fire | Space / F | Enter / . |
| Shield | G / Left Shift | Right Shift / / |
| Start / Join / Continue | 1 | 2 |

When Player 1 is playing alone, the arrow keys also drive Player 1. Once Player 2 joins, the arrows go back to Player 2.

Press **P** or **Esc** to pause. Gamepads are supported: pad 1 is Player 1 and pad 2 is Player 2. In classic mode, the left and right sticks drive the two treads.

## Project layout

```
package.json      npm scripts (start / check / test)
scripts/          zero-dependency dev server, syntax check, level validator
index.html        page shell, modals
styles.css        page theme
js/core.js        constants, RNG, settings, high-score storage
js/audio.js       Web Audio synthesized SFX, engine rumble, speech
js/input.js       keyboard / gamepad, simple + classic tread modes
js/level.js       seeded station generator (rooms, corridors, spawns)
js/render.js      chunked high-res map renderer, sprites, HUD, title/equipment screens
js/game.js        game state machine, AI, combat, main loop
js/ui.js          settings / controls / high-score / initials modals
```

Settings and the high-score table are saved in `localStorage`.

## Credits

- **Original game:** *Vindicators* © 1988 Atari Games Corporation, which ran on the Atari System 2 arcade hardware and was followed by *Vindicators Part II*. The gameplay, the SR-88 tanks, the Tangent Empire story and the Equipment Room concept all come from that game. This project is an unofficial fan tribute. It has no affiliation with, and no endorsement from, the rights holders, and it contains no original code, graphics or sound.
- **Remake:** Roberto Renz ([@robertorenz](https://github.com/robertorenz)), built with the help of [Claude Code](https://claude.com/claude-code) by Anthropic.
- **Fonts:** [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38, and [Inter](https://rsms.me/inter/) by Rasmus Andersson. Both are served by Google Fonts under the SIL Open Font License 1.1.
- **Everything else:** all graphics are drawn in code on an HTML5 Canvas, all sound effects are synthesized live with the Web Audio API, and voice callouts use the browser's built-in speech synthesis. There are no external image or audio assets.

*Vindicators is a trademark of its respective owners. This fan project is non-commercial.*
