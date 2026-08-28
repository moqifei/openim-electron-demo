import assert = require("assert");
import fs = require("fs");
import path = require("path");

const file = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/pages/chat/queryChat/ChatFooter/SendActionBar/index.tsx",
  ),
  "utf8",
);

assert.ok(
  /import \{[\s\S]*canUseShake[\s\S]*\} from "@\/utils\/shakeMessage"/.test(
    file,
  ),
  "send action bar should use the shared shake policy",
);
assert.ok(
  file.includes("const currentConversation = useConversationStore"),
  "send action bar should read the active conversation",
);
assert.ok(
  file.includes("const canSendShake = canUseShake(currentConversation)"),
  "send action bar should compute the shake visibility policy",
);
assert.ok(
  /canSendShake\s*&&\s*\(\s*<div[\s\S]*?title="抖一抖"/.test(file),
  "shake button should only render when the policy allows it",
);
assert.ok(
  /const handleShake = async \(\) => \{[\s\S]*?if \(!canSendShake\) return;/.test(
    file,
  ),
  "shake handler should reject disallowed conversations",
);

console.log("shakeSendBehavior tests passed");
