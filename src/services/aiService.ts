import { ChatMessage, DesktopTool } from '../types/assistant';

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onToolCall?: (toolCall: { name: string; args: Record<string, unknown> }) => void;
  onError: (err: Error) => void;
  onComplete: () => void;
}

export class AiService {
  private abortController: AbortController | null = null;

  public cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async streamChat(
    apiKey: string,
    modelName: string,
    messages: ChatMessage[],
    activeTools: DesktopTool[],
    callbacks: StreamCallbacks
  ): Promise<void> {
    if (!apiKey) {
      callbacks.onError(new Error("API key is not configured. Please add your Gemini API key in Settings."));
      return;
    }

    this.cancelStream();
    this.abortController = new AbortController();

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

      // Convert conversation messages to Gemini contents format
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => {
          const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

          if (m.imageUrl) {
            // Strip data:image/...;base64,
            const match = m.imageUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2]
                }
              });
            }
          }

          if (m.content) {
            parts.push({ text: m.content });
          }

          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts
          };
        });

      // Prepare functionDeclarations for enabled desktop tools
      const functionDeclarations = activeTools
        .filter((t) => t.enabled)
        .map((t) => ({
          name: t.id,
          description: t.description,
          parameters: {
            type: 'OBJECT',
            properties: Object.keys(t.inputSchema).reduce((acc, key) => {
              acc[key] = { type: 'STRING', description: `Argument for ${key}` };
              return acc;
            }, {} as Record<string, { type: string; description: string }>),
            required: Object.keys(t.inputSchema)
          }
        }));

      const bodyPayload: Record<string, unknown> = {
        contents,
        systemInstruction: {
          parts: [
            {
              text: "You are an intelligent, concise, always-accessible AI desktop assistant on Windows. Help users with quick answers, code, desktop productivity, and troubleshooting. If the user asks you to perform an action (like open an app or search the web), use the appropriate tool function call."
            }
          ]
        }
      };

      if (functionDeclarations.length > 0) {
        bodyPayload.tools = [{ functionDeclarations }];
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API Error (${response.status}): ${errorBody || response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response stream received from Gemini API.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const candidates = parsed.candidates || [];
            if (candidates.length > 0 && candidates[0].content) {
              const parts = candidates[0].content.parts || [];
              for (const part of parts) {
                if (part.text) {
                  callbacks.onChunk(part.text);
                }
                if (part.functionCall && callbacks.onToolCall) {
                  callbacks.onToolCall({
                    name: part.functionCall.name,
                    args: part.functionCall.args || {}
                  });
                }
              }
            }
          } catch {
            // Partial chunk or parse skip
          }
        }
      }

      callbacks.onComplete();
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        callbacks.onComplete();
      } else {
        callbacks.onError(err as Error);
      }
    } finally {
      this.abortController = null;
    }
  }
}

export const aiService = new AiService();
