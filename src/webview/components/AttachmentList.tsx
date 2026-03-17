import React from 'react';

export interface Attachment {
  id: string;
  type: 'image' | 'text';
  base64?: string;
  content?: string;
  mimeType: string;
  name: string;
}

interface AttachmentListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="attachment-list">
      {attachments.map((att) => (
        <div key={att.id} className="attachment-chip">
          {att.type === 'image' && att.base64 ? (
            <img
              className="attachment-thumb"
              src={`data:${att.mimeType};base64,${att.base64}`}
              alt={att.name}
            />
          ) : (
            <span className="attachment-file-icon">📄</span>
          )}
          <span className="attachment-name" title={att.name}>
            {att.name.length > 20 ? att.name.slice(0, 18) + '…' : att.name}
          </span>
          <button
            className="attachment-remove"
            onClick={() => onRemove(att.id)}
            title={`Remove ${att.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
