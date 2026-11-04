/**
 * A CSS easing as a function, for what can't be left to the browser to animate. It asks the browser, so accepts
 * whatever CSS does.
 * @returns the eased progress (usually 0–1) at each progress through the easing (0–1)
 */
export const easingFunction = (easing: string): ((progress: number) => number) => {
  const duration = 1000;
  const effect = new KeyframeEffect(null, [], { duration, easing, fill: "both" });
  const animation = new Animation(effect);
  return (progress) => {
    animation.currentTime = progress * duration;
    return effect.getComputedTiming().progress ?? 0;
  };
};
