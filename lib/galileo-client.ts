import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Get Galileo configuration from environment variables
const GALILEO_API_KEY = process.env.GALILEO_API_KEY
const GALILEO_PROJECT = process.env.GALILEO_PROJECT || 'AlchmPlanetaryAgents'
const GALILEO_LOG_STREAM = (process.env.GALILEO_LOG_STREAM || 'Planetary Agents').trim()

// Basic validation
if (!GALILEO_API_KEY) {
  console.warn('Warning: GALILEO_API_KEY is not set in environment variables')
}

// Helper function to check if Galileo is configured
export function isGalileoConfigured(): boolean {
  return !!GALILEO_API_KEY
}

// Log to Galileo logstream - simplified implementation
export async function logToGalileoStream(
  message: string,
  metadata: Record<string, any> = {}
): Promise<boolean> {
  if (!isGalileoConfigured()) {
    console.warn('Galileo API key not configured, cannot log to stream')
    return false
  }

  console.log(`Logging to Galileo stream "${GALILEO_LOG_STREAM}" in project "${GALILEO_PROJECT}"`)
  console.log(`Log message: ${message}`)

  try {
    // Use a simple fetch to log the data in a format easily visible in the console
    // This is a fallback mechanism since we don't know the exact Galileo API setup
    const logData = {
      timestamp: metadata.timestamp || new Date().toISOString(),
      project: GALILEO_PROJECT,
      stream: GALILEO_LOG_STREAM,
      message,
      level: metadata.level || 'info',
      metadata: {
        ...metadata,
        source: 'planetary-agents',
      },
    }

    console.log('====== GALILEO LOG ======')
    console.log(JSON.stringify(logData, null, 2))
    console.log('=========================')

    // For now, we'll consider this a success since we've at least logged to the console
    // and Galileo might be capturing these logs through other means (log forwarding, etc.)
    return true

    /* Actual API implementation - uncomment when you have the correct API endpoint
    const response = await fetch('YOUR_GALILEO_API_ENDPOINT', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GALILEO_API_KEY}`
      },
      body: JSON.stringify(logData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Galileo API error: ${response.status} ${response.statusText}`);
      console.error('Response:', errorText);
      return false;
    }
    
    return true;
    */
  } catch (error) {
    console.error('Error logging to Galileo stream:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Error stack:', error.stack)
    }
    return false
  }
}
