import { createContext } from "react";

export interface FeatureFlags {
  debug: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  debug: false,
};

export const FeatureFlagsContext = createContext<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
