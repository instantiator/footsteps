import { useMemo, type PropsWithChildren } from "react";
import { useSearchParams } from "react-router";
import { configFromQuery, ENV_APP_CONFIG, type AppConfig } from "../config/AppConfig";
import { AppConfigContext } from "./AppConfigContext";

/** Any setting may be given as a prop to change the environment's value; an undefined one keeps it. */
type AppConfigProviderProps = Partial<AppConfig>;

/**
 * Layers the environment's config, then props, then URL query parameters (e.g. `?debug=true&visionModel=mediapipe`).
 *
 * The config keeps its identity until a setting changes, so effects that depend on it don't restart every render.
 */
export default function AppConfigProvider({ children, ...props }: PropsWithChildren<AppConfigProviderProps>) {
  const [searchParams] = useSearchParams();
  // Stringifying drops undefined props, and gives a stable key for a fresh props object
  const overrides = JSON.stringify(props);
  const config = useMemo(
    () => configFromQuery(searchParams, { ...ENV_APP_CONFIG, ...(JSON.parse(overrides) as AppConfigProviderProps) }),
    [overrides, searchParams],
  );

  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>;
}
