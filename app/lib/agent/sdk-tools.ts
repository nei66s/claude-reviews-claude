import { z } from 'zod'
import { runTool, toolDefinitions } from './tools'

/**
 * Bridges our legacy tool definitions and runTool logic to the OpenAI Agents SDK format.
 */
export function getSDKTools(context: any) {
  // Map our toolDefinitions to SDK tools
  // Note: For a real production app, we'd define these explicitly with Zod schemas.
  // For this migration bridge, we'll use a generic handler where possible.
  
  return toolDefinitions.map(def => {
    const name = def.function.name
    const description = def.function.description
    
    return {
      name,
      description,
      // The SDK allows defining tools with a run function
      run: async (args: any) => {
        const result = await runTool(name, args, context)
        // Ensure result is in a format the SDK likes (usually just the output)
        return result.ok ? result.output : { error: result.output }
      }
    }
  })
}
