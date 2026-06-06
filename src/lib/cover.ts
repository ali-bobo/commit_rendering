export interface CoverRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * "cover" fit: scale an image to fully cover a W×H box (preserving aspect ratio),
 * centred, cropping the overflow. Mirrors CSS `background-size: cover`.
 */
export function coverRect(
  imgW: number,
  imgH: number,
  W: number,
  H: number
): CoverRect {
  const scale = Math.max(W / imgW, H / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
}
