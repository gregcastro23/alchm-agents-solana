import { NextResponse } from 'next/server'

// Cache this endpoint for 5 minutes (300 seconds)
export const revalidate = 300

// Static catalog of available local models for the desktop app
const MODEL_CATALOG = [
  {
    id: 'phi-3-mini-4k-instruct-q4',
    tier: 'base',
    label: 'Phi-3 Mini 4K Instruct Q4',
    filename: 'Phi-3-mini-4k-instruct-q4.gguf',
    sha256: '8a83c7fb9049a9b2e92266fa7ad04933bb53aa1e85136b7b30f1b8000ff2edef',
    size: 2393231072,
    url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    source: 'microsoft/Phi-3-mini-4k-instruct-gguf',
  },
  {
    id: 'llama-3-8b-instruct-q4_k_m',
    tier: 'premium',
    label: 'Meta Llama 3 8B Instruct Q4_K_M',
    filename: 'Meta-Llama-3-8B-Instruct.Q4_K_M.gguf',
    sha256: '86c8ea6c8b755687d0b723176fcd0b2411ef80533d23e2a5030f845d13ab2db7',
    size: 4920734272,
    url: 'https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf',
    source: 'QuantFactory/Meta-Llama-3-8B-Instruct-GGUF',
  },
]

export async function GET() {
  try {
    return NextResponse.json(MODEL_CATALOG)
  } catch (error) {
    console.error('Error serving model catalog:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
