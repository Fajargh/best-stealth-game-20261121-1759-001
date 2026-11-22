// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, level-clear, caught and won screens.
//
// ?seed=N fixes the patrol wobble and gem sparkle. ?shot=cover|patrol|alert|win
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from "./config.js";
import { createRandom } from "./random.js";
import {
  createWorld, stepWorld, startLevel, advanceWorld,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_LEVEL_DONE,
  SCREEN_CAUGHT, SCREEN_WON,
} from "./world.js";
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from "./input.js";
import { createAudio } from "./audio.js";
import { makeRenderer } from "./render.js";
import { updateGuard } from "./guards.js";
import { stageShot } from "./shots.js";

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const query = new URLSearchParams(window.location.search);
const shotName = query.get("shot");
const seedText = Number.parseInt(query.get("seed") ?? "", 10);
const seed = Number.isInteger(seedText) ? seedText : Math.floor(Math.random() * 4294967296);

const board = document.getElementById("game");
const live = document.getElementById("status");
const game = createWorld(createRandom(seed));
const painter = makeRenderer(board);
const sound = createAudio();
const keys = createInput(board, (x, y) => painter.screenToWorld(x, y));

// Guard footsteps, panned by where the guard is relative to the player.
game.onStep = (guard) => {
  const pan = Math.max(-1, Math.min(1, (guard.x - game.player.x) / 360));
  sound.footstep(pan);
};

function loadBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function storeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function stageAndPaint(name) {
  const staged = stageShot(name, game);
  let drawn = 0;
  function drawOnce() {
    painter.draw(game, staged.screen, staged.best, performance.now() / 1000);
    drawn += 1;
    if (drawn < 2) requestAnimationFrame(drawOnce);
    else window.__shotReady = true;
  }
  requestAnimationFrame(drawOnce);
}

function play() {
  let view = SCREEN_TITLE;
  let top = loadBest();
  let bank = 0;
  let prev = performance.now();

  function say(message) {
    live.textContent = message;
  }

  // Sounds and speech for what just happened in the world.
  function playEvents() {
    for (const ev of game.events) {
      if (ev.type === "gem") sound.gem();
      else if (ev.type === "spotted") sound.spotted();
      else if (ev.type === "alarm") sound.alarm();
      else if (ev.type === "caught") sound.caught();
      else if (ev.type === "levelDone") sound.levelDone();
      else if (ev.type === "won") sound.won();
      else if (ev.type === "start") sound.click();
    }
    game.events.length = 0;
  }

  function followWorld() {
    if (game.state !== view) {
      view = game.state;
      if (view === SCREEN_CAUGHT) {
        say("Caught! Press Space to try again.");
        if (game.score > top) {
          top = game.score;
          storeBest(top);
        }
      } else if (view === SCREEN_LEVEL_DONE) {
        say("Level clear! Press Space for the next level.");
      } else if (view === SCREEN_WON) {
        say("You won! The ember is yours.");
        if (game.score > top) {
          top = game.score;
          storeBest(top);
        }
      }
    }
  }

  function readActions() {
    const pressed = keys.takeActions();
    if (pressed & ACTION_CONFIRM) sound.unlock();
    if (pressed & ACTION_CONFIRM && view === SCREEN_TITLE) {
      startLevel(game);
      view = SCREEN_PLAY;
      say(`Playing. ${game.level.name}.`);
    } else if (pressed & ACTION_CONFIRM && view === SCREEN_LEVEL_DONE) {
      advanceWorld(game);
      view = SCREEN_PLAY;
      say(`Playing. ${game.level.name}.`);
    } else if (pressed & ACTION_CONFIRM && view === SCREEN_CAUGHT) {
      advanceWorld(game);
      view = SCREEN_PLAY;
      say("Try again.");
    } else if (pressed & ACTION_CONFIRM && view === SCREEN_WON) {
      game.score = 0;
      game.gemsGot = 0;
      game.time = 0;
      game.levelIndex = 0;
      startLevel(game);
      view = SCREEN_PLAY;
      say(`Playing. ${game.level.name}.`);
    } else if (pressed & ACTION_PAUSE && view === SCREEN_PLAY) {
      view = SCREEN_PAUSED;
      game.state = SCREEN_PAUSED;
      say("Paused.");
    } else if (pressed & (ACTION_PAUSE | ACTION_CONFIRM) && view === SCREEN_PAUSED) {
      view = SCREEN_PLAY;
      game.state = SCREEN_PLAY;
      say("Playing.");
    }
  }

  function tick() {
    if (view === SCREEN_TITLE) {
      // The museum lives behind the title: guards walk their rounds.
      for (const guard of game.guards) updateGuard(guard, STEP, game);
      return;
    }
    if (view !== SCREEN_PLAY) return;
    const vec = keys.direction();
    const tap = keys.takeClick();
    stepWorld(game, STEP, { mx: vec.x, my: vec.y, running: keys.running(), click: tap });
    playEvents();
    followWorld();
  }

  function loop(now) {
    requestAnimationFrame(loop);
    bank += Math.min((now - prev) / 1000, MAX_FRAME);
    prev = now;
    readActions();
    while (bank >= STEP && (view === SCREEN_TITLE || view === SCREEN_PLAY)) {
      tick();
      bank -= STEP;
    }
    if (view !== SCREEN_TITLE && view !== SCREEN_PLAY) bank = 0;
    painter.draw(game, view, top, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && view === SCREEN_PLAY) {
      view = SCREEN_PAUSED;
      game.state = SCREEN_PAUSED;
      say("Paused.");
    }
  });

  say("Emberlight Heist. Press Space or click to start.");
  requestAnimationFrame(loop);
}

if (shotName) stageAndPaint(shotName);
else play();
