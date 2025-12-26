import { GoogleGenerativeAI } from '@google/generative-ai'

export interface DOMOperation {
  selector: string
  action: 'replace' | 'append' | 'prepend' | 'setStyle' | 'remove'
  content?: string
  styles?: Record<string, string>
}

export interface OperationResult {
  selector: string
  success: boolean
  error?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  operationResults?: OperationResult[]
}

export interface GeminiUsage {
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
}

export interface GeminiVariation {
  title: string
  summary: string
  operations: DOMOperation[]
}

export interface GeminiDesignResponse {
  variations: GeminiVariation[]
  usage?: GeminiUsage
}

export const callGeminiDesign = async (
  apiKey: string,
  html: string,
  screenshot: string | null,
  instruction: string,
  history: ChatMessage[] = [],
  attachedImage: string | null = null,
  customSystemPrompt?: string,
  modelName: string = 'gemini-3-flash-preview'
): Promise<GeminiDesignResponse> => {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
    }
  })

  const defaultPrompt = `
You are an expert web designer and frontend developer.
Your task is to modify the provided web page based on the user's instructions.

USER INSTRUCTION: "${instruction}"

Analyze the HTML and return a JSON object containing one or more design variations.
If the instruction is creative or open-ended, provide 2-3 distinct variations with different styles or layouts.

SCHEMA:
{
  "variations": Array<{
    "title": string, // A short, catchy title for this variation (e.g., "Minimalist Dark", "Vibrant & Bold").
    "summary": string, // A concise explanation of the changes in this variation.
    "operations": Array<{
      "selector": string,
      "action": "replace" | "append" | "prepend" | "setStyle" | "remove",
      "content"?: string,
      "styles"?: Record<string, string>
    }>
  }>
}


### CRITICAL RULES:
1. **NO JAVASCRIPT**: Do NOT use 'executeScript' or generate <script> tags. Strict CSP blocks them. Focus on HTML/CSS changes.
2. **REPLACE ACTION**: "replace" updates the **innerHTML** of the target element. **Do NOT** include the target element's own tag in the "content", or you will create a nested duplicate (double-wrapping). Only provide the *children* nodes.
3. **SELECTORS**: Use standard \`document.querySelector\` selectors. NO \`:has()\`. All selectors MUST be relative to the "TARGET ELEMENT" using \`:scope\`.
4. **SPECIAL CHARACTERS**: Escape special characters in Tailwind classes (e.g., \`[\`, \`]\`, \`/\`, \`.\`) with DOUBLE BACKSLASH. Example: \`:scope .w-\\\\[50%\\\\]\`.
5. **CUMULATIVE CHANGES**: The provided HTML is the **ORIGINAL state** of the page baseline. The CONVERSATION HISTORY contains all previous steps. 
   **Your "operations" MUST be cumulative**: they should represent the final desired state of the page relative to the ORIGINAL HTML, incorporating both previous successful steps AND the current instruction.
6. **EXISTING ELEMENTS**: When styling or removing, ensure the selector targets an element that exists in the current HTML.

HTML (ORIGINAL BASELINE):
${html.substring(0, 50000)}

### CONVERSATION HISTORY & FEEDBACK:
Below is the history of this session. Each turn's goal adds to the previous ones.
Your task is to provide the TOTAL set of operations to reach the final state from the ORIGINAL BASELINE.

${history.map(m => {
    let text = `${m.role.toUpperCase()}: ${m.content}`
    if (m.operationResults && m.operationResults.some(r => !r.success)) {
      const errors = m.operationResults.filter(r => !r.success)
        .map(r => `  - Selector "${r.selector}" failed: ${r.error}`)
        .join('\n')
      text += `\nERRORS DETECTED IN PREVIOUS TURN:\n${errors}`
    }
    return text
  }).join('\n\n')}

CURRENT USER INSTRUCTION: "${instruction}"
`

  const prompt = (customSystemPrompt && customSystemPrompt.trim().length > 0)
    ? customSystemPrompt.replace('{instruction}', instruction).replace('{html}', html.substring(0, 50000))
    : defaultPrompt

  const parts: any[] = [{ text: prompt }]
  if (screenshot) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: screenshot.split(',')[1],
      },
    })
  }
  if (attachedImage) {
    parts.push({
      text: 'REFERENCE IMAGE (Use this for style/inspiration):'
    })
    parts.push({
      inlineData: {
        mimeType: attachedImage.split(';')[0].split(':')[1],
        data: attachedImage.split(',')[1],
      },
    })
  }

  try {
    const result = await model.generateContent(parts)
    const response = await result.response
    const text = response.text()

    const usage = response.usageMetadata ? {
      promptTokenCount: response.usageMetadata.promptTokenCount || 0,
      candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
      totalTokenCount: response.usageMetadata.totalTokenCount || 0,
    } : undefined

    // Try parsing the response text
    try {
      const parsed = JSON.parse(text)
      if (parsed.variations && Array.isArray(parsed.variations)) {
        return { variations: parsed.variations, usage }
      } else if (Array.isArray(parsed)) {
        return { variations: parsed, usage }
      } else {
        // Fallback for single object responses
        return {
          variations: [{
            title: parsed.title || "Generated Design",
            summary: parsed.summary || "",
            operations: parsed.operations || []
          }],
          usage
        }
      }
    } catch (e) {
      // JSON mode should prevent this, but just in case
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.variations) return { variations: parsed.variations, usage }
        return { variations: [parsed], usage }
      }
      throw new Error('Failed to parse Gemini response as JSON.')
    }
  } catch (err: any) {
    throw new Error(`Gemini API Error: ${err.message}`)
  }
}
