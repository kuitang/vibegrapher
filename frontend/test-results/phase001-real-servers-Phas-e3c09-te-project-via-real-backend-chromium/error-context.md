# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]: "[plugin:vite:css]"
    - generic [ref=e6]: "[postcss] It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin. The PostCSS plugin has moved to a separate package, so to continue using Tailwind CSS with PostCSS you'll need to install `@tailwindcss/postcss` and update your PostCSS configuration."
  - generic [ref=e7]: /home/kuitang/git/vibegrapher/frontend/src/index.css:undefined:null
  - generic [ref=e8]:
    - text: at We (
    - generic [ref=e9] [cursor=pointer]: /home/kuitang/git/vibegrapher/frontend/node_modules/tailwindcss/dist/lib.js:35:2121
    - text: ) at LazyResult.runOnRoot (
    - generic [ref=e10] [cursor=pointer]: /home/kuitang/git/vibegrapher/frontend/node_modules/postcss/lib/lazy-result.js:361:16
    - text: ) at LazyResult.runAsync (
    - generic [ref=e11] [cursor=pointer]: /home/kuitang/git/vibegrapher/frontend/node_modules/postcss/lib/lazy-result.js:290:26
    - text: ) at LazyResult.async (
    - generic [ref=e12] [cursor=pointer]: /home/kuitang/git/vibegrapher/frontend/node_modules/postcss/lib/lazy-result.js:192:30
    - text: ) at LazyResult.then (
    - generic [ref=e13] [cursor=pointer]: /home/kuitang/git/vibegrapher/frontend/node_modules/postcss/lib/lazy-result.js:436:17
    - text: )
  - generic [ref=e14]:
    - text: Click outside, press
    - generic [ref=e15]: Esc
    - text: key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e16]: server.hmr.overlay
    - text: to
    - code [ref=e17]: "false"
    - text: in
    - code [ref=e18]: vite.config.ts
    - text: .
```