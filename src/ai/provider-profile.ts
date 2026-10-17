import type { ProviderConfig } from './contracts';
export function providerCapabilityProfile(
  provider: ProviderConfig,
  model: string,
) {
  const declared =
    provider.models.find((m) => m.id === model)?.capabilities ?? [];
  return {
    providerId: provider.id,
    model,
    protocol: provider.type,
    toolCalling: 'unknown',
    structuredOutput: 'unknown',
    vision: declared.includes('vision') ? 'configured' : 'not-configured',
    streamingToolCalls: 'adapter-supported-provider-unverified',
    contextWindow: null,
    toolSchemaCompatibility: 'JSON Schema; actual endpoint support unverified',
    parallelToolCalls: 'unknown',
    cancellation: 'local-abort-supported',
    errorSemantics: 'typed-host-errors',
    adapterTransports: ['tools', 'structured-plan'],
    evidence: 'configuration-and-adapter; not a live provider certification',
  };
}
