/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Play, AlertCircle } from 'lucide-react';

interface ScriptViewerProps {
  code: string;
  onRunSimulation: () => void;
  isSimulating: boolean;
}

export default function ScriptViewer({ code, onRunSimulation, isSimulating }: ScriptViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'UE_MaterialAutomation.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Convert raw code into line arrays for styled rendering
  const lines = code.split('\n');

  return (
    <div className="bg-black rounded-lg border border-[#2a2a2a] shadow-2xl overflow-hidden h-full flex flex-col font-mono text-xs text-[#CCCCCC]">
      {/* Target File Title bar */}
      <div className="px-4 py-3 bg-[#1e1e1e] border-b border-[#2a2a2a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#E18E2D]" />
          <span className="font-bold text-white text-xs tracking-wider uppercase">UE_MaterialAutomation.py</span>
          <span className="text-[9px] font-mono text-[#555555] ml-2">READ_ONLY</span>
        </div>

        <div className="flex items-center gap-2 font-sans">
          {/* Simulation Launcher Trigger */}
          <button
            onClick={onRunSimulation}
            disabled={isSimulating}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
              isSimulating
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-[#E18E2D] hover:bg-[#ffaa44] text-black active:scale-95'
            }`}
          >
            <Play className={`w-3 h-3 fill-current ${isSimulating ? 'animate-pulse' : ''}`} />
            {isSimulating ? '模拟运行中' : '网页端预跑'}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded bg-[#111111] hover:bg-[#333333] text-zinc-400 hover:text-white transition-colors border border-[#333333]"
            title="复制脚本"
          >
            {copied ? <Check className="w-4 h-4 text-[#44CC44]" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded bg-[#111111] hover:bg-[#333333] text-zinc-400 hover:text-white transition-colors border border-[#333333]"
            title="下载脚本 (.py)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar flex bg-[#0c0c0c]">
        {/* Line Numbers */}
        <div className="text-right select-none text-[#444444] text-xs pr-4 border-r border-[#1a1a1a] font-mono w-10">
          {lines.map((_, i) => (
            <div key={i} className="leading-5 h-5">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Block with simulated syntax coloring */}
        <pre className="flex-1 pl-4 leading-5 h-full overflow-x-auto text-[#CCCCCC] select-all selection:bg-[#E18E2D]/20 selection:text-white">
          {lines.map((line, idx) => {
            // Very simple highlight rule for display polish
            let styleClass = 'text-[#CCCCCC]';
            if (line.trim().startsWith('#')) {
              styleClass = 'text-[#555555] italic'; // Comments
            } else if (line.trim().startsWith('def ') || line.trim().startsWith('class ')) {
              styleClass = 'text-[#E18E2D] font-semibold'; // Function declaration (Epic Orange)
            } else if (line.trim().startsWith('import ') || line.trim().startsWith('from ')) {
              styleClass = 'text-[#8E44AD]'; // Imports (Epic Purple)
            } else if (line.includes('===') || line.includes('---')) {
              styleClass = 'text-[#333333]'; // Section Separators
            } else if (line.match(/^[A-Z_]+\s*=/)) {
              styleClass = 'text-[#3498DB]'; // Configurations (Epic Blue)
            }

            return (
              <div key={idx} className={`h-5 whitespace-pre font-mono ${styleClass}`}>
                {line || ' '}
              </div>
            );
          })}
        </pre>
      </div>

      {/* Footer Info bar */}
      <div className="px-4 py-2.5 bg-[#171717] border-t border-[#2a2a2a] flex items-center justify-between text-[10px] text-[#555555] font-sans">
        <span className="flex items-center gap-1.5 uppercase font-semibold">
          <AlertCircle className="w-3.5 h-3.5 text-[#E18E2D]" />
          Unreal Editor Scripting Enabled Prerequisite
        </span>
        <span className="font-mono uppercase">Python 3 | UTF-8</span>
      </div>
    </div>
  );
}
