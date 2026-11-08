import { useParams } from "react-router";
import CalibrationView from "../components/landing/CalibrationView";
import AppConfigProvider from "../providers/AppConfigProvider";

/** Calibrates the floor for the chosen camera, opened from the landing page of the game with the id in the route. */
export default function LocalCalibrate() {
  const { id } = useParams();
  return (
    <AppConfigProvider>
      <CalibrationView backTo={`/game/${id ?? ""}`} />
    </AppConfigProvider>
  );
}
