export interface LabelRectangle { id: number; x: number; y: number; width: number; height: number; priority: number; movable: boolean }
export interface LabelPlacement { id: number; x: number; y: number }
const intersects = (a: number[], b: number[]) => a[0]! < b[2]! && a[2]! > b[0]! && a[1]! < b[3]! && a[3]! > b[1]!;

/** Move labels only; leaders in the scene preserve the original feature identity. */
export function placeLabels(labels: readonly LabelRectangle[], width: number, height: number): LabelPlacement[] {
  const occupied: number[][] = [], placed: LabelPlacement[] = [];
  for (const label of [...labels].sort((a, b) => b.priority - a.priority || a.id - b.id)) {
    const steps = label.movable ? [[0, 0], [0, -20], [0, 20], [24, 0], [-24, 0], [0, -40], [0, 40], [48, -20], [-48, -20], [48, 20], [-48, 20], [0, -64], [0, 64]] : [[0, 0]];
    for (const [dx, dy] of steps) {
      const x = label.movable ? Math.max(label.width / 2 + 4, Math.min(width - label.width / 2 - 4, label.x + dx!)) : label.x;
      const y = label.movable ? Math.max(label.height / 2 + 4, Math.min(height - label.height / 2 - 4, label.y + dy!)) : label.y;
      const rectangle = [x - label.width / 2 - 3, y - label.height / 2 - 3, x + label.width / 2 + 3, y + label.height / 2 + 3];
      if (rectangle[0]! < 0 || rectangle[1]! < 0 || rectangle[2]! > width || rectangle[3]! > height || occupied.some(other => intersects(rectangle, other))) continue;
      occupied.push(rectangle); placed.push({ id: label.id, x, y }); break;
    }
  }
  return placed;
}
