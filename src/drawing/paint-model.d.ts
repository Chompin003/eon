export interface Point {
  x: number;
  y: number;
  move?: boolean;
}
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Cut {
  radius: number;
  rx?: number;
  ry?: number;
  points: Point[];
}
export interface Geometry {
  points: Point[];
  erasures?: Cut[];
}
interface HistoryState {
  items: Geometry[];
  past: Geometry[][];
  future: Geometry[][];
  commit(next: Geometry[], previous?: Geometry[]): void;
  undo(): boolean;
  redo(): boolean;
}
declare const model: {
  wrapRA(value: number): number;
  nearRA(value: number, reference: number): number;
  clamp(value: number, min: number, max: number): number;
  bounds(item: Geometry): Box;
  invalidate(item: Geometry): void;
  move(item: Geometry, dx: number, dy: number): Geometry;
  resize(item: Geometry, target: Box): Geometry;
  intersectsSweep(item: Geometry, a: Point, b: Point, radius: number, padding?: number): boolean;
  appendPoint(points: Point[], point: Point, tolerance: number): boolean;
  History: new (limit?: number) => HistoryState;
};
export default model;
