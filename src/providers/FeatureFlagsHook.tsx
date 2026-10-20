import { useContext } from "react";
import { FeatureFlagsContext } from "./FeatureFlagsContext";

/** The current {@link FeatureFlags}. */
export default function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
