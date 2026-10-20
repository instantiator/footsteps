import type { PropsWithChildren } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_FEATURE_FLAGS, FeatureFlagsContext, type FeatureFlags } from "./FeatureFlagsContext";

/** Any flag may be given as a prop to change its default. */
type FeatureFlagsProviderProps = Partial<FeatureFlags>;

/**
 * Layers defaults, then props, then query parameters (any value but "false" turns a flag on).
 * Only known flags are read from the props, and an undefined one keeps its default.
 */
const composeFeatureFlags = (
  defaultFlags: FeatureFlags,
  props: FeatureFlagsProviderProps,
  searchParams: URLSearchParams,
): FeatureFlags => {
  const flags: FeatureFlags = { ...defaultFlags };
  for (const key of Object.keys(defaultFlags) as (keyof FeatureFlags)[]) {
    flags[key] = props[key] ?? defaultFlags[key];
  }

  searchParams.forEach((value, key) => {
    if (key in flags) {
      flags[key as keyof FeatureFlags] = value !== "false";
    }
  });

  return flags;
};

/** Feature flags from props, overridden by matching URL query parameters (e.g. ?debug=true). */
export default function FeatureFlagsProvider(props: PropsWithChildren<FeatureFlagsProviderProps>) {
  const [searchParams] = useSearchParams();
  const flags = composeFeatureFlags(DEFAULT_FEATURE_FLAGS, props, searchParams);

  return <FeatureFlagsContext.Provider value={flags}>{props.children}</FeatureFlagsContext.Provider>;
}
