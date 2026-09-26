const PASSWORD_HASH_ITERATIONS = 600_000
const encoder = new TextEncoder()

function toBase64Url(bytes) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    return null
  }
}

async function derivePasswordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const saltBuffer = new ArrayBuffer(salt.byteLength)
  new Uint8Array(saltBuffer).set(salt)
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations: PASSWORD_HASH_ITERATIONS }, key, 256))
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePasswordHash(password, salt)
  return `pbkdf2-sha256$${PASSWORD_HASH_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`
}

export async function verifyPassword(password, encodedHash) {
  const parts = encodedHash?.split('$')
  const validFormat = parts?.length === 4 && parts[0] === 'pbkdf2-sha256' && parts[1] === String(PASSWORD_HASH_ITERATIONS)
  const salt = validFormat ? fromBase64Url(parts?.[2] || '') : null
  const expected = validFormat ? fromBase64Url(parts?.[3] || '') : null
  const actual = await derivePasswordHash(password, salt?.length === 16 ? salt : new Uint8Array(16))
  if (!validFormat || !salt || salt.length !== 16 || !expected || expected.length !== actual.length) return false
  let difference = 0
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index]
  return difference === 0
}
