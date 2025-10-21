/**
 * Standard filename for Gradle project properties file.
 *
 * @remarks
 * The gradle.properties file is the standard location for Gradle project
 * configuration, including:
 * - Project version properties
 * - Build configuration options
 * - System properties
 * - Custom project properties
 *
 * This file is typically located in the project root directory and is used
 * by VERSE to read and update module version information.
 *
 * @see {@link https://docs.gradle.org/current/userguide/build_environment.html#sec:gradle_configuration_properties}
 */
export declare const GRADLE_PROPERTIES_FILE = "gradle.properties";
/**
 * Standard filename for Gradle build script using Groovy DSL.
 *
 * @remarks
 * The build.gradle file contains the build configuration written in Groovy.
 * It defines project dependencies, plugins, tasks, and other build logic.
 *
 * This is the traditional Gradle build script format and is widely used in
 * Gradle projects. The presence of this file indicates a Gradle project.
 *
 * @see {@link https://docs.gradle.org/current/userguide/tutorial_using_tasks.html}
 */
export declare const GRADLE_BUILD_FILE = "build.gradle";
/**
 * Standard filename for Gradle build script using Kotlin DSL.
 *
 * @remarks
 * The build.gradle.kts file contains the build configuration written in Kotlin.
 * It provides the same functionality as build.gradle but with type-safe DSL,
 * better IDE support, and compile-time checking.
 *
 * This is the modern Gradle build script format that offers improved developer
 * experience through Kotlin's language features. The presence of this file
 * indicates a Gradle project using Kotlin DSL.
 *
 * @see {@link https://docs.gradle.org/current/userguide/kotlin_dsl.html}
 */
export declare const GRADLE_BUILD_KTS_FILE = "build.gradle.kts";
/**
 * Standard filename for Gradle settings file using Groovy DSL.
 *
 * @remarks
 * The settings.gradle file defines the multi-project build structure. It
 * specifies which subprojects are included in the build and configures
 * project-wide settings.
 *
 * This file is particularly important for multi-module projects where it
 * declares all modules that should be built together. For single-module
 * projects, this file may be optional.
 *
 * The presence of this file is a strong indicator of a Gradle project,
 * especially for multi-module builds.
 *
 * @see {@link https://docs.gradle.org/current/userguide/multi_project_builds.html}
 */
export declare const GRADLE_SETTINGS_FILE = "settings.gradle";
/**
 * Standard filename for Gradle settings file using Kotlin DSL.
 *
 * @remarks
 * The settings.gradle.kts file is the Kotlin DSL equivalent of settings.gradle.
 * It defines the multi-project build structure with type-safe configuration.
 *
 * Like its Groovy counterpart, this file specifies which subprojects are
 * included in the build, but with the benefits of Kotlin's type system and
 * IDE support.
 *
 * The presence of this file indicates a Gradle project using Kotlin DSL,
 * especially for multi-module builds.
 *
 * @see {@link https://docs.gradle.org/current/userguide/kotlin_dsl.html}
 */
export declare const GRADLE_SETTINGS_KTS_FILE = "settings.gradle.kts";
/**
 * Unique identifier for the Gradle adapter.
 *
 * @remarks
 * This constant is used throughout the system to identify the Gradle adapter.
 * It serves as:
 * - A key in adapter registries
 * - An identifier in configuration files
 * - A reference in logging and error messages
 * - A discriminator for adapter-specific behavior
 *
 * The value should remain stable as it may be used in persisted configuration
 * or user-facing documentation.
 */
export declare const GRADLE_ID = "gradle";
//# sourceMappingURL=constants.d.ts.map