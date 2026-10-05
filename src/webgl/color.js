import { Color } from 'three'

const A = new Color()
const B = new Color()

/** out = colore a sfumato verso b (k 0..1), con a e b esadecimali sRGB. */
export function mixColor(out, a, b = a, k = 1) {
  return out.copy(A.set(a)).lerp(B.set(b), k)
}
