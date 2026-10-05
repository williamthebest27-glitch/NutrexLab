import * as THREE from 'three'

/*
  Logo inciso a smeriglio sul bicchiere: maschera disegnata da tracciati SVG (lo stesso formato
  di src/ui/logo-paths.js del sito: viewBox, hex con fill-rule evenodd, letters, lab).
  Si legge appena, chiaro sul fondo scuro, e quando il bicchiere ruota passa davanti e dietro.
*/
export function createEtchTexture(logo, width = 1024) {
  const [, , vw, vh] = logo.viewBox.split(/[\s,]+/).map(Number)
  const pad = 8
  const scale = (width - pad * 2) / vw
  const height = Math.round(vh * scale) + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, width, height)
  g.translate(pad, pad)
  g.scale(scale, scale)
  g.fillStyle = '#fff'
  if (logo.hex) g.fill(new Path2D(logo.hex), 'evenodd')
  for (const d of [...(logo.letters ?? []), ...(logo.lab ?? []), ...(logo.paths ?? [])]) g.fill(new Path2D(d))
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return { texture: tex, aspect: width / height }
}
