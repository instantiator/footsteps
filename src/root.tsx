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
        <title>footsteps</title>
        <link rel="icon" type="image/png" href={`${import.meta.env.BASE_URL}footprints-icon.png`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com/" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro&family=Open+Sans&family=Material+Icons&family=DynaPuff&display=swap"
        />
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
