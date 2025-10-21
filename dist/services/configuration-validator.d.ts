import { type Config } from "../config/index.js";
/**
 * Validates VERSE configuration against Zod schema for type safety and correctness.
 * Ensures all configuration values conform to expected types and constraints,
 * providing detailed error messages for any validation failures.
 */
export declare class ConfigurationValidator {
    /**
     * Validates configuration against the schema and returns the validated result.
     * @param config - Configuration object to validate
     * @returns Validated and typed configuration object
     * @throws {Error} If validation fails, with detailed error information
     */
    validate(config: unknown): Config;
}
//# sourceMappingURL=configuration-validator.d.ts.map