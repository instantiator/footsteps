import { useContext } from "react";
import { FeatureFlagsContext } from "./FeatureFlagsContext";

export default function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
