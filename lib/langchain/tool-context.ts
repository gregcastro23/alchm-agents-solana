import { AsyncLocalStorage } from 'node:async_hooks'

export interface ToolExecutionContext {
  userId?: string
  userName?: string | null
  userEmail?: string | null
  sessionId?: string
  chartId?: string
}

const toolContextStorage = new AsyncLocalStorage<ToolExecutionContext>()

/**
 * Bind request-scoped authenticated user and session metadata into AsyncLocalStorage
 * for LangChain and AI SDK tool handlers without exposing userId in model schemas.
 */
export function runWithToolExecutionContext<T>(
  context: ToolExecutionContext,
  fn: () => Promise<T>
): Promise<T> {
  return toolContextStorage.run(context, fn)
}

export function getToolExecutionContext(): ToolExecutionContext | undefined {
  return toolContextStorage.getStore()
}
