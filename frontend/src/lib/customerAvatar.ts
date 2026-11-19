/** Müşteri avatarı için kimlikten türetilen sabit renk tonu (0-359). */
export function avatarHue(id: number | string) {
  return (Number(id) * 67) % 360;
}
