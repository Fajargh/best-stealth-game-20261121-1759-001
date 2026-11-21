// Everything the player sees: the moonlit floor, walls and cover, the guards
// and their vision cones, the firefly thief, the HUD, and the title, pause,
// caught and win screens. All drawing is canvas 2D, no images.
import {
  TILE, COLS, ROWS, VIEW_W, VIEW_H, GUARD_RANGE, GUARD_FOV, COLORS,
} from './config.js';
import { tileAt } from './levels.js';
import { rayDistance } from './physics.js';
import { STATE_CHASE, STATE_CURIOUS, STATE_SEARCH } from './guards.js';
import {
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_LEVEL_DONE, SCREEN_CAUGHT, SCREEN_WON,
} from './world.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** A stable pseudo-random shade per tile, so the floor never looks flat. */
function tileShade(col, row) {
  const h = ((col * 73856093) ^ (row * 19349663)) >>> 0;
  return (h % 100) / 100;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(w / VIEW_W, h / VIEW_H) * dpr;
    offsetX = (canvas.width - VIEW_W * scale) / 2;
    offsetY = (canvas.height - VIEW_H * scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  /** Convert a point in CSS pixels (from a mouse event) to world pixels. */
  function screenToWorld(cssX, cssY) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const x = (cssX * dpr - offsetX) / scale;
    const y = (cssY * dpr - offsetY) / scale;
    if (x < 0 || y < 0 || x > VIEW_W || y > VIEW_H) return null;
    return { x, y };
  }

  function drawFloor(state) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const ch = tileAt(state.level, col, row);
        const x = col * TILE;
        const y = row * TILE;
        const shade = tileShade(col, row);
        if (ch === '#') {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(x, y, TILE, 6);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y + TILE - 5, TILE, 5);
        } else {
          ctx.fillStyle = shade > 0.5 ? COLORS.floorA : COLORS.floorB;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = COLORS.floorEdge;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }
      }
    }
    // Lamp pools: warm light that shows what is safe and what is not.
    for (const [col, row] of state.level.lamps) {
      const x = col * TILE + TILE / 2;
      const y = row * TILE + TILE / 2;
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 110);
      glow.addColorStop(0, COLORS.lampGlow);
      glow.addColorStop(1, 'rgba(255,196,90,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 110, y - 110, 220, 220);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawExit(state, time) {
    const { x, y } = state.exit;
    const pulse = 0.6 + Math.sin(time * 3) * 0.25;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 70);
    glow.addColorStop(0, `rgba(57,217,138,${0.35 * pulse})`);
    glow.addColorStop(1, 'rgba(57,217,138,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 70, y - 70, 140, 140);
    ctx.fillStyle = COLORS.exitGlow;
    roundRect(ctx, x - 16, y - 18, 32, 36, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.exit;
    roundRect(ctx, x - 12, y - 14, 24, 28, 4);
    ctx.fill();
    ctx.fillStyle = '#062b1a';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', x, y + 26);
  }

  function drawGems(state, time) {
    for (const gem of state.gems) {
      if (gem.taken) continue;
      const bob = Math.sin(time * 2.4 + gem.phase) * 3;
      const size = 9 + Math.sin(time * 3 + gem.phase) * 1.5;
      const glow = ctx.createRadialGradient(gem.x, gem.y + bob, 1, gem.x, gem.y + bob, 26);
      glow.addColorStop(0, 'rgba(255,211,77,0.5)');
      glow.addColorStop(1, 'rgba(255,211,77,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(gem.x - 26, gem.y + bob - 26, 52, 52);
      ctx.save();
      ctx.translate(gem.x, gem.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = COLORS.gem;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(-size / 4, -size / 4, size / 2, size / 2);
      ctx.restore();
    }
  }

  function drawCover(state) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const ch = tileAt(state.level, col, row);
        const x = col * TILE;
        const y = row * TILE;
        if (ch === 'C') {
          ctx.fillStyle = COLORS.crate;
          roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 4);
          ctx.fill();
          ctx.strokeStyle = COLORS.crateEdge;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
        } else if (ch === 'B') {
          ctx.fillStyle = COLORS.bushDark;
          roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 8);
          ctx.fill();
          ctx.fillStyle = COLORS.bush;
          for (let i = 0; i < 5; i += 1) {
            const lx = x + 8 + ((i * 7 + tileShade(col, row) * 20) % 26);
            const ly = y + 9 + ((i * 11 + tileShade(row, col) * 18) % 24);
            ctx.beginPath();
            ctx.arc(lx, ly, 7, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = COLORS.bushLeaf;
          ctx.beginPath();
          ctx.arc(x + 13, y + 14, 5, 0, Math.PI * 2);
          ctx.arc(x + 26, y + 24, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawCone(guard, level) {
    const rays = 26;
    const chasing = guard.state === STATE_CHASE;
    const curious = guard.state === STATE_CURIOUS || guard.state === STATE_SEARCH;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let i = 0; i <= rays; i += 1) {
      const angle = guard.angle - GUARD_FOV / 2 + (GUARD_FOV * i) / rays;
      const dist = rayDistance(level, guard.x, guard.y, angle, GUARD_RANGE);
      ctx.lineTo(guard.x + Math.cos(angle) * dist, guard.y + Math.sin(angle) * dist);
    }
    ctx.closePath();
    ctx.fillStyle = chasing ? COLORS.coneAlert : COLORS.cone;
    ctx.fill();
    ctx.strokeStyle = curious ? 'rgba(255,201,61,0.5)' : COLORS.coneEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawGuard(guard) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(guard.x, guard.y + 12, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 1, 11, 0, Math.PI * 2);
    ctx.fill();
    // Visor and the direction the guard is looking.
    const nx = guard.x + Math.cos(guard.angle) * 8;
    const ny = guard.y + Math.sin(guard.angle) * 8;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(nx, ny, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a1f18';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, guard.y + Math.sin(guard.angle) * 18);
    ctx.stroke();
    if (guard.state === STATE_CHASE) {
      drawMark(guard.x, guard.y - 26, '!', COLORS.danger);
    } else if (guard.state === STATE_CURIOUS || guard.state === STATE_SEARCH) {
      drawMark(guard.x, guard.y - 26, '?', COLORS.warn);
    }
  }

  function drawMark(x, y, text, color) {
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawPlayer(state, time) {
    const player = state.player;
    const glow = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 34);
    glow.addColorStop(0, 'rgba(126,243,255,0.55)');
    glow.addColorStop(1, 'rgba(126,243,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(player.x - 34, player.y - 34, 68, 68);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 11, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Firefly wings, fluttering.
    const flutter = Math.sin(time * 18) * 3;
    ctx.fillStyle = 'rgba(220,250,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(player.x - 9, player.y - 6 + flutter, 7, 3.5, -0.5, 0, Math.PI * 2);
    ctx.ellipse(player.x + 9, player.y - 6 - flutter, 7, 3.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerDark;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#083344';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (player.inBush) {
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.ok;
      ctx.fillText('HIDDEN', player.x, player.y - 24);
    }
  }

  function drawNoiseRings(state) {
    for (const ring of state.noiseRings) {
      const radius = 12 + ring.t * 90;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ring.t / 0.9)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function drawHud(state, best, screen) {
    ctx.fillStyle = COLORS.hudBack;
    ctx.fillRect(0, 0, VIEW_W, 34);
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Level ${state.levelIndex + 1} — ${state.level.name}`, 10, 18);
    const gemsGot = state.gems.filter((g) => g.taken).length;
    ctx.fillStyle = COLORS.gem;
    ctx.fillText(`◆ ${gemsGot}/${state.gems.length}`, 330, 18);
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`Score ${state.score}`, 430, 18);
    ctx.fillText(`⏱ ${formatTime(state.levelTime)}`, 530, 18);
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`Best ${best}`, 615, 18);
    // The alarm meter: an eye and a bar that fills as the guards notice you.
    const meterX = 700;
    const meterW = 120;
    ctx.fillStyle = state.meter >= 100 ? COLORS.danger : state.meter >= 35 ? COLORS.warn : COLORS.ok;
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText('👁', meterX - 22, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, meterX, 10, meterW, 14, 7);
    ctx.fill();
    ctx.fillStyle = state.meter >= 100 ? COLORS.danger : state.meter >= 35 ? COLORS.warn : COLORS.ok;
    if (state.meter > 1) {
      roundRect(ctx, meterX, 10, (meterW * state.meter) / 100, 14, 7);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 12px ${FONT}`;
    const label = state.meter >= 100 ? 'SPOTTED!' : state.meter >= 35 ? 'SUSPICIOUS' : 'UNSEEN';
    ctx.fillText(label, meterX + meterW + 10, 18);
    if (state.messageT > 0 && state.message && screen === SCREEN_PLAY) {
      ctx.globalAlpha = Math.min(1, state.messageT);
      ctx.font = `14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(state.message, VIEW_W / 2, 52);
      ctx.globalAlpha = 1;
    }
    if (state.meter >= 100) {
      ctx.fillStyle = COLORS.danger;
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('⚠ ALARM — BREAK LINE OF SIGHT! ⚠', VIEW_W / 2, 78);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 90);
    ctx.fillStyle = COLORS.text;
    ctx.font = `17px ${FONT}`;
    let y = VIEW_H / 2 - 40;
    for (const line of lines) {
      ctx.fillText(line, VIEW_W / 2, y);
      y += 28;
    }
  }

  function drawScreen(state, screen, best, time) {
    if (screen === SCREEN_TITLE) {
      overlay('EMBERLIGHT HEIST', [
        'Pip the firefly thief is in the Ember Museum after dark.',
        'Slip past the night watch, pocket the embers, reach the green door.',
        '',
        'Move: WASD / arrows — or click where to sneak.  Run: Shift (loud!).',
        'Hedges hide you. Crates block sight. A guard’s cone fills the alarm.',
        `Best score: ${best}   ·   3 levels, ${state.level.guards.length} guards on this one.`,
        '',
        'Press SPACE or click to start',
      ], '#ffd34d');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or Space to keep sneaking.'], COLORS.textDim);
    } else if (screen === SCREEN_LEVEL_DONE) {
      overlay('LEVEL CLEAR!', [
        `${state.level.name} — the door is behind you.`,
        `Score ${state.score}   ·   Gems ${state.gems.filter((g) => g.taken).length}/${state.gems.length}`,
        '',
        'Press SPACE for the next level',
      ], COLORS.ok);
    } else if (screen === SCREEN_CAUGHT) {
      overlay('CAUGHT!', [
        'A guard got a hand on Pip. The museum keeps its embers… this time.',
        `Score ${state.score}   ·   Level ${state.levelIndex + 1}: ${state.level.name}`,
        '',
        'Press SPACE to try the level again',
      ], COLORS.danger);
    } else if (screen === SCREEN_WON) {
      overlay('THE EMBER IS YOURS!', [
        'All three levels, every guard outwitted. Pip vanishes into the night.',
        `Final score ${state.score}   ·   Time ${formatTime(state.time)}   ·   Gems ${state.gemsGot}`,
        `Best score: ${Math.max(best, state.score)}`,
        '',
        'Press SPACE to play again',
      ], COLORS.gem);
    }
    void time;
  }

  return {
    screenToWorld,
    draw(state, screen, best, time) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      drawFloor(state);
      drawExit(state, time);
      drawGems(state, time);
      drawCover(state);
      for (const guard of state.guards) drawCone(guard, state.level);
      for (const guard of state.guards) drawGuard(guard);
      drawNoiseRings(state);
      drawPlayer(state, time);
      drawHud(state, best, screen);
      // A red edge creeps in as the alarm fills — the near miss you can feel.
      if (state.meter > 35) {
        const alpha = ((state.meter - 35) / 65) * 0.35;
        ctx.strokeStyle = `rgba(255,60,40,${alpha})`;
        ctx.lineWidth = 18;
        ctx.strokeRect(9, 9, VIEW_W - 18, VIEW_H - 18);
      }
      drawScreen(state, screen, best, time);
    },
  };
}
