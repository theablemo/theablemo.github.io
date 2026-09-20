// Regression fixture: align a measured sprite pivot to a ground point.
export function placement(frame, sourceBodyHeight, size, x, y) {
  const scale = size / sourceBodyHeight;
  return {
    x: x - frame.pivot[0] * scale,
    y: y - frame.pivot[1] * scale,
    width: frame.source[2] * scale,
    height: frame.source[3] * scale,
    scale,
  };
}
