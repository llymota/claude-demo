// Turns the single-file build into a page fragment for artifact hosting:
// keeps <title>, font links, inline styles, the root node and the inline module script.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist-single/index.html", "utf8");
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join("\n");
const title = pick(/<title>[\s\S]*?<\/title>/g);
const links = pick(/<link rel="(?:preconnect|stylesheet)"[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script type="module"[^>]*>[\s\S]*?<\/script>/g);
writeFileSync("dist-single/tendril.html", [title, links, styles, '<div id="root"></div>', scripts].join("\n"));
console.log("wrote dist-single/tendril.html");
