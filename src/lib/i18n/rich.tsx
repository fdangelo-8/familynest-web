import { Fragment, type ReactNode } from "react";
import { t, type Params } from "./translate";

export type RichTags = Readonly<
  Record<string, (children: ReactNode) => ReactNode>
>;

const TOKEN = /<(\/?)(\w+)>/g;

type Frame = { name: string; nodes: ReactNode[] };

/**
 * Message with tags such as `<b>…</b>`. Parameters are inserted as text, so a
 * value like `<i>x</i>` never becomes an element. Unknown tags stay as text.
 */
export function rich(
  template: string,
  params: Params = {},
  tags: RichTags = {},
): ReactNode {
  const root: Frame = { name: "", nodes: [] };
  const open: Frame[] = [];
  let current = root;
  let key = 0;
  let last = 0;

  const pushText = (text: string) => {
    if (text) current.nodes.push(t(text, params));
  };

  for (const match of template.matchAll(TOKEN)) {
    const [raw = "", closing = "", name = ""] = match;
    const render = tags[name];
    if (!render) continue;
    pushText(template.slice(last, match.index));
    last = (match.index ?? 0) + raw.length;
    if (!closing) {
      open.push(current);
      current = { name, nodes: [] };
    } else if (current.name === name && open.length > 0) {
      const finished = current;
      current = open.pop() ?? root;
      current.nodes.push(
        <Fragment key={key++}>{render(finished.nodes)}</Fragment>,
      );
    } else {
      current.nodes.push(raw);
    }
  }
  pushText(template.slice(last));
  // Unclosed tags: keep their content, drop the tag.
  while (open.length > 0) {
    const unclosed = current;
    current = open.pop() ?? root;
    current.nodes.push(...unclosed.nodes);
  }
  return root.nodes.map((node, index) => (
    <Fragment key={index}>{node}</Fragment>
  ));
}
