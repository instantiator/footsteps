import { useEffect, useState } from "react";
import { isDefined } from "../../../util/ObjectUtils";

/**
 * The width/height ratio of an image, once it has loaded, so a layer can size itself to the image
 * without being told its dimensions. Undefined before then, or if it doesn't load.
 */
export default function useImageAspectRatio(url: string | undefined): number | undefined {
  const [loaded, setLoaded] = useState<{ url: string; ratio: number }>();
  useEffect(() => {
    if (!isDefined(url)) return;
    const image = new Image();
    image.onload = () => {
      if (image.naturalHeight > 0) setLoaded({ url, ratio: image.naturalWidth / image.naturalHeight });
    };
    image.src = url;
    return () => {
      image.onload = null;
    };
  }, [url]);
  return isDefined(loaded) && loaded.url === url ? loaded.ratio : undefined;
}
