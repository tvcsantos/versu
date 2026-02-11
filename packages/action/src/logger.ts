import * as core from '@actions/core';
import type { Logger } from '@versu/core';

export class ActionsLogger implements Logger {
    debug(message: string): void {
        core.debug(message);
    }
    info(message: string): void {
        core.info(message);
    }
    warning(message: string | Error, context?: Record<string, unknown>): void {
        core.warning(message, context);
    }
    error(message: string | Error, context?: Record<string, unknown>): void {
        core.error(message, context);
    }
}
