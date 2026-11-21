import { ImageResponse } from "next/og";

// iPhones ignore SVG icons for the home screen, so this draws app/icon.svg
// again as a PNG. Same shapes on a 32-unit grid, scaled up.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const u = 180 / 32;
const box = (x: number, y: number, w: number, h: number, r: number, bg: string) => (
  <div
    style={{
      position: "absolute",
      left: x * u,
      top: y * u,
      width: w * u,
      height: h * u,
      borderRadius: r * u,
      background: bg,
    }}
  />
);

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#0a0908" }}>
        {box(2, 14.75, 28, 2.5, 1.25, "#f3efe7")}
        {box(5, 6, 4.5, 20, 1.2, "#da4e58")}
        {box(10, 9, 3.5, 14, 1, "#5c93d6")}
        {box(22.5, 6, 4.5, 20, 1.2, "#da4e58")}
        {box(18.5, 9, 3.5, 14, 1, "#5c93d6")}
      </div>
    ),
    size,
  );
}
