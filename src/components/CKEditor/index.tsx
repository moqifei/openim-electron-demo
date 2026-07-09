import "./index.scss";
import "ckeditor5/ckeditor5.css";

import { ClassicEditor } from "@ckeditor/ckeditor5-editor-classic";
import { Essentials } from "@ckeditor/ckeditor5-essentials";
import { Paragraph } from "@ckeditor/ckeditor5-paragraph";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type CKEditorRef = {
  focus: (moveToEnd?: boolean) => void;
  insertText: (text: string) => void;
  setText: (text: string) => void;
  getEditor: () => ClassicEditor | null;
};

interface CKEditorProps {
  value: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onEnter?: () => void;
  onPasteFile?: (files: File[]) => void;
  onKeydown?: (event: KeyboardEvent) => void;
}

export interface EmojiData {
  src: string;
  alt: string;
}

const keyCodes = {
  delete: 46,
  backspace: 8,
  composing: 229,
};

const Index: ForwardRefRenderFunction<CKEditorRef, CKEditorProps> = (
  { value, placeholder, onChange, onEnter, onPasteFile, onKeydown },
  ref,
) => {
  const ckEditor = useRef<ClassicEditor | null>(null);
  const onEnterRef = useRef(onEnter);
  const onPasteFileRef = useRef(onPasteFile);
  const onKeydownRef = useRef(onKeydown);
  const pasteCleanupRef = useRef<(() => void) | null>(null);

  onEnterRef.current = onEnter;
  onPasteFileRef.current = onPasteFile;
  onKeydownRef.current = onKeydown;

  const focus = (moveToEnd = false) => {
    const editor = ckEditor.current;

    if (editor) {
      const model = editor.model;
      const view = editor.editing.view;
      const root = model.document.getRoot();
      if (moveToEnd && root) {
        const range = model.createRange(model.createPositionAt(root, "end"));

        model.change((writer) => {
          writer.setSelection(range);
        });
      }
      view.focus();
    }
  };

  const insertText = (text: string) => {
    const editor = ckEditor.current;
    if (!editor) return;
    editor.model.change((writer) => {
      const insertPosition = editor.model.document.selection.getFirstPosition();
      writer.insertText(text, insertPosition!);
    });
    editor.editing.view.focus();
    onChange?.(editor.getData());
  };

  const setText = (text: string) => {
    const editor = ckEditor.current;
    if (!editor) return;
    editor.model.change((writer) => {
      const root = editor.model.document.getRoot();
      if (!root) return;
      writer.remove(writer.createRangeIn(root));
      writer.insertText(text, root, 0);
    });
    editor.editing.view.focus();
    onChange?.(editor.getData());
  };

  const listenKeydown = (editor: ClassicEditor) => {
    editor.editing.view.document.on(
      "keydown",
      (evt, data) => {
        const isComposing =
          editor.editing.view.document.isComposing ||
          data.keyCode === keyCodes.composing ||
          Boolean((data.domEvent as KeyboardEvent | undefined)?.isComposing);

        // debug: log all key events
        console.log(
          "[CKEditor keydown]",
          "keyCode:",
          data.keyCode,
          "key:",
          data.domEvent?.key,
          "shift:",
          data.domEvent?.shiftKey,
          "isComposing:",
          isComposing,
        );
        if (isComposing) {
          return;
        }

        // Forward event to parent first (for @mention detection)
        if (onKeydownRef.current) {
          try {
            onKeydownRef.current(data.domEvent as unknown as KeyboardEvent);
          } catch (e) {
            console.error("[CKEditor] onKeydown callback error:", e);
          }
        }
        if (data.keyCode === 13 && !data.shiftKey) {
          data.preventDefault();
          evt.stop();
          onEnterRef.current?.();
          return;
        }
        if (data.keyCode === keyCodes.backspace || data.keyCode === keyCodes.delete) {
          const selection = editor.model.document.selection;
          const hasSelectContent = !editor.model.getSelectedContent(selection).isEmpty;
          const hasEditorContent = Boolean(editor.getData());

          if (!hasEditorContent) {
            return;
          }

          if (hasSelectContent) return;
        }
      },
      { priority: "high" },
    );
  };

  const listenPaste = (editor: ClassicEditor) => {
    const editableElement = editor.ui.view.editable.element;
    if (!editableElement) return null;

    const handler = (e: ClipboardEvent) => {
      const files: File[] = [];
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }
      if (files.length === 0 && e.clipboardData?.files.length) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          files.push(e.clipboardData.files[i]);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onPasteFileRef.current?.(files);
      }
    };

    editableElement.addEventListener("paste", handler);
    return () => editableElement.removeEventListener("paste", handler);
  };

  useEffect(() => {
    return () => {
      pasteCleanupRef.current?.();
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus,
      insertText,
      setText,
      getEditor: () => ckEditor.current,
    }),
    [],
  );

  return (
    <CKEditor
      editor={ClassicEditor}
      data={value}
      config={{
        placeholder,
        toolbar: [],
        image: {
          toolbar: [],
          insert: {
            type: "inline",
          },
        },
        plugins: [Essentials, Paragraph],
      }}
      onReady={(editor) => {
        ckEditor.current = editor;
        listenKeydown(editor);
        pasteCleanupRef.current = listenPaste(editor);
        focus(true);
      }}
      onChange={(event, editor) => {
        const data = editor.getData();
        onChange?.(data);
      }}
    />
  );
};

export default memo(forwardRef(Index));
