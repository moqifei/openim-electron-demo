import { useCallback, useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

interface SelectRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DrawElementRect {
  type: "rect";
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DrawElementLine {
  type: "line";
  color: string;
  points: Point[];
}

interface DrawElementText {
  type: "text";
  color: string;
  x: number;
  y: number;
  text: string;
}

type DrawElement = DrawElementRect | DrawElementLine | DrawElementText;

type Tool = "select" | "rect" | "line" | "text";

const COLORS = ["#ff0000", "#00aa00", "#0066ff", "#ffaa00", "#000000", "#ffffff"];

interface ScreenshotCropperProps {
  imageSrc: string;
  onConfirm: (croppedBase64: string) => void;
  onCancel: () => void;
}

export default function ScreenshotCropper({
  imageSrc,
  onConfirm,
  onCancel,
}: ScreenshotCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(COLORS[0]);
  const [elements, setElements] = useState<DrawElement[]>([]);
  const [draftElement, setDraftElement] = useState<DrawElement | null>(null);
  const [selectRect, setSelectRect] = useState<SelectRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const dragStart = useRef<Point>({ x: 0, y: 0 });

  const [textInput, setTextInput] = useState<{
    x: number;
    y: number;
    cssX: number;
    cssY: number;
    value: string;
  } | null>(null);

  // Load image and compute canvas size
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = window.innerWidth * 0.95;
      const maxH = window.innerHeight * 0.78;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxW || h > maxH) {
        const scale = Math.min(maxW / w, maxH / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      setCanvasSize({ w, h });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Convert CSS pixel to canvas logical pixel
  const getCanvasPos = useCallback((e: React.MouseEvent | MouseEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Get CSS pixel position for overlay elements (text input)
  const getCssPos = useCallback((logicalPos: Point): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      x: rect.left + logicalPos.x * scaleX,
      y: rect.top + logicalPos.y * scaleY,
    };
  }, []);

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    const { w, h } = canvasSize;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const allElements = draftElement ? [...elements, draftElement] : elements;

    allElements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (el.type === "rect") {
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === "line" && el.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === "text" && el.text) {
        ctx.font = "16px sans-serif";
        ctx.fillText(el.text, el.x, el.y);
      }
    });

    // Draw select rect overlay
    if (selectRect && selectRect.w > 0 && selectRect.h > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.rect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);
      ctx.fill("evenodd");
      ctx.strokeStyle = "#1890ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);

      // Size label
      const label = `${Math.round(selectRect.w)} × ${Math.round(selectRect.h)}`;
      ctx.font = "12px sans-serif";
      const textMetrics = ctx.measureText(label);
      const labelW = textMetrics.width + 10;
      const labelH = 22;
      const labelX = selectRect.x;
      let labelY = selectRect.y - labelH - 4;
      if (labelY < 0) labelY = selectRect.y + selectRect.h + 4;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(labelX, labelY, labelW, labelH);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, labelX + 5, labelY + 15);
    }
  }, [canvasSize, elements, draftElement, selectRect]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const pos = getCanvasPos(e);
      dragStart.current = pos;
      setIsDrawing(true);
      setHasDragged(false);

      if (tool === "select") {
        setSelectRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
      } else if (tool === "rect") {
        setDraftElement({ type: "rect", color, x: pos.x, y: pos.y, w: 0, h: 0 });
      } else if (tool === "line") {
        setDraftElement({ type: "line", color, points: [pos] });
      }
    },
    [tool, color, getCanvasPos],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;
      const pos = getCanvasPos(e);
      if (
        Math.abs(pos.x - dragStart.current.x) > 2 ||
        Math.abs(pos.y - dragStart.current.y) > 2
      ) {
        setHasDragged(true);
      }

      if (tool === "select") {
        setSelectRect({
          x: Math.min(dragStart.current.x, pos.x),
          y: Math.min(dragStart.current.y, pos.y),
          w: Math.abs(pos.x - dragStart.current.x),
          h: Math.abs(pos.y - dragStart.current.y),
        });
      } else if (tool === "rect" && draftElement?.type === "rect") {
        setDraftElement({
          ...draftElement,
          x: Math.min(dragStart.current.x, pos.x),
          y: Math.min(dragStart.current.y, pos.y),
          w: Math.abs(pos.x - dragStart.current.x),
          h: Math.abs(pos.y - dragStart.current.y),
        });
      } else if (tool === "line" && draftElement?.type === "line") {
        setDraftElement({
          ...draftElement,
          points: [...draftElement.points, pos],
        });
      }
    },
    [isDrawing, tool, draftElement, getCanvasPos],
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "text" && !hasDragged) {
      const cssPos = getCssPos(dragStart.current);
      setTextInput({
        x: dragStart.current.x,
        y: dragStart.current.y,
        cssX: cssPos.x,
        cssY: cssPos.y,
        value: "",
      });
      return;
    }

    if (draftElement) {
      setElements((prev) => [...prev, draftElement]);
      setDraftElement(null);
    }
  }, [isDrawing, tool, hasDragged, draftElement, getCssPos]);

  const commitText = useCallback(() => {
    if (textInput && textInput.value.trim()) {
      setElements((prev) => [
        ...prev,
        {
          type: "text",
          color,
          x: textInput.x,
          y: textInput.y + 14,
          text: textInput.value.trim(),
        },
      ]);
    }
    setTextInput(null);
  }, [textInput, color]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (textInput) {
          setTextInput(null);
        } else {
          onCancel();
        }
      }
    },
    [textInput, onCancel],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getOriginalScale = useCallback(() => {
    const img = imgRef.current;
    if (!img || canvasSize.w === 0) return { sx: 1, sy: 1 };
    return {
      sx: img.naturalWidth / canvasSize.w,
      sy: img.naturalHeight / canvasSize.h,
    };
  }, [canvasSize]);

  const drawOntoCanvas = useCallback(
    (
      targetCtx: CanvasRenderingContext2D,
      _targetW: number,
      _targetH: number,
      drawElements: DrawElement[],
    ) => {
      const { sx, sy } = getOriginalScale();
      const lineW = Math.max(2, Math.round(2 * sx));

      drawElements.forEach((el) => {
        targetCtx.strokeStyle = el.color;
        targetCtx.fillStyle = el.color;
        targetCtx.lineWidth = lineW;
        targetCtx.lineCap = "round";
        targetCtx.lineJoin = "round";

        if (el.type === "rect") {
          targetCtx.strokeRect(el.x * sx, el.y * sy, el.w * sx, el.h * sy);
        } else if (el.type === "line" && el.points.length > 1) {
          targetCtx.beginPath();
          targetCtx.moveTo(el.points[0].x * sx, el.points[0].y * sy);
          for (let i = 1; i < el.points.length; i++) {
            targetCtx.lineTo(el.points[i].x * sx, el.points[i].y * sy);
          }
          targetCtx.stroke();
        } else if (el.type === "text" && el.text) {
          targetCtx.font = `${Math.round(16 * sx)}px sans-serif`;
          targetCtx.fillText(el.text, el.x * sx, el.y * sy);
        }
      });
    },
    [getOriginalScale],
  );

  const handleSave = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;

    const saveCanvas = document.createElement("canvas");
    saveCanvas.width = img.naturalWidth;
    saveCanvas.height = img.naturalHeight;
    const ctx = saveCanvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    drawOntoCanvas(ctx, saveCanvas.width, saveCanvas.height, elements);

    const link = document.createElement("a");
    link.download = `screenshot_${Date.now()}.png`;
    link.href = saveCanvas.toDataURL("image/png");
    link.click();
  }, [elements, drawOntoCanvas]);

  const handleConfirm = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;

    if (selectRect && selectRect.w > 5 && selectRect.h > 5) {
      const { sx, sy } = getOriginalScale();
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = Math.round(selectRect.w * sx);
      cropCanvas.height = Math.round(selectRect.h * sy);
      const ctx = cropCanvas.getContext("2d")!;
      ctx.drawImage(
        img,
        selectRect.x * sx,
        selectRect.y * sy,
        selectRect.w * sx,
        selectRect.h * sy,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height,
      );
      onConfirm(cropCanvas.toDataURL("image/png"));
    } else {
      // Send full annotated image at original resolution
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = img.naturalWidth;
      fullCanvas.height = img.naturalHeight;
      const ctx = fullCanvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      drawOntoCanvas(ctx, fullCanvas.width, fullCanvas.height, elements);
      onConfirm(fullCanvas.toDataURL("image/png"));
    }
  }, [selectRect, elements, onConfirm, getOriginalScale, drawOntoCanvas]);

  const toolBtnClass = (t: Tool) =>
    `flex h-8 w-8 items-center justify-center rounded transition-colors ${
      tool === t
        ? "bg-blue-500 text-white"
        : "text-gray-300 hover:bg-gray-700 hover:text-white"
    }`;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85"
    >
      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-800/95 px-4 py-2 shadow-xl">
        <button
          title="选区"
          className={toolBtnClass("select")}
          onClick={() => setTool("select")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
          </svg>
        </button>
        <button
          title="矩形"
          className={toolBtnClass("rect")}
          onClick={() => setTool("rect")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="10" height="10" />
          </svg>
        </button>
        <button
          title="画线"
          className={toolBtnClass("line")}
          onClick={() => setTool("line")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 14L14 2" />
          </svg>
        </button>
        <button
          title="文字"
          className={toolBtnClass("text")}
          onClick={() => setTool("text")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 3h8M8 3v10M5 13h6" />
          </svg>
        </button>

        <div className="mx-1 h-5 w-px bg-gray-600" />

        {COLORS.map((c) => (
          <button
            key={c}
            className={`h-5 w-5 rounded-full border-2 transition-transform ${
              color === c ? "scale-110 border-white" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}

        <div className="mx-1 h-5 w-px bg-gray-600" />

        <button
          onClick={handleSave}
          className="rounded px-3 py-1 text-sm text-white hover:bg-gray-700"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="rounded px-3 py-1 text-sm text-white hover:bg-gray-700"
        >
          取消
        </button>
        <button
          onClick={handleConfirm}
          className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
        >
          确认
        </button>
      </div>

      {/* Canvas container */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className={`select-none shadow-2xl ${
            tool === "text" ? "cursor-text" : "cursor-crosshair"
          }`}
          style={{ maxWidth: "95vw", maxHeight: "78vh" }}
          onMouseDown={tool === "text" ? undefined : handleMouseDown}
          onMouseMove={tool === "text" ? undefined : handleMouseMove}
          onMouseUp={tool === "text" ? undefined : handleMouseUp}
          onMouseLeave={tool === "text" ? undefined : handleMouseUp}
          onClick={
            tool === "text"
              ? (e) => {
                  const pos = getCanvasPos(e);
                  const cssPos = getCssPos(pos);
                  setTextInput({
                    x: pos.x,
                    y: pos.y,
                    cssX: cssPos.x,
                    cssY: cssPos.y,
                    value: "",
                  });
                }
              : undefined
          }
        />

        {/* Text input overlay */}
        {textInput && (
          <input
            autoFocus
            className="absolute z-10 border border-blue-500 bg-transparent px-1 text-base outline-none"
            style={{
              left: textInput.cssX,
              top: textInput.cssY,
              color: color,
              minWidth: 80,
              fontSize: 16,
              lineHeight: "20px",
              textShadow: color === "#ffffff" ? "0 0 2px #000" : "none",
            }}
            value={textInput.value}
            onChange={(e) =>
              setTextInput((prev) => (prev ? { ...prev, value: e.target.value } : null))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitText();
              }
            }}
            onBlur={commitText}
          />
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {tool === "select" && "拖拽选择区域，确认后加入聊天输入区"}
        {tool === "rect" && "拖拽绘制矩形"}
        {tool === "line" && "拖拽绘制线条"}
        {tool === "text" && "点击画布输入文字"}
      </div>
    </div>
  );
}
