/* Geometría independiente del navegador. x = RA sin envolver; y = -Dec. */

'use strict';
const wrapRA = (value) => ((value % 360) + 360) % 360;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const boxes = new WeakMap();
function invalidate(item) {
  boxes.delete(item);
}
function bounds(item) {
  if (boxes.has(item)) return boxes.get(item);
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const point of item.points) {
    x = Math.min(x, point.x);
    y = Math.min(y, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  const box = { x, y, width: right - x, height: bottom - y };
  boxes.set(item, box);
  return box;
}
function nearRA(ra, reference) {
  return ra + 360 * Math.round((reference - ra) / 360);
}
function offsetFor(item, center) {
  const b = bounds(item);
  return 360 * Math.round((center - (b.x + b.width / 2)) / 360);
}
function move(item, dx, dy) {
  const translate = (p) => ({ ...p, x: p.x + dx, y: p.y + dy });
  return {
    ...item,
    points: item.points.map(translate),
    erasures: item.erasures?.map((cut) => ({ ...cut, points: cut.points.map(translate) })),
  };
}
function resize(item, target) {
  const b = bounds(item);
  const transform = (p) => ({
    ...p,
    x: target.x + (b.width > 1e-12 ? (p.x - b.x) / b.width : 0.5) * target.width,
    y: target.y + (b.height > 1e-12 ? (p.y - b.y) / b.height : 0.5) * target.height,
  });
  return {
    ...item,
    points: item.points.map(transform),
    erasures: item.erasures?.map((cut) => ({
      ...cut,
      // Elliptical footprints preserve the exact erased region on nonuniform resize.
      rx: (cut.rx ?? cut.radius) * (b.width > 1e-12 ? target.width / b.width : 1),
      ry: (cut.ry ?? cut.radius) * (b.height > 1e-12 ? target.height / b.height : 1),
      points: cut.points.map(transform),
    })),
  };
}
function intersectsSweep(item, a, b, radius, padding = 0) {
  const box = bounds(item),
    margin = radius + padding;
  const left = box.x - margin,
    right = box.x + box.width + margin,
    top = box.y - margin,
    bottom = box.y + box.height + margin;
  // Slab intersection: O(1), no path resampling or pixel reads.
  let low = 0,
    high = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, left, right],
    [a.y, b.y - a.y, top, bottom],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (start < min || start > max) return false;
    } else {
      const t1 = (min - start) / delta,
        t2 = (max - start) / delta;
      low = Math.max(low, Math.min(t1, t2));
      high = Math.min(high, Math.max(t1, t2));
      if (low > high) return false;
    }
  }
  return true;
}
function appendPoint(points, point, tolerance) {
  const last = points.at(-1);
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < tolerance) return false;
  if (points.length >= 2 && !point.move && !last.move) {
    const a = points.at(-2),
      dx = point.x - a.x,
      dy = point.y - a.y,
      length2 = dx * dx + dy * dy;
    const t = length2 ? ((last.x - a.x) * dx + (last.y - a.y) * dy) / length2 : -1;
    const distance = length2
      ? Math.abs(dx * (last.y - a.y) - dy * (last.x - a.x)) / Math.sqrt(length2)
      : Infinity;
    if (t >= 0 && t <= 1 && distance <= tolerance) {
      points[points.length - 1] = point;
      return true;
    }
  }
  points.push(point);
  return true;
}
function frame(center, width, height, field = 20) {
  const vertical = (field * Math.max(height, 1)) / Math.max(width, 1);
  return {
    x: center.ra - field / 2,
    y: -center.dec - vertical / 2,
    width: field,
    height: vertical,
  };
}
function screenPoint(x, y, rect, view) {
  return {
    x: view.x + clamp(x / rect.width, 0, 1) * view.width,
    y: view.y + clamp(y / rect.height, 0, 1) * view.height,
  };
}
function isSkyPoint(point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.y) <= 90;
}
class History {
  constructor(limit = 50) {
    this.items = [];
    this.past = [];
    this.future = [];
    this.limit = limit;
  }
  commit(next, previous = this.items) {
    this.past.push(previous);
    if (this.past.length > this.limit) this.past.shift();
    this.items = next;
    this.future = [];
  }
  undo() {
    if (!this.past.length) return false;
    this.future.push(this.items);
    this.items = this.past.pop();
    return true;
  }
  redo() {
    if (!this.future.length) return false;
    this.past.push(this.items);
    this.items = this.future.pop();
    return true;
  }
}
const api = {
  wrapRA,
  clamp,
  bounds,
  invalidate,
  nearRA,
  offsetFor,
  move,
  resize,
  intersectsSweep,
  appendPoint,
  frame,
  screenPoint,
  isSkyPoint,
  History,
};

export default api;
