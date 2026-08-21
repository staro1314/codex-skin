import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// CSS forbids nesting :has() inside :has() (or inside :not() that is itself
// an argument of :has()).  Chromium drops the entire rule, so a nested
// pattern ships as silently dead styling — v1.3.1 lost the full-window home
// and every task-route ambient background this way.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const files = [
  "runtime/dream-skin.css",
  "macos/assets/dream-skin.css",
  "windows/assets/dream-skin.css",
];

const findNestedHas = (css) => {
  const findings = [];
  for (let index = css.indexOf(":has("); index !== -1; index = css.indexOf(":has(", index + 1)) {
    const open = index + ":has(".length - 1;
    let depth = 0;
    for (let cursor = open; cursor < css.length; cursor += 1) {
      const char = css[cursor];
      if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          const argument = css.slice(open + 1, cursor);
          if (argument.includes(":has(")) {
            findings.push(css.slice(index, Math.min(cursor + 1, index + 160)));
          }
          break;
        }
      }
    }
  }
  return findings;
};

for (const file of files) {
  test(`no nested :has() in ${file}`, () => {
    const css = readFileSync(join(root, file), "utf8");
    const findings = findNestedHas(css);
    assert.deepEqual(findings, [], `nested :has() found in ${file}`);
  });

  test(`wide full-mode Markdown retains themed light text in ${file}`, () => {
    const css = readFileSync(join(root, file), "utf8");
    const selectorToken = file.startsWith("runtime/")
      ? "__DREAM_SELECTOR_SHELL_MAIN__:not\\(:has\\(__DREAM_SELECTOR_HOME_ROUTE_CSS__\\)\\) __DREAM_SELECTOR_MARKDOWN__"
      : "main:is\\(\\.main-surface, \\[data-app-shell-main-surface\\], \\[class\\*=\"_MainContentSurface_\"\\]\\):not\\(:has\\(\\[role=\"main\"\\]\\)\\) \\[class\\*=\"_markdown\"\\]";
    const fullMode = ':is\\([^)]*\\[data-dream-task-mode="full"\\][^)]*\\[data-dream-art-task-mode="full"\\][^)]*\\)\\[data-dream-art-wide="true"\\]';
    const markdownRule = new RegExp(`${fullMode}\\s*\\n?\\s*${selectorToken}\\s*\\{\\s*\\n?\\s*color:\\s*var\\(--ds-text\\)\\s*!important;`);
    const lightShadowRule = new RegExp(`\\[data-dream-shell="light"\\]${fullMode}\\s*\\n?\\s*${selectorToken}\\s*\\{\\s*\\n?\\s*text-shadow:`);
    assert.match(css, markdownRule,
      "Full task mode must override native dark-shell Markdown foreground (#309).");
    assert.match(css, lightShadowRule,
      "Full task mode must retain the light-shell Markdown contrast shadow (#309).");
  });

  test(`wide task workspace matches the sidebar glass opacity in ${file}`, () => {
    const css = readFileSync(join(root, file), "utf8");
    assert.match(css,
      /Keep the workspace on the same glass opacity as the sidebar[\s\S]*?rgb\(var\(--ds-panel-rgb\) \/ \.46\),\s*rgb\(var\(--ds-bg-rgb\) \/ \.58\) 100%\) !important;/,
      "The wide task workspace must not introduce a darker second surface over the wallpaper.");
  });

  test(`task artwork does not define a bottom fade layer in ${file}`, () => {
    const css = readFileSync(join(root, file), "utf8");
    assert.match(css,
      /--ds-task-fade:\s*none;/,
      "The task workspace must not paint a black bottom gradient behind the composer or approval chrome.");
  });

  test(`video layering does not rewrite body portal positioning in ${file}`, () => {
    const css = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(css,
      /html\[data-dream-skin="active"\]\[data-dream-media="video"\]\s+body\s*>\s*:not\(\[data-dream-skin-video\]\)\s*\{[\s\S]*?position:\s*relative;/,
      "Video layering must not rewrite fixed/absolute portal positions under body.");
    assert.match(css,
      /html\[data-dream-skin="active"\]\[data-dream-media="video"\]\s+body\s*>\s*#root\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*1;/,
      "Only the application root should be raised above the fixed video layer.");
  });

  test(`wide task composer host does not retain a full-width bottom shadow in ${file}`, () => {
    const css = readFileSync(join(root, file), "utf8");
    assert.match(css,
      /Search routes ship an opaque sticky band[\s\S]*?div\.sticky:has\(input\[type="text"\]\)\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
      "The sticky composer host must not paint a second full-width shadow below the composer.");
    assert.match(css,
      /div\.sticky:has\(input\[type="text"\]\)::before,[\s\S]*?div\.sticky:has\(input\[type="text"\]\)::after\s*\{[\s\S]*?content:\s*none !important;[\s\S]*?box-shadow:\s*none !important;/,
      "Sticky composer pseudo-elements must not recreate the bottom shadow.");
    assert.match(css,
      /div\.no-drag:has\(> input\[type="text"\]\)\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*inset 0 0 0 1px var\(--ds-immersive-line\) !important;/,
      "The input surface must stay transparent while retaining only its boundary line.");
    assert.match(css,
      /ComposerLayoutRoot[\s\S]*?background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.10\) !important;[\s\S]*?box-shadow:\s*\n?\s*inset 0 0 0 1px var\(--ds-immersive-line\),/,
      "The current CSS-module composer root must use a translucent micro-highlight surface.");
    assert.match(css,
      /\.sticky:has\(:is\(input\[type="text"\], textarea, \[contenteditable="true"\], \[role="textbox"\]\)\)\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
      "Sticky hosts with modern textarea/contenteditable inputs must not retain the bottom shadow.");
    assert.match(css,
      /\[class~="from-token-main-surface-primary"\]\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?background-image:\s*none !important;[\s\S]*?box-shadow:\s*none !important;/,
      "All workspace-owned native bottom fade surfaces must be transparent.");
    assert.match(css,
      /Wide mode paints the artwork on body[\s\S]*?content:\s*none !important;[\s\S]*?background-image:\s*none !important;/,
      "Wide task pages must not retain the legacy vertical task-fade pseudo-element.");
    assert.match(css,
      /Codex 26\.810 renders the remaining black band[\s\S]*?\.sticky:has\(:is\(input\[type="text"\], textarea, \[contenteditable="true"\], \[role="textbox"\]\)\)\s+\[class~="pointer-events-none"\]\[class~="absolute"\]\[class~="bg-gradient-to-t"\]\[class~="from-surface"\]\s*\{[\s\S]*?display:\s*none !important;/,
      "The confirmed Codex 26.810 sticky-child gradient must be removed.");
    assert.match(css,
      /Codex 26\.818 keeps the bottom sticky gradient[\s\S]*?\.thread-scroll-container:has\(\[data-ds-part="composer"\], \[class\*="_ComposerLayoutRoot_"\]\)[\s\S]*?\.sticky\s+\[class~="pointer-events-none"\]\[class~="absolute"\]\[class~="bg-gradient-to-t"\]\[class~="from-surface"\][\s\S]*?display:\s*none !important;/,
      "The current sibling-layout sticky gradient must be removed only when a task thread owns the composer.");
    assert.match(css,
      /Codex 26\.818 keeps the bottom sticky gradient[\s\S]*?\.thread-scroll-container:has\(\[data-ds-part="composer"\], \[class\*="_ComposerLayoutRoot_"\]\)[\s\S]*?\.min-w-0:has\(\[class\*="_ComposerLayoutRoot_"\]\)\s+\[class~="pointer-events-none"\]\[class~="absolute"\]\[class~="bg-gradient-to-t"\]\[class~="from-surface"\][\s\S]*?display:\s*none !important;/,
      "The current composer-root gradient must be removed without changing the composer surface itself.");
    assert.match(css,
      /Approval replaces the textbox[\s\S]*?\.thread-scroll-container:has\(\[data-codex-approval-surface\]\)[\s\S]*?\.sticky\s+\[class~=\"pointer-events-none\"\]\[class~=\"absolute\"\]\[class~=\"bg-gradient-to-t\"\]\[class~=\"from-surface\"\][\s\S]*?display:\s*none !important;/,
      "Approval state must remove the sibling-layout sticky gradient without changing ordinary input composers.");
    assert.match(css,
      /Approval replaces the textbox[\s\S]*?\.thread-scroll-container:has\(\[data-codex-approval-surface\]\)[\s\S]*?\.min-w-0:has\(\[class\*="_ComposerLayoutRoot_"\]\)\s+\[class~=\"pointer-events-none\"\]\[class~=\"absolute\"\]\[class~=\"bg-gradient-to-t\"\]\[class~=\"from-surface\"\][\s\S]*?display:\s*none !important;/,
      "Approval state must remove the sibling composer-root gradient without changing the composer surface itself.");
    assert.match(css,
      /data-codex-approval-surface[\s\S]*?\.sticky:has\(\[data-codex-approval-surface\]\)\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
      "Approval chrome must clear its replacement sticky host even when no textbox is mounted.");
    assert.match(css,
      /\.sticky:has\(\[data-codex-approval-surface\]\)[\s\S]*?\[class~="pointer-events-none"\]\[class~="absolute"\]\[class~="bg-gradient-to-t"\][\s\S]*?display:\s*none !important;/,
      "Approval chrome must remove the replacement sticky gradient child.");
    assert.match(css,
      /The wide task composer has a more specific surface rule above[\s\S]*?\.sticky:has\(\[data-codex-approval-surface\]\)\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
      "Approval chrome must outrank the wide composer surface rule without broadening the ordinary composer override.");
    assert.match(css,
      /Turn diff cards inherit dark native token surfaces[\s\S]*?\[class~="bg-surface-elevated-secondary\/50"\]:has\(> \[class~="group\/turn-diff-header"\]\)\s*\{[\s\S]*?background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.34\) !important;[\s\S]*?box-shadow:\s*0 0 0 \.5px rgb\(var\(--ds-muted-rgb\) \/ \.16\) !important;/,
      "Turn diff cards must use a lighter translucent surface and a restrained edge shadow.");
    assert.match(css,
      /Turn diff cards inherit dark native token surfaces[\s\S]*?\[class~="bg-surface-elevated-secondary\/50"\]:has\(> \[class~="group\/turn-diff-header"\]\)\s+\[class~="bg-surface\/70"\]\s*\{[\s\S]*?background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.28\) !important;/,
      "Turn diff file rows must not retain the native opaque black surface.");
  });

  test(`overlay dialogs use the same transparent micro-highlight treatment in ${file}`, () => {
    const css = readFileSync(join(root, file), "utf8");
    assert.match(css,
      /Overlay dialogs stay on the artwork glass layer[\s\S]*?:is\(\[role="dialog"\], \[aria-modal="true"\], \[data-ds-part="dialog"\]\)\s*\{[\s\S]*?background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.10\) !important;[\s\S]*?background-image:\s*none !important;[\s\S]*?box-shadow:\s*\n?\s*inset 0 0 0 1px var\(--ds-immersive-line\),[\s\S]*?backdrop-filter:\s*none !important;/,
      "Overlay dialogs must not retain an opaque native surface or a large drop shadow.");
    assert.match(css,
      /:is\(\[role="dialog"\], \[aria-modal="true"\], \[data-ds-part="dialog"\]\)::before,[\s\S]*?::after\s*\{[\s\S]*?content:\s*none !important;[\s\S]*?box-shadow:\s*none !important;/,
      "Overlay dialog pseudo-elements must not recreate a gradient shadow.");
    assert.match(css,
      /:has\(:is\(\[role="dialog"\], \[aria-modal="true"\], \[data-ds-part="dialog"\]\)\) body::after\s*\{[\s\S]*?content:\s*none !important;[\s\S]*?box-shadow:\s*none !important;[\s\S]*?opacity:\s*0 !important;/,
      "The global state glow must be disabled while an in-page dialog is open.");
  });

  test(`theme chrome does not add signature text or decorative dots in ${file}`, () => {
    const css = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(css, /content:\s*var\(--dream-skin-name/,
      "The home hero must not add a duplicate theme-name signature.");
    assert.doesNotMatch(css, /content:\s*var\(--dream-skin-quote/,
      "The workspace must not add a decorative quote signature.");
    assert.doesNotMatch(css, /button\[aria-label\^="切换模式"\]::after/,
      "The native mode switch must not receive an extra decorative dot.");
  });
}
