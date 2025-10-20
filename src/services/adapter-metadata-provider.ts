import * as core from '@actions/core';
import { AdapterMetadata, AdapterIdentifier } from './adapter-identifier.js';
import { AdapterIdentifierRegistry } from './adapter-identifier-registry.js';

export type AdapterMetadataProviderOptions = {
  adapter?: string;
  repoRoot: string;
};

export class AdapterMetadataProvider {
    private readonly adapterId: string | undefined;

    constructor(
        private readonly adapterIdentifierRegistry: AdapterIdentifierRegistry,
        private readonly options: AdapterMetadataProviderOptions
    ) {
        this.adapterId = options.adapter?.toLowerCase();
    }

    async getMetadata(): Promise<AdapterMetadata> {
        let identifier = await this.getSpecifiedAdapter();
        if (!identifier) {
            identifier = await this.getAutoDetectedAdapter();
        }
        return identifier.metadata;
    }

    private async getSpecifiedAdapter(): Promise<AdapterIdentifier | null> {
        if (this.adapterId) {
            const identifier = this.adapterIdentifierRegistry.getIdentifierById(this.adapterId);

            if (!identifier) {
                throw new Error(
                    `Unsupported adapter '${this.adapterId}'. Supported adapters: ${
                        this.adapterIdentifierRegistry.getSupportedAdapters().join(', ')
                    }`
                );
            }

            core.info(`📝 Using explicitly provided adapter: ${this.adapterId}`);

            return identifier;
        }

        return null;
    }

    private async getAutoDetectedAdapter(): Promise<AdapterIdentifier> {
        const identifier = await this.adapterIdentifierRegistry.identify(this.options.repoRoot);

        if (!identifier) {
            throw new Error(
                'No project adapter could be auto-detected. ' + 
                'Please specify the "adapter" input explicitly in your workflow. ' +
                'Supported adapters: gradle. For more information, see the documentation.'
            );
        }

        core.info(`🔍 Auto-detected adapter: ${identifier.metadata.id}`);

        return identifier;
    }
}
