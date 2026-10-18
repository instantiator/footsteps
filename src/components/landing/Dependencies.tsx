import licenses from "../../assets/license-report.json";

export default function Dependencies() {
  return (
    <ul>
      {licenses.map((license: any, index: number) => (
        <li key={`dependency-${index}`}>
          {license.name}: {license.licenseType}
        </li>
      ))}
    </ul>
  );
}
