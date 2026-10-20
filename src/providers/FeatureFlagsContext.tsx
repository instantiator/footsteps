import { createContext } from "react";

/** Switches that toggle optional behaviour. */
export interface FeatureFlags {
  /** Shows debugging aids. */
  debug: boolean;
}

/** The flags' values when nothing overrides them. */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  debug: false,
};

/** The resolved feature flags; see `FeatureFlagsProvider`. */
export const FeatureFlagsContext = createContext<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
