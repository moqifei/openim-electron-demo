import assert = require("assert");

const common = require("../src/utils/common.ts");

assert.equal(
  typeof common.formatPlainTextAsHtml,
  "function",
  "message text formatter should escape untrusted HTML before rendering",
);

assert.equal(
  common.formatPlainTextAsHtml(
    "<meta http-equiv=\"refresh\" content=\"1;url=/login\">\n<script>alert('xss')</script> & text",
  ),
  "&lt;meta http-equiv=&quot;refresh&quot; content=&quot;1;url=/login&quot;&gt;<br>&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt; &amp; text",
  "untrusted message content must remain visible text while line breaks stay readable",
);

console.log("safe message HTML tests passed");
