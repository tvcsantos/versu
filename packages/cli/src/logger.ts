import { Command } from '@oclif/core';
import type { Logger } from '@versu/core';
import Debug from 'debug';

const debug = Debug('versu');

export class OclifLogger implements Logger {
    constructor(private readonly cmd: Command) { }
    info(message: string): void {
        this.cmd.log(message);
    }
    warning(message: string | Error): void {
        this.cmd.warn(message);
    }
    error(message: string | Error, context?: Record<string, unknown>): void {
        this.cmd.error(message, context);
    }
    debug(message: string): void {
        debug(message);
    }
}
