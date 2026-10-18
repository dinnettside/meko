import { Fragment, isValidElement } from "react";
import type { ReactNode } from "react";

// React's names for SVG attributes that are not just the attribute's name in camel case.
const NAMES: Record<string, string> = { className: "class", xlinkHref: "xlink:href" };
const attributeName = (key: string) => NAMES[key] ?? key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// The markup of SVG drawn with plain React elements, like the icons, so a template can put it in its own SVG markup.
// Only plain elements and fragments are drawn; components, style objects and event handlers are left out.
export function markupOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return escape(String(node));
  if (Array.isArray(node)) return node.map(markupOf).join("");
  if (!isValidElement(node)) return "";
  const { children, ...props } = node.props as { children?: ReactNode } & Record<string, unknown>;
  if (node.type === Fragment) return markupOf(children);
  if (typeof node.type !== "string") return "";
  const attributes = Object.entries(props)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && typeof value !== "object" && typeof value !== "function")
    .map(([key, value]) => ` ${attributeName(key)}="${escape(String(value))}"`)
    .join("");
  return `<${node.type}${attributes}>${markupOf(children)}</${node.type}>`;
}
