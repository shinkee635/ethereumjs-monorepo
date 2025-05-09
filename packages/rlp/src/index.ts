import { EthereumJSErrorWithoutCode } from './errors.ts'

export * from './errors.ts'

export type Input = string | number | bigint | Uint8Array | Array<Input> | null | undefined

export type NestedUint8Array = Array<Uint8Array | NestedUint8Array>

export interface Decoded {
  data: Uint8Array | NestedUint8Array
  remainder: Uint8Array
}

/**
 * Parse integers. Check if there is no leading zeros
 * @param v The value to parse
 */
function decodeLength(v: Uint8Array): number {
  if (v[0] === 0) {
    throw EthereumJSErrorWithoutCode('invalid RLP: extra zeros')
  }
  return parseHexByte(bytesToHex(v))
}

function encodeLength(len: number, offset: number): Uint8Array {
  if (len < 56) {
    return Uint8Array.from([len + offset])
  }
  const hexLength = numberToHex(len)
  const lLength = hexLength.length / 2
  const firstByte = numberToHex(offset + 55 + lLength)
  return Uint8Array.from(hexToBytes(firstByte + hexLength))
}

/**
 * Slices a Uint8Array, throws if the slice goes out-of-bounds of the Uint8Array.
 * E.g. `safeSlice(hexToBytes('aa'), 1, 2)` will throw.
 * @param input
 * @param start
 * @param end
 */
function safeSlice(input: Uint8Array, start: number, end: number) {
  if (end > input.length) {
    throw EthereumJSErrorWithoutCode(
      'invalid RLP (safeSlice): end slice of Uint8Array out-of-bounds',
    )
  }
  return input.slice(start, end)
}

/** Decode an input with RLP */
function _decode(input: Uint8Array): Decoded {
  let length: number, lLength: number, data: Uint8Array, innerRemainder: Uint8Array, d: Decoded
  const decoded = []
  const firstByte = input[0]

  if (firstByte <= 0x7f) {
    // a single byte whose value is in the [0x00, 0x7f] range, that byte is its own RLP encoding.
    return {
      data: input.slice(0, 1),
      remainder: input.subarray(1),
    }
  } else if (firstByte <= 0xb7) {
    // string is 0-55 bytes long. A single byte with value 0x80 plus the length of the string followed by the string
    // The range of the first byte is [0x80, 0xb7]
    length = firstByte - 0x7f

    // set 0x80 null to 0
    if (firstByte === 0x80) {
      data = Uint8Array.from([])
    } else {
      data = safeSlice(input, 1, length)
    }

    if (length === 2 && data[0] < 0x80) {
      throw EthereumJSErrorWithoutCode(
        'invalid RLP encoding: invalid prefix, single byte < 0x80 are not prefixed',
      )
    }

    return {
      data,
      remainder: input.subarray(length),
    }
  } else if (firstByte <= 0xbf) {
    // string is greater than 55 bytes long. A single byte with the value (0xb7 plus the length of the length),
    // followed by the length, followed by the string
    lLength = firstByte - 0xb6
    if (input.length - 1 < lLength) {
      throw EthereumJSErrorWithoutCode('invalid RLP: not enough bytes for string length')
    }
    length = decodeLength(safeSlice(input, 1, lLength))
    if (length <= 55) {
      throw EthereumJSErrorWithoutCode('invalid RLP: expected string length to be greater than 55')
    }
    data = safeSlice(input, lLength, length + lLength)

    return {
      data,
      remainder: input.subarray(length + lLength),
    }
  } else if (firstByte <= 0xf7) {
    // a list between 0-55 bytes long
    length = firstByte - 0xbf
    innerRemainder = safeSlice(input, 1, length)
    while (innerRemainder.length) {
      d = _decode(innerRemainder)
      decoded.push(d.data)
      innerRemainder = d.remainder
    }

    return {
      data: decoded,
      remainder: input.subarray(length),
    }
  } else {
    // a list over 55 bytes long
    lLength = firstByte - 0xf6
    length = decodeLength(safeSlice(input, 1, lLength))
    if (length < 56) {
      throw EthereumJSErrorWithoutCode('invalid RLP: encoded list too short')
    }
    const totalLength = lLength + length
    if (totalLength > input.length) {
      throw EthereumJSErrorWithoutCode('invalid RLP: total length is larger than the data')
    }

    innerRemainder = safeSlice(input, lLength, totalLength)

    while (innerRemainder.length) {
      d = _decode(innerRemainder)
      decoded.push(d.data)
      innerRemainder = d.remainder
    }

    return {
      data: decoded,
      remainder: input.subarray(totalLength),
    }
  }
}

const cachedHexes = Array.from({ length: 256 }, (_v, i) => i.toString(16).padStart(2, '0'))
function bytesToHex(uint8a: Uint8Array): string {
  // Pre-caching chars with `cachedHexes` speeds this up 6x
  let hex = ''
  for (let i = 0; i < uint8a.length; i++) {
    hex += cachedHexes[uint8a[i]]
  }
  return hex
}

function parseHexByte(hexByte: string): number {
  const byte = Number.parseInt(hexByte, 16)
  if (Number.isNaN(byte)) throw EthereumJSErrorWithoutCode('Invalid byte sequence')
  return byte
}

