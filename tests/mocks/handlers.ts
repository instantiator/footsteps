import fs from "fs";
import { http, HttpResponse } from "msw";
import path from "path";

export const handlers = [
  http.get("/*", ({ request }) => {
    const url = new URL(request.url);
    const filePath = path.resolve("public", url.pathname.slice(1));

    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, "utf8");
      let contentType = "text/plain";
      if (filePath.endsWith(".json")) {
        contentType = "application/json";
      } else if (filePath.endsWith(".png")) {
        contentType = "image/png";
      } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
        contentType = "image/jpeg";
      }
      return new HttpResponse(fileContents, {
        headers: {
          "Content-Type": contentType,
        },
      });
    }

    return new HttpResponse(null, { status: 404 });
  }),
];
