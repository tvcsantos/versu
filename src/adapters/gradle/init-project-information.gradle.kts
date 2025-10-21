import groovy.json.JsonOutput
import groovy.json.JsonGenerator

/**
 * Computes the qualified property name for a project's version in gradle.properties.
 * 
 * For the root project, returns "version".
 * For subprojects, returns "{name}.version" where name is the last component of the project path.
 * 
 * Examples:
 * - Root project (:) -> "version"
 * - Project :app -> "app.version"
 * - Project :lib:core -> "core.version"
 * 
 * @return The property name to use for this project's version in gradle.properties
 */
fun Project.qualifiedVersionProperty(): String {
    val name = name.split(':').last()
    return if (name.isEmpty()) "version" else "${name}.version"
}

gradle.rootProject {
    /**
     * Main task that collects and outputs complete project structure information.
     * 
     * This task performs comprehensive analysis of the Gradle project hierarchy,
     * collecting module relationships, versions, and metadata. The output is
     * formatted as JSON for programmatic consumption by VERSE.
     * 
     * Output includes:
     * - Module hierarchy and parent-child relationships
     * - Module paths relative to project root
     * - Version information (from project.version and gradle.properties)
     * - Module types (root vs. module)
     * - Affected modules (transitive subprojects)
     */
    tasks.register("printProjectInformation") {
        group = "help"
        description = "Shows which subprojects are affected when a parent project changes."

        // Capture hierarchy data at configuration time to avoid Project references in execution
        // This provider builds a map of project paths to their affected (child) modules
        val hierarchyDepsProvider = provider {
            val hierarchyEdges = linkedMapOf<String, Set<String>>()

            gradle.rootProject.allprojects.forEach { project ->
                val affectedChildren = mutableSetOf<String>()

                // Recursively collect all subprojects (direct and transitive children)
                // This enables dependency propagation analysis - when a parent module
                // changes, all its descendants are considered affected
                fun collectSubprojects(parent: org.gradle.api.Project) {
                    parent.subprojects.forEach { child ->
                        affectedChildren.add(child.path)
                        collectSubprojects(child) // recursively collect grandchildren
                    }
                }

                collectSubprojects(project)
                hierarchyEdges[project.path] = affectedChildren.toSet()
            }
            hierarchyEdges
        }

        // Capture project metadata at configuration time
        // Collects version information, paths, and other project details
        val projectDataProvider = provider {
            val projectData = linkedMapOf<String, Map<String, Any?>>()

            gradle.rootProject.allprojects.forEach { project ->
                // Calculate relative path from root to this project's directory
                val relativePath = gradle.rootProject.projectDir.toPath().relativize(project.projectDir.toPath()).toString()
                val path = if (relativePath.isEmpty()) "." else relativePath
                
                // Get version, treating "unspecified" as null (Gradle's default when no version is set)
                val version = if (project.version == "unspecified") null else project.version
                
                // Determine project type: root vs. module (subproject)
                val type = if (project == gradle.rootProject) "root" else "module"

                // Check if version is declared in gradle.properties
                // This is important for tracking whether version management is enabled for this module
                val versionPropertyKey = project.qualifiedVersionProperty()
                val versionFromProperty = project.findProperty(versionPropertyKey) as? String

                projectData[project.path] = mapOf(
                    "path" to path,
                    "version" to version,
                    "type" to type,
                    "name" to project.name,
                    "declaredVersion" to (versionFromProperty != null)
                )
            }
            projectData
        }

        doLast {
            // Retrieve captured data from providers
            val hierarchyMap = hierarchyDepsProvider.get()
            val projectDataMap = projectDataProvider.get()

            // Merge hierarchy and project data into final output structure
            val result = hierarchyMap.toSortedMap().mapValues { (projectPath, affectedModules) ->
                val projectInfo = projectDataMap.getValue(projectPath)

                mapOf(
                    "path" to projectInfo["path"],
                    "affectedModules" to affectedModules.toSortedSet(),
                    "version" to projectInfo["version"],
                    "type" to projectInfo["type"],
                    "name" to projectInfo["name"],
                    "declaredVersion" to projectInfo["declaredVersion"]
                )
            }

            // Configure JSON output to exclude null values for cleaner output
            val generator = JsonGenerator.Options()
                .excludeNulls()
                .build()

            // Print JSON output to stdout for consumption by VERSE
            println(JsonOutput.prettyPrint(generator.toJson(result)))
        }
    }

    /**
     * Convenience alias for the printProjectInformation task.
     * 
     * Provides a shorter, more memorable command name for users.
     * This is the task name used by VERSE when executing the init script.
     * 
     * Usage: ./gradlew --init-script <path> structure
     */
    tasks.register("structure") {
        group = "help"
        description = "Show project structure information"
        dependsOn("printProjectInformation")
    }
}
