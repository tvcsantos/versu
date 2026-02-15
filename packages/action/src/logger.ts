import * as core from "@actions/core";
import type { Logger } from "@versu/core";

function formatElement(element: unknown): string {
  if (typeof element === "object" && element !== null) {
    return JSON.stringify(element);
  }
  return String(element);
}

function formatMessage(
  message: string | Error,
  context?: Record<string, unknown>,
): string {
  const result = message instanceof Error ? message.toString() : message;
  
  if (!context || Object.keys(context).length === 0) {
    return result;
  }

  const entries = Object.entries(context);
  
  // Check if we have any arrays
  const hasArrays = entries.some(([_, value]) => Array.isArray(value) && value.length > 0);
  
  // If we have arrays, always use multi-line format
  if (hasArrays) {
    const lines: string[] = [];
    
    for (const [key, value] of entries) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`  ${key}: none`);
        } else {
          lines.push(`  ${key}:`);
          value.forEach(item => {
            const itemStr = formatElement(item);
            lines.push(`    - ${itemStr}`);
          });
        }
      } else {
        const valueStr = formatElement(value);
        lines.push(`  ${key}: ${valueStr}`);
      }
    }
    
    return `${result}\n${lines.join("\n")}`;
  }
  
  // Calculate inline length for non-array entries
  const totalLength = entries.reduce((sum, [key, value]) => {
    const valueStr = formatElement(value);
    return sum + key.length + valueStr.length;
  }, 0);
  
  // Use inline format for simple cases: <= 3 keys and reasonable total length
  if (entries.length <= 3 && totalLength < 80) {
    const inline = entries
      .map(([key, value]) => {
        const valueStr = formatElement(value);
        return `${key}=${valueStr}`;
      })
      .join(" ");
    return `${result} (${inline})`;
  }
  
  // Use multi-line format for complex cases
  const multiline = entries
    .map(([key, value]) => {
      const valueStr = formatElement(value);
      return `  ${key}: ${valueStr}`;
    })
    .join("\n");
  return `${result}\n${multiline}`;
}

export class ActionsLogger implements Logger {
  private readonly context: Record<string, unknown>;

  constructor(context: Record<string, unknown> = {}) {
    this.context = context;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    core.debug(formatMessage(message, { ...this.context, ...context }));
  }
  info(message: string, context?: Record<string, unknown>): void {
    core.info(formatMessage(message, { ...this.context, ...context }));
  }
  warning(message: string | Error, context?: Record<string, unknown>): void {
    core.warning(formatMessage(message, { ...this.context, ...context }));
  }
  error(message: string | Error, context?: Record<string, unknown>): void {
    core.error(formatMessage(message, { ...this.context, ...context }));
  }
  child(context: Record<string, unknown>): Logger {
    return new ActionsLogger({ ...this.context, ...context });
  }
  group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return core.group(name, fn);
  }
  startGroup(name: string): void {
    core.startGroup(name);
  }
  endGroup(): void {
    core.endGroup();
  }
}
