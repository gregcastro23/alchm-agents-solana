/**
 * Helper to parse Server-Sent Events (SSE) stream responses in integration tests.
 */
export async function parseStreamResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return response.json()
  }

  const reader = response.body?.getReader()
  if (!reader) {
    return response.json()
  }

  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
  }

  const events = buffer.split('\n\n')
  for (const event of events) {
    if (event.includes('event: done')) {
      const dataLine = event.split('\n').find(line => line.startsWith('data: '))
      if (dataLine) {
        return JSON.parse(dataLine.substring(6))
      }
    }
    if (event.includes('event: error')) {
      const dataLine = event.split('\n').find(line => line.startsWith('data: '))
      if (dataLine) {
        const errorObj = JSON.parse(dataLine.substring(6))
        return {
          error: 'Failed to process multi-agent conversation',
          details: errorObj.error,
        }
      }
    }
  }

  throw new Error('No done event found in stream response')
}
