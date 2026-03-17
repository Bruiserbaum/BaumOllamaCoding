import React, { useRef, useState, KeyboardEvent, useEffect, useCallback } from 'react';
import { vscode } from '../vscode';
import { AttachmentList, Attachment } from './AttachmentList';

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
  selectedModel: string;
  pendingAttachments?: Attachment[];
  onClearPendingAttachments?: () => void;
}

const VISION_MODELS = ['llava', 'bakllava', 'moondream', 'minicpm', 'llava-llama3'];

function isVisionModel(model: string): boolean {
  const lower = model.toLowerCase();
  return VISION_MODELS.some((v) => lower.includes(v));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  selectedModel,
  pendingAttachments,
  onClearPendingAttachments,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [githubUrlPrompt, setGithubUrlPrompt] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Absorb pending attachments from parent (e.g. files-selected, github-content)
  useEffect(() => {
    if (pendingAttachments && pendingAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...pendingAttachments]);
      onClearPendingAttachments?.();
    }
  }, [pendingAttachments, onClearPendingAttachments]);

  const addAttachment = useCallback((att: Omit<Attachment, 'id'>) => {
    setAttachments((prev) => [...prev, { ...att, id: generateId() }]);
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || disabled || isStreaming) return;
    onSend(text, attachments);
    setText('');
    setAttachments([]);
    setGithubUrlPrompt(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          addAttachment({
            type: 'image',
            base64,
            mimeType: item.type,
            name: 'screenshot.png',
          });
        };
        reader.readAsDataURL(blob);
        return; // Handled image paste, stop
      }
    }

    // Check if pasted text is a GitHub URL
    const pastedText = e.clipboardData?.getData('text') ?? '';
    if (pastedText.match(/^https?:\/\/(www\.)?github\.com\//)) {
      // Don't prevent default — let it be inserted into textarea, but show prompt
      setGithubUrlPrompt(pastedText);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          addAttachment({ type: 'image', base64, mimeType: file.type, name: file.name });
        };
        reader.readAsDataURL(file);
      } else {
        // Text/code file — read as UTF-8
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          addAttachment({ type: 'text', content, mimeType: file.type || 'text/plain', name: file.name });
        };
        reader.readAsText(file);
      }
    }
  };

  const handleFilePicker = () => {
    vscode.postMessage({ type: 'open-file-picker' });
  };

  const handleGithubFetch = (url: string) => {
    vscode.postMessage({ type: 'github-fetch-url', url });
    setGithubUrlPrompt(null);
  };

  const hasImageAttachment = attachments.some((a) => a.type === 'image');
  const showVisionWarning = hasImageAttachment && selectedModel && !isVisionModel(selectedModel);

  return (
    <div className="chat-input-container">
      {disabled && !isStreaming && (
        <div className="chat-input-hint">Select a model to start chatting</div>
      )}

      {githubUrlPrompt && (
        <div className="github-url-prompt">
          <span className="github-url-prompt-text">Fetch GitHub content?</span>
          <button
            className="btn-small btn-small--success"
            onClick={() => handleGithubFetch(githubUrlPrompt)}
          >
            Yes
          </button>
          <button
            className="btn-small"
            onClick={() => setGithubUrlPrompt(null)}
          >
            No
          </button>
        </div>
      )}

      {showVisionWarning && (
        <div className="vision-warning">
          ⚠ Model "{selectedModel}" may not support images. Use llava, moondream, or similar.
        </div>
      )}

      <AttachmentList attachments={attachments} onRemove={removeAttachment} />

      <div
        className={`chat-input-row ${disabled && !isStreaming ? 'chat-input-row--disabled' : ''} ${isDragOver ? 'chat-input-row--dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          className="icon-btn attach-btn"
          onClick={handleFilePicker}
          disabled={disabled || isStreaming}
          title="Attach file"
        >
          <span className="icon">📎</span>
        </button>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={disabled ? 'No model selected...' : 'Message BaumOllamaCoding... (Enter to send)'}
          disabled={disabled || isStreaming}
          rows={1}
        />
        {isStreaming ? (
          <button className="send-btn send-btn--stop" onClick={onStop} title="Stop generation">
            <span className="icon">■</span>
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={disabled || (!text.trim() && attachments.length === 0)}
            title="Send message"
          >
            <span className="icon">▶</span>
          </button>
        )}
      </div>
      <div className="chat-input-footer">
        <span className="chat-input-tip"><kbd>Enter</kbd> send &nbsp; <kbd>Shift+Enter</kbd> newline &nbsp; Paste/drop images</span>
      </div>
    </div>
  );
}
