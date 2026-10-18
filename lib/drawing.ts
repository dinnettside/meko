import type { DrawingPart } from "./storyboard.ts";
import { DRAWING, VIDEO } from "./theme.ts";

// Where a drawing's 0 to 100 grid lies on the frame: inside the side margins, below the corner notes and the title,
// above the captions. DrawingScene draws on it, and the director places labels on it.
export function drawingCanvas(hasTitle: boolean) {
  const left = VIDEO.sideMargin;
  const right = VIDEO.width - VIDEO.sideMargin;
  const top = hasTitle ? VIDEO.topSpace + DRAWING.titleSize * 1.3 + 30 : VIDEO.topSpace;
  const bottom = VIDEO.height - VIDEO.captionSpace;
  return {
    left,
    right,
    top,
    bottom,
    X: (x: number) => left + (x / 100) * (right - left),
    Y: (y: number) => top + (y / 100) * (bottom - top),
  };
}

type Box = { left: number; top: number; right: number; bottom: number };
type Canvas = ReturnType<typeof drawingCanvas>;

// Labels may sit in the side margins too, but not at the very edge of the frame.
const EDGE = 40;
// The least space between two labels, so two never read as one.
const LABEL_SPACE = 24;

// The part's box on the frame, in pixels.
function boxOf(part: DrawingPart, canvas: Canvas): Box {
  const { X, Y } = canvas;
  switch (part.shape) {
    case "band":
      return { left: 0, right: VIDEO.width, top: Y(part.y1), bottom: Y(part.y2) };
    case "box":
    case "blob":
      return { left: X(part.x - part.w / 2), right: X(part.x + part.w / 2), top: Y(part.y - part.h / 2), bottom: Y(part.y + part.h / 2) };
    case "cone":
      return { left: X(part.x - part.w / 2), right: X(part.x + part.w / 2), top: Y(part.y - part.h), bottom: Y(part.y) };
    case "icon": {
      const half = DRAWING.iconSizes[part.size] / 2;
      return { left: X(part.x) - half, right: X(part.x) + half, top: Y(part.y) - half, bottom: Y(part.y) + half };
    }
    default: {
      const pad = part.shape === "tube" ? DRAWING.tubeWidth / 2 : 12;
      const xs = part.points.map((point) => X(point.x));
      const ys = part.points.map((point) => Y(point.y));
      return { left: Math.min(...xs) - pad, right: Math.max(...xs) + pad, top: Math.min(...ys) - pad, bottom: Math.max(...ys) + pad };
    }
  }
}

const areaOf = (box: Box) => Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
const overlapOf = (a: Box, b: Box) =>
  areaOf({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });

// How much a drawing may grow or shrink to fill the canvas, and how much of the canvas it may fill.
const FIT = { min: 0.8, max: 1.6, fill: 0.9 };

// The drawing moved to the middle of the canvas and scaled to fill most of it, keeping its shape: the model often drew
// everything small in one corner. Layers move with the parts, so a peak still stands on its layer; a layer that reaches
// the top or the bottom of the grid still does.
export function fitDrawing(parts: DrawingPart[], hasTitle: boolean): DrawingPart[] {
  const canvas = drawingCanvas(hasTitle);
  const boxes = parts.filter((part) => part.shape !== "band").map((part) => boxOf(part, canvas));
  if (boxes.length === 0) return parts;
  const box = { left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)), top: Math.min(...boxes.map((b) => b.top)), bottom: Math.max(...boxes.map((b) => b.bottom)) };
  const [width, height] = [canvas.right - canvas.left, canvas.bottom - canvas.top];
  const scale = Math.min(FIT.max, Math.max(FIT.min, Math.min((width * FIT.fill) / Math.max(1, box.right - box.left), (height * FIT.fill) / Math.max(1, box.bottom - box.top))));
  // On the grid: a place moves toward the middle and away from the drawing's own middle, a size only grows.
  const [fromX, toX] = [(((box.left + box.right) / 2 - canvas.left) / width) * 100, 50];
  const [fromY, toY] = [(((box.top + box.bottom) / 2 - canvas.top) / height) * 100, 50];
  const x = (value: number) => toX + (value - fromX) * scale;
  const y = (value: number) => toY + (value - fromY) * scale;
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const point = (p: { x: number; y: number }) => ({ x: x(p.x), y: y(p.y) });
  return parts.map((part): DrawingPart => {
    switch (part.shape) {
      case "band":
        return { ...part, y1: part.y1 <= 1 ? 0 : clamp(y(part.y1)), y2: part.y2 >= 99 ? 100 : clamp(y(part.y2)) };
      case "icon":
        return { ...part, ...point(part) };
      case "tube":
      case "arrow":
      case "flow":
        return { ...part, points: part.points.map(point) };
      default:
        return { ...part, ...point(part), w: part.w * scale, h: part.h * scale };
    }
  });
}

