#!/usr/bin/env python3
"""Fix-3 verification + screenshot re-capture for The Last Light
(best-stealth-game-20261121-1759).

- Asserts window.__GAME.hudKeheningan matches  ^\d+(\.\d)? \/ 3$
- Captures 01-cover.png (Level 1 gameplay + HUD)  -- overwritten
- Plays through levels 1->2->3 to the MENANG screen and captures 04-end.png -- overwritten
- 02-play.png and 03-play.png are NOT touched (already correct).
"""
import os
import sys
import time
import math

# venv playwright
sys.path.insert(0, "/home/hatch/workspace/venv-playwright/lib/python3.12/site-packages")

from playwright.sync_api import sync_playwright

REPO = "/home/hatch/workspace/makefun/best-stealth-game-20261121-1759"
OUT = os.path.join(REPO, "screenshots")
PORT = 8091
URL = "http://127.0.0.1:%d/game/index.html" % PORT

REGEX = r"^\d+(\.\d)? \/ 3$"

console_msgs = []
screenshot_count = [0]


def log(msg):
    print("[fix3] " + msg)


def dom_key(key, down):
    """Dispatch a key event on the canvas (bubbles to window where main.js listens)."""
    pg.evaluate(
        "(function(args){"
        "var t = document.getElementById('game');"
        "var type = args[1] ? 'keydown' : 'keyup';"
        "t.dispatchEvent(new KeyboardEvent(type, {key: %s, code: %s, bubbles: true, cancelable: true}));"
        "})([%s, %s])"
        % (repr(key), repr(key), repr(key), "true" if down else "false")
    )


def game_state():
    return pg.evaluate(
        """() => {
            const g = window.__GAME;
            if (!g) return null;
            const l = g.level;
            const def = g.levels ? g.levels[g.levelIndex] : null;
            const pl = l ? l.player : null;
            return {
                screen: g.screen,
                levelId: l ? l.id : null,
                levelName: def ? def.name : null,
                codeEntered: g.level ? g.level.codeEntered : null,
                codeDigits: g.state ? g.state.codeDigits : null,
                still: g.still,
                playerX: pl ? pl.x : null,
                playerY: pl ? pl.y : null,
            };
        }"""
    )


def nav_to(exit_xy, tol=22, max_iters=80):
    """Drive the player toward exit_xy, one axis at a time, re-checking after each
    axis press. Returns the game state after reaching (or nearly reaching) the exit."""
    for i in range(max_iters):
        g = game_state()
        p = {"x": g.get("playerX"), "y": g.get("playerY")} if g else None
        if not p or p["x"] is None:
            time.sleep(0.2)
            continue
        d = math.hypot(p["x"] - exit_xy[0], p["y"] - exit_xy[1])
        if d < tol:
            return g
        mx = 1 if exit_xy[0] > p["x"] else (-1 if exit_xy[0] < p["x"] else 0)
        my = 1 if exit_xy[1] > p["y"] else (-1 if exit_xy[1] < p["y"] else 0)
        log("  nav iter %d: player=(%.1f,%.1f) dist=%.1f to (%d,%d)" % (i, p["x"], p["y"], d, exit_xy[0], exit_xy[1]))
        # press each required axis for 0.12 s, re-checking the distance after each
        if mx:
            dom_key("ArrowRight" if mx > 0 else "ArrowLeft", True)
            time.sleep(0.12)
            dom_key("ArrowRight" if mx > 0 else "ArrowLeft", False)
            g2 = game_state()
            p2 = {"x": g2.get("playerX"), "y": g2.get("playerY")} if g2 else None
            if p2 and math.hypot(p2["x"] - exit_xy[0], p2["y"] - exit_xy[1]) < tol:
                return g2
        if my:
            dom_key("ArrowDown" if my > 0 else "ArrowUp", True)
            time.sleep(0.12)
            dom_key("ArrowDown" if my > 0 else "ArrowUp", False)
            g2 = game_state()
            p2 = {"x": g2.get("playerX"), "y": g2.get("playerY")} if g2 else None
            if p2 and math.hypot(p2["x"] - exit_xy[0], p2["y"] - exit_xy[1]) < tol:
                return g2
    g = game_state()
    log("  nav: max iters reached, final player=(%.1f,%.1f) dist=%.1f" % (
        g.get("playerX"), g.get("playerY"),
        math.hypot(g.get("playerX") or 0 - exit_xy[0], g.get("playerY") or 0 - exit_xy[1])))
    return g


def wait_state(expect, timeout=12.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        g = game_state()
        ok = True
        for k, v in expect.items():
            if g.get(k) != v:
                ok = False
                break
        if ok:
            return g
        time.sleep(0.12)
    raise RuntimeError("timeout waiting for state " + repr(expect) + " game=" + repr(game_state()))


def screenshot(name, expect):
    pg.screenshot(path=os.path.join(OUT, name), clip={"x": 0, "y": 0, "width": 1280, "height": 720})
    time.sleep(0.3)
    g = game_state()
    ok = (g.get("levelId") == expect.get("levelId")
          and g.get("screen") == expect.get("screen")
          and g.get("levelName") == expect.get("levelName"))
    log("captured %s (expect %s) -> state %s %s" % (name, expect, g, "OK" if ok else "MISMATCH"))
    return g


def main():
    global pg
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.on("console", lambda m: console_msgs.append("%s: %s" % (m.type, m.text)))
        pg.on("pageerror", lambda e: console_msgs.append("pageerror: %s" % str(e)))
        # fresh game: level 1, player at spawn (140,430)
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_function("() => !!window.__GAME", timeout=10000)
        pg.wait_for_function(
            """() => { const g = window.__GAME; return g && g.screen === 'play' && g.level && g.level.id === 1; }""",
            timeout=10000,
        )
        log("booted level 1 play, waiting for render")
        time.sleep(0.8)

        # ---------- 1) cover: Level 1 gameplay + HUD ----------
        g = game_state()
        log("cover state: " + repr(g))
        pg.screenshot(path=os.path.join(OUT, "01-cover.png"), clip={"x": 0, "y": 0, "width": 1280, "height": 720})
        time.sleep(0.4)

        # format assert (no eyes: Playwright assertion on the exposed string)
        matches = pg.evaluate("""() => {
            const s = window.__GAME.hudKeheningan;
            return typeof s === 'string' && /^(\\d+(\\.\\d)?) \\/ 3$/.test(s);
        }""")
        log("window.__GAME.hudKeheningan = %r  regex-assert=%s" % (g.get("still"), matches))
        if not matches:
            log("FAIL: hudKeheningan does not match regex")
            sys.exit(1)

        # ---------- 2) level 1 -> level 2 ----------
        g = nav_to((40, 460), tol=22, max_iters=12)
        log("level1 nav state: " + repr(g))
        if g.get("screen") != "play" or g.get("levelId") != 2:
            log("player pos: " + repr(g))
            raise RuntimeError("level 1 playtest did not finish: " + repr(g))
        wait_state({"levelId": 2, "screen": "play", "levelName": "ruang-penjaga"}, timeout=8.0)

        # ---------- 3) level 2 keypad [3,7,2] ----------
        for k in ["3", "7", "2", "Enter"]:
            dom_key(k, True)
            time.sleep(0.08)
            dom_key(k, False)
        wait_state({"levelId": 2, "screen": "play", "levelName": "ruang-penjaga", "codeEntered": True}, timeout=8.0)
        log("level 2 code entered OK")

        # ---------- 4) level 2 -> level 3 ----------
        g = nav_to((520, 60), tol=25, max_iters=20)
        log("level2->3 nav state: " + repr(g))
        wait_state({"levelId": 3, "screen": "play", "levelName": "ruang-lampu"}, timeout=10.0)

        # ---------- 5) level 3 -> MENANG ----------
        g = nav_to((470, 20), tol=25, max_iters=20)
        log("level3 nav state: " + repr(g))
        wait_state({"screen": "menang"}, timeout=10.0)
        log("win state: " + repr(game_state()))

        # ---------- 6) end screenshot ----------
        screenshot("04-end.png", {"levelId": None, "screen": "menang", "levelName": "menang"})

        b.close()

    log("console messages: " + (repr(console_msgs) if console_msgs else "NONE"))
    log("screenshots dir: " + repr(sorted(os.listdir(OUT))))
    log("DONE")


if __name__ == "__main__":
    main()
