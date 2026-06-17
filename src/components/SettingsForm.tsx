/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GeneratorSettings } from '../types';
import { Settings, Folder, KeyRound, Sliders, Info, ShieldCheck, Plus, Trash2, Download, Upload } from 'lucide-react';

interface SettingsFormProps {
  settings: GeneratorSettings;
  onChange: (settings: GeneratorSettings) => void;
}

export default function SettingsForm({ settings, onChange }: SettingsFormProps) {
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Clear import status automatically after 3.5 seconds
  useEffect(() => {
    if (importStatus) {
      const timer = setTimeout(() => setImportStatus(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [importStatus]);

  const handleExportConfig = () => {
    try {
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ue_material_automator_settings.json';
      link.click();
      URL.revokeObjectURL(url);
      setImportStatus('✓ 导出成功');
    } catch (e) {
      setImportStatus('✗ 导出失败');
    }
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (typeof parsed === 'object' && parsed !== null) {
          onChange({
            ...settings,
            ...parsed,
          });
          setImportStatus('✓ 导入成功');
        } else {
          setImportStatus('✗ 格式错误');
        }
      } catch (err) {
        setImportStatus('✗ 导入失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    onChange({
      ...settings,
      [name]: val,
    });
  };

  const handleUpdateCustomSlot = (id: string, updates: Partial<any>) => {
    const updated = (settings.customSlots || []).map((slot) => {
      if (slot.id === id) {
        return { ...slot, ...updates };
      }
      return slot;
    });
    onChange({
      ...settings,
      customSlots: updated,
    });
  };

  const handleAddCustomSlot = () => {
    const newId = 'slot_' + Date.now();
    const newSlot = {
      id: newId,
      name: '自建材质参数',
      paramName: 'CustomParam',
      suffix: '_c',
      enabled: false,
    };
    onChange({
      ...settings,
      customSlots: [...(settings.customSlots || []), newSlot],
    });
  };

  const handleRemoveCustomSlot = (id: string) => {
    onChange({
      ...settings,
      customSlots: (settings.customSlots || []).filter((s) => s.id !== id),
    });
  };

  return (
    <div className="bg-[#1a1a1a] text-[#CCCCCC] rounded-lg border border-[#2a2a2a] shadow-2xl overflow-hidden h-full flex flex-col font-sans">
      <div className="p-4 border-b border-[#2a2a2a] bg-[#1e1e1e] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#E18E2D]" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#E18E2D]">1. 核心配置 (Configuration)</h2>
        </div>
        <span className="text-[10px] font-mono font-bold bg-[#E18E2D]/10 text-[#E18E2D] px-2 py-0.5 rounded border border-[#E18E2D]/20 uppercase">
          Unreal 5.7+
        </span>
      </div>

      {/* Local Config management bar */}
      <div className="px-4 py-2 border-b border-[#242424] bg-[#151515] flex flex-row items-center justify-between text-xs gap-3">
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">本地配置管理 (JSON Settings)</span>
        <div className="flex items-center gap-2">
          {importStatus && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${importStatus.includes('成功') ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/10' : 'bg-rose-950/40 text-rose-400 border border-rose-500/10'}`}>
              {importStatus}
            </span>
          )}
          <button
            onClick={handleExportConfig}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-850 hover:bg-zinc-750 active:bg-zinc-950 border border-zinc-750 hover:border-zinc-650 text-zinc-200 text-[10px] uppercase font-bold rounded transition-colors"
            title="将当前配置的所有倾向参数、自定义插槽导出为本地 JSON 配置文件"
          >
            <Download className="w-3.5 h-3.5 text-[#E18E2D]" />
            <span>导出配置</span>
          </button>
          <label
            className="flex items-center gap-1.5 px-3 py-1 bg-[#E18E2D]/10 hover:bg-[#E18E2D]/20 active:bg-[#E18E2D]/30 border border-[#E18E2D]/20 hover:border-[#E18E2D]/45 text-[#E18E2D] text-[10px] uppercase font-bold rounded transition-colors cursor-pointer"
            title="一键加载/导入之前配置保存过的 JSON 配置文件"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>导入配置</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportConfig}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="p-5 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
        {/* Section 1: UE Directory Configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#888888]">
            <Folder className="w-3.5 h-3.5 text-[#E18E2D]" />
            <span>虚幻项目资产位置 (UE Directory Paths)</span>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="masterMaterialPath" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1 flex items-center justify-between">
                <span>原母材质 / 父级实例路径 (Parent Material / Instance Path)</span>
                <span className="text-zinc-650 font-mono text-[9px] text-zinc-500">MASTER_MATERIAL_PATH</span>
              </label>
              <input
                id="masterMaterialPath"
                type="text"
                name="masterMaterialPath"
                value={settings.masterMaterialPath}
                onChange={handleChange}
                placeholder="例如: /Game/Materials/M_MasterMaterial 或 MI_ParentInstance"
                className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
              />
              <p className="text-[10px] text-[#666666] mt-1 italic">
                新材质实例的父级模板。支持直接指定母材质(Material)，或是另一个已有的材质实例(Material Instance)，便于实现多级实例继承。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="primaryTextureDir" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1">
                  主贴图库 (Primary Library)
                </label>
                <input
                  id="primaryTextureDir"
                  type="text"
                  name="primaryTextureDir"
                  value={settings.primaryTextureDir}
                  onChange={handleChange}
                  placeholder="/Game/Textures/Primary"
                  className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                />
              </div>
              <div>
                <label htmlFor="backupTextureDir" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1">
                  备用贴图库 (Backup Library)
                </label>
                <input
                  id="backupTextureDir"
                  type="text"
                  name="backupTextureDir"
                  value={settings.backupTextureDir}
                  onChange={handleChange}
                  placeholder="/Game/Textures/Backup"
                  className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                />
              </div>
            </div>
            <p className="text-[10px] text-[#666666] italic">
              自动检索贴图的虚幻资产文件夹目录（脚本会自动递归检索子文件夹）。
            </p>

            <div>
              <label htmlFor="saveFolder" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1 flex items-center justify-between">
                <span>材质实例保存文件夹 (Save Folder)</span>
                <span className="text-zinc-600 font-mono text-[9px] text-zinc-500">SAVE_FOLDER</span>
              </label>
              <input
                id="saveFolder"
                type="text"
                name="saveFolder"
                value={settings.saveFolder}
                onChange={handleChange}
                placeholder="/Game/MaterialInstances"
                className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
              />
              <p className="text-[10px] text-[#666666] mt-1 italic">
                新创建的材质实例保存的目标位置。如果没有此路径，脚本会自动创建。
              </p>
            </div>
          </div>
        </div>

        <hr className="border-[#2b2b2b]" />

        {/* Section 2: Textures Selection & Suffix */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#888888]">
            <KeyRound className="w-3.5 h-3.5 text-[#E18E2D]" />
            <span>原材质参数项与贴图插槽 (Material Parameters)</span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* BaseColor Column */}
              <div className="p-3 bg-[#0c0c0c] border border-[#2b2b2b] rounded flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-white uppercase">BaseColor 基础颜色</span>
                    <span className="text-[9px] px-1 bg-green-950/45 text-green-400 rounded border border-green-500/20 font-semibold">必填</span>
                  </div>
                  <div>
                    <label htmlFor="baseColorParam" className="block text-[9px] font-semibold text-[#888888] uppercase mb-1">
                      参数名称 (Param Name)
                    </label>
                    <input
                      id="baseColorParam"
                      type="text"
                      name="baseColorParam"
                      value={settings.baseColorParam}
                      onChange={handleChange}
                      className="w-full text-xs font-mono py-1.5 px-2 bg-black border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                    />
                  </div>
                </div>
                <div className="text-[9px] text-zinc-500 italic pt-1">匹配去除法线/PBR后缀的主贴图</div>
              </div>

              {/* Normal Column */}
              <div className={`p-3 border rounded transition-all duration-200 flex flex-col justify-between space-y-2 ${settings.enableNormal ? 'bg-[#0c0c0c] border-[#2b2b2b]' : 'bg-transparent border-[#222222]/30 opacity-50'}`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="enableNormal" className="text-[10px] font-bold text-white uppercase flex items-center gap-1.5 cursor-pointer">
                      <input
                        id="enableNormal"
                        type="checkbox"
                        name="enableNormal"
                        checked={settings.enableNormal}
                        onChange={handleChange}
                        className="w-3.5 h-3.5 text-[#E18E2D] border-[#333333] bg-black rounded focus:ring-0 cursor-pointer accent-[#E18E2D]"
                      />
                      <span>Normal 法线槽</span>
                    </label>
                    <span className={`text-[9px] px-1 rounded border font-semibold ${settings.enableNormal ? 'bg-[#E18E2D]/10 text-[#E18E2D] border-[#E18E2D]/20' : 'bg-zinc-900/60 text-zinc-500 border-zinc-850'}`}>
                      {settings.enableNormal ? '已开启' : '已关闭'}
                    </span>
                  </div>

                  {settings.enableNormal ? (
                    <div className="space-y-2">
                      <div>
                        <label htmlFor="normalParam" className="block text-[9px] font-semibold text-[#8a8a8a] uppercase mb-1">
                          法线参数名 (Param Name)
                        </label>
                        <input
                          id="normalParam"
                          type="text"
                          name="normalParam"
                          value={settings.normalParam}
                          onChange={handleChange}
                          className="w-full text-xs font-mono py-1.5 px-2 bg-black border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="normalSuffix" className="block text-[9px] font-semibold text-[#8a8a8a] uppercase mb-1">
                          匹配后缀 (Suffix)
                        </label>
                        <input
                          id="normalSuffix"
                          type="text"
                          name="normalSuffix"
                          value={settings.normalSuffix}
                          onChange={handleChange}
                          placeholder="_n"
                          className="w-full text-xs font-mono py-1.5 px-2 bg-black border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-500 italic py-4 text-center">
                      法线模块已关闭，生成时不绑定法线贴图
                    </div>
                  )}
                </div>
              </div>

              {/* PBR Column */}
              <div className={`p-3 border rounded transition-all duration-200 flex flex-col justify-between space-y-2 ${settings.enablePBR ? 'bg-[#0c0c0c] border-[#2b2b2b]' : 'bg-transparent border-[#222222]/30 opacity-50'}`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="enablePBR" className="text-[10px] font-bold text-white uppercase flex items-center gap-1.5 cursor-pointer">
                      <input
                        id="enablePBR"
                        type="checkbox"
                        name="enablePBR"
                        checked={settings.enablePBR}
                        onChange={handleChange}
                        className="w-3.5 h-3.5 text-[#E18E2D] border-[#333333] bg-black rounded focus:ring-0 cursor-pointer accent-[#E18E2D]"
                      />
                      <span>PBR 粗糙/金属槽</span>
                    </label>
                    <span className={`text-[9px] px-1 rounded border font-semibold ${settings.enablePBR ? 'bg-[#E18E2D]/10 text-[#E18E2D] border-[#E18E2D]/20' : 'bg-zinc-900/60 text-zinc-500 border-zinc-850'}`}>
                      {settings.enablePBR ? '已开启' : '已关闭'}
                    </span>
                  </div>

                  {settings.enablePBR ? (
                    <div className="space-y-2">
                      <div>
                        <label htmlFor="pbrParam" className="block text-[9px] font-semibold text-[#8a8a8a] uppercase mb-1">
                          PBR 参数名 (Param Name)
                        </label>
                        <input
                          id="pbrParam"
                          type="text"
                          name="pbrParam"
                          value={settings.pbrParam}
                          onChange={handleChange}
                          className="w-full text-xs font-mono py-1.5 px-2 bg-black border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="pbrSuffix" className="block text-[9px] font-semibold text-[#8a8a8a] uppercase mb-1">
                          匹配后缀 (Suffix)
                        </label>
                        <input
                          id="pbrSuffix"
                          type="text"
                          name="pbrSuffix"
                          value={settings.pbrSuffix}
                          onChange={handleChange}
                          placeholder="_s"
                          className="w-full text-xs font-mono py-1.5 px-2 bg-black border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-500 italic py-4 text-center">
                      PBR 模块已关闭，生成时不绑定PBR贴图
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 自定义增加贴图插槽功能区域 */}
            <div className="p-3 bg-[#0a0a0a]/50 border border-[#222222] rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  📁 自定义新增贴图插槽 (Custom Slots)
                </span>
                <button
                  type="button"
                  onClick={handleAddCustomSlot}
                  className="px-2.5 py-1 bg-[#E18E2D]/10 hover:bg-[#E18E2D]/20 text-[#E18E2D] border border-[#E18E2D]/35 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 hover:scale-102 active:scale-98"
                >
                  <Plus className="w-3 h-3 text-[#E18E2D]" />
                  <span>新增插槽</span>
                </button>
              </div>

              {(!settings.customSlots || settings.customSlots.length === 0) ? (
                <div className="text-[10px] text-zinc-650 font-mono text-center py-4 bg-[#0d0d0d] rounded border border-dashed border-[#222222] italic">
                  暂无自定义贴图插槽，点击右上角“新增插槽”扩充绑定规则
                </div>
              ) : (
                <div className="space-y-3">
                  {settings.customSlots.map((slot) => (
                    <div key={slot.id} className="p-3 bg-[#111111] border border-[#2b2b2b] rounded-md flex flex-col space-y-3 transition-colors hover:border-[#383838]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={slot.enabled}
                            onChange={(e) => handleUpdateCustomSlot(slot.id, { enabled: e.target.checked })}
                            className="w-3.5 h-3.5 text-[#E18E2D] border-[#333333] bg-black rounded focus:ring-0 cursor-pointer accent-[#E18E2D]"
                          />
                          <input
                            type="text"
                            value={slot.name}
                            onChange={(e) => handleUpdateCustomSlot(slot.id, { name: e.target.value })}
                            placeholder="如: 自发光"
                            className="text-[11px] font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#E18E2D] focus:outline-none transition-colors px-1 py-0.5 w-[150px]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomSlot(slot.id)}
                          className="p-1 text-zinc-600 hover:text-rose-500 hover:bg-rose-950/20 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[9px] text-[#8a8a8a] uppercase mb-1">
                            材质参数名 (Param Name)
                          </label>
                          <input
                            type="text"
                            value={slot.paramName}
                            onChange={(e) => handleUpdateCustomSlot(slot.id, { paramName: e.target.value })}
                            placeholder="如: EmissiveColor"
                            disabled={!slot.enabled}
                            className="w-full text-[10px] font-mono py-1 px-1.5 bg-black border border-[#2a2a2a] hover:border-[#383838] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] transition-colors disabled:opacity-40"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-[#8a8a8a] uppercase mb-1">
                            匹配贴图后缀 (Suffix)
                          </label>
                          <input
                            type="text"
                            value={slot.suffix}
                            onChange={(e) => handleUpdateCustomSlot(slot.id, { suffix: e.target.value })}
                            placeholder="如: _e"
                            disabled={!slot.enabled}
                            className="w-full text-[10px] font-mono py-1 px-1.5 bg-black border border-[#2a2a2a] hover:border-[#383838] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] transition-colors disabled:opacity-40"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-gradient-to-r from-[#E18E2D]/10 to-transparent border border-[#E18E2D]/20 rounded text-xs">
              <span className="block text-[#E18E2D] font-bold text-[10px] uppercase mb-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> 贴图匹配与插槽过滤规则:
              </span>
              <p className="text-[10px] text-[#AAAAAA] leading-relaxed">
                若选中材质核心为 <code>Stone</code> 且正常开启相应插槽：
              </p>
              <ul className="list-disc pl-4 mt-1.5 text-[10px] text-[#888888] space-y-0.5">
                <li><b>BaseColor：</b>匹配文件名包含 <code>Stone</code> 且排除已被启用的法线/PBR以及各种自定义开启的贴图后缀。</li>
                {settings.enableNormal && <li><b>Normal：</b>已开启。匹配包含 <code>Stone</code> 且以 <code>{settings.normalSuffix}</code> 结尾的文件（如 <code>T_Stone{settings.normalSuffix}</code>）。</li>}
                {settings.enablePBR && <li><b>PBR：</b>已开启. 匹配包含 <code>Stone</code> 且以 <code>{settings.pbrSuffix}</code> 结尾的文件（如 <code>T_Stone{settings.pbrSuffix}</code>）。</li>}
                {(settings.customSlots || []).filter(s => s.enabled).map(s => (
                  <li key={s.id}><b>{s.name}：</b>已开启。匹配包含 <code>Stone</code> 且以 <code>{s.suffix}</code> 结尾的文件（如 <code>T_Stone{s.suffix}</code>）。</li>
                ))}
                {(!settings.enableNormal || !settings.enablePBR || (settings.customSlots || []).some(s => !s.enabled)) && <li className="text-[#E18E2D]/70 font-semibold">提示：被关闭或未启用的贴图插槽将不会被检索并执行虚幻实参注入。</li>}
              </ul>
            </div>
          </div>
        </div>

        <hr className="border-[#2b2b2b]" />

        {/* Section 3: Mesh Material Name Clean */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#888888]">
            <Sliders className="w-3.5 h-3.5 text-[#E18E2D]" />
            <span>核心映射词与命名清洗规则 (Mapping Rules)</span>
          </div>
          <div className="space-y-3">
            {/* Core Match Source Toggles */}
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold text-[#888888] uppercase">
                核心词检测源 (Match Source Setting)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, matchSource: 'material' })}
                  style={{ contentVisibility: 'auto' }}
                  className={`px-3 py-2 border text-left flex flex-col transition-all rounded cursor-pointer ${
                    settings.matchSource === 'material'
                      ? 'bg-[#E18E2D]/10 border-[#E18E2D] text-white shadow-[0_0_8px_rgba(225,142,45,0.15)]'
                      : 'bg-[#0c0c0c] border-[#2b2b2b] text-[#888888] hover:bg-[#151515] hover:border-[#3a3a3a] hover:text-zinc-300'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${settings.matchSource === 'material' ? 'text-white' : 'text-zinc-400'}`}>
                    读取模型材质球名字
                  </span>
                  <span className="text-[9px] mt-0.5 leading-heading text-zinc-500">
                    读取已绑定的材质球资产名称进行检索清洗 (例如 <code>M_Stone_01</code> → <code>Stone_01</code>)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, matchSource: 'slot' })}
                  style={{ contentVisibility: 'auto' }}
                  className={`px-3 py-2 border text-left flex flex-col transition-all rounded cursor-pointer ${
                    settings.matchSource === 'slot'
                      ? 'bg-[#E18E2D]/10 border-[#E18E2D] text-white shadow-[0_0_8px_rgba(225,142,45,0.15)]'
                      : 'bg-[#0c0c0c] border-[#2b2b2b] text-[#888888] hover:bg-[#151515] hover:border-[#3a3a3a] hover:text-zinc-300'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${settings.matchSource === 'slot' ? 'text-white' : 'text-zinc-400'}`}>
                    读取模型插槽名字 (Slot Name)
                  </span>
                  <span className="text-[9px] mt-0.5 leading-heading text-zinc-500">
                    从网格模型自身的物理材质插槽中读取名称 (例如 <code>Stone_01_Slot</code> → <code>Stone_01</code>)
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#0c0c0c] border border-[#2b2b2b] rounded">
              <input
                id="ignoreTrailingOne"
                type="checkbox"
                name="ignoreTrailingOne"
                checked={settings.ignoreTrailingOne}
                onChange={handleChange}
                className="w-4 h-4 text-[#E18E2D] border-[#333333] bg-black rounded focus:ring-0 focus:ring-offset-0 mt-0.5 cursor-pointer accent-[#E18E2D]"
              />
              <div className="text-xs cursor-pointer select-none">
                <label htmlFor="ignoreTrailingOne" className="font-bold text-white block uppercase">无视材质命名的最末尾数字 1</label>
                <span className="text-[10px] text-[#666666] block mt-0.5 leading-relaxed">
                  开启后，例如 <code>M_Wood_1</code> 或 <code>M_Wood1</code> 都会清洗出 <code>M_Wood</code>，防止因虚幻复制而产生多余的重名实例。
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="stripPrefixes" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1">
                  要剥离的原始前缀 (Strip Prefixes)
                </label>
                <input
                  id="stripPrefixes"
                  type="text"
                  name="stripPrefixes"
                  value={settings.stripPrefixes}
                  onChange={handleChange}
                  placeholder="M_, MAT_, MI_"
                  className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                />
                <p className="text-[9px] text-[#666666] mt-1 italic">
                  逗号分隔。例: <code>M_Brick</code> 剥离后为 <code>Brick</code>。
                </p>
              </div>

              <div>
                <label htmlFor="addInstancePrefix" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1">
                  生成的材质实例前缀 (Add Prefix)
                </label>
                <input
                  id="addInstancePrefix"
                  type="text"
                  name="addInstancePrefix"
                  value={settings.addInstancePrefix}
                  onChange={handleChange}
                  placeholder="MI_"
                  className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                />
                <p className="text-[9px] text-[#666666] mt-1 italic">
                  通常材质实例使用 <code>MI_</code> 前缀标识。
                </p>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-[#2b2b2b]" />

        {/* Section 4: Material Library Matching */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#888888]">
            <Folder className="w-3.5 h-3.5 text-[#E18E2D]" />
            <span>材质库已有资产匹配规则 (Material Library Direct Matching)</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-[#0c0c0c] border border-[#2b2b2b] rounded">
              <input
                id="enableMaterialLibraryMatch"
                type="checkbox"
                name="enableMaterialLibraryMatch"
                checked={settings.enableMaterialLibraryMatch}
                onChange={handleChange}
                className="w-4 h-4 text-[#E18E2D] border-[#333333] bg-black rounded focus:ring-0 focus:ring-offset-0 mt-0.5 cursor-pointer accent-[#E18E2D]"
              />
              <div className="text-xs cursor-pointer select-none flex-1">
                <label htmlFor="enableMaterialLibraryMatch" className="font-bold text-white block uppercase cursor-pointer">
                  优先直接匹配材质库已有材质
                </label>
                <span className="text-[10px] text-[#666666] block mt-0.5 leading-relaxed">
                  若开启，脚本会优先从指定的“材质库路径”中，搜索清洗后核心名称匹配的已有材质（或材质实例）并直接指派给模型，从而无需基于贴图重新生成新实例。
                </span>
              </div>
            </div>

            {settings.enableMaterialLibraryMatch && (
              <div className="space-y-3 pt-1 border-l-2 border-[#E18E2D]/20 pl-3">
                <div>
                  <label htmlFor="materialLibraryPath" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1 flex items-center justify-between">
                    <span>独立材质库资产保存路径 (Material Library Folder)</span>
                    <span className="text-zinc-650 font-mono text-[9px] text-zinc-500 font-normal">MATERIAL_LIBRARY_PATH</span>
                  </label>
                  <input
                    id="materialLibraryPath"
                    type="text"
                    name="materialLibraryPath"
                    value={settings.materialLibraryPath}
                    onChange={handleChange}
                    placeholder="例如: /Game/MaterialLibrary"
                    className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                  />
                  <p className="text-[10px] text-[#666666] mt-1 italic">
                    指定虚幻引擎中已建立的材质资产存放文件夹，脚本会自动递归遍历该目录。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <hr className="border-[#2b2b2b]" />

        {/* Section 5: Fallback / Incomplete Material Rules */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#888888]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#E18E2D]" />
            <span>缺省备用材质规则 (Fallback Rules)</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-[#0c0c0c] border border-[#2b2b2b] rounded">
              <input
                id="useFallbackMaterial"
                type="checkbox"
                name="useFallbackMaterial"
                checked={settings.useFallbackMaterial}
                onChange={handleChange}
                className="w-4 h-4 text-[#E18E2D] border-[#333333] bg-black rounded focus:ring-0 focus:ring-offset-0 mt-0.5 cursor-pointer accent-[#E18E2D]"
              />
              <div className="text-xs cursor-pointer select-none flex-1">
                <label htmlFor="useFallbackMaterial" className="font-bold text-white block uppercase cursor-pointer">启用缺省材质替换机制</label>
                <span className="text-[10px] text-[#666666] block mt-0.5 leading-relaxed">
                  若无法找齐 PBR 贴图三件套（基础颜色、法线、PBR），自动启用备用母材质并其仅使用 BaseColor 贴图。
                </span>
              </div>
            </div>

            {settings.useFallbackMaterial && (
              <div className="space-y-3 pt-1 border-l-2 border-[#E18E2D]/20 pl-3">
                <div>
                  <label htmlFor="backupMasterMaterialPath" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1 flex items-center justify-between">
                    <span>备用母材质路径 (Backup Parent Material Path)</span>
                    <span className="text-zinc-650 font-mono text-[9px] text-zinc-500 font-normal">BACKUP_MATERIAL_PATH</span>
                  </label>
                  <input
                    id="backupMasterMaterialPath"
                    type="text"
                    name="backupMasterMaterialPath"
                    value={settings.backupMasterMaterialPath}
                    onChange={handleChange}
                    placeholder="/Game/Materials/M_BackupMaterial"
                    className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="fallbackPrefix" className="block text-[10px] font-semibold text-[#888888] uppercase mb-1">
                    备用材质实例前缀 (Fallback Instance Prefix)
                  </label>
                  <input
                    id="fallbackPrefix"
                    type="text"
                    name="fallbackPrefix"
                    value={settings.fallbackPrefix}
                    onChange={handleChange}
                    placeholder="MI_N_"
                    className="w-full text-xs font-mono py-2 px-3 bg-[#0a0a0a] border border-[#333333] hover:border-[#444444] rounded text-white focus:outline-none focus:ring-1 focus:ring-[#E18E2D] focus:border-[#E18E2D] transition-colors"
                  />
                  <p className="text-[9px] text-[#666666] mt-1 italic">
                    当使用备用材质时，材质实例的命名将以该值作为前缀（默认：<code>MI_N_</code>）。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
