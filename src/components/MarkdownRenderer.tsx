import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Maximize2 } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onOpenPopup?: (code: string, lang: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', onOpenPopup }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleDownload = (code: string, lang: string, idx: number) => {
    const ext = getExtension(lang);
    const filename = `iris_${lang || 'code'}_${idx + 1}.${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getExtension = (lang: string) => {
    const l = lang.toLowerCase().trim();
    if (l.includes('py')) return 'py';
    if (l.includes('javascript') || l === 'js') return 'js';
    if (l.includes('typescript') || l === 'ts') return 'ts';
    if (l.includes('tsx')) return 'tsx';
    if (l.includes('jsx')) return 'jsx';
    if (l.includes('html')) return 'html';
    if (l.includes('css')) return 'css';
    if (l.includes('json')) return 'json';
    if (l.includes('md') || l.includes('markdown')) return 'md';
    if (l.includes('csv')) return 'csv';
    if (l.includes('sql')) return 'sql';
    return 'txt';
  };

  // Robust regex for code blocks: matches ```lang\n...``` OR ```lang ...``` OR ```\n...```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)(?:[ \t]*\r?\n|[ \t]+)([\s\S]*?)(?:```|$)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockCounter = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const matchIndex = match.index;
    const textBefore = content.substring(lastIndex, matchIndex);

    if (textBefore.trim()) {
      elements.push(
        <div key={`text-${lastIndex}`} className="space-y-2 whitespace-pre-wrap leading-relaxed">
          {formatInlineMarkdown(textBefore)}
        </div>
      );
    }

    const rawLang = (match[1] || 'code').trim();
    const rawCode = match[2] || '';
    const formattedCode = normalizeCodeFormatting(rawCode, rawLang);
    const currentIndex = blockCounter++;

    elements.push(
      <div
        key={`code-${currentIndex}`}
        className="my-3 rounded-xl overflow-hidden bg-slate-950 border border-cyan-500/40 shadow-xl"
      >
        {/* Code Frame Header with Copy Button on the Top Right Corner */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-cyan-500/25 text-cyan-300 font-mono">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="uppercase text-[11px] font-bold tracking-wider text-cyan-200">
              {rawLang || 'CODE BLOCK'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenPopup && (
              <button
                onClick={() => onOpenPopup(formattedCode, rawLang)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 hover:text-white border border-cyan-500/20 text-xs transition-colors"
                title="Show in full popup"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Popup</span>
              </button>
            )}
            <button
              onClick={() => handleCopy(formattedCode, currentIndex)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-100 font-sans text-xs font-semibold transition-all active:scale-95 shadow-sm"
              title="Copy code to clipboard"
            >
              {copiedIndex === currentIndex ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleDownload(formattedCode, rawLang, currentIndex)}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/50 text-xs transition-colors"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </div>

        {/* Code Content Body with Pre/Mono and Scroll */}
        <pre className="p-3.5 overflow-x-auto text-slate-100 font-mono text-xs sm:text-[13px] leading-relaxed select-text bg-slate-950/90 whitespace-pre">
          <code>{formattedCode}</code>
        </pre>
      </div>
    );

    lastIndex = matchIndex + match[0].length;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText.trim()) {
    elements.push(
      <div key={`text-end`} className="space-y-2 whitespace-pre-wrap leading-relaxed">
        {formatInlineMarkdown(remainingText)}
      </div>
    );
  }

  // If content had no triple backtick code blocks but starts or contains inline text
  if (elements.length === 0) {
    return <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>{formatInlineMarkdown(content)}</div>;
  }

  return <div className={`space-y-2.5 ${className}`}>{elements}</div>;
};

// Auto-formats collapsed or single-line code if line breaks were lost
function normalizeCodeFormatting(code: string, lang: string): string {
  let cleaned = code.trim();
  const lines = cleaned.split('\n');

  // If code is squashed into 1 or 2 lines but contains typical Python/JS constructs
  if (lines.length <= 2 && (lang.toLowerCase().includes('py') || cleaned.includes('import ') || cleaned.includes('def '))) {
    cleaned = cleaned
      .replace(/\s*(#\s*[^\n]*?)(?=\s+(?:import|from|def|class|if|while|for|pygame|[a-zA-Z_]\w*\s*=))/g, '\n$1\n')
      .replace(/\s+(import\s+[a-zA-Z0-9_, ]+)/g, '\n$1')
      .replace(/\s+(from\s+[a-zA-Z0-9_.]+\s+import)/g, '\n$1')
      .replace(/\s+(def\s+[a-zA-Z0-9_]+\s*\([^)]*\):)/g, '\n\n$1\n    ')
      .replace(/\s+(while\s+[^\n:]+:)/g, '\n\n$1\n    ')
      .replace(/\s+(for\s+[^\n:]+:)/g, '\n    $1\n        ')
      .replace(/\s+(elif\s+[^\n:]+:)/g, '\n    $1\n        ')
      .replace(/\s+(else:)/g, '\n    $1\n        ')
      .replace(/\s+(if\s+[^\n:]+:)/g, '\n    $1\n        ')
      .replace(/\s+(pygame\.[a-zA-Z0-9_]+)/g, '\n    $1')
      .replace(/\s+(clock\.tick)/g, '\n    $1')
      .replace(/\s+(quit\(\))/g, '\n$1')
      .replace(/\n{3,}/g, '\n\n');
  }

  return cleaned;
}

// Formats **bold**, *italic*, `code`, and list bullets
function formatInlineMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
    const cleanedLine = isBullet ? line.trim().substring(2) : line;

    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(cleanedLine)) !== null) {
      if (m.index > last) {
        parts.push(cleanedLine.substring(last, m.index));
      }
      const token = m[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={`${lineIdx}-${m.index}`} className="font-bold text-cyan-200">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={`${lineIdx}-${m.index}`}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-xs border border-cyan-500/20"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={`${lineIdx}-${m.index}`} className="italic text-slate-300">
            {token.slice(1, -1)}
          </em>
        );
      }
      last = m.index + token.length;
    }

    if (last < cleanedLine.length) {
      parts.push(cleanedLine.substring(last));
    }

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex items-start gap-2 pl-2">
          <span className="text-cyan-400 font-bold">•</span>
          <span className="flex-1">{parts}</span>
        </div>
      );
    }

    return (
      <div key={lineIdx} className="min-h-[1.25rem]">
        {parts}
      </div>
    );
  });
}
