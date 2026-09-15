import assert = require("assert");
import fs = require("fs");
import path = require("path");

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const chatContent = read("src/pages/chat/queryChat/ChatContent.tsx");
const mergeDetail = read(
  "src/pages/chat/queryChat/MessageItem/MergeMessageDetailModal.tsx",
);
const fileMessageRender = read(
  "src/pages/chat/queryChat/MessageItem/FileMessageRender.tsx",
);

assert.match(
  chatContent,
  /const mergeMessages = isMerge\s*\?\s*\(JSON\.parse\(JSON\.stringify\(messages\)\) as MessageItemType\[\]\)\s*:\s*messages;/,
  "merge forwarding must freeze the selected message payload before target selection",
);
assert.match(
  chatContent,
  /messageList: mergeMessages/,
  "the SDK must receive the frozen selection rather than live message objects",
);
assert.match(
  chatContent,
  /items=\{imagePreviewItems\}[\s\S]*?\/>\s*<Virtuoso/,
  "the normal chat preview must be self-closing and sibling to the virtual message list",
);
assert.match(
  chatContent,
  /const ipcInvoke = window\.electronAPI\?\.ipcInvoke;/,
  "the normal chat preview must retain an IPC reference after its save-as guard",
);
assert.match(
  mergeDetail,
  /import \{ copyImageToClipboard \} from "@\/utils\/imageClipboard";/,
  "merge detail images must use the existing native image clipboard helper",
);
assert.match(
  mergeDetail,
  /select-text/,
  "merge detail text must opt out of the application's global user-select:none rule",
);
assert.doesNotMatch(
  mergeDetail,
  /dangerouslySetInnerHTML/,
  "merge detail text must render as plain text so copied text is not generated HTML",
);
assert.match(
  mergeDetail,
  /copyImageToClipboard\(orig\)/,
  "copying a merge detail image must use its source image URL",
);
assert.match(
  mergeDetail,
  /const displayUrl = pic\?\.snapshotPicture\?\.url \|\| pic\?\.sourcePicture\?\.url \|\| "";/,
  "merge detail must resolve one display URL for the clicked image",
);
assert.match(
  mergeDetail,
  /src=\{displayUrl\}[\s\S]*?preview=\{false\}[\s\S]*?onImagePreview\(getMergeImagePreviewKey\(message\)\)/,
  "the merge image thumbnail must explicitly open the controlled merge gallery",
);
assert.match(
  mergeDetail,
  /const \[mergePreviewVisible, setMergePreviewVisible\] = useState\(false\);/,
  "merge detail must own its preview visibility instead of relying on an ancestor gallery",
);
assert.match(
  mergeDetail,
  /const \[mergePreviewCurrent, setMergePreviewCurrent\] = useState\(0\);/,
  "merge detail must own its current gallery position",
);
assert.match(
  mergeDetail,
  /const \[mergePreviewScale, setMergePreviewScale\] = useState\(1\);/,
  "merge detail must own its preview zoom state",
);
assert.match(
  mergeDetail,
  /const \[mergePreviewRotate, setMergePreviewRotate\] = useState\(0\);/,
  "merge detail must own its preview rotation state",
);
assert.doesNotMatch(
  mergeDetail,
  /<Image\.PreviewGroup/,
  "merge detail must not use rc-image's non-interactive preview layer",
);
assert.match(
  mergeDetail,
  /preview=\{false\}[\s\S]*?onImagePreview\(getMergeImagePreviewKey\(message\)\)/,
  "direct merge images must explicitly open the merge gallery rather than register with a parent gallery",
);
assert.match(
  mergeDetail,
  /preview=\{false\}[\s\S]*?onImagePreview\(\)/,
  "quoted merge images must explicitly open the same merge gallery",
);
assert.match(
  mergeDetail,
  /import \{ inferDownloadFileName \} from "@\/utils\/downloadFileName";/,
  "merge detail previews must use the normal image download filename resolver",
);
assert.match(
  mergeDetail,
  /const mergeImagePreviewItems = useMemo\([\s\S]*?collectMergeImagePreviewItems\(mergeElem\?\.multiMessage\)/,
  "merge detail must build an ordered local gallery from the merged messages",
);
assert.match(
  mergeDetail,
  /const currentPreviewItem = mergeImagePreviewItems\[mergePreviewCurrent\];/,
  "merge detail controls must resolve downloads from the active gallery image",
);
assert.match(
  mergeDetail,
  /onClick=\{handlePreviewDownload\}[\s\S]*?onClick=\{handlePreviewSaveAs\}/,
  "merge detail preview controls must expose download and save-as actions",
);
assert.match(
  mergeDetail,
  /aria-label="Close image preview"[\s\S]*?className="absolute right-5 top-16 /,
  "merge preview close control must stay below the frameless window title-bar controls",
);
assert.match(
  mergeDetail,
  /aria-label="Close image preview"[\s\S]*?onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*handlePreviewClose\(\);\s*\}\}/,
  "closing the preview must not bubble beyond the controlled preview overlay",
);
assert.match(
  mergeDetail,
  /transform:\s*`translate\(\$\{mergePreviewTranslate\.x\}px, \$\{mergePreviewTranslate\.y\}px\) rotate\(\$\{mergePreviewRotate\}deg\) scale\(\$\{mergePreviewScale\}\) scaleX\(\$\{mergePreviewFlipX \? -1 : 1\}\) scaleY\(\$\{mergePreviewFlipY \? -1 : 1\}\)`/,
  "merge detail must render transforms through its own interactive viewer",
);
assert.match(
  mergeDetail,
  /onClick=\{\(\) =>\s*setMergePreviewRotate\(\(rotate\) => rotate - 90\)\s*\}[\s\S]*?onClick=\{\(\) =>\s*setMergePreviewRotate\(\(rotate\) => rotate \+ 90\)\s*\}[\s\S]*?onClick=\{\(\) =>\s*setMergePreviewScale\(\(scale\) => Math\.max\(0\.25, scale - 0\.25\)\)\s*\}[\s\S]*?onClick=\{\(\) =>\s*setMergePreviewScale\(\(scale\) => Math\.min\(5, scale \+ 0\.25\)\)\s*\}/,
  "merge detail viewer must provide active rotate and zoom controls",
);
assert.match(
  mergeDetail,
  /import FileMessageRender from "\.\/FileMessageRender";/,
  "merge detail files must reuse the normal conversation file renderer",
);
assert.match(
  mergeDetail,
  /<FileMessageRender message=\{m\} isSender=\{false\} \/>/,
  "quoted merge files must reuse the normal conversation file renderer",
);
assert.match(
  mergeDetail,
  /<FileMessageRender message=\{message\} isSender=\{false\} \/>/,
  "direct merge files must reuse the normal conversation file renderer",
);
assert.doesNotMatch(
  mergeDetail,
  /const MergeFileActions/,
  "merge detail must not maintain a separate file action implementation",
);
assert.doesNotMatch(
  fileMessageRender,
  /IMessageItemProps/,
  "the normal file renderer must accept the narrow props needed by merge detail reuse",
);

console.log("mergeForwardDetail tests passed");
