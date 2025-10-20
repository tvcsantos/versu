import { GradleAdapterIdentifier } from "../adapters/gradle/services/gradle-adapter-identifier.js";
import { AdapterIdentifier } from "../services/adapter-identifier.js";
import { AdapterIdentifierRegistry } from "../services/adapter-identifier-registry.js";

export function createAdapterIdentifierRegistry(): AdapterIdentifierRegistry {
    const identifiers: AdapterIdentifier[] = [
        new GradleAdapterIdentifier(),
        // Add future adapter identifiers here:
        // new MavenAdapterIdentifier(),
        // new NodeJSAdapterIdentifier(),
        // new PythonAdapterIdentifier(),
    ];

    return new AdapterIdentifierRegistry(identifiers);
}