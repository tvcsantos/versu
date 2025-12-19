import groovy.json.JsonOutput
import groovy.json.JsonGenerator

/**
 * Computes the qualified property name for a project's version in gradle.properties.
 * Returns "version" for root, "{name}.version" for subprojects.
 */
fun Project.qualifiedVersionProperty(): String {
    val name = if (path.contains(":")) path.split(':').last() else ""
    return if (name.isEmpty()) "version" else "${name}.version"
}

gradle.rootProject {
    /**
     * Collects and outputs project structure information as JSON.
     * Includes module hierarchy, paths, versions, and affected modules.
     */
    tasks.register("printProjectInformation") {
        group = "help"
        description = "Shows which subprojects are affected by changes (hierarchy + direct dependencies)."

        // Capture hierarchy data at configuration time
        val hierarchyDepsProvider = provider {
            val hierarchyEdges = linkedMapOf<String, Set<String>>()

            gradle.rootProject.allprojects.forEach { project ->
                val affectedChildren = mutableSetOf<String>()

                // Recursively collect all subprojects
                fun collectSubprojects(parent: org.gradle.api.Project) {
                    parent.subprojects.forEach { child ->
                        affectedChildren.add(child.path)
                        collectSubprojects(child)
                    }
                }

                collectSubprojects(project)
                hierarchyEdges[project.path] = affectedChildren.toSet()
            }
            hierarchyEdges
        }

        // Capture direct project dependencies at configuration time
        val dependencyDepsProvider = provider {
            val dependencyEdges = linkedMapOf<String, Set<String>>()

            gradle.rootProject.allprojects.forEach { project ->
                val directDeps = mutableSetOf<String>()

                project.configurations.forEach { config ->
                    // Check regular dependencies
                    config.dependencies.forEach { dep ->
                        if (dep is ProjectDependency) {
                            directDeps.add(dep.dependencyProject.path)
                        }
                    }

                    // Check dependency constraints (platform/BOM imports)
                    config.dependencyConstraints.forEach { constraint ->
                        // Constraints reference projects by group:name, need to resolve to project path
                        val constraintProject = gradle.rootProject.allprojects.find { proj ->
                            proj.group.toString() == constraint.group && proj.name == constraint.name
                        }
                        constraintProject?.let { directDeps.add(it.path) }
                    }
                }

                dependencyEdges[project.path] = directDeps.toSet()
            }
            dependencyEdges
        }

        // Capture project metadata at configuration time
        val projectDataProvider = provider {
            val projectData = linkedMapOf<String, Map<String, Any?>>()

            gradle.rootProject.allprojects.forEach { project ->
                val relativePath = gradle.rootProject.projectDir.toPath().relativize(project.projectDir.toPath()).toString()
                val path = if (relativePath.isEmpty()) "." else relativePath
                val version = if (project.version == "unspecified") null else project.version
                val type = if (project == gradle.rootProject) "root" else "module"
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
            val hierarchyMap = hierarchyDepsProvider.get()
            val dependencyMap = dependencyDepsProvider.get()
            val projectDataMap = projectDataProvider.get()

            // Calculate directly affected modules only
            val result = projectDataMap.keys.sorted().associateWith { projectPath ->
                val projectInfo = projectDataMap.getValue(projectPath)
                val affectedModules = mutableSetOf<String>()

                // Add hierarchy children
                hierarchyMap[projectPath]?.let { affectedModules.addAll(it) }

                // Add projects that directly depend on this one
                dependencyMap.forEach { (dependent, dependencies) ->
                    if (projectPath in dependencies) {
                        affectedModules.add(dependent)
                    }
                }

                mapOf(
                    "path" to projectInfo["path"],
                    "affectedModules" to affectedModules.toSortedSet(),
                    "version" to projectInfo["version"],
                    "type" to projectInfo["type"],
                    "name" to projectInfo["name"],
                    "declaredVersion" to projectInfo["declaredVersion"]
                )
            }

            val generator = JsonGenerator.Options()
                .excludeNulls()
                .build()

            println(JsonOutput.prettyPrint(generator.toJson(result)))
        }
    }

    /**
     * Convenience alias for printProjectInformation task.
     * Usage: ./gradlew --init-script <path> structure
     */
    tasks.register("structure") {
        group = "help"
        description = "Show project structure information"
        dependsOn("printProjectInformation")
    }
}
