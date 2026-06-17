/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Terminal, CheckSquare, PlusCircle, Laptop, Settings } from 'lucide-react';

export default function TutorialGuide() {
  const steps = [
    {
      icon: <Settings className="w-4 h-4 text-[#E18E2D]" />,
      title: '第一步：启用 Python 引擎脚本插件',
      content: (
        <div className="space-y-2 text-xs text-[#AAAAAA] leading-relaxed">
          <p>在虚幻编辑器菜单中选择：</p>
          <div className="p-2 bg-black border border-[#222222] text-white font-mono text-[10px] select-all">
            编辑 (Edit) → 插件 (Plugins)
          </div>
          <p>
            在弹出的搜索框中检索 <code>Python</code>，勾选并启用{' '}
            <b className="text-white">Python Editor Script Plugin</b> 插件。如提示需重启编辑器，请保存项目并重启。
          </p>
        </div>
      ),
    },
    {
      icon: <Terminal className="w-4 h-4 text-[#E18E2D]" />,
      title: '第二步：打开输出日志 (Output Log) 并切换至 Python 模式',
      content: (
        <div className="space-y-2 text-xs text-[#AAAAAA] leading-relaxed">
          <p>打开控制台：</p>
          <div className="p-2 bg-black border border-[#222222] text-white font-mono text-[10px] select-all">
            窗口 (Window) → 开发者工具 → 输出日志 (Output Log)
          </div>
          <p>
            在输出日志面板的底部，输入框最左侧点击切换运行指令模式，将默认的 <b className="text-white">CMD</b> 更改成{' '}
            <b className="text-[#E18E2D]">Python</b>。
          </p>
        </div>
      ),
    },
    {
      icon: <CheckSquare className="w-4 h-4 text-[#E18E2D]" />,
      title: '第三步：在内容浏览器中选中模型并执行',
      content: (
        <div className="space-y-2 text-xs text-[#AAAAAA] leading-relaxed">
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              <b className="text-white">选中模型对象</b>：在虚幻编辑器的 <b className="text-white">内容浏览器 (Content Browser)</b> 中，选中（可按住 Ctrl 批量多选）需要自动匹配和实例化材质的静态模型或骨骼模型 (StaticMesh / SkeletalMesh) 资产。
            </li>
            <li>
              <b className="text-white">粘贴并运行</b>：将本系统生成的完整 Python 代码复制，直接粘贴到虚幻编辑器底部 <b className="text-white">Output Log</b> 下面的命令行输入框（已切换至 Python 模式）中，按下回车运行。
            </li>
            <li>
              <b className="text-white">或通过外部文件</b>：也可以将脚本保存为本地文书文件，在命令行里通过 <code>py "D:/YourScript.py"</code> 传真调用。
            </li>
          </ol>
        </div>
      ),
    },
    {
      icon: <PlusCircle className="w-4 h-4 text-[#E18E2D]" />,
      title: '高阶推荐：创建编辑器工具架一键按钮 (Editor Utility)',
      content: (
        <div className="space-y-2 text-xs text-[#AAAAAA] leading-relaxed">
          <p>如果不希望每次复制粘贴，可以一键绑定：</p>
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>在内容浏览器中右键 → <b className="text-white">编辑器实用程序 (Editor Utility) → 编辑器实用程序构建块 (Utility Widget)</b>。</li>
            <li>在 Widget UI 蓝图中加入一个 Button。</li>
            <li>选中按钮重写 OnClicked 事件，连接节点 <b className="text-white">Execute Python Command</b>。</li>
            <li>将本生成代码写入，后续在视口里点一下这个按钮，就会自动秒级完成选中模型的全部匹配，体验极其丝滑！</li>
          </ol>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] shadow-2xl overflow-hidden p-5 space-y-5 font-sans">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#E18E2D] flex items-center gap-2">
          <Laptop className="w-4 h-4 text-[#E18E2D]" />
          3. 虚幻引擎 5 使用及安装手册 (Unreal Engine Setup Tutorial)
        </h3>
        <p className="text-[10px] text-[#888888] mt-1">
          本脚本专为虚幻5材质自动化研发，完美支持资产目录批量清洗、材质替换、实例重组和贴图自动配槽。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step, idx) => (
          <div key={idx} className="p-4 bg-[#111111] border border-[#222222] rounded flex gap-3.5 items-start">
            <div className="p-2 bg-[#E18E2D]/10 rounded border border-[#E18E2D]/20 shrink-0 text-[#E18E2D]">
              {step.icon}
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <span className="block text-xs font-bold text-white uppercase tracking-wider">{step.title}</span>
              {step.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
