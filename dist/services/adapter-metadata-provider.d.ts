import { AdapterMetadata } from './adapter-identifier.js';
import { AdapterIdentifierRegistry } from './adapter-identifier-registry.js';
export type AdapterMetadataProviderOptions = {
    adapter?: string;
    repoRoot: string;
};
export declare class AdapterMetadataProvider {
    private readonly adapterIdentifierRegistry;
    private readonly options;
    private readonly adapterId;
    constructor(adapterIdentifierRegistry: AdapterIdentifierRegistry, options: AdapterMetadataProviderOptions);
    getMetadata(): Promise<AdapterMetadata>;
    private getSpecifiedAdapter;
    private getAutoDetectedAdapter;
}
//# sourceMappingURL=adapter-metadata-provider.d.ts.map