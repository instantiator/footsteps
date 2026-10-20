import { useMemo, type PropsWithChildren } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_FEATURE_FLAGS, FeatureFlagsContext, type FeatureFlags } from "./FeatureFlagsContext";

/** Any flag may be given as a prop to change its default. */
type FeatureFlagsProviderProps = Partial<FeatureFlags>;

/** Layers defaults, then props, then query parameters (any value but "false" turns a flag on). */
const composeFeatureFlags = (
  defaultFlags: FeatureFlags,
  props: FeatureFlagsProviderProps,
  searchParams: URLSearchParams,
): FeatureFlags => {
  const flags: FeatureFlags = {
    ...defaultFlags,
    ...props,
  };

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
  const flags = useMemo(() => composeFeatureFlags(DEFAULT_FEATURE_FLAGS, props, searchParams), [props, searchParams]);

  return <FeatureFlagsContext.Provider value={flags}>{props.children}</FeatureFlagsContext.Provider>;
}
