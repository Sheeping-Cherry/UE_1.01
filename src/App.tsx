/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GeneratorSettings } from './types';
import { generateUEPythonScript } from './utils/scriptGenerator';
import { generateStandaloneHTML } from './utils/standaloneExporter';
import SettingsForm from './components/SettingsForm';
import ScriptViewer from './components/ScriptViewer';
import UnrealSimulator from './components/UnrealSimulator';
import TutorialGuide from './components/TutorialGuide';
import { Cpu, ShieldCheck, Download } from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState<GeneratorSettings>({
    masterMaterialPath: '/Game/Materials/M_MasterMaterial',
    saveFolder: '/Game/MaterialInstances',
    primaryTextureDir: '/Game/Textures/Primary',
    backupTextureDir: '/Game/Textures/Backup',
    ignoreTrailingOne: true,
    baseColorParam: 'BaseColor',
    normalParam: 'Normal',
    pbrParam: 'PBR',
    normalSuffix: '_n',
    pbrSuffix: '_s',
    stripPrefixes: 'MI_N_, M_, MI_MC_, MI_, MC_, MAT_',
    addInstancePrefix: 'MI_',
    backupMasterMaterialPath: '/Game/Materials/M_BackupMaterial',
    fallbackPrefix: 'MI_N_',
    useFallbackMaterial: true,
    enableNormal: true,
    enablePBR: true,
    customSlots: [
      { id: 'slot_emissive', name: '自发光 (Emissive)', paramName: 'EmissiveColor', suffix: '_e', enabled: false },
    ],
    matchSource: 'material',
    materialLibraryPath: '/Game/MaterialLibrary',
    enableMaterialLibraryMatch: false,
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [offlinePackState, setOfflinePackState] = useState<{
    isLoading: boolean;
    progress: string;
    error: string | null;
  }>({
    isLoading: false,
    progress: '',
    error: null,
  });

  // Generate python code dynamically based on current configuration
  const pythonScript = generateUEPythonScript(settings);

  // Auto-trigger simulation run inside UnrealSimulator component
  const handleOpenSimulation = () => {
    setIsSimulating(true);
  };

  // Generate and export full standalone web app container with caching and fallback
  const handleDownloadOfflineHTML = async () => {
    setOfflinePackState({ isLoading: true, progress: '正在初始化本地全量离线打包管线 (JIT Build)...', error: null });

    const assets = {
      react: [
        'https://unpkg.com/react@18/umd/react.production.min.js',
        'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js'
      ],
      reactDom: [
        'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
        'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js'
      ],
      babel: [
        'https://unpkg.com/@babel/standalone/babel.min.js',
        'https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.24.7/babel.min.js'
      ],
      tailwind: [
        'https://cdn.tailwindcss.com',
        'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4/dist/index.global.js',
        'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css'
      ]
    };

    const inlined: { react?: string; reactDom?: string; babel?: string; tailwind?: string } = {};
    const CACHE_NAME = 'ue-material-automator-cdn-cache-v1';

    const getCachedOrFetch = async (key: 'react' | 'reactDom' | 'babel' | 'tailwind', displayName: string): Promise<string> => {
      const urls = assets[key];
      
      // 1. Try Cache Storage first
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(CACHE_NAME);
          for (const url of urls) {
            const cachedResponse = await cache.match(url);
            if (cachedResponse) {
              const text = await cachedResponse.text();
              if (text && text.trim().length > 100) {
                console.log(`[Cache Hit] ${displayName} loaded from browser Cache Storage`);
                return text;
              }
            }
          }
        } catch (e) {
          console.warn('Cache Storage match failed:', e);
        }
      }

      // 2. Fetch with fallback servers
      let lastError: any;
      for (const url of urls) {
        try {
          setOfflinePackState(prev => ({ ...prev, progress: `正在从多线节点检索并打包: [${displayName}] 等待连接...` }));
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            if (text && text.trim().length > 100) {
              // Store in Cache Storage for instant offline next time
              if (typeof caches !== 'undefined') {
                try {
                  const cache = await caches.open(CACHE_NAME);
                  const responseToCache = new Response(text, {
                    headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
                  });
                  await cache.put(url, responseToCache);
                } catch (cacheErr) {
                  console.warn('Failed to write into Cache Storage:', cacheErr);
                }
              }
              return text;
            }
          }
        } catch (err) {
          console.warn(`URL failed: ${url}`, err);
          lastError = err;
        }
      }

      throw lastError || new Error(`无法获取依赖项: ${displayName}`);
    };

    try {
      // Fetch React and ReactDOM in parallel
      setOfflinePackState(prev => ({ ...prev, progress: '正在打包 React 核心引擎算法 (Parallel)...' }));
      const [reactCode, reactDomCode] = await Promise.all([
        getCachedOrFetch('react', 'React 运行时'),
        getCachedOrFetch('reactDom', 'ReactDOM 图层交互构筑')
      ]);
      inlined.react = reactCode;
      inlined.reactDom = reactDomCode;

      setOfflinePackState(prev => ({ ...prev, progress: '正在打包 Tailwind CSS 实时编译器 (JIT Compiler)...' }));
      inlined.tailwind = await getCachedOrFetch('tailwind', 'Tailwind 渲染驱动');

      setOfflinePackState(prev => ({ ...prev, progress: '正在合并 Babel 即时解释引擎 (进行高度压缩中，首次约耗时2s)...' }));
      inlined.babel = await getCachedOrFetch('babel', 'Babel 解释编译器');

      setOfflinePackState(prev => ({ ...prev, progress: '正在将 100% 依赖项合流写入 HTML 单文件...' }));

      const htmlContent = generateStandaloneHTML(settings, inlined);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'UE_Material_Automator_Full_Offline.html';
      link.click();
      URL.revokeObjectURL(url);

      setOfflinePackState({
        isLoading: false,
        progress: '✓ 本地独立运行版 (.html) 100% 依赖打包离线输出成功！可随时脱水断网使用。',
        error: null
      });

      setTimeout(() => {
        setOfflinePackState(prev => ({ ...prev, progress: '' }));
      }, 5000);

    } catch (err: any) {
      console.error('Failed to bundle offline HTML:', err);
      // Fallback gracefully to generating the standard CDN-inclusive HTML
      setOfflinePackState({
        isLoading: false,
        progress: '',
        error: `并发打包过程出现网络中断，已自动降级为您生成【标准在线渲染容器】：Download standard edition. (原因为: ${err.message || err})`
      });

      try {
        const htmlContent = generateStandaloneHTML(settings);
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'UE_Material_Automator_Standard.html';
        link.click();
        URL.revokeObjectURL(url);
      } catch (fallbackErr) {
        console.error('Fallback generation also failed:', fallbackErr);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-[#CCCCCC] flex flex-col font-sans antialiased selection:bg-[#E18E2D]/20 selection:text-white">
      
      {/* Visual Workspace Hero Header */}
      <header className="bg-[#1e1e1e] border-b border-[#2a2a2a] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#E18E2D] flex items-center justify-center rounded shadow-lg shadow-[#E18E2D]/10">
              <span className="text-black font-black text-xl leading-none">U</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white uppercase flex items-center">
                  Unreal 5.7 Material Automator
                  <span className="text-[#E18E2D] font-mono text-[9px] ml-2.5 bg-[#E18E2D]/10 px-1.5 py-0.5 rounded border border-[#E18E2D]/20">v1.0.4-STABLE</span>
                </h1>
              </div>
              <p className="text-[10px] text-[#888888]">
                虚幻引擎后期自动化材质管线构建工具：自定义配配规则、材质球清洗与多库级串接
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-[10px] uppercase tracking-wider text-[#888888]">
            <span className="px-2.5 py-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded font-mono">
              Engine: UE 5.0 - 5.7+
            </span>
            <span className="px-2.5 py-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded font-mono text-[#E18E2D]">
              Active: Profile Custom
            </span>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 min-h-0">
        
        {/* Intro Alert */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#E18E2D]/10 to-transparent border border-[#E18E2D]/30 text-white rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <span className="inline-block text-[10px] font-bold bg-[#E18E2D] text-black uppercase tracking-wider px-2 py-0.5 rounded font-mono leading-none">
              Pipeline Blueprint
            </span>
            <p className="text-xs sm:text-sm text-[#CCCCCC] leading-relaxed">
              在虚幻编辑器中使用本 Python 自动化脚本，可以让您一键搞定模型材质分配，免受逐个指认材质实例与拉入贴图的重复繁琐劳动！
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleDownloadOfflineHTML}
              disabled={offlinePackState.isLoading}
              className={`font-semibold text-xs px-5 py-2.5 rounded transition-all active:scale-95 uppercase tracking-wider flex items-center gap-2 border ${
                offlinePackState.isLoading
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700 cursor-not-allowed'
                  : 'bg-[#222222] hover:bg-[#333333] border-[#444444] text-white'
              }`}
            >
              {offlinePackState.isLoading ? (
                <>
                  <span className="animate-spin mr-1 h-3 w-3 border-2 border-t-transparent border-[#E18E2D] rounded-full inline-block"></span>
                  正在打包离线依赖...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-[#E18E2D]" />
                  下载完美极客离线版 (.html)
                </>
              )}
            </button>
            <button
              onClick={handleOpenSimulation}
              className="bg-[#E18E2D] hover:bg-[#ffaa44] text-black font-semibold text-xs px-5 py-2.5 rounded transition-all active:scale-95 uppercase tracking-wider"
            >
              立即预实验 (Dry-Run)
            </button>
          </div>
        </div>

        {/* Offline Pack Status and Notice */}
        {(offlinePackState.isLoading || offlinePackState.progress || offlinePackState.error) && (
          <div className={`p-4 text-xs rounded-lg border font-mono transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            offlinePackState.error
              ? 'bg-rose-950/40 border-rose-800/30 text-rose-300'
              : offlinePackState.isLoading
                ? 'bg-amber-950/40 border-amber-800/30 text-amber-200'
                : 'bg-emerald-950/40 border-emerald-800/30 text-emerald-300'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                offlinePackState.error
                  ? 'bg-rose-500 animate-ping'
                  : offlinePackState.isLoading
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-500'
              }`} />
              <p className="font-sans leading-relaxed text-left">
                {offlinePackState.error ? offlinePackState.error : offlinePackState.progress}
              </p>
            </div>
            {offlinePackState.isLoading && (
              <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase self-end sm:self-auto shrink-0 font-mono tracking-wider">
                打包解析中 (JIT BUNDLER)
              </span>
            )}
          </div>
        )}

        {/* Core Config & Code Area (First Bento row) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Settings inputs column */}
          <div className="lg:col-span-5 h-[680px]">
            <SettingsForm settings={settings} onChange={setSettings} />
          </div>

          {/* Generated Python code rendering column */}
          <div className="lg:col-span-7 h-[680px]">
            <ScriptViewer
              code={pythonScript}
              onRunSimulation={handleOpenSimulation}
              isSimulating={isSimulating}
            />
          </div>
        </div>

        {/* Simulation Output Area (Second Bento row) */}
        <div>
          <UnrealSimulator
            settings={settings}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
          />
        </div>

        {/* Tutorial Guide Section (Third Bento row) */}
        <div>
          <TutorialGuide />
        </div>

      </main>

      {/* Footer Info */}
      <footer className="bg-[#1e1e1e] border-t border-[#2a2a2a] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between text-xs text-[#555555] gap-3">
          <span>© 100% Client-side. Designed for Epic Games Unreal Engine.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-[#E18E2D] transition-colors">脚本协议文档</a>
            <span>•</span>
            <a href="#" className="hover:text-[#E18E2D] transition-colors">UE5.7 API 兼容检测</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
