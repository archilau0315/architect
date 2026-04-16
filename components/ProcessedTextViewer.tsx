import { useState, useEffect } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';

interface ProcessedTextViewerProps {
  rawText: string;
  title?: string;
  onTextClick?: (text: string) => void;
}

export const ProcessedTextViewer = ({ rawText, title, onTextClick }: ProcessedTextViewerProps) => {
  const [processedText, setProcessedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (rawText) {
      let text = rawText;
      text = text.replace(/###/g, '');
      text = text.replace(/\n\n+/g, '\n\n');
      text = text.trim();
      setProcessedText(text);
    }
  }, [rawText]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(processedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (onTextClick) {
      onTextClick('');
    }
  };

  const shouldTruncate = processedText.length > 200;
  const displayText = isExpanded || !shouldTruncate ? processedText : processedText.slice(0, 200) + '...';

  if (!processedText) {
    return null;
  }

  return (
    <div 
      className="relative rounded-xl border transition-all duration-300"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {title && (
          <h3 
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h3>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ 
              backgroundColor: copied ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-tertiary)',
              color: copied ? '#22C55E' : 'var(--text-secondary)',
            }}
            title={copied ? '已复制' : '复制文本'}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ 
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-tertiary)',
            }}
            title="清空文本"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空
          </button>
        </div>
      </div>

      <div 
        className="p-4 min-h-[80px] max-h-[400px] overflow-y-auto"
        onClick={() => onTextClick?.(processedText)}
        style={{ cursor: onTextClick ? 'pointer' : 'default' }}
      >
        <p 
          className="text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={{ color: 'var(--text-secondary)' }}
        >
          {displayText}
        </p>
        
        {shouldTruncate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="mt-3 text-xs font-medium transition-all"
            style={{ color: 'var(--theme-primary)' }}
          >
            {isExpanded ? '收起' : `展开全文 (${processedText.length} 字符)`}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-tertiary)' }}>
        <span>字符数: {processedText.length}</span>
        <span>行数: {processedText.split('\n').length}</span>
      </div>
    </div>
  );
};
