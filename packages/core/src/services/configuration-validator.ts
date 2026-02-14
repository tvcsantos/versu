import zod from "zod";

/**
 * Validates VERSU configuration against Zod schema for type safety and correctness.
 * Ensures all configuration values conform to expected types and constraints,
 * providing detailed error messages for any validation failures.
 */
export class ConfigurationValidator<T> {
  constructor(private readonly configSchema: zod.ZodType<T>) {}

  /**
   * Validates configuration against the schema and returns the validated result.
   * @param config - Configuration object to validate
   * @returns Validated and typed configuration object
   * @throws {Error} If validation fails, with detailed error information
   */
  validate(config: unknown): T {
    const result = this.configSchema.safeParse(config);
    if (!result.success) {
      const errors = result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new Error(`Configuration validation failed: ${errors}`);
    }
    return result.data;
  }
}

export class ConfigurationValidatorFactory {
  static create<T>(configSchema: zod.ZodType<T>): ConfigurationValidator<T> {
    return new ConfigurationValidator<T>(configSchema);
  }
}
