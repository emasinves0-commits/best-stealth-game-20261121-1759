// Input: keyboard (WASD / arrows) for movement, mouse for steering and clicking.
// One clear job: turn player actions into values the world loop reads, nothing else.
"use strict";

import { WORLD } from "./config.js";

export const ACTION_NONE = 0;
export const ACTION_MOVE = 1;
export const ACTION_CONFIRM = 2;   // press Enter / click to interact with gates, keypads, crates
export const ACTION_PAUSE = 4;     // P key

export function createInput() {
  const keys = new Set();
  let action = ACTION_NONE;
  let target = null;           // mouse target position (logical units, 0..1 inside canvas)
  let mouseDown = false;

  const canvas = document.getElementById("game");

  function onKeyDown(e) {
    const k = e.key;
    if (k === "ArrowUp" || k === "w" || k === "W") keys.add("up");
    if (k === "ArrowDown" || k === "s" || k === "S") keys.add("down");
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.add("left");
    if (k === "ArrowRight" || k === "d" || k === "D") keys.add("right");
    if (k === "Enter" || k === " ") { e.preventDefault(); action = ACTION_CONFIRM; }
    if (k === "p" || k === "P") action = ACTION_PAUSE;
  }
  function onKeyUp(e) {
    const k = e.key;
    if (k === "ArrowUp" || k === "w" || k === "W") keys.delete("up");
    if (k === "ArrowDown" || k === "s" || k === "S") keys.delete("down");
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.delete("left");
    if (k === "ArrowRight" || k === "d" || k === "D") keys.delete("right");
    if (k === "Enter" || k === " ") { e.preventDefault(); action = ACTION_NONE; }
    if (k === "p" || k === "P") action = ACTION_NONE;
  }
  function onMouseMove(e) {
    if (!e.buttons) {
      const rect = canvas.getBoundingClientRect();
      target = {
        x: (e.clientX - rect.left) * WORLD.width / rect.width,
        y: (e.clientY - rect.top) * WORLD.height / rect.height,
      };
    }
  }
  function onClick(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    target = {
      x: (e.clientX - rect.left) * WORLD.width / rect.width,
      y: (e.clientY - rect.top) * WORLD.height / rect.height,
    };
    action = ACTION_CONFIRM;
    mouseDown = true;
  }
  function onMouseUp() { mouseDown = false; action = ACTION_NONE; }

  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onClick);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  return { keys, action, target, mouseDown };
}
