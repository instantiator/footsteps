import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts } from "react-router";
import "./index.css";

/** The HTML document every page renders into. */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Game content may be remote: no plugins, no <base> hijacking, no form submissions */}
        <meta httpEquiv="Content-Security-Policy" content="object-src 'none'; base-uri 'self'; form-action 'none'" />
        <title>footsteps</title>
        <link rel="icon" type="image/png" href={`${import.meta.env.BASE_URL}footprints-icon.png`} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** The root route: renders whichever page the URL matched inside {@link Layout}. */
export default function Root() {
  return <Outlet />;
}
