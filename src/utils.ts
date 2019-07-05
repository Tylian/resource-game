export type Matrix = number[][];
export interface Point {
  x: number;
  y: number;
}

export function lineAABB(p1: Point, p2: Point) {
  return [
    { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
    { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
  ]
}

export function lineInAABB(line: Point[], aabb: Point[]) {
  if(!aabbInAABB(lineAABB(line[0], line[1]), aabb)) {
    return false;
  }

  let corners = [
    aabb[0],
    { x: aabb[1].x, y: aabb[0].y },
    aabb[1],
    { x: aabb[0].x, y: aabb[1].y }
  ];

  if(lineInLine(line[0], line[1], corners[0], corners[1])) return true;
  if(lineInLine(line[0], line[1], corners[3], corners[4])) return true;
  if(lineInLine(line[0], line[1], corners[1], corners[3])) return true;
  if(lineInLine(line[0], line[1], corners[2], corners[4])) return true;
  return false;
}

export function lineInLine(p1: Point, p2: Point, p3: Point, p4: Point) {
  if(!aabbInAABB(lineAABB(p1, p2), lineAABB(p3, p4))) {
    return false;
  }

  let s1: Point = { x: p2.x - p1.x, y: p2.y - p1.y };
  let s2: Point = { x: p4.x - p3.x, y: p4.y - p3.y };

  const s = (-s1.y * (p1.x - p3.x) + s1.x * (p1.y - p3.y)) / (-s2.x * s1.y + s1.x * s2.y);
  const t = ( s2.x * (p1.y - p3.y) - s2.y * (p1.x - p3.x)) / (-s2.x * s1.y + s1.x * s2.y);

  return (s >= 0 && s <= 1 && t >= 0 && t <= 1)
}

export function aabbInAABB(a: Point[], b: Point[]) {
  return a[0].x <= b[1].x 
    && a[1].x >= b[0].x 
    && a[0].y <= b[1].y
    && a[1].y >= b[0].y;
}

export function circleInAABB(a: Point, b: Point, circle: Point, radius: number) {
  const deltaX = circle.x - Math.max(a.x, Math.min(circle.x, b.x));
  const deltaY = circle.y - Math.max(a.y, Math.max(circle.y, b.y));
  return (deltaX * deltaX + deltaY * deltaY) < (radius * radius);
} 

export function mmult(A: Matrix, B: Matrix): Matrix {
  if (A[0].length != B.length) {
    throw "error: incompatible sizes";
  }

  const result: Matrix = [];
  for (let i = 0; i < A.length; i++) {
      result[i] = [];
      for (let j = 0; j < B[0].length; j++) {
          var sum = 0;
          for (let k = 0; k < A[i].length; k++) {
              sum += A[i][k] * B[k][j];
          }
          result[i][j] = sum;
      }
  }
  return result; 
}