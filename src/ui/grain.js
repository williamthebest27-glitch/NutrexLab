/** Grana della pellicola (.grain): una piccola tessera di rumore ripetuta su tutto lo schermo. */
export function makeGrain() {
  const el = document.querySelector('.grain')
  if (!el) return
  const size = 180
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const img = g.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  el.style.backgroundImage = `url(${c.toDataURL()})`
}
