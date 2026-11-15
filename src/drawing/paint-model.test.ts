import { describe, expect, it } from 'vitest';
import M from './paint-model.js';

describe('lightweight annotation geometry', () => {
  it('unwraps RA across zero and preserves cuts when moving/scaling', () => {
    expect(M.nearRA(1, 359)).toBe(361);
    const item = {
      points: [
        { x: 359, y: -2 },
        { x: 361, y: 4 },
      ],
      erasures: [
        {
          radius: 0.2,
          points: [
            { x: 359, y: 0 },
            { x: 360, y: 1, move: true },
          ],
        },
      ],
    };
    const moved = M.move(item, 2, 3);
    expect(moved.erasures![0].points[0]).toEqual({ x: 361, y: 3 });
    expect(moved.erasures![0].points[1].move).toBe(true);
    expect(item.erasures[0].points[0].x).toBe(359);
    const scaled = M.resize(item, { x: 0, y: 0, width: 4, height: 18 });
    expect(scaled.erasures![0].rx).toBeCloseTo(0.4);
    expect(scaled.erasures![0].ry).toBeCloseTo(0.6);
  });
  it('detects swept segments without sampling all pixels and rejects disjoint boxes', () => {
    const item = {
      points: [
        { x: 4, y: 4 },
        { x: 6, y: 6 },
      ],
    };
    expect(M.intersectsSweep(item, { x: 0, y: 5 }, { x: 10, y: 5 }, 0.1)).toBe(true);
    expect(M.intersectsSweep(item, { x: 0, y: 10 }, { x: 10, y: 10 }, 0.1)).toBe(false);
    expect(M.bounds(item)).toBe(M.bounds(item));
  });
  it('simplifies straight strokes and limits undo without copying scientific images', () => {
    const points = [{ x: 0, y: 0 }];
    for (let x = 1; x < 10000; x++) M.appendPoint(points, { x, y: 0 }, 0.01);
    expect(points).toHaveLength(2);
    const history = new M.History(2),
      item = { points };
    history.commit([item]);
    history.commit([]);
    history.undo();
    expect(history.items[0]).toBe(item);
    history.redo();
    expect(history.items).toEqual([]);
    history.commit([item]);
    expect(history.past).toHaveLength(2);
  });
});