// The places a label of this size may go for its part, best first, as the label's center: beside the part on the
// right or the left, above or below it, and for an arrow just past its head. A layer is labeled inside, at its left
// or right end.
function placesFor(part: DrawingPart, box: Box, width: number, height: number, canvas: Canvas): [number, number][] {
  const gap = DRAWING.labelGap;
  const middleY = (Math.max(box.top, canvas.top) + Math.min(box.bottom, canvas.bottom)) / 2;
  if (part.shape === "band") return [[canvas.left + width / 2, middleY], [canvas.right - width / 2, middleY]];
  const middleX = (box.left + box.right) / 2;
  const beside: [number, number][] = [
    [box.right + gap + width / 2, (box.top + box.bottom) / 2],
    [box.left - gap - width / 2, (box.top + box.bottom) / 2],
    [middleX, box.top - gap - height / 2],
    [middleX, box.bottom + gap + height / 2],
  ];
  if (part.shape !== "arrow") return beside;
  const [end, before] = [part.points[part.points.length - 1], part.points[part.points.length - 2]];
  const [dx, dy] = [canvas.X(end.x) - canvas.X(before.x), canvas.Y(end.y) - canvas.Y(before.y)];
  const length = Math.hypot(dx, dy) || 1;
  const reach = Math.abs(dx / length) * (width / 2) + Math.abs(dy / length) * (height / 2) + gap + 20;
  return [[canvas.X(end.x) + (dx / length) * reach, canvas.Y(end.y) + (dy / length) * reach], ...beside];
}

// Puts each label beside the part it names, as the model only says which part that is: the model placed labels badly,
// in a column in the middle. A label keeps clear of the frame's edges, the captions and the labels placed before it,
// and covers as little of the other parts as it can. The result is on the 0 to 100 grid, like the parts.
export function placeLabels(parts: DrawingPart[], labels: { text: string; part: number }[], hasTitle: boolean): { text: string; x: number; y: number }[] {
  const canvas = drawingCanvas(hasTitle);
  const boxes = parts.map((part) => boxOf(part, canvas));
  const placed: Box[] = [];
  return labels.map(({ text, part: index }) => {
    const part = parts[index];
    const width = text.length * DRAWING.labelSize * 0.56 + 16;
    const height = DRAWING.labelSize * 1.3;
    const own = boxes[index];
    const places = part ? placesFor(part, own, width, height, canvas) : [[(canvas.left + canvas.right) / 2, (canvas.top + canvas.bottom) / 2] as [number, number]];
    const scored = places.map(([x, y], order) => {
      const label = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
      const labelArea = areaOf(label);
      const outside = label.left < EDGE || label.right > VIDEO.width - EDGE || label.top < canvas.top || label.bottom > canvas.bottom;
      const roomy = { left: label.left - LABEL_SPACE, right: label.right + LABEL_SPACE, top: label.top - LABEL_SPACE / 2, bottom: label.bottom + LABEL_SPACE / 2 };
      const onLabels = placed.reduce((total, other) => total + overlapOf(roomy, other), 0) / labelArea;
      // A label inside its own layer is where it belongs; inside another shape it hides that shape.
      const onParts = boxes.reduce((total, box, other) => total + (parts[other].shape === "band" ? 0 : overlapOf(label, box) * (other === index ? 3 : 1)), 0) / labelArea;
      return { x, y, label, score: (outside ? 1e6 : 0) + onLabels * 1e4 + onParts * 100 + order };
    });
    const best = scored.reduce((a, b) => (b.score < a.score ? b : a));
    // With no place inside the frame, the label goes as close to its first place as the frame allows.
    const x = Math.min(VIDEO.width - EDGE - width / 2, Math.max(EDGE + width / 2, best.x));
    const y = Math.min(canvas.bottom - height / 2, Math.max(canvas.top + height / 2, best.y));
    placed.push({ left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 });
    const round = (value: number) => Math.round(value * 10) / 10;
    return { text, x: round(((x - canvas.left) / (canvas.right - canvas.left)) * 100), y: round(((y - canvas.top) / (canvas.bottom - canvas.top)) * 100) };
  });
}
