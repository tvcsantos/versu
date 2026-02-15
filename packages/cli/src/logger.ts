import { Command } from "@oclif/core";
import type { Logger } from "@versu/core";
import Debug from "debug";
import chalk from "chalk";
import ora, { Ora } from "ora";

const debug = Debug("versu");

function indent(str: string, spaces: number): string {
  const indentation = " ".repeat(spaces);
  return indentation + str;
}

function formatElement(element: unknown): string {
  if (typeof element === "object" && element !== null) {
    return JSON.stringify(element);
  }
  return String(element);
}

/**
 * Formats context object for beautiful CLI display
 */
function formatContext(
  context?: Record<string, unknown>,
  baseIndent = 0,
): string {
  if (!context || Object.keys(context).length === 0) return "";

  const entries = Object.entries(context);

  // Check if we have any arrays
  const hasArrays = entries.some(
    ([_, value]) => Array.isArray(value) && value.length > 0,
  );

  // If we have arrays, always use multi-line format with list items
  if (hasArrays) {
    const lineIndent = baseIndent + 2;
    const itemIndent = baseIndent + 4;
    const lines: string[] = [];

    for (const [key, value] of entries) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(
            indent(`${chalk.dim(key)}: ${chalk.cyan("none")}`, lineIndent),
          );
        } else {
          lines.push(indent(`${chalk.dim(key)}:`, lineIndent));
          value.forEach((item) => {
            const itemStr = formatElement(item);
            lines.push(
              indent(`${chalk.dim("•")} ${chalk.cyan(itemStr)}`, itemIndent),
            );
          });
        }
      } else {
        const valueStr = formatElement(value);
        lines.push(
          indent(`${chalk.dim(key)}: ${chalk.cyan(valueStr)}`, lineIndent),
        );
      }
    }

    return "\n" + lines.join("\n");
  }

  const processedEntries = entries.map(([key, value]) => {
    const formattedValue = formatElement(value);
    return { key, formattedValue, length: key.length + formattedValue.length };
  });

  // Calculate total inline length
  const totalLength = processedEntries.reduce((sum, e) => sum + e.length, 0);
  const hasLongValue = processedEntries.some(
    (e) => e.formattedValue.length > 50,
  );

  // Use inline format for simple cases: <= 3 keys and reasonable total length
  if (processedEntries.length <= 3 && totalLength < 80 && !hasLongValue) {
    const inline = processedEntries
      .map((e) => `${chalk.dim(e.key)}=${chalk.cyan(e.formattedValue)}`)
      .join(" ");
    return ` ${chalk.dim("(")}${inline}${chalk.dim(")")}`;
  }

  // Use multi-line format for complex cases
  // Account for base indentation + icon (2 chars: "ℹ ")
  const lineIndent = baseIndent + 2;
  const multiline = processedEntries
    .map((e) =>
      indent(
        `${chalk.dim(e.key)}: ${chalk.cyan(e.formattedValue)}`,
        lineIndent,
      ),
    )
    .join("\n");
  return "\n" + multiline;
}

/**
 * Formats a message with optional context for CLI output
 */
function formatMessage(
  message: string | Error,
  context?: Record<string, unknown>,
  baseIndent = 0,
): string {
  const result = message instanceof Error ? message.toString() : message;
  const contextString = formatContext(context, baseIndent);
  return `${result}${contextString}`;
}

/**
 * CLI Logger implementation with beautiful formatting using chalk and ora
 * Implements the core Logger interface for presentation in the CLI
 */
export class OclifLogger implements Logger {
  private spinner: Ora | null = null;
  private groupDepth = 0;

  constructor(
    private readonly cmd: Command,
    private readonly context: Record<string, unknown> = {},
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    const baseIndent = this.groupDepth * 2;
    debug(formatMessage(message, { ...this.context, ...context }, baseIndent));
  }

  /**
   * Helper method to handle spinner-aware logging with consistent formatting
   */
  private logWithSpinner(
    logFn: (message: string) => void,
    icon: string,
    color: (text: string) => string,
    message: string | Error,
    context?: Record<string, unknown>,
    isError = false,
  ): void {
    const baseIndent = this.groupDepth * 2;
    const formatted = formatMessage(
      message,
      { ...this.context, ...context },
      baseIndent,
    );
    const output = indent(`${color(icon)} ${formatted}`, baseIndent);

    if (this.spinner) {
      if (isError) {
        this.spinner.fail();
        this.spinner = null;
      } else {
        this.spinner.stop();
      }
    }

    logFn(output);

    if (this.spinner && !isError) {
      this.spinner.start();
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.logWithSpinner(
      (msg) => this.cmd.log(msg),
      "ℹ",
      chalk.blue,
      message,
      context,
    );
  }

  warning(message: string | Error, context?: Record<string, unknown>): void {
    this.logWithSpinner(
      (msg) => this.cmd.warn(msg),
      "⚠",
      chalk.yellow,
      message,
      context,
    );
  }

  error(message: string | Error, context?: Record<string, unknown>): void {
    this.logWithSpinner(
      (msg) => this.cmd.error(msg),
      "✖",
      chalk.red,
      message,
      context,
      true,
    );
  }

  child(context: Record<string, unknown>): Logger {
    return new OclifLogger(this.cmd, { ...this.context, ...context });
  }

  startGroup(name: string): void {
    // Stop any active spinner before starting a group
    if (this.spinner) {
      this.spinner.succeed();
      this.spinner = null;
    }

    this.cmd.log(indent(chalk.bold.cyan(name), this.groupDepth));
    this.groupDepth++;
  }

  async group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startGroup(name);
    try {
      // Start spinner for the group operation
      this.spinner = ora({
        indent: this.groupDepth,
        color: "cyan",
      }).start();

      const result = await fn();

      // Succeed the spinner when done
      if (this.spinner) {
        this.spinner.succeed(chalk.green("Complete"));
        this.spinner = null;
      }

      return result;
    } catch (error) {
      if (this.spinner) {
        this.spinner.fail(chalk.red("Failed"));
        this.spinner = null;
      }
      throw error;
    } finally {
      this.endGroup();
    }
  }

  endGroup(): void {
    if (this.groupDepth > 0) {
      this.groupDepth--;
    }

    // Clean up spinner if still active
    if (this.groupDepth === 0 && this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}
