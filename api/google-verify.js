/*
  GET /googlef1435490fd6eb828.html (vercel.json): il file di verifica della proprieta' del sito per Google
  Search Console, servito tale e quale. Messo come file statico, "cleanUrls" lo reindirizzerebbe
  all'indirizzo senza .html e Google non lo accetterebbe.
*/
export function GET() {
  return new Response('google-site-verification: googlef1435490fd6eb828.html', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=86400' },
  })
}
