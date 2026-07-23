import * as React from "react";

type CheckboxProps = Omit<React.ComponentProps<"input">, "type">;

function Checkbox(props: CheckboxProps) {
  return <input type="checkbox" {...props} />;
}

export { Checkbox };
export type { CheckboxProps };
