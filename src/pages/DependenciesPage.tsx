import { Link } from "react-router";
import Dependencies from "../components/landing/Dependencies";

/** The app's dependencies and their licences, linked from the home page's attributions. */
export default function DependenciesPage() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Dependencies</h1>
      <p>
        The packages Footsteps is built with, and their licences. <Link to="/">Back to games</Link>
      </p>
      <Dependencies />
    </div>
  );
}
