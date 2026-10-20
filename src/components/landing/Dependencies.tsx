import licenses from "../../assets/license-report.json";

/** Lists each dependency with its licence type, from the generated licence report. */
export default function Dependencies() {
  return (
    <ul>
      {licenses.map((license, index) => (
        <li key={`dependency-${index}`}>
          {license.name}: {license.licenseType}
        </li>
      ))}
    </ul>
  );
}
