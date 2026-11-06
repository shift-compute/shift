import type { ReactNode } from "react";
import "../../styles/inner.css";

/** Frame for the inner pages: dotted field with a soft top band, content fades in. The home page does not use it. */
export function InnerPage({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="inner-bg" />
      <div className="inner-enter space-y-6">{children}</div>
    </>
  );
}
