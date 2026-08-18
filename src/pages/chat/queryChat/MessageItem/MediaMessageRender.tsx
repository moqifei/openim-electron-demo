import { DownloadOutlined } from "@ant-design/icons";
import { MessageStatus } from "@openim/wasm-client-sdk";
import { Image, Spin } from "antd";
import { FC } from "react";

import { downloadFileWithProgress } from "@/utils/fileDownload";

import { IMessageItemProps } from ".";

const min = (a: number, b: number) => (a > b ? b : a);

const MediaMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const imageHeight = message.pictureElem!.sourcePicture.height;
  const imageWidth = message.pictureElem!.sourcePicture.width;
  const snapshotMaxHeight = message.pictureElem!.snapshotPicture?.height ?? imageHeight;
  const minHeight = min(200, imageWidth) * (imageHeight / imageWidth) + 2;
  const adaptedHight = min(minHeight, snapshotMaxHeight) + 10;
  const adaptedWidth = min(imageWidth, 200) + 10;

  const sourceUrl =
    message.pictureElem!.snapshotPicture?.url || message.pictureElem!.sourcePicture.url;
  const originalUrl = message.pictureElem!.sourcePicture.url;
  const isSending = message.status === MessageStatus.Sending;
  const minStyle = { minHeight: `${adaptedHight}px`, minWidth: `${adaptedWidth}px` };

  const handleDownload = async () => {
    try {
      await downloadFileWithProgress({
        url: originalUrl,
        showProgressToast: true,
        progressTitle: "Downloading...",
      });
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <Spin spinning={isSending}>
      <div className="relative max-w-[200px]" style={minStyle}>
        <Image
          rootClassName="message-image cursor-pointer"
          className="max-w-[200px] rounded-lg border border-[var(--border-color)] shadow-sm"
          src={sourceUrl}
          preview={{
            toolbarRender: (originalNode) => (
              <div className="flex items-center gap-3">
                {originalNode}
                <DownloadOutlined
                  className="cursor-pointer text-lg text-white"
                  onClick={handleDownload}
                />
              </div>
            ),
          }}
          placeholder={
            <div style={minStyle} className="flex items-center justify-center">
              <Spin />
            </div>
          }
        />
      </div>
    </Spin>
  );
};

export default MediaMessageRender;
