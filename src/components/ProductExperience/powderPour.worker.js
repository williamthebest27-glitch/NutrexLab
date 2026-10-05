import { computePour, pourTransfer } from './powderPour.js'

// versata della polvere fuori dal thread della pagina (powderPour.js)
self.onmessage = (e) => {
  const out = computePour(e.data)
  self.postMessage(out, pourTransfer(out))
}
