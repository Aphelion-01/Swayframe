import { createAIPlatform } from './platform';
import { AIProviderManager } from './provider-manager';
let manager: AIProviderManager | undefined;
export function getAIApplication() {
  if (!manager) {
    const platform = createAIPlatform(
      typeof window === 'undefined' ? undefined : window.swayframe?.desktop.ai,
    );
    manager = new AIProviderManager(platform.storage, platform.transport);
    void manager.initialize();
  }
  return manager;
}
