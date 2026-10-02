/* Share links: the design compressed into the URL hash. No server. "#d=" + base64url(deflate-raw(JSON)). */
const b64url = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (str) => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
async function pipe(bytes, stream) { const r = new Blob([bytes]).stream().pipeThrough(stream); return new Uint8Array(await new Response(r).arrayBuffer()); }
export async function encodeDesign(d) {
  const json = new TextEncoder().encode(JSON.stringify(d));
  if (typeof CompressionStream !== 'undefined') return 'z' + b64url(await pipe(json, new CompressionStream('deflate-raw')));
  return 'j' + b64url(json);
}
export async function decodeDesign(code) {
  const kind = code[0], bytes = unb64url(code.slice(1));
  const raw = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}
