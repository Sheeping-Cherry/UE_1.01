/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GeneratorSettings, MockMeshMaterial, MockTextureAsset, SimulationResult } from '../types';
import { Plus, Trash2, Play, Layers, Image, FolderCheck, RefreshCw, Sparkles, ChevronRight } from 'lucide-react';

interface UnrealSimulatorProps {
  settings: GeneratorSettings;
  isSimulating: boolean;
  setIsSimulating: (simulating: boolean) => void;
}

export default function UnrealSimulator({ settings, isSimulating, setIsSimulating }: UnrealSimulatorProps) {
  // 1. Predefined mock materials in user viewport selection
  const [mockMaterials, setMockMaterials] = useState<MockMeshMaterial[]>([
    { id: 'm1', modelName: 'SM_SprucePlank', originalMaterialName: 'MI_MC_spruce_planks', slotName: 'spruce_planks' },
    { id: 'm2', modelName: 'SM_OakDoor', originalMaterialName: 'MI_MC_oak_door_bottom', slotName: 'oak_door_bottom' },
    { id: 'm3', modelName: 'SM_Rock_01', originalMaterialName: 'M_CliffRock_1', slotName: 'CliffRock_1' },
    { id: 'm4', modelName: 'SM_BrickWall', originalMaterialName: 'M_RedBrick_01_1', slotName: 'RedBrick_01' },
  ]);

  // 2. Predefined mock textures in libraries (Primary / Backup)
  const [mockTextures, setMockTextures] = useState<MockTextureAsset[]>([
    // User Minecraft-themed Realistic textures
    { id: 't10', fileName: 'spruce_planks', folder: 'primary' },
    { id: 't11', fileName: 'spruce_planks_n', folder: 'primary' },
    { id: 't12', fileName: 'spruce_planks_s', folder: 'primary' },
    { id: 't16', fileName: 'spruce_planks_e', folder: 'primary' },
    { id: 't13', fileName: 'oak_door_bottom', folder: 'primary' },
    { id: 't14', fileName: 'oak_door_bottom_n', folder: 'primary' },
    { id: 't15', fileName: 'oak_door_bottom_s', folder: 'primary' },
    { id: 't17', fileName: 'oak_door_bottom_e', folder: 'backup' },
    // Primary folder textures
    { id: 't1', fileName: 'T_CliffRock', folder: 'primary' },
    { id: 't2', fileName: 'T_CliffRock_n', folder: 'primary' },
    { id: 't3', fileName: 'T_CliffRock_s', folder: 'primary' },
    { id: 't4', fileName: 'T_RedBrick_01', folder: 'primary' },
    { id: 't5', fileName: 'T_RedBrick_01_n', folder: 'primary' },
    // Backup folder textures
    { id: 't6', fileName: 'T_RedBrick_01_s', folder: 'backup' },
  ]);

  // 3. Predefined mock materials in the direct Material Library
  const [mockLibMaterials, setMockLibMaterials] = useState<string[]>([
    'MI_spruce_planks',
    'MI_oak_door_bottom',
    'MI_CliffRock_Premium',
    'M_RedBrick_Classic'
  ]);

  const [activeTab, setActiveTab] = useState<'selection' | 'textures' | 'library'>('selection');
  
  // Simulation log outputs and results
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [hasRun, setHasRun] = useState<boolean>(false);

  // New item states
  const [newModel, setNewModel] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [newSlotName, setNewSlotName] = useState('');
  const [newTexFile, setNewTexFile] = useState('');
  const [newTexFolder, setNewTexFolder] = useState<'primary' | 'backup'>('primary');
  const [newLibMat, setNewLibMat] = useState('');

  const addMockMaterial = () => {
    if (!newModel || !newMatName) return;
    const computedSlot = newSlotName || newMatName.toLowerCase().replace(/^(m_|mi_mc_|mi_|mm_|mc_|mat_|t_)/, '');
    setMockMaterials([
      ...mockMaterials,
      { 
        id: Date.now().toString(), 
        modelName: newModel, 
        originalMaterialName: newMatName,
        slotName: computedSlot
      },
    ]);
    setNewModel('');
    setNewMatName('');
    setNewSlotName('');
  };

  const deleteMockMaterial = (id: string) => {
    setMockMaterials(mockMaterials.filter(m => m.id !== id));
  };

  const addMockTexture = () => {
    if (!newTexFile) return;
    setMockTextures([
      ...mockTextures,
      { id: Date.now().toString(), fileName: newTexFile, folder: newTexFolder },
    ]);
    setNewTexFile('');
  };

  const deleteMockTexture = (id: string) => {
    setMockTextures(mockTextures.filter(t => t.id !== id));
  };

  const addMockLibMaterial = () => {
    if (!newLibMat) return;
    if (mockLibMaterials.includes(newLibMat)) return;
    setMockLibMaterials([...mockLibMaterials, newLibMat]);
    setNewLibMat('');
  };

  const deleteMockLibMaterial = (matName: string) => {
    setMockLibMaterials(mockLibMaterials.filter(m => m !== matName));
  };

  const runSampleSimulation = () => {
    setIsSimulating(true);
    setHasRun(true);
    setSimulationResults([]);
    setCurrentStep(1);
    setConsoleLogs([]);

    const logs: string[] = [];
    const pushLog = (msg: string) => {
      logs.push(msg);
      setConsoleLogs([...logs]);
    };

    // Stage-based animation with Web simulation logic
    setTimeout(() => {
      pushLog(`[1/5]  [初始化] 开始载入自动化分配脚本...`);
      pushLog(`[1/5]  [环境] 验证父级材质/实例路径: ${settings.masterMaterialPath} ... 已存在。`);
      pushLog(`[1/5]  [采集] 正在扫描编辑器中模型材质插槽关系...`);
      setCurrentStep(2);

      setTimeout(() => {
        pushLog(`[2/5]  [采集完成] 共捕获内容浏览器中选中的 ${mockMaterials.length} 个静态模型资产：`);
        mockMaterials.forEach((m) => {
          if (settings.matchSource === 'slot') {
            pushLog(`       - 选中内容浏览器模型: '${m.modelName}' -> 检测到物理材质插槽 [${m.slotName}] (正在应用[读取模型插槽名字]模式)`);
          } else {
            pushLog(`       - 选中内容浏览器模型: '${m.modelName}' -> 检测到绑定材质球 [${m.originalMaterialName}]`);
          }
        });
        setCurrentStep(3);

        setTimeout(() => {
          pushLog(`[3/5]  [命名清洗中] 正在根据参数规则进行深度命名清洗...`);
          if (settings.ignoreTrailingOne) {
            pushLog(`       - [规则] 已开启末尾数字"1"无视逻辑`);
          }
          pushLog(`       - [规则] 清理原始前缀: [${settings.stripPrefixes}]`);
          pushLog(`       - [规则] 添加实例前缀: '${settings.addInstancePrefix}'`);
          setCurrentStep(4);

          setTimeout(() => {
            pushLog(`[4/5]  [实例创建 / 贴图检索] 正在检索贴图文件夹并建立独立材质属性...`);
            
            // Execute mock logic
            const results: SimulationResult[] = mockMaterials.map((m) => {
              const opLogs: string[] = [];
              let name = settings.matchSource === 'slot' ? m.slotName : m.originalMaterialName;
              if (!name) return null;
              
              // 1. Strip trailing 1 based on settings
              if (settings.ignoreTrailingOne && name.endsWith('1')) {
                name = name.slice(0, -1);
                if (name.endsWith('_')) {
                  name = name.slice(0, -1);
                }
              }

              // 2. Strip prefixes (cascading recursive logic matching the Python engine)
              const userPrefixes = settings.stripPrefixes.split(',').map(p => p.trim()).filter(Boolean);
              const defaultPrefixes = ["MI_MC_", "M_MC_", "MAT_", "MI_", "MM_", "MC_", "M_", "T_"];
              const allPrefixes = Array.from(new Set([...userPrefixes, ...defaultPrefixes]));
              
              // Sort by length descending to prevent partial match conflicts
              allPrefixes.sort((a, b) => b.length - a.length);

              let strippedAny = true;
              while (strippedAny) {
                strippedAny = false;
                for (const pref of allPrefixes) {
                  if (name.startsWith(pref)) {
                    name = name.slice(pref.length);
                    strippedAny = true;
                    break;
                  }
                }
              }

              const coreName = name.replace(/^_+|_+$/g, '');

              // Check if we should directly match in Material Library
              const findMockMaterialInLibrary = (cName: string) => {
                if (!settings.enableMaterialLibraryMatch) return null;
                const normCore = cName.toLowerCase();
                
                for (const libMat of mockLibMaterials) {
                  const normLibMat = libMat.toLowerCase();
                  
                  // Clean libMat using same rules
                  let cleanName = normLibMat;
                  
                  // 1. Strip trailing 1 based on settings
                  if (settings.ignoreTrailingOne && cleanName.endsWith('1')) {
                    cleanName = cleanName.slice(0, -1);
                    if (cleanName.endsWith('_')) {
                      cleanName = cleanName.slice(0, -1);
                    }
                  }
                  
                  // 2. Strip prefixes
                  const userPrefixes = settings.stripPrefixes.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
                  const defaultPrefixes = ["mi_mc_", "m_mc_", "mat_", "mi_", "mm_", "mc_", "m_", "t_"];
                  const allPrefixes = Array.from(new Set([...userPrefixes, ...defaultPrefixes]));
                  allPrefixes.sort((a, b) => b.length - a.length);
                  
                  let strippedAny = true;
                  while (strippedAny) {
                    strippedAny = false;
                    for (const pref of allPrefixes) {
                      if (pref && cleanName.startsWith(pref)) {
                        cleanName = cleanName.slice(pref.length);
                        strippedAny = true;
                        break;
                      }
                    }
                  }
                  
                  cleanName = cleanName.replace(/^_+|_+$/g, '');
                  
                  if (cleanName === normCore) {
                    return libMat; // Return exact matched mock library material name
                  }
                }
                return null;
              };

              const libraryMatMatch = findMockMaterialInLibrary(coreName);
              if (libraryMatMatch) {
                opLogs.push(`清洗: ${settings.matchSource === 'slot' ? `[插槽名] ${m.slotName}` : `[材质名] ${m.originalMaterialName}`} -> ${coreName}`);
                opLogs.push(`[材质库直接匹配成功] 优先从材质库区域 ${settings.materialLibraryPath} 检索同名材质: ${libraryMatMatch}`);
                opLogs.push(`[直接替换并指派] 跳过新建材质实例与贴图加载流程，秒速完成指派！`);
                return {
                  meshName: m.modelName,
                  originalMaterial: m.originalMaterialName,
                  cleanedMaterialName: coreName,
                  instanceName: libraryMatMatch,
                  instanceSavePath: `${settings.materialLibraryPath}/${libraryMatMatch}`,
                  slots: {
                    baseColor: {
                      textureName: 'Inherited From Library',
                      foundIn: 'library',
                      paramName: settings.baseColorParam
                    },
                    normal: {
                      textureName: 'Inherited From Library',
                      foundIn: 'library',
                      paramName: settings.normalParam
                    },
                    pbr: {
                      textureName: 'Inherited From Library',
                      foundIn: 'library',
                      paramName: settings.pbrParam
                    },
                    customSlots: {}
                  },
                  logs: opLogs
                };
              }

              // Mock finding textures
              const findTexture = (suffix: string | null, isBaseColor: boolean) => {
                const matchInFolder = (folder: 'primary' | 'backup') => {
                  const filtered = mockTextures.filter(t => t.folder === folder);
                  for (const tex of filtered) {
                    const normFileName = tex.fileName.toLowerCase();
                    const normCore = coreName.toLowerCase();
                    
                    let cleanName = normFileName;
                    if (suffix) {
                      const sufLow = suffix.toLowerCase();
                      if (cleanName.endsWith(sufLow)) {
                        cleanName = cleanName.slice(0, -sufLow.length);
                      } else {
                        continue;
                      }
                    } else {
                      // BaseColor verification: make sure it is not Normal/PBR or Custom Slots first
                      const hasNSuffix = normFileName.endsWith(settings.normalSuffix.toLowerCase());
                      const hasSSuffix = normFileName.endsWith(settings.pbrSuffix.toLowerCase());
                      const hasCustomSuffix = (settings.customSlots || [])
                        .filter(cs => cs.enabled)
                        .some(cs => cs.suffix && normFileName.endsWith(cs.suffix.toLowerCase()));
                      if (hasNSuffix || hasSSuffix || hasCustomSuffix) {
                        continue;
                      }

                      // Strip standard BaseColor suffixes
                      const bcSuffixes = ["_d", "_bc", "_c", "_diffuse", "_albedo", "_color", "_col", "_basecolor"];
                      for (const bcSuf of bcSuffixes) {
                        if (cleanName.endsWith(bcSuf)) {
                          cleanName = cleanName.slice(0, -bcSuf.length);
                          break;
                        }
                      }
                    }

                    // Remove trailing underscores
                    cleanName = cleanName.replace(/_+$/, '');

                    // Strip prefixes
                    const prefixes = settings.stripPrefixes.split(',').map(p => p.trim().toLowerCase());
                    const defaultPrefixes = ["mi_mc_", "m_mc_", "mat_", "mi_", "mm_", "mc_", "m_", "t_"];
                    defaultPrefixes.forEach(dp => {
                      if (!prefixes.includes(dp)) {
                        prefixes.push(dp);
                      }
                    });
                    prefixes.sort((a, b) => b.length - a.length);

                    let strippedAny = true;
                    while (strippedAny) {
                      strippedAny = false;
                      for (const pref of prefixes) {
                        if (pref && cleanName.startsWith(pref)) {
                          cleanName = cleanName.slice(pref.length);
                          strippedAny = true;
                          break;
                        }
                      }
                    }

                    // Clean leading/trailing underscores
                    cleanName = cleanName.replace(/^_+|_+$/g, '');

                    if (cleanName === normCore) {
                      return tex;
                    }
                  }
                  return null;
                };

                // Search primary first, then backup
                let match = matchInFolder('primary');
                if (match) return { tex: match, source: 'primary' as const };

                match = matchInFolder('backup');
                if (match) return { tex: match, source: 'backup' as const };

                return null;
              };

              const bcMatch = findTexture(null, true);
              const normalMatch = settings.enableNormal ? findTexture(settings.normalSuffix, false) : null;
              const pbrMatch = settings.enablePBR ? findTexture(settings.pbrSuffix, false) : null;

              // 检索自定义插槽贴图匹配
              const customMatches: { [slotId: string]: any } = {};
              (settings.customSlots || []).forEach(slot => {
                if (slot.enabled) {
                   const match = findTexture(slot.suffix, false);
                   customMatches[slot.id] = {
                     slotName: slot.name,
                     textureName: match ? match.tex.fileName : null,
                     foundIn: match ? match.source : null,
                     paramName: slot.paramName
                   };
                }
              });

              // NEW: Fallback logic for simulation 
              const isFallbackActive = settings.useFallbackMaterial && (
                !bcMatch || 
                (settings.enableNormal && !normalMatch) || 
                (settings.enablePBR && !pbrMatch) ||
                (settings.customSlots || []).some(slot => 
                  slot.enabled && (!customMatches[slot.id] || !customMatches[slot.id].textureName)
                )
              );
              const finalPrefix = isFallbackActive ? settings.fallbackPrefix : settings.addInstancePrefix;
              const instanceName = `${finalPrefix}${coreName}`;
              const instanceSavePath = `${settings.saveFolder}/${instanceName}`;

              opLogs.push(`清洗: ${settings.matchSource === 'slot' ? `[插槽名] ${m.slotName}` : `[材质名] ${m.originalMaterialName}`} -> ${coreName}`);
              if (isFallbackActive) {
                opLogs.push(`[触发备用材质替换] 贴图不完整，启用备用母材质模板: ${settings.backupMasterMaterialPath}`);
                opLogs.push(`由于启用备用材质机制，该材质实例仅绑定使用 BaseColor，其余插槽为空。`);
              }
              opLogs.push(`新建材质实例: ${instanceName} 在路径 ${settings.saveFolder}`);
              
              if (bcMatch) {
                opLogs.push(`[BaseColor] 匹配到: ${bcMatch.tex.fileName} (${bcMatch.source === 'primary' ? '主库' : '备库'})`);
              } else {
                opLogs.push(`[BaseColor] [未匹配到贴图]`);
              }

              if (!isFallbackActive) {
                if (settings.enableNormal) {
                  if (normalMatch) {
                    opLogs.push(`[Normal] 匹配到: ${normalMatch.tex.fileName} (${normalMatch.source === 'primary' ? '主库' : '备库'})`);
                  } else {
                    opLogs.push(`[Normal] [未匹配到贴图]`);
                  }
                } else {
                  opLogs.push(`[Normal] [插槽未开启，已跳过]`);
                }

                if (settings.enablePBR) {
                  if (pbrMatch) {
                    opLogs.push(`[PBR] 匹配到: ${pbrMatch.tex.fileName} (${pbrMatch.source === 'primary' ? '主库' : '备库'})`);
                  } else {
                    opLogs.push(`[PBR] [未匹配到贴图]`);
                  }
                } else {
                  opLogs.push(`[PBR] [插槽未开启，已跳过]`);
                }

                // 打印并处理自定义插槽匹配日志
                (settings.customSlots || []).forEach(slot => {
                  if (slot.enabled) {
                    const matchInfo = customMatches[slot.id];
                    if (matchInfo && matchInfo.textureName) {
                      opLogs.push(`[${slot.name}] 匹配到: ${matchInfo.textureName} (${matchInfo.foundIn === 'primary' ? '主库' : '备库'})`);
                    } else {
                      opLogs.push(`[${slot.name}] [未匹配到贴图]`);
                    }
                  } else {
                    opLogs.push(`[${slot.name}] [插槽未开启，已跳过]`);
                  }
                });
              }

              return {
                meshName: m.modelName,
                originalMaterial: m.originalMaterialName,
                cleanedMaterialName: coreName,
                instanceName,
                instanceSavePath,
                slots: {
                  baseColor: {
                    textureName: bcMatch ? bcMatch.tex.fileName : null,
                    foundIn: bcMatch ? bcMatch.source : null,
                    paramName: settings.baseColorParam
                  },
                  normal: {
                    textureName: (!isFallbackActive && normalMatch) ? normalMatch.tex.fileName : null,
                    foundIn: (!isFallbackActive && normalMatch) ? normalMatch.source : null,
                    paramName: settings.normalParam
                  },
                  pbr: {
                    textureName: (!isFallbackActive && pbrMatch) ? pbrMatch.tex.fileName : null,
                    foundIn: (!isFallbackActive && pbrMatch) ? pbrMatch.source : null,
                    paramName: settings.pbrParam
                  },
                  customSlots: isFallbackActive ? {} : customMatches
                },
                logs: opLogs
              };
            }).filter(Boolean) as SimulationResult[];

            // print outcomes to visual log console
            results.forEach((res) => {
              pushLog(`       ======== 材质球: ${res.originalMaterial} -> 创建材质实例 =======`);
              res.logs.forEach(msg => pushLog(`       * ${msg}`));
            });

            setSimulationResults(results);
            setCurrentStep(5);

            setTimeout(() => {
              pushLog(`[5/5]  [保存] 写入烘焙配置并序列化保存材质实例属性...`);
              pushLog(`[5/5]  [弹窗报告] 自动化匹配流程圆满结束！`);
              setIsSimulating(false);
            }, 800);

          }, 800);

        }, 800);

      }, 800);

    }, 500);
  };

  // Run simulation whenever mock changes while simulating is active
  useEffect(() => {
    if (isSimulating && currentStep === 0) {
      runSampleSimulation();
    }
  }, [isSimulating]);

  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] shadow-2xl overflow-hidden flex flex-col font-sans">
      {/* Simulation workspace Header bar */}
      <div className="p-4 border-b border-[#2a2a2a] bg-[#1e1e1e] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#E18E2D]" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#E18E2D]">2. 自动化模拟干跑区 (Dry-Run Simulator)</h2>
        </div>
        
        <button
          onClick={runSampleSimulation}
          disabled={isSimulating}
          className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${
            isSimulating
              ? 'bg-[#222222] text-[#555555] cursor-not-allowed border border-[#333333]'
              : 'bg-[#E18E2D] hover:bg-[#ffaa44] text-black active:scale-95 shadow-lg shadow-[#E18E2D]/10'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isSimulating ? '模拟分析中...' : '点击启动 Dry-Run 预匹配'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[500px] divide-y lg:divide-y-0 lg:divide-x divide-[#2a2a2a]">
        {/* Left Side: Mock Library Editors */}
        <div className="lg:col-span-5 flex flex-col min-h-0 bg-[#141414]">
          <div className="border-b border-[#2a2a2a] flex p-1.5 bg-[#171717] gap-1">
            <button
              onClick={() => setActiveTab('selection')}
              className={`flex-1 py-1.5 text-[10px] sm:text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'selection' ? 'bg-[#2a2a2a] text-white border border-[#3498DB]/30 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#3498DB]" />
              选中模型 ({mockMaterials.length})
            </button>
            <button
              onClick={() => setActiveTab('textures')}
              className={`flex-1 py-1.5 text-[10px] sm:text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'textures' ? 'bg-[#2a2a2a] text-white border border-[#44CC44]/30 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Image className="w-3.5 h-3.5 text-[#44CC44]" />
              贴图资产 ({mockTextures.length})
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`flex-1 py-1.5 text-[10px] sm:text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'library' ? 'bg-[#2a2a2a] text-white border border-[#E18E2D]/30 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <FolderCheck className="w-3.5 h-3.5 text-[#E18E2D]" />
              材质库 ({mockLibMaterials.length})
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {activeTab === 'selection' && (
              <div className="space-y-3.5">
                <p className="text-[11px] text-[#888888] leading-relaxed">
                  模拟在虚幻<b>内容浏览器 (Content Browser) 中手动选中的静态三维模型 (StaticMesh / SkeletalMesh)</b> 。脚本会自动深度扫描其材质槽，读取分配的原材质，实现无缝命名过滤与自动化参数重绑。
                </p>

                {/* List items */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 select-none custom-scrollbar">
                  {mockMaterials.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#222222] rounded hover:border-[#333333] transition-colors">
                      <div className="min-w-0 flex-1">
                        <span className="block text-[9px] font-bold text-[#555555] font-mono uppercase tracking-wider leading-none mb-1">{item.modelName}</span>
                        <div className="flex flex-col gap-0.5">
                          <span className="block text-xs font-semibold text-white font-mono truncate">
                            <span className="text-zinc-500 font-normal">材质球:</span> {item.originalMaterialName}
                          </span>
                          <span className="block text-[10px] font-medium text-zinc-400 font-mono truncate">
                            <span className="text-zinc-500 font-normal">物理插槽 (Slot):</span> <span className="text-[#E18E2D] font-mono font-bold">{item.slotName}</span>
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteMockMaterial(item.id)}
                        className="p-1 text-zinc-650 hover:text-rose-500 hover:bg-rose-950/20 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Adding form */}
                <div className="p-3 bg-[#0d0d0d] rounded border border-[#222222] space-y-2.5">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">写入要选中的内容浏览器模型测试用例:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="网格体 (例: SM_Floor)"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      className="text-[10px] py-1.5 px-2 bg-black border border-[#333333] hover:border-[#444444] rounded text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#3498DB]"
                    />
                    <input
                      type="text"
                      placeholder="材质球 (例: M_Floor_1)"
                      value={newMatName}
                      onChange={(e) => setNewMatName(e.target.value)}
                      className="text-[10px] py-1.5 px-2 bg-black border border-[#333333] hover:border-[#444444] rounded text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#3498DB]"
                    />
                    <input
                      type="text"
                      placeholder="插槽 (例: Floor)"
                      value={newSlotName}
                      onChange={(e) => setNewSlotName(e.target.value)}
                      className="text-[10px] py-1.5 px-2 bg-black border border-[#333333] hover:border-[#444444] rounded text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#3498DB]"
                    />
                  </div>
                  <button
                    onClick={addMockMaterial}
                    disabled={!newModel || !newMatName}
                    className="w-full py-1.5 bg-[#1b1b1b] hover:bg-[#252525] border border-[#333333] text-white rounded text-xs font-bold uppercase transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    + 添加测试案例网格体模型
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'textures' && (
              <div className="space-y-3.5">
                <p className="text-[11px] text-[#888888] leading-relaxed">
                  模拟存在于虚幻<b>主贴图库 (Primary)</b> 与 <b>备用贴图库 (Backup)</b> 下的贴图资产序列：
                </p>

                {/* List items */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 select-none custom-scrollbar">
                  {mockTextures.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-[#222222] rounded hover:border-[#333333] transition-colors">
                      <div className="min-w-0">
                        <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded mr-2 leading-none font-mono tracking-wide uppercase ${
                          item.folder === 'primary' ? 'bg-[#3498DB]/10 text-[#3498DB] border border-[#3498DB]/20' : 'bg-[#E18E2D]/10 text-[#E18E2D] border border-[#E18E2D]/20'
                        }`}>
                          {item.folder === 'primary' ? 'Primary' : 'Backup'}
                        </span>
                        <span className="inline text-xs font-semibold text-zinc-300 font-mono">{item.fileName}</span>
                      </div>
                      <button
                        onClick={() => deleteMockTexture(item.id)}
                        className="p-1 text-zinc-650 hover:text-rose-500 hover:bg-rose-950/20 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Adding form */}
                <div className="p-3 bg-[#0d0d0d] rounded border border-[#222222] space-y-2.5">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">录入库中的贴图文件:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="贴图文件名 (如 T_Floor_n)"
                      value={newTexFile}
                      onChange={(e) => setNewTexFile(e.target.value)}
                      className="flex-1 text-xs py-1.5 px-2.5 bg-black border border-[#333333] hover:border-[#444444] rounded text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#44CC44]"
                    />
                    <select
                      value={newTexFolder}
                      onChange={(e) => setNewTexFolder(e.target.value as 'primary' | 'backup')}
                      className="text-xs border border-[#333333] bg-black rounded py-1.5 px-2 font-bold text-white focus:outline-none"
                    >
                      <option value="primary">主库</option>
                      <option value="backup">备库</option>
                    </select>
                  </div>
                  <button
                    onClick={addMockTexture}
                    disabled={!newTexFile}
                    className="w-full py-1.5 bg-[#1b1b1b] hover:bg-[#252525] border border-[#333333] text-white rounded text-xs font-bold uppercase transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    + 添加测试贴图
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'library' && (
              <div className="space-y-3.5">
                <p className="text-[11px] text-[#888888] leading-relaxed">
                  模拟存在于虚幻指定文件夹 <b>{settings.materialLibraryPath}</b> 下的已有材质/实例球资产。
                  开启匹配开关后，脚本运行时若发现其同名，将<b>一键指派并直接应用</b>，无需重新匹配和产生新实例。
                </p>

                {/* Status Indicator */}
                <div className={`p-2.5 rounded text-[11px] flex items-center gap-2 ${
                  settings.enableMaterialLibraryMatch 
                    ? 'bg-amber-955/20 text-yellow-500 border border-amber-900/30' 
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${settings.enableMaterialLibraryMatch ? 'bg-yellow-500 animate-pulse' : 'bg-zinc-650'}`} />
                  {settings.enableMaterialLibraryMatch 
                    ? `材质库直接匹配已开启 (查找路径: ${settings.materialLibraryPath})` 
                    : '检测到您的配置层未启用 [材质实例库匹配]，请先在配置表勾选启用！'
                  }
                </div>

                {/* List items */}
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 select-none custom-scrollbar">
                  {mockLibMaterials.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-[#222222] rounded hover:border-[#333333] transition-colors">
                      <div className="min-w-0 flex items-center gap-2">
                        <FolderCheck className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        <span className="inline-block text-xs font-semibold text-zinc-300 font-mono overflow-hidden text-ellipsis">{item}</span>
                      </div>
                      <button
                        onClick={() => deleteMockLibMaterial(item)}
                        className="p-1 text-zinc-650 hover:text-rose-500 hover:bg-rose-950/20 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {mockLibMaterials.length === 0 && (
                    <div className="text-center py-6 text-[11px] text-zinc-500 border border-dashed border-[#222222] rounded bg-[#0a0a0a]">
                      材质库为空，请在下方录入已有材质资产名称
                    </div>
                  )}
                </div>

                {/* Adding form */}
                <div className="p-3 bg-[#0d0d0d] rounded border border-[#222222] space-y-2.5">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">录入材质库已有的材质:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="材质名称 (以 M_ 或 MI_ 开头最优)"
                      value={newLibMat}
                      onChange={(e) => setNewLibMat(e.target.value)}
                      className="flex-1 text-xs py-1.5 px-2.5 bg-black border border-[#333333] hover:border-[#444444] rounded text-white font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addMockLibMaterial();
                      }}
                    />
                  </div>
                  <button
                    onClick={addMockLibMaterial}
                    disabled={!newLibMat}
                    className="w-full py-1.5 bg-[#1b1b1b] hover:bg-[#252525] border border-[#333333] text-zinc-300 rounded text-xs font-bold uppercase transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    + 添加已有材质资产
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Visual Dry-Run outputs & Sphere visualization */}
        <div className="lg:col-span-7 flex flex-col min-h-0 bg-[#0e0e0e] p-4 sm:p-5 space-y-4">
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            
            {/* Step Timeline indicators */}
            <div className="flex items-center justify-between text-[9px] font-bold text-zinc-600 border-b border-[#222222] pb-3 select-none uppercase tracking-wider">
              <span className={currentStep >= 1 ? 'text-[#E18E2D]' : ''}>1. 载入插件</span>
              <ChevronRight className="w-3 h-3 text-zinc-700" />
              <span className={currentStep >= 2 ? 'text-[#3498DB]' : ''}>2. 材质采集</span>
              <ChevronRight className="w-3 h-3 text-zinc-700" />
              <span className={currentStep >= 3 ? 'text-[#3498DB]' : ''}>3. 核心清洗</span>
              <ChevronRight className="w-3 h-3 text-zinc-700" />
              <span className={currentStep >= 4 ? 'text-indigo-400' : ''}>4. 库检索</span>
              <ChevronRight className="w-3 h-3 text-zinc-700" />
              <span className={currentStep >= 5 ? 'text-[#44CC44]' : ''}>5. 完成绑定</span>
            </div>

            {hasRun ? (
              <div className="flex-1 flex flex-col min-h-0 gap-4">
                {/* Simulated Log Console */}
                <div className="h-[125px] bg-black rounded p-3 border border-[#222222] font-mono text-[10px] text-[#888888] overflow-y-auto space-y-1 custom-scrollbar">
                  <span className="block text-[9px] text-[#444444] border-b border-[#1c1c1c] pb-1 mb-1 font-bold uppercase tracking-widest">
                    LogPython: 虚幻引擎实时诊断 (UE Live Python Log Console)
                  </span>
                  {consoleLogs.map((log, idx) => {
                    let logColor = 'text-zinc-500';
                    if (log.includes('[错误]')) {
                      logColor = 'text-rose-500';
                    } else if (log.includes('完成') || log.includes('匹配到') || log.includes('流程圆满')) {
                      logColor = 'text-[#44CC44]';
                    } else if (log.includes('========') || log.includes('---')) {
                      logColor = 'text-[#E18E2D]';
                    } else if (log.includes('[环境]') || log.includes('验证')) {
                      logColor = 'text-[#3498DB]';
                    } else if (log.trim().startsWith('*')) {
                      logColor = 'text-[#AAAAAA]';
                    }

                    return (
                      <div key={idx} className={`${logColor} leading-4`}>
                        {log}
                      </div>
                    );
                  })}
                </div>

                {/* Visual outcomes visualization: Material Instances slots mapping */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    绑定后的虚幻材质实例 (Generated Material Instances):
                  </span>
                  
                  {isSimulating && simulationResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-zinc-500 gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#E18E2D]" />
                      <span className="text-xs uppercase font-bold tracking-wider">进行虚幻自动化编译与贴图匹配中...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {simulationResults.map((res, i) => (
                        <div key={i} className="p-3 bg-[#111111] border border-[#222222] rounded hover:border-[#333333] transition-all flex flex-col md:flex-row gap-4 items-start md:items-center">
                          {/* Left: Material Ball Sphere representation */}
                          <div className="relative shrink-0 w-12 h-12 rounded-full border border-[#E18E2D]/40 bg-gradient-to-tr from-[#3a200a]/30 to-[#E18E2D]/15 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(225,142,45,0.05)]">
                            <div className="absolute inset-1 rounded-full bg-[#E18E2D]/10 animate-pulse border border-[#E18E2D]/20"></div>
                            <span className="text-[10px] text-[#E18E2D] font-bold font-mono relative z-10 uppercase select-none">M_Inst</span>
                          </div>

                          {/* Center Info */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white font-mono">{res.instanceName}</span>
                              {res.slots.baseColor.foundIn === 'library' ? (
                                <span className="text-[8px] border border-amber-500/25 bg-amber-500/10 text-amber-500 font-bold px-1.5 rounded uppercase tracking-wider font-mono">
                                  Library Mat
                                </span>
                              ) : (
                                <span className="text-[8px] border border-[#3498DB]/30 bg-[#3498DB]/10 text-[#3498DB] font-bold px-1 rounded uppercase tracking-wider font-mono">
                                  INSTANCE
                                </span>
                              )}
                            </div>
                            <span className="block text-[10px] text-[#555555] font-mono truncate">{res.instanceSavePath}</span>
                            
                            {/* Texture match results slots items */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#1e1e1e]">
                              {/* BaseColor item */}
                              <div className="p-1 px-2 bg-black rounded border border-[#222222] flex flex-col justify-center">
                                <span className="text-[8px] font-bold text-[#555555] uppercase font-mono">{res.slots.baseColor.paramName}</span>
                                <span className={`text-[10px] font-mono leading-tight truncate ${res.slots.baseColor.textureName ? 'text-[#CCCCCC]' : 'text-rose-500 font-bold italic'}`}>
                                  {res.slots.baseColor.textureName || 'Missing Map'}
                                </span>
                                {res.slots.baseColor.foundIn && (
                                  <span className={`text-[8px] font-bold font-mono mt-0.5 ${res.slots.baseColor.foundIn === 'library' ? 'text-amber-500' : 'text-[#E18E2D]'}`}>
                                    {res.slots.baseColor.foundIn === 'primary' ? '★ Primary' : res.slots.baseColor.foundIn === 'library' ? '✦ Library Match' : '☆ Backup'}
                                  </span>
                                )}
                              </div>
                              {/* Normal item */}
                              <div className={`p-1 px-2 bg-black rounded border flex flex-col justify-center ${settings.enableNormal ? 'border-[#222222]' : 'border-zinc-800 opacity-40'}`}>
                                <span className="text-[8px] font-bold text-[#555555] uppercase font-mono">{res.slots.normal.paramName}</span>
                                {!settings.enableNormal ? (
                                  <span className="text-[9px] font-mono leading-tight text-zinc-650 italic">插槽已禁用</span>
                                ) : (
                                  <>
                                    <span className={`text-[10px] font-mono leading-tight truncate ${res.slots.normal.textureName ? 'text-[#CCCCCC]' : 'text-rose-500 font-bold italic'}`}>
                                      {res.slots.normal.textureName || 'Missing Map'}
                                    </span>
                                    {res.slots.normal.foundIn && (
                                      <span className={`text-[8px] font-bold font-mono mt-0.5 ${res.slots.normal.foundIn === 'library' ? 'text-amber-500' : 'text-[#E18E2D]'}`}>
                                        {res.slots.normal.foundIn === 'primary' ? '★ Primary' : res.slots.normal.foundIn === 'library' ? '✦ Library Match' : '☆ Backup'}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              {/* PBR item */}
                              <div className={`p-1 px-2 bg-black rounded border flex flex-col justify-center ${settings.enablePBR ? 'border-[#222222]' : 'border-zinc-800 opacity-40'}`}>
                                <span className="text-[8px] font-bold text-[#555555] uppercase font-mono">{res.slots.pbr.paramName}</span>
                                {!settings.enablePBR ? (
                                  <span className="text-[9px] font-mono leading-tight text-zinc-650 italic">插槽已禁用</span>
                                ) : (
                                  <>
                                    <span className={`text-[10px] font-mono leading-tight truncate ${res.slots.pbr.textureName ? 'text-[#CCCCCC]' : 'text-rose-500 font-bold italic'}`}>
                                      {res.slots.pbr.textureName || 'Missing Map'}
                                    </span>
                                    {res.slots.pbr.foundIn && (
                                      <span className={`text-[8px] font-bold font-mono mt-0.5 ${res.slots.pbr.foundIn === 'library' ? 'text-amber-500' : 'text-[#E18E2D]'}`}>
                                        {res.slots.pbr.foundIn === 'primary' ? '★ Primary' : res.slots.pbr.foundIn === 'library' ? '✦ Library Match' : '☆ Backup'}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              {/* Dynamic custom slots items */}
                              {Object.entries(res.slots.customSlots || {}).map(([slotId, slotResult]: [string, any]) => {
                                const originalSlot = (settings.customSlots || []).find(cs => cs.id === slotId);
                                const isEnabled = originalSlot ? originalSlot.enabled : false;
                                return (
                                  <div key={slotId} className={`p-1 px-2 bg-black rounded border flex flex-col justify-center ${isEnabled ? 'border-[#222222]' : 'border-zinc-800 opacity-40'}`}>
                                    <span className="text-[8px] font-bold text-[#555555] uppercase font-mono">{slotResult.slotName} ({slotResult.paramName})</span>
                                    {!isEnabled ? (
                                      <span className="text-[9px] font-mono leading-tight text-zinc-650 italic">插槽已禁用</span>
                                    ) : (
                                      <>
                                        <span className={`text-[10px] font-mono leading-tight truncate ${slotResult.textureName ? 'text-[#CCCCCC]' : 'text-rose-500 font-bold italic'}`}>
                                          {slotResult.textureName || 'Missing Map'}
                                        </span>
                                        {slotResult.foundIn && (
                                          <span className="text-[8px] font-bold text-[#E18E2D] font-mono mt-0.5">
                                            {slotResult.foundIn === 'primary' ? '★ Primary' : '☆ Backup'}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#222222] rounded p-8 text-center select-none text-[#555555]">
                <FolderCheck className="w-10 h-10 text-zinc-800 mb-3 stroke-1" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#888888]">等待启动流程演算</span>
                <p className="text-[11px] text-[#666666] mt-1.5 max-w-sm leading-relaxed">
                  点击右上角的“启动 Dry-Run 预匹配”按钮，可在网页中即刻模拟 Python 脚本在 Unreal Editor 原生自动化材质生成的全部步骤。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
