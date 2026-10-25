import { createContext } from "react";
import { ENV_APP_CONFIG, type AppConfig } from "../config/AppConfig";

/** The resolved app config; see `AppConfigProvider`. Outside a provider, the environment's config. */
export const AppConfigContext = createContext<AppConfig>(ENV_APP_CONFIG);
