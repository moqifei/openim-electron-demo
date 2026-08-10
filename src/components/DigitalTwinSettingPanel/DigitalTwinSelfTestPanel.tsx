import { Button, Input } from "antd";
import { FC, useMemo, useState } from "react";
import type { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";

import { DigitalTwinConfig } from "@/api/digitalTwin";
import { selfTestDigitalTwinReply } from "@/api/digitalTwin";
import { feedbackToast } from "@/utils/common";
import DigitalTwinMessageRender from "@/pages/chat/queryChat/MessageItem/DigitalTwinMessageRender";

type RawCitation = {
  slug?: string;
  title?: string;
  spaceName?: string;
  similarity?: number;
  relevanceScore?: number;
  scope?: { name?: string };
  detail?: {
    slug?: string;
    title?: string;
    content_md?: string;
    summary?: string;
    outlinks?: string[];
    backlinks?: string[];
  };
};

type SelfTestResult = {
  message: MessageItem;
  replySource: string;
  generatorError: string | null;
  elapsedMs: number;
};

type DigitalTwinSelfTestPanelProps = {
  ownerUserID: string;
  config: DigitalTwinConfig;
};

const DIGITAL_TWIN_EXT_TYPE = "digital_twin";

const DigitalTwinSelfTestPanel: FC<DigitalTwinSelfTestPanelProps> = ({
  ownerUserID,
  config,
}) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SelfTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const knowledgeBase = useMemo(
    () => config.knowledgeBase ?? undefined,
    [config.knowledgeBase],
  );

  const handleSend = async () => {
    const text = question.trim();
    if (!text) {
      feedbackToast({ msg: "请输入要测试的问题" });
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    console.log("[SelfTest] 发送自测请求:", {
      ownerUserID,
      senderUserID: `self-test:${ownerUserID}`,
      messageContent: text,
      kbEnabled: knowledgeBase?.enabled,
    });
    const startedAt = performance.now();
    try {
      const resp = await selfTestDigitalTwinReply({
        ownerUserID,
        senderUserID: `self-test:${ownerUserID}`,
        messageContent: text,
        prompt: config.prompt,
        knowledgeBase,
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      console.log("[SelfTest] orange 原始响应:", resp);

      // 将 orange 返回映射为 DigitalTwinMessageRender 期望的 MessageItem。
      // 组件内部通过 ex(JSON 字符串) 中的 openim_ext_type / replyText / citations 解析。
      const rawCitations = (resp.citations ?? []) as unknown as RawCitation[];
      const citations = rawCitations.map((c) => ({
        title: c.title ?? c.detail?.title ?? "未命名文档",
        slug: c.slug ?? c.detail?.slug,
        spaceName: c.spaceName ?? c.scope?.name,
        relevanceScore:
          typeof c.relevanceScore === "number"
            ? c.relevanceScore
            : typeof c.similarity === "number"
              ? c.similarity
              : undefined,
        detail: c.detail
          ? {
              slug: c.detail.slug,
              title: c.detail.title,
              content_md: c.detail.content_md,
              summary: c.detail.summary,
              outlinks: c.detail.outlinks ?? [],
              backlinks: c.detail.backlinks ?? [],
            }
          : undefined,
      }));

      const ext = {
        [DIGITAL_TWIN_EXT_TYPE]: DIGITAL_TWIN_EXT_TYPE,
        replyText: resp.replyText ?? "",
        citations,
      };

      const fakeMessage = {
        clientMsgID: `self-test-${Date.now()}`,
        serverMsgID: "",
        sendID: `self-test:${ownerUserID}`,
        recvID: ownerUserID,
        senderNickname: "",
        senderFaceUrl: "",
        sessionType: 1,
        msgFrom: 0,
        contentType: 100,
        content: "",
        ex: JSON.stringify(ext),
      } as unknown as MessageItem;

      console.log("[SelfTest] 构造 message:", fakeMessage);
      setResult({
        message: fakeMessage,
        replySource: resp.replySource ?? "ai",
        generatorError: resp.generatorError ?? null,
        elapsedMs,
      });
    } catch (e) {
      console.error("[SelfTest] 请求异常:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #2a3346" }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: "#9aa7bd" }}>
        自助验证分身回复与知识库关联效果，请求仅发送至 Orange，不会触达 IM / 聊天服务，也不会向他人发送消息。
      </div>
      <Input.TextArea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="请输入要测试的问题，例如：我要请年假"
        autoSize={{ minRows: 2, maxRows: 6 }}
        style={{ marginBottom: 12 }}
        disabled={loading}
      />
      <Button
        type="primary"
        loading={loading}
        onClick={() => void handleSend()}
        style={{ marginBottom: 16 }}
      >
        发送测试
      </Button>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#3a1f24",
            color: "#ff9b9b",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          请求失败：{error}
        </div>
      )}

      {result && (
        <div
          style={{
            padding: 14,
            borderRadius: 8,
            background: "#161c2c",
            border: "1px solid #2a3346",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#9aa7bd",
              marginBottom: 8,
              display: "flex",
              gap: 12,
            }}
          >
            <span>
              耗时 {result.elapsedMs}ms · 状态{" "}
              {result.generatorError ? (
                <span style={{ color: "#ff9b9b" }}>失败</span>
              ) : (
                <span style={{ color: "#7ee0a0" }}>成功</span>
              )}
            </span>
            <span>来源 {result.replySource}</span>
          </div>

          {result.generatorError ? (
            <div style={{ color: "#ff9b9b", fontSize: 13 }}>
              {result.generatorError}
            </div>
          ) : (
            <DigitalTwinMessageRender message={result.message} isSender={false} />
          )}
        </div>
      )}
    </div>
  );
};

export default DigitalTwinSelfTestPanel;
