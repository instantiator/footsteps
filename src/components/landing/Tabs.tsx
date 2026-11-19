import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

/** One tab: its id, which is also its URL hash, the label on it, and what it shows. */
export interface Tab {
  /** Its URL hash, without the `#`. */
  id: string;
  /** What the tab says. */
  label: string;
  /** What the panel shows while it's chosen. */
  content: ReactNode;
}

/** How each key moves the choice, from the current tab's index among `count`. */
const KEY_MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * An accessible tab set: a row of tabs over one panel. The chosen tab is kept in the URL hash, replaced rather than
 * pushed, so a reload or a shared link opens it without filling the history. No hash, or an unknown one, chooses the
 * first tab. The arrow keys, Home and End move between the tabs, and only the chosen one is in the Tab order.
 */
export default function Tabs({ tabs, className }: { tabs: Tab[]; className?: string }) {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => `#${tab.id}` === hash),
  );
  const choose = (next: number) => navigate({ hash: tabs[next].id }, { replace: true, preventScrollReset: true });
  const onKeyDown = (event: KeyboardEvent) => {
    const move = KEY_MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const next = move(index, tabs.length);
    choose(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" className="tabs-list">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(button) => {
              buttons.current[i] = button;
            }}
            type="button"
            role="tab"
            id={`${id}-${tab.id}`}
            aria-selected={i === index}
            aria-controls={`${id}-panel`}
            tabIndex={i === index ? 0 : -1}
            className="tabs-tab"
            onClick={() => choose(i)}
            onKeyDown={onKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tabs[index].id}`} className="tabs-panel">
        {tabs[index].content}
      </div>
    </div>
  );
}