// Borrowed from @noble/curves to avoid dependency
// Original code here - https://github.com/paulmillr/noble-curves/blob/d0a8d2134c5737d9d0aa81be13581cd416ebdeb4/src/abstract/utils.ts#L63-L91
const asciis = { _0: 48, _9: 57, _A: 65, _F: 70, _a: 97, _f: 102 } as const
function asciiToBase16(char: number): number | undefined {
  if (char >= asciis._0 && char <= asciis._9) return char - asciis._0
  if (char >= asciis._A && char <= asciis._F) return char - (asciis._A - 10)
  if (char >= asciis._a && char <= asciis._f) return char - (asciis._a - 10)
  return
}

/**
 * @example hexToBytes('0xcafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.slice(0, 2) === '0x') hex = hex.slice(0, 2)
  if (typeof hex !== 'string')
    throw EthereumJSErrorWithoutCode('hex string expected, got ' + typeof hex)
  const hl = hex.length
  const al = hl / 2
  if (hl % 2)
    throw EthereumJSErrorWithoutCode('padded hex string expected, got unpadded hex of length ' + hl)
  const array = new Uint8Array(al)
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi))
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1))
    if (n1 === undefined || n2 === undefined) {
      const char = hex[hi] + hex[hi + 1]
      throw EthereumJSErrorWithoutCode(
        'hex string expected, got non-hex character "' + char + '" at index ' + hi,
      )
    }
    array[ai] = n1 * 16 + n2
  }
  return array
}

/** Concatenates two Uint8Arrays into one. */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  if (arrays.length === 1) return arrays[0]
  const length = arrays.reduce((a, arr) => a + arr.length, 0)
  const result = new Uint8Array(length)
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const arr = arrays[i]
    result.set(arr, pad)
    pad += arr.length
  }
  return result
}

// Global symbols in both browsers and Node.js since v11
// See https://github.com/microsoft/TypeScript/issues/31535
declare const TextEncoder: any

function utf8ToBytes(utf: string): Uint8Array {
  return new TextEncoder().encode(utf)
}

/** Transform an integer into its hexadecimal value */
function numberToHex(integer: number | bigint): string {
  if (integer < 0) {
    throw EthereumJSErrorWithoutCode('Invalid integer as argument, must be unsigned!')
  }
  const hex = integer.toString(16)
  return hex.length % 2 ? `0${hex}` : hex
}

/** Pad a string to be even */
function padToEven(a: string): string {
  return a.length % 2 ? `0${a}` : a
}

/** Check if a string is prefixed by 0x */
function isHexString(str: string): boolean {
  return str.length >= 2 && str[0] === '0' && str[1] === 'x'
}

/** Removes 0x from a given String */
function stripHexPrefix(str: string): string {
  if (typeof str !== 'string') {
    return str
  }
  return isHexString(str) ? str.slice(2) : str
}

/** Transform anything into a Uint8Array */
function toBytes(v: Input): Uint8Array {
  if (v instanceof Uint8Array) {
    return v
  }
  if (typeof v === 'string') {
    if (isHexString(v)) {
      return hexToBytes(padToEven(stripHexPrefix(v)))
    }
    return utf8ToBytes(v)
  }
  if (typeof v === 'number' || typeof v === 'bigint') {
    if (!v) {
      return Uint8Array.from([])
    }
    return hexToBytes(numberToHex(v))
  }
  if (v === null || v === undefined) {
    return Uint8Array.from([])
  }
  throw EthereumJSErrorWithoutCode('toBytes: received unsupported type ' + typeof v)
}

/**
 * RLP Encoding based on https://ethereum.org/en/developers/docs/data-structures-and-encoding/rlp/
 * This function takes in data, converts it to Uint8Array if not,
 * and adds a length for recursion.
 * @param input Will be converted to Uint8Array
 * @returns Uint8Array of encoded data
 **/
export function encode(input: Input): Uint8Array {
  if (Array.isArray(input)) {
    const output: Uint8Array[] = []
    let outputLength = 0
    for (let i = 0; i < input.length; i++) {
      const encoded = encode(input[i])
      output.push(encoded)
      outputLength += encoded.length
    }
    return concatBytes(encodeLength(outputLength, 192), ...output)
  }
  const inputBuf = toBytes(input)
  if (inputBuf.length === 1 && inputBuf[0] < 128) {
    return inputBuf
  }
  return concatBytes(encodeLength(inputBuf.length, 128), inputBuf)
}

/**
 * RLP Decoding based on https://ethereum.org/en/developers/docs/data-structures-and-encoding/rlp/
 * @param input Will be converted to Uint8Array
 * @param stream Is the input a stream (false by default)
 * @returns decoded Array of Uint8Arrays containing the original message
 **/
export function decode(input: Input, stream?: false): Uint8Array | NestedUint8Array
export function decode(input: Input, stream?: true): Decoded
export function decode(input: Input, stream = false): Uint8Array | NestedUint8Array | Decoded {
  if (typeof input === 'undefined' || input === null || (input as any).length === 0) {
    return Uint8Array.from([])
  }

  const inputBytes = toBytes(input)
  const decoded = _decode(inputBytes)

  if (stream) {
    return {
      data: decoded.data,
      remainder: decoded.remainder.slice(),
    }
  }
  if (decoded.remainder.length !== 0) {
    throw EthereumJSErrorWithoutCode('invalid RLP: remainder must be zero')
  }

  return decoded.data
}

export const utils = {
  bytesToHex,
  concatBytes,
  hexToBytes,
  utf8ToBytes,
}

export const RLP = { encode, decode }
