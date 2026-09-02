const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx",
  ),
  "utf8",
);

assert.match(
  source,
  /import \{[\s\S]*canUseShake[\s\S]*\} from "@\/utils\/shakeMessage"/,
  "send action bar should use the shared shake policy",
);
assert.match(
  source,
  /const currentConversation = useConversationStore[\s\S]*?currentConversation/,
  "send action bar should read the active conversation",
);
assert.match(
  source,
  /const canSendShake = canUseShake\(currentConversation\)/,
  "send action bar should compute the shake visibility policy",
);
assert.match(
  source,
  /canSendShake\s*&&\s*\([\s\S]*?title="抖一抖"/,
  "shake button should only render when the policy allows it",
);
assert.match(
  source,
  /const handleShake = async \(\) => \{[\s\S]*?if \(!canSendShake\) return;[\s\S]*?createCustomMessage[\s\S]*?buildShakeMessageData\(\)[\s\S]*?CHAT_SHAKE_TEXT[\s\S]*?sendMessage\(\{[\s\S]*?message[\s\S]*?recvID:/,
  "shake handler should create and send the 901 custom message to the active peer",
);
assert.match(
  source,
  /const handleShake = async \(\) => \{[\s\S]*?await sendMessage\([\s\S]*?window\.electronAPI\?\.ipcSend\("shakeMainWindow",[\s\S]*?durationMs: 1000/,
  "shake sender should also request a local window shake",
);

console.log("shakeSendBehavior test passed");
