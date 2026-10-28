export async function* parseNdjson(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown, void, void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (line) yield JSON.parse(line)
        index = buffer.indexOf('\n')
      }
    }
    buffer += decoder.decode()
    const tail = buffer.trim()
    if (tail) yield JSON.parse(tail)
  } finally {
    reader.releaseLock()
  }
}
