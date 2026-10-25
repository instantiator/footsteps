import { useContext } from "react";
import { AppConfigContext } from "./AppConfigContext";

/** The current `AppConfig`. */
export default function useAppConfig() {
  return useContext(AppConfigContext);
}
