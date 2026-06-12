// Simple adapter for Galileo AI that can be used with the AI SDK

// Define Galileo response types
type GalileoResponse = {
  text: string
  finish_reason: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Define our model interface
export type ModelProvider = {
  id: string
  name: string
}

export type ModelGenerateResult = {
  text: string
  finishReason: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export type GenerateTextOptions = {
  prompt: string
  system?: string
  maxTokens?: number
  temperature?: number
}

export type StreamTextOptions = GenerateTextOptions

// Galileo model implementation
export function galileo(modelId: string) {
  return {
    id: `galileo:${modelId}`,
    provider: {
      id: 'galileo',
      name: 'Galileo AI',
    },
    displayName: `Galileo ${modelId}`,

    generateText: async (options: GenerateTextOptions): Promise<ModelGenerateResult> => {
      // Ensure API key is available
      const apiKey = process.env.GALILEO_API_KEY
      if (!apiKey) {
        throw new Error('GALILEO_API_KEY is not defined')
      }

      try {
        const response = await fetch('https://api.galileo.ai/v1/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            prompt: options.prompt,
            system: options.system || undefined,
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Galileo API error (${response.status}): ${errorText}`)
        }

        const data = (await response.json()) as GalileoResponse

        return {
          text: data.text,
          finishReason: data.finish_reason,
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          },
        }
      } catch (error) {
        console.error('Error calling Galileo API:', error)
        throw error
      }
    },

    streamText: async (options: StreamTextOptions) => {
      // For simplicity, we'll implement a non-streaming version that returns the full result
      // In a production environment, you would implement proper streaming
      const result = await galileo(modelId).generateText(options)

      // Return a promise that resolves immediately with the text
      const textPromise = Promise.resolve(result.text)

      // Return a promise that resolves with the full response
      const fullResponsePromise = Promise.resolve(result)

      return {
        text: textPromise,
        fullResponse: fullResponsePromise,
      }
    },
  }
}
