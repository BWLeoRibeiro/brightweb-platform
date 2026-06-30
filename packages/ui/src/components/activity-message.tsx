import type { MsgSeg } from "../lib/activity-format";

/** Render a composed activity message — actor/entity names semibold, values medium. */
export function ActivityMessage({ segs }: { segs: MsgSeg[] }) {
  return (
    <>
      {segs.map((seg, index) => {
        if (typeof seg === "string") return <span key={index}>{seg}</span>;
        if ("b" in seg) {
          return (
            <span key={index} className="font-semibold text-[color:var(--foreground)]">
              {seg.b}
            </span>
          );
        }
        return (
          <span key={index} className="font-medium text-[color:var(--foreground)]">
            {seg.v}
          </span>
        );
      })}
    </>
  );
}
