import { useEffect, useState, type PropsWithChildren } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_FEATURE_FLAGS, FeatureFlagsContext, type FeatureFlags } from "./FeatureFlagsContext";

type FeatureFlagsProviderProps = Partial<FeatureFlags>;

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

export default function FeatureFlagsProvider(props: PropsWithChildren<FeatureFlagsProviderProps>) {
  const [searchParams] = useSearchParams();
  const [flags, setFlags] = useState<FeatureFlags>(composeFeatureFlags(DEFAULT_FEATURE_FLAGS, props, searchParams));

  useEffect(() => {
    setFlags(composeFeatureFlags(DEFAULT_FEATURE_FLAGS, props, searchParams));
  }, [props, searchParams]);

  return <FeatureFlagsContext.Provider value={flags}>{props.children}</FeatureFlagsContext.Provider>;
}
