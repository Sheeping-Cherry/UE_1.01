/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeneratorSettings } from '../types';

export interface InlinedScripts {
  react?: string;
  reactDom?: string;
  babel?: string;
  tailwind?: string;
}

export function generateStandaloneHTML(initialSettings: GeneratorSettings, inlinedScripts?: InlinedScripts): string {
  // Transpile Python script generator to offline JS
  const exporterCode = `
    const initialSettings = ${JSON.stringify(initialSettings, null, 2)};

    function generateUEPythonScript(settings) {
      const {
        masterMaterialPath,
        saveFolder,
        primaryTextureDir,
        backupTextureDir,
        ignoreTrailingOne,
        baseColorParam,
        normalParam,
        pbrParam,
        normalSuffix,
        pbrSuffix,
        stripPrefixes,
        addInstancePrefix,
        backupMasterMaterialPath,
        fallbackPrefix,
        useFallbackMaterial,
        enableNormal,
        enablePBR,
        customSlots = [],
        matchSource = 'material',
        materialLibraryPath = '/Game/MaterialLibrary',
        enableMaterialLibraryMatch = false,
      } = settings;

      const prefixListStr = stripPrefixes
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => \`"\${p}"\`)
        .join(', ');

      const customSlotsPython = customSlots
        .map((s) => {
          const isEnabled = s.enabled ? 'True' : 'False';
          return \`    "\${s.id}": {"ENABLED": \${isEnabled}, "PARAM_NAME": "\${s.paramName}", "SUFFIX": "\${s.suffix}", "UI_NAME": "\${s.name}"}\`;
        })
        .join(',\\n');

      return \`import unreal
import os

# ==============================================================================
# UE自动化脚本：材质实例批处理与贴图绑定脚本 (Unreal 5.1-5.7+)
# ==============================================================================
# 功能概要:
# 1. 检测关卡中选中模型的材质，或者内容浏览器中选中的模型/材质资源
# 2. 对材质名称进行清洗（无视末尾1，去除指定前缀如 M_）
# 3. 在目标文件夹创建由指定原材质派生的材质实例 (Material Instance Constant)
# 4. 根据材质名称自动在贴图主库和备用库中检索 BaseColor, Normal, PBR 贴图并绑定
# ==============================================================================

# =================配置区域 (User Configuration)=================
# 1. 父级材质路径 (Parent Material / Material Instance Path to use as template)
# 支持指定 Material (母材质) 或 MaterialInstanceConstant (材质实例) 作为新实例的父级，完美支持多级实例继承。
# 支持自定义无限外接扩展贴图插槽。
MASTER_MATERIAL_PATH = "\${masterMaterialPath}"

# 1-2. 缺省备用母材质设置 (Fallback / Incomplete Material Settings)
# 缺省备份机制完美融接自定义新增槽位，若任何启用的自定义插槽无可用材质，亦自动进行备份替换。
USE_FALLBACK_MATERIAL = \${useFallbackMaterial ? 'True' : 'False'}
BACKUP_MASTER_MATERIAL_PATH = "\${backupMasterMaterialPath}"
FALLBACK_PREFIX = "\${fallbackPrefix}"

# 1-3. 贴图插槽启用开关 (Texture Slot Enabled Switches)
ENABLE_NORMAL = \${enableNormal ? 'True' : 'False'}
ENABLE_PBR = \${enablePBR ? 'True' : 'False'}

# 2. 贴图库与备用库路径 (Texture Library Folders)
PRIMARY_TEXTURE_DIR = "\${primaryTextureDir}"
BACKUP_TEXTURE_DIR = "\${backupTextureDir}"

# 3. 材质实例保存目录 (Where to save generated Material Instances)
SAVE_FOLDER = "\${saveFolder}"

# 4. 参数插槽名称 (Parameter Names in the Master Material)
PARAM_BASE_COLOR = "\${baseColorParam}"
PARAM_SIZE_NORMAL = "\${normalParam}"
PARAM_SIZE_PBR = "\${pbrParam}"

# 5. 贴图后缀匹配规则 (Texture Suffix Matching Rules)
SUFFIX_NORMAL = "\${normalSuffix}"
SUFFIX_PBR = "\${pbrSuffix}"

# 5-2. 额外增加的自定义贴图插槽 (Custom Dynamic Texture Slots)
CUSTOM_SLOTS = {
\${customSlotsPython}
}

# 寻找BaseColor时排除这些已被占用的后缀，避免错误配对为一般色彩
EXCLUDE_SUFFIXES = [SUFFIX_NORMAL, SUFFIX_PBR] + [slot_info["SUFFIX"] for slot_info in CUSTOM_SLOTS.values() if slot_info["ENABLED"]]

# 6. 命名清洗与前置后缀规则 (Naming Rules)
STRIP_PREFIXES = [\${prefixListStr}] # 需要清洗的材质前缀
ADD_INSTANCE_PREFIX = "\${addInstancePrefix}" # 生成材质实例的前缀
IGNORE_TRAILING_ONE = \${ignoreTrailingOne ? 'True' : 'False'} # 是否无视最末尾的 "1"
# 材质映射核心检测源 ('material' = 读取模型材质球名字, 'slot' = 读取模型插槽名字)
MATCH_SOURCE = "\${matchSource}"

# 7. 材质库已有材质同名直接匹配 (Material Library Matching)
ENABLE_MATERIAL_LIBRARY_MATCH = \${enableMaterialLibraryMatch ? 'True' : 'False'}
MATERIAL_LIBRARY_PATH = "\${materialLibraryPath}"

# ===============================================================
# 效能极限优化缓存结构 (Performance Caching Subsystem)
# ===============================================================
_assets_by_directory_cache = {}
_texture_asset_lookup_cache = {}
_material_library_lookup_cache = {}

def get_cached_assets(directory):
    """
    高效分析 & 缓存目录资产。原先对每个材质的每个插槽都递归向UE引擎调用 list_assets，
    这会导致大型项目运行异常缓慢。通过全缓存优化，单次执行 list_assets，全局快速匹配。
    """
    if not directory:
        return []
    if directory not in _assets_by_directory_cache:
        try:
            if unreal.EditorAssetLibrary.does_directory_exist(directory):
                unreal.log(f"[效能优化] 正在预载入并分析目录资产(仅调取一次): '{directory}' ...")
                _assets_by_directory_cache[directory] = unreal.EditorAssetLibrary.list_assets(directory, recursive=True) or []
            else:
                _assets_by_directory_cache[directory] = []
        except Exception as e:
            unreal.log_warning(f"[效能优化] 预载入目录 '{directory}' 资产失败: {e}")
            _assets_by_directory_cache[directory] = []
    return _assets_by_directory_cache[directory]

# ===============================================================

def find_material_in_library(core_name):
    """
    独立材质选配核心：优先尝试直接从设定的材质库路径(MATERIAL_LIBRARY_PATH)中搜索匹配核心清洗名的已有材质
    """
    if not ENABLE_MATERIAL_LIBRARY_MATCH or not MATERIAL_LIBRARY_PATH:
        return None
        
    cache_key = core_name
    if cache_key in _material_library_lookup_cache:
        return _material_library_lookup_cache[cache_key]

    assets = get_cached_assets(MATERIAL_LIBRARY_PATH)
    if not assets:
        _material_library_lookup_cache[cache_key] = None
        return None
        
    unreal.log(f"[材质库] 开始高速检索同名已有材质: {MATERIAL_LIBRARY_PATH} (核心词: '{core_name}')")
    norm_core = core_name.lower().strip("_")
    
    for asset_path in assets:
        asset_name = asset_path.split(".")[-1]
        asset_name_lower = asset_name.lower()
        
        # 使用清洗算法清洗库中的材质名字
        clean_name = asset_name_lower
        
        # 剥离前缀
        all_prefixes = list(STRIP_PREFIXES)
        default_prefixes = ["mi_mc_", "m_mc_", "mat_", "mi_", "mm_", "mc_", "m_", "t_"]
        for dp in default_prefixes:
            if dp not in all_prefixes:
                all_prefixes.append(dp)
        all_prefixes.sort(key=len, reverse=True)
        
        stripped_any = True
        while stripped_any:
            stripped_any = False
            for prefix in all_prefixes:
                if clean_name.startswith(prefix.lower()):
                    clean_name = clean_name[len(prefix):]
                    stripped_any = True
                    break
                    
        if IGNORE_TRAILING_ONE and clean_name.endswith("1"):
            clean_name = clean_name[:-1]
            if clean_name.endswith("_"):
                clean_name = clean_name[:-1]
                
        clean_name = clean_name.strip("_")
        
        if clean_name == norm_core:
            material_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
            if isinstance(material_asset, unreal.MaterialInterface):
                unreal.log(f"[材质库] [直接匹配成功] 找到对应已有材质球/实例: '{asset_path}'")
                _material_library_lookup_cache[cache_key] = material_asset
                return material_asset
                
    unreal.log(f"[材质库] 未在 {MATERIAL_LIBRARY_PATH} 中找到任何材质/实例名称契合: '{core_name}'")
    _material_library_lookup_cache[cache_key] = None
    return None

def clean_material_name(original_name):
    """
    清洗材质球名称以获得核心资产名称名称
    例如: "M_Brick_01_1" -> "Brick_01" 或 "M_Stone_1" -> "Stone"
    """
    name = original_name
    
    # 1. 过滤后缀中包含的文件名（比如有些会有带有材质实例或复制版后缀）
    unreal.log(f"[命名清洗] 输入原始名称: {name}")
    
    # 2. 是否无视最末尾的 "1" (例如 "Stone1" -> "Stone", "M_Brick_01" -> "M_Brick_0")
    if IGNORE_TRAILING_ONE and name.endswith("1"):
        name = name[:-1]
        # 如果去掉1后剩下下划线，也连带去掉，如 "Stone_1" -> "Stone_" -> "Stone"
        if name.endswith("_"):
            name = name[:-1]
            
    # 3. 去除指定材质前缀 (支持级联/连环剥离，例如 "MI_MC_oak_door_bottom" -> "oak_door_bottom")
    # 合并用户定义的和默认的常见材质前缀
    all_prefixes = list(STRIP_PREFIXES)
    default_prefixes = ["MI_MC_", "M_MC_", "MAT_", "MI_", "MM_", "MC_", "M_", "T_"]
    for dp in default_prefixes:
        if dp not in all_prefixes:
            all_prefixes.append(dp)
            
    # 按长度降序排列前缀以避免子字符串冲突 (例如优先剥离 "MI_MC_" 而不是 "MI_")
    all_prefixes.sort(key=len, reverse=True)
    
    stripped_any = True
    while stripped_any:
        stripped_any = False
        for prefix in all_prefixes:
            if name.startswith(prefix):
                name = name[len(prefix):]
                stripped_any = True
                break # 重新从最长的前缀开始匹配，实现完美连环剥离
            
    # 4. 去除可能残留的下划线
    name = name.strip("_")
    
    unreal.log(f"[命名清洗] 输出清洗后核心名称: {name}")
    return name

def find_texture_asset(core_name, suffix=None, ex_suffixes=None):
    """
    在主贴图库与备份贴图库中，递归匹配最合适的贴图资源 (高效缓存内存匹配版)
    """
    cache_key = (core_name, suffix, tuple(ex_suffixes) if ex_suffixes else None)
    if cache_key in _texture_asset_lookup_cache:
        return _texture_asset_lookup_cache[cache_key]

    search_dirs = [PRIMARY_TEXTURE_DIR, BACKUP_TEXTURE_DIR]
    norm_core = core_name.lower().strip("_")
    
    for directory in search_dirs:
        if not directory:
            continue
            
        assets = get_cached_assets(directory)
        if not assets:
            continue
            
        unreal.log(f"[贴图检索] 正在从高速缓存中分析匹配贴图 (核心词: '{core_name}', 目录: {directory})")
        
        for asset_path in assets:
            asset_name = asset_path.split(".")[-1] # 获取文件名
            asset_name_lower = asset_name.lower()
            
            # 精确匹配和剥离辅助逻辑
            clean_name = asset_name_lower
            
            if suffix:
                suf_low = suffix.lower()
                if clean_name.endswith(suf_low):
                    clean_name = clean_name[:-len(suf_low)]
                else:
                    continue # 后缀不匹配直接跳过
            else:
                # BaseColor 检索且不包含其它排他性后缀
                is_excluded = False
                if ex_suffixes:
                    for ex in ex_suffixes:
                        if asset_name_lower.endswith(ex.lower()):
                            is_excluded = True
                            break
                if is_excluded:
                    continue
                
                # 剥离 BaseColor 专配后缀
                bc_suffixes = ["_d", "_bc", "_c", "_diffuse", "_albedo", "_color", "_col", "_basecolor"]
                for bc_suf in bc_suffixes:
                    if clean_name.endswith(bc_suf):
                        clean_name = clean_name[:-len(bc_suf)]
                        break
            
            # 移除下划线
            clean_name = clean_name.rstrip("_")
            
            # 剥离前缀
            all_prefixes = [p.lower() for p in STRIP_PREFIXES]
            default_prefixes = ["mi_mc_", "m_mc_", "mat_", "mi_", "mm_", "mc_", "m_", "t_"]
            for dp in default_prefixes:
                if dp not in all_prefixes:
                    all_prefixes.append(dp)
            all_prefixes.sort(key=len, reverse=True)
            
            stripped_any = True
            while stripped_any:
                stripped_any = False
                for prefix in all_prefixes:
                    if clean_name.startswith(prefix):
                        clean_name = clean_name[len(prefix):]
                        stripped_any = True
                        break
            
            clean_name = clean_name.strip("_")
            
            if clean_name == norm_core:
                texture_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
                if isinstance(texture_asset, unreal.Texture):
                    unreal.log(f"[贴图检索] [匹配成功] 找到贴图: {asset_path} (清理后名称: {clean_name}, 目标: {norm_core})")
                    _texture_asset_lookup_cache[cache_key] = texture_asset
                    return texture_asset
                        
    unreal.log_warning(f"[贴图检索] [未找到] 在库中无法找到核心词 '{core_name}' 后缀为 '{suffix if suffix else 'BaseColor'}' 的贴图")
    _texture_asset_lookup_cache[cache_key] = None
    return None

def get_selected_resources():
    """
    采集选中的资源与角色：
    - 内容浏览器选中的 static/skeletal mesh 或 材质
    - 关卡视口中选中的 Actor
    返回 (处理材质集, 选中素材资源列表, 选中角色列表)
    """
    materials = set()
    selected_assets = []
    selected_actors = []
    
    # 1. 采集内容浏览器选中的资源
    try:
        # 优先使用标准的 unreal.EditorUtilityLibrary (需要启用 Editor Scripting Utilities 插件)
        try:
            selected_assets = unreal.EditorUtilityLibrary.get_selected_assets() or []
        except Exception as err:
            unreal.log(f"[采集] 尝试使用 EditorUtilityLibrary 失败，尝试备用子系统: {err}")
            utility_subsystem = unreal.get_editor_subsystem(unreal.EditorUtilitySubsystem)
            if utility_subsystem and hasattr(utility_subsystem, 'get_selected_assets'):
                selected_assets = utility_subsystem.get_selected_assets() or []
                
        if selected_assets and MATCH_SOURCE == "material":
            unreal.log(f"[采集] 检测到内容浏览器中选中了 {len(selected_assets)} 个资源，开始提取材质...")
            for asset in selected_assets:
                if isinstance(asset, unreal.MaterialInterface):
                    materials.add(asset)
                    unreal.log(f"[采集] (内容浏览器) -> 直接选中了材质资产: '{asset.get_name()}'")
                elif isinstance(asset, unreal.StaticMesh):
                    # 递归读取静态网格体网格的所有材质槽 (Material Slots)
                    for mat_slot in asset.static_materials:
                        if mat_slot.material_interface:
                            materials.add(mat_slot.material_interface)
                            unreal.log(f"[采集] (内容浏览器) -> 选中静态模型 '{asset.get_name()}' 并在材质槽匹配到: '{mat_slot.material_interface.get_name()}'")
                elif isinstance(asset, unreal.SkeletalMesh):
                    # 递归读取骨骼网格的所有材质槽 (Material Slots)
                    for mat_slot in asset.materials:
                        if mat_slot.material_interface:
                            materials.add(mat_slot.material_interface)
                            unreal.log(f"[采集] (内容浏览器) -> 选中骨骼模型 '{asset.get_name()}' 并在材质槽匹配到: '{mat_slot.material_interface.get_name()}'")
    except Exception as e:
        unreal.log_warning(f"[采集] 内容浏览器资源提取发生异常 (可忽略): {e}")

    # 2. 采集关卡视口选中的 Actor
    try:
        try:
            actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
            selected_actors = actor_subsystem.get_selected_level_actors() or []
        except Exception:
            # 兼容老版本 UE5.0
            selected_actors = unreal.EditorLevelLibrary.get_selected_level_actors() or []
            
        if selected_actors and MATCH_SOURCE == "material":
            unreal.log(f"[采集] 扫描视口中选中的 {len(selected_actors)} 个 Actor...")
            for actor in selected_actors:
                try:
                    mesh_components = actor.get_components_by_class(unreal.MeshComponent)
                    for mesh_comp in mesh_components:
                        num_materials = mesh_comp.get_num_materials()
                        for i in range(num_materials):
                            mat = mesh_comp.get_material(i)
                            if mat:
                                materials.add(mat)
                except Exception:
                    pass
    except Exception as e:
        unreal.log_warning(f"[采集] 关卡视口 Actor 提取发生异常 (可忽略): {e}")
        
    return list(materials), selected_assets, selected_actors

def assign_material_to_asset(mesh_asset, slot_index, new_material):
    """
    将材质赋给指定的资源槽。
    """
    try:
        mesh_asset.set_material(slot_index, new_material)
        return True
    except Exception as e1:
        try:
            if hasattr(mesh_asset, "static_materials"):
                mesh_asset.static_materials[slot_index].material_interface = new_material
                return True
        except Exception:
            pass
            
        try:
            if hasattr(mesh_asset, "materials"):
                mesh_asset.materials[slot_index].material_interface = new_material
                return True
        except Exception:
            pass
            
        unreal.log_warning(f"[覆盖材质] 无法赋能网格 '{mesh_asset.get_name()}' 插槽 {slot_index}，错误: {e1}")
        return False

def process_automation():
    # 1. 验证父级材质 / 实例是否存在
    if not unreal.EditorAssetLibrary.does_asset_exist(MASTER_MATERIAL_PATH):
        unreal.EditorDialog.show_message(
            title="脚本配置警告",
            message=f"配置的父级材质或材质实例路径不存在，请在脚本中定义正确的路径:\\\\n{MASTER_MATERIAL_PATH}",
            message_type=unreal.AppMsgType.OK,
            default_value=unreal.AppReturnType.OK
        )
        return
        
    master_material = unreal.EditorAssetLibrary.load_asset(MASTER_MATERIAL_PATH)
    
    # 1-2. 验证并加载缺省备用材质
    backup_material = None
    if USE_FALLBACK_MATERIAL:
        if not unreal.EditorAssetLibrary.does_asset_exist(BACKUP_MASTER_MATERIAL_PATH):
            unreal.log_warning(f"[系统警告] 启用了缺省备用材质替换机制，但在项目中未找到该备用母材质资产: {BACKUP_MASTER_MATERIAL_PATH}")
        else:
            backup_material = unreal.EditorAssetLibrary.load_asset(BACKUP_MASTER_MATERIAL_PATH)
            unreal.log(f"[系统提示] 成功加载备用母材质资产: {BACKUP_MASTER_MATERIAL_PATH}")
            
    # 2. 采样采集选中的资源与组件关系
    materials_to_process, selected_assets, selected_actors = get_selected_resources()
    
    # 3. 确保目标文件夹在UE中建立
    if not unreal.EditorAssetLibrary.does_directory_exist(SAVE_FOLDER):
        unreal.EditorAssetLibrary.make_directory(SAVE_FOLDER)
        unreal.log(f"[系统] 自动为您创建了材质保存目录: {SAVE_FOLDER}")
        
    processed_count = 0
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    
    # 建立 核心词(已经清洗) -> 材质实例资产 的字典关联词库，保障重复使用
    core_to_new_mi = {}
    
    def get_or_create_instance_for_core(core_name):
        if not core_name:
            return None
            
        if core_name in core_to_new_mi:
            return core_to_new_mi[core_name]
            
        # [新特性] 优先从指定的材质库中匹配清洗名相同的已有材质球/实例
        if ENABLE_MATERIAL_LIBRARY_MATCH:
            library_mat = find_material_in_library(core_name)
            if library_mat:
                core_to_new_mi[core_name] = library_mat
                return library_mat
                
        unreal.log(f"\\\\n======== 开始为核心词 '{core_name}' 匹配贴图与生成材质实例 ========")
        
        # 提取贴图
        bc_texture = find_texture_asset(core_name, suffix=None, ex_suffixes=EXCLUDE_SUFFIXES)
        n_texture = find_texture_asset(core_name, suffix=SUFFIX_NORMAL) if ENABLE_NORMAL else None
        pbr_texture = find_texture_asset(core_name, suffix=SUFFIX_PBR) if ENABLE_PBR else None
        
        custom_textures = {}
        for slot_id, slot_info in CUSTOM_SLOTS.items():
            if slot_info["ENABLED"]:
                custom_textures[slot_id] = find_texture_asset(core_name, suffix=slot_info["SUFFIX"])
                
        # 备用材质逻辑
        is_fallback_active = False
        if USE_FALLBACK_MATERIAL and backup_material:
            has_missing = not bc_texture or (ENABLE_NORMAL and not n_texture) or (ENABLE_PBR and not pbr_texture)
            if not has_missing:
                for slot_id, slot_info in CUSTOM_SLOTS.items():
                    if slot_info["ENABLED"] and not custom_textures.get(slot_id):
                        has_missing = True
                        break
            if has_missing:
                is_fallback_active = True
                unreal.log(f"[触发备用材质] 核心词 '{core_name}' 启用的贴图不完整，启用备用母材质，其余槽位为空。")
                
        active_parent = backup_material if is_fallback_active else master_material
        active_pref = FALLBACK_PREFIX if is_fallback_active else ADD_INSTANCE_PREFIX
        
        instance_name = f"{active_pref}{core_name}"
        instance_path = f"{SAVE_FOLDER}/{instance_name}"
        
        mi_asset = None
        if unreal.EditorAssetLibrary.does_asset_exist(instance_path):
            unreal.log(f"[材质实例] 重用加载已存在实例: {instance_path}")
            mi_asset = unreal.EditorAssetLibrary.load_asset(instance_path)
        else:
            unreal.log(f"[材质实例] 新建材质实例: {instance_path}")
            mi_asset = asset_tools.create_asset(
                asset_name=instance_name,
                package_path=SAVE_FOLDER,
                asset_class=unreal.MaterialInstanceConstant,
                factory=unreal.MaterialInstanceConstantFactoryNew()
            )
            
        if not mi_asset:
            return None
            
        unreal.MaterialEditingLibrary.set_material_instance_parent(mi_asset, active_parent)
        
        if is_fallback_active:
            if bc_texture:
                unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi_asset, PARAM_BASE_COLOR, bc_texture)
        else:
            if bc_texture:
                unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi_asset, PARAM_BASE_COLOR, bc_texture)
            if ENABLE_NORMAL and n_texture:
                unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi_asset, PARAM_SIZE_NORMAL, n_texture)
            if ENABLE_PBR and pbr_texture:
                unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi_asset, PARAM_SIZE_PBR, pbr_texture)
            for slot_id, slot_info in CUSTOM_SLOTS.items():
                if slot_info["ENABLED"] and custom_textures.get(slot_id):
                    unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi_asset, slot_info["PARAM_NAME"], custom_textures[slot_id])
                    
        unreal.EditorAssetLibrary.save_loaded_asset(mi_asset)
        core_to_new_mi[core_name] = mi_asset
        return mi_asset

    # 4. 根据匹配策略进行替换与回填
    replaced_asset_count = 0
    replaced_actor_count = 0
    
    if MATCH_SOURCE == "slot":
        unreal.log("[工作模式] 已启用【读取模型插槽名字】匹配策略。")
        # A. 第一阶段: 内容浏览器网格体 assets (根据插槽名称匹配)
        if selected_assets:
            unreal.log("\\\\n======== 开始扫描【内容浏览器】选中模型的物理材质插槽 =======")
            for asset in selected_assets:
                has_replaced = False
                if isinstance(asset, unreal.StaticMesh):
                    for i, mat_slot in enumerate(asset.static_materials):
                        slot_name = mat_slot.material_slot_name
                        if not slot_name:
                            continue
                        core_name = clean_material_name(str(slot_name))
                        new_mi = get_or_create_instance_for_core(core_name)
                        if new_mi:
                            if assign_material_to_asset(asset, i, new_mi):
                                has_replaced = True
                                processed_count += 1
                    if has_replaced:
                        unreal.EditorAssetLibrary.save_loaded_asset(asset)
                        replaced_asset_count += 1
                elif isinstance(asset, unreal.SkeletalMesh):
                    for i, mat_slot in enumerate(asset.materials):
                        slot_name = mat_slot.material_slot_name
                        if not slot_name:
                            continue
                        core_name = clean_material_name(str(slot_name))
                        new_mi = get_or_create_instance_for_core(core_name)
                        if new_mi:
                            if assign_material_to_asset(asset, i, new_mi):
                                has_replaced = True
                                processed_count += 1
                    if has_replaced:
                        unreal.EditorAssetLibrary.save_loaded_asset(asset)
                        replaced_asset_count += 1
                        
        # B. 第二阶段: 关卡视口 Actors 里面的 MeshComponent (根据插槽名称匹配并实时渲染)
        if selected_actors:
            unreal.log("\\\\n======== 开始扫描【关卡主视口】选中角色的网格插槽并实时渲染 =======")
            for actor in selected_actors:
                has_replaced = False
                try:
                    mesh_components = actor.get_components_by_class(unreal.MeshComponent)
                    for mesh_comp in mesh_components:
                        slot_names = list(mesh_comp.get_material_slot_names() or [])
                        for i in range(mesh_comp.get_num_materials()):
                            slot_name = None
                            if i < len(slot_names):
                                slot_name = slot_names[i]
                            else:
                                if hasattr(mesh_comp, "static_mesh") and mesh_comp.static_mesh:
                                    if i < len(mesh_comp.static_mesh.static_materials):
                                        slot_name = mesh_comp.static_mesh.static_materials[i].material_slot_name
                                elif hasattr(mesh_comp, "skeletal_mesh") and mesh_comp.skeletal_mesh:
                                    if i < len(mesh_comp.skeletal_mesh.materials):
                                        slot_name = mesh_comp.skeletal_mesh.materials[i].material_slot_name
                                        
                            if slot_name:
                                core_name = clean_material_name(str(slot_name))
                                new_mi = get_or_create_instance_for_core(core_name)
                                if new_mi:
                                    mesh_comp.set_material(i, new_mi)
                                    has_replaced = True
                                    processed_count += 1
                                    unreal.log(f"[关卡替换完成] Actor '{actor.get_name()}' 插槽 {i} ({slot_name}) -> '{new_mi.get_name()}'")
                    if has_replaced:
                        replaced_actor_count += 1
                except Exception as ex:
                    unreal.log_warning(f"[系统警告] 无法处理角色组件材质替换 '{actor.get_name()}': {ex}")
                    
    else:
        unreal.log("[工作模式] 已启用【读取模型材质球名字】匹配策略。")
        # 建立清洗前材质 PathName 到 新材质实例 Constant 资产的词典绑定映射
        old_to_new_mat_paths = {}
        for original_mat in materials_to_process:
            orig_name = original_mat.get_name()
            core_name = clean_material_name(orig_name)
            new_mi = get_or_create_instance_for_core(core_name)
            if new_mi:
                old_to_new_mat_paths[original_mat.get_path_name()] = new_mi
                processed_count += 1
                
        # 回填替换内容浏览器网格 (根据原绑定的 MaterialInterface 进行升级)
        if selected_assets:
            unreal.log("\\\\n======== 开始自动回填替换内容浏览器选中模型的插槽材质球 ========")
            for asset in selected_assets:
                has_replaced = False
                if isinstance(asset, unreal.StaticMesh):
                    for i, mat_slot in enumerate(asset.static_materials):
                        old_mat = mat_slot.material_interface
                        if old_mat and old_mat.get_path_name() in old_to_new_mat_paths:
                            new_mat = old_to_new_mat_paths[old_mat.get_path_name()]
                            if assign_material_to_asset(asset, i, new_mat):
                                has_replaced = True
                    if has_replaced:
                        unreal.EditorAssetLibrary.save_loaded_asset(asset)
                        replaced_asset_count += 1
                elif isinstance(asset, unreal.SkeletalMesh):
                    for i, mat_slot in enumerate(asset.materials):
                        old_mat = mat_slot.material_interface
                        if old_mat and old_mat.get_path_name() in old_to_new_mat_paths:
                            new_mat = old_to_new_mat_paths[old_mat.get_path_name()]
                            if assign_material_to_asset(asset, i, new_mat):
                                has_replaced = True
                    if has_replaced:
                        unreal.EditorAssetLibrary.save_loaded_asset(asset)
                        replaced_asset_count += 1

        # 6. 回填替换关卡中选中渲染 Actor 实例的材质球组件 (Real-time Viewport Component Replacement)
        if selected_actors:
            unreal.log("\\\\n======== 开始自动回填并实时渲染关卡视口选中的 Actor 材质球 ========")
            for actor in selected_actors:
                has_replaced = False
                try:
                    mesh_components = actor.get_components_by_class(unreal.MeshComponent)
                    for mesh_comp in mesh_components:
                        num_materials = mesh_comp.get_num_materials()
                        for i in range(num_materials):
                            old_mat = mesh_comp.get_material(i)
                            if old_mat and old_mat.get_path_name() in old_to_new_mat_paths:
                                new_mat = old_to_new_mat_paths[old_mat.get_path_name()]
                                mesh_comp.set_material(i, new_mat)
                                has_replaced = True
                                unreal.log(f"[关卡替换完成] 已成功更新关卡实例 Actor '{actor.get_name()}' 的网格插槽 {i} -> '{new_mat.get_name()}'")
                    if has_replaced:
                        replaced_actor_count += 1
                except Exception as e:
                    pass

    # 7. 最终运行结果综合弹窗报告
    finish_message = f"脚本处理完成!\\\\n成功生成并匹配了 {processed_count} 个材质实例到该文件夹下:\\\\n{SAVE_FOLDER}\\\\n\\\\n"
    if replaced_asset_count > 0:
        finish_message += f"【内容浏览器】已完成 {replaced_asset_count} 个模型资产材质槽的原地升级替换！\\\\n"
    if replaced_actor_count > 0:
        finish_message += f"【关卡主视口】已完成 {replaced_actor_count} 个关卡网格角色的材质秒速渲染！\\\\n"
    if replaced_asset_count == 0 and replaced_actor_count == 0:
        finish_message += "注意：未能回填替换到网格资产或关卡Actor，请确保在运行脚本时同时也选中了对应的静态/骨骼模型或关卡角色。"

    unreal.EditorDialog.show_message(
        title="自动化材质匹配与替换完成",
        message=finish_message,
        message_type=unreal.AppMsgType.OK,
        default_value=unreal.AppReturnType.OK
    )

if __name__ == "__main__":
    process_automation()
\`;
    }
  `;

  const tailwindScript = inlinedScripts?.tailwind 
    ? `<script>/* inlined Tailwind CSS JIT Engine */\n${inlinedScripts.tailwind}\n</script>` 
    : `<script src="https://cdn.tailwindcss.com"></script>`;

  const reactScript = inlinedScripts?.react 
    ? `<script>/* inlined React Core */\n${inlinedScripts.react}\n</script>` 
    : `<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>`;

  const reactDomScript = inlinedScripts?.reactDom 
    ? `<script>/* inlined React DOM Core */\n${inlinedScripts.reactDom}\n</script>` 
    : `<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>`;

  const babelScript = inlinedScripts?.babel 
    ? `<script>/* inlined Babel Standalone Compiler */\n${inlinedScripts.babel}\n</script>` 
    : `<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unreal 5.1-5.7+ 材质实例自动化匹配管线工具 (Standalone Desktop)</title>
  
  <!-- Tailwind CSS Configuration V4 stylesheet & Dark styling -->
  ${tailwindScript}
  <style>
    body {
      background-color: #111111;
      color: #CCCCCC;
    }
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #161616;
    }
    ::-webkit-scrollbar-thumb {
      background: #333333;
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #444444;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #121212;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgb(63 63 70);
      border-radius: 9999px;
    }
  </style>

  <!-- React & Polyfills directly from public CDN for 100% stable offline / runtime execution -->
  ${reactScript}
  ${reactDomScript}
  
  <!-- Babel compiler to compile JSX within the browser on the fly -->
  ${babelScript}
  <script>
    // 注册强制 Classic 运行时的 Preset，防止在本地 file:// 协议打开时生成 ES Module import 语句导致黑屏
    try {
      Babel.registerPreset('classic-react', {
        presets: [
          [Babel.availablePresets['react'] || 'react', { runtime: 'classic' }]
        ]
      });
    } catch (e) {
      console.warn("Classic Preset registration failed, falling back to pragma: ", e);
    }
  </script>
</head>
<body class="min-h-screen bg-[#111111] text-[#CCCCCC] flex flex-col font-sans select-none">

  <!-- React mounting container node -->
  <div id="root"></div>

  <!-- Exporter Code helper -->
  <script>
    ${exporterCode}
  </script>

  <!-- Entire React UI Layout Application logic compiling on the fly -->
  <script type="text/babel" data-presets="classic-react">
    /* @jsx React.createElement */
    /* @jsxFrag React.Fragment */
    const { useState, useEffect } = React;

    // SVG Icon components rendered directly as component states to avoid loading Lucide dependencies
    function SettingsIcon() {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="w-4 h-4"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      );
    }
    function DownloadIcon() {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      );
    }
    function CopyIcon() {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      );
    }
    function CheckIcon() {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="w-4 h-4 text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
      );
    }
    function PlayIcon() {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><polygon points="5 3 19 12 5 21"/></svg>
      );
    }
    function TrashIcon() {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      );
    }
    function PlusIcon() {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="w-3.5 h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      );
    }

    function App() {
      const [settings, setSettings] = useState(initialSettings);
      const [isSimulating, setIsSimulating] = useState(false);
      const [copied, setCopied] = useState(false);

      // Simulation mock collections
      const [mockMaterials, setMockMaterials] = useState([
        { id: 'm1', modelName: 'SM_SprucePlank', originalMaterialName: 'MI_MC_spruce_planks', slotName: 'spruce_planks' },
        { id: 'm2', modelName: 'SM_OakDoor', originalMaterialName: 'MI_MC_oak_door_bottom', slotName: 'oak_door_bottom' },
        { id: 'm3', modelName: 'SM_Rock_01', originalMaterialName: 'M_CliffRock_1', slotName: 'CliffRock_1' },
        { id: 'm4', modelName: 'SM_BrickWall', originalMaterialName: 'M_RedBrick_01_1', slotName: 'RedBrick_01' },
      ]);
      const [mockTextures, setMockTextures] = useState([
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

      const [mockLibMaterials, setMockLibMaterials] = useState([
        'MI_spruce_planks',
        'MI_oak_door_bottom',
        'MI_CliffRock_Premium',
        'M_RedBrick_Classic'
      ]);

      const [activeTab, setActiveTab] = useState('selection');
      const [simulationResults, setSimulationResults] = useState([]);
      const [currentStep, setCurrentStep] = useState(0);
      const [consoleLogs, setConsoleLogs] = useState([]);
      const [hasRun, setHasRun] = useState(false);

      const [importStatus, setImportStatus] = useState(null);

      useEffect(() => {
        if (importStatus) {
          const timer = setTimeout(() => {
            setImportStatus(null);
          }, 3500);
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

      const handleImportConfig = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            if (typeof parsed === 'object' && parsed !== null) {
              setSettings({
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

      // Add item variables
      const [newModel, setNewModel] = useState('');
      const [newMatName, setNewMatName] = useState('');
      const [newSlotName, setNewSlotName] = useState('');
      const [newTexFile, setNewTexFile] = useState('');
      const [newTexFolder, setNewTexFolder] = useState('primary');
      const [newLibMat, setNewLibMat] = useState('');

      const addMockLibMaterial = () => {
        if (!newLibMat) return;
        if (mockLibMaterials.includes(newLibMat)) return;
        setMockLibMaterials([...mockLibMaterials, newLibMat]);
        setNewLibMat('');
      };

      const deleteMockLibMaterial = (matName) => {
        setMockLibMaterials(mockLibMaterials.filter((m) => m !== matName));
      };

      const pythonScript = generateUEPythonScript(settings);

      const handleChange = (e) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? e.target.checked : value;
        setSettings({ ...settings, [name]: val });
      };

      const handleUpdateCustomSlot = (id, updates) => {
        const updated = (settings.customSlots || []).map((slot) => {
          if (slot.id === id) {
            return { ...slot, ...updates };
          }
          return slot;
        });
        setSettings({
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
        setSettings({
          ...settings,
          customSlots: [...(settings.customSlots || []), newSlot],
        });
      };

      const handleRemoveCustomSlot = (id) => {
        setSettings({
          ...settings,
          customSlots: (settings.customSlots || []).filter((s) => s.id !== id),
        });
      };

      const handleCopy = () => {
        navigator.clipboard.writeText(pythonScript).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      };

      const handleDownloadScript = () => {
        const blob = new Blob([pythonScript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'UE_MaterialAutomation.py';
        link.click();
        URL.revokeObjectURL(url);
      };

      // Exec simulator
      const runSampleSimulation = () => {
        setIsSimulating(true);
        setHasRun(true);
        setSimulationResults([]);
        setCurrentStep(1);
        setConsoleLogs([]);

        const logs = [];
        const pushLog = (msg) => {
          logs.push(msg);
          setConsoleLogs([...logs]);
        };

        setTimeout(() => {
          pushLog(\`[1/5]  [初始化] 开始载入自动化分配脚本...\`);
          pushLog(\`[1/5]  [环境] 验证父级材质/实例路径: \${settings.masterMaterialPath} ... 已存在。\`);
          pushLog(\`[1/5]  [采集] 正在扫描编辑器中模型材质插槽关系...\`);
          setCurrentStep(2);

          setTimeout(() => {
            pushLog(\`[2/5]  [采集完成] 共扫描到 \${mockMaterials.length} 个材质球需处理：\`);
            mockMaterials.forEach((m) => {
              if (settings.matchSource === 'slot') {
                pushLog(\`       - 选中模型: '\${m.modelName}' -> 检测到物理材质插槽 [\${m.slotName || m.originalMaterialName}] (正在应用[读取模型插槽名字]模式)\`);
              } else {
                pushLog(\`       - 选中模型: '\${m.modelName}' -> 检测到绑定材质球 [\${m.originalMaterialName}]\`);
              }
            });
            setCurrentStep(3);

            setTimeout(() => {
              pushLog(\`[3/5]  [命名清洗中] 正在根据参数规则进行深度命名清洗...\`);
              if (settings.ignoreTrailingOne) {
                pushLog(\`       - [规则] 已开启末尾数字"1"无视逻辑\`);
              }
              pushLog(\`       - [规则] 清理原始前缀: [\${settings.stripPrefixes}]\`);
              pushLog(\`       - [规则] 添加实例前缀: '\${settings.addInstancePrefix}'\`);
              setCurrentStep(4);

              setTimeout(() => {
                pushLog(\`[4/5]  [实例创建 / 贴图检索] 正在检索贴图文件夹并建立独立材质属性...\`);
                
                const results = mockMaterials.map((m) => {
                  const opLogs = [];
                  let name = settings.matchSource === 'slot' ? m.slotName : m.originalMaterialName;
                  if (!name) return null;
                  
                  if (settings.ignoreTrailingOne && name.endsWith('1')) {
                    name = name.slice(0, -1);
                    if (name.endsWith('_')) {
                      name = name.slice(0, -1);
                    }
                  }

                  const prefixes = settings.stripPrefixes.split(',').map(p => p.trim());
                  for (const pref of prefixes) {
                    if (name.startsWith(pref)) {
                      name = name.slice(pref.length);
                      break;
                    }
                  }

                  const coreName = name.replace(/^_+|_+$/g, '');

                  // Check if we should directly match in Material Library
                  const findMockMaterialInLibrary = (cName) => {
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
                    opLogs.push("清洗: " + (settings.matchSource === 'slot' ? "[插槽名] " + (m.slotName || m.originalMaterialName) : "[材质名] " + m.originalMaterialName) + " -> " + coreName);
                    opLogs.push("[材质库直接匹配成功] 优先从材质库区域 " + settings.materialLibraryPath + " 检索同名材质: " + libraryMatMatch);
                    opLogs.push("[直接替换并指派] 跳过新建材质实例与贴图加载流程，秒速完成指派！");
                    return {
                      meshName: m.modelName,
                      originalMaterial: m.originalMaterialName,
                      cleanedMaterialName: coreName,
                      instanceName: libraryMatMatch,
                      instanceSavePath: settings.materialLibraryPath + "/" + libraryMatMatch,
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

                  const findTexture = (suffix, isBaseColor) => {
                    const matchInFolder = (folder) => {
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

                    let match = matchInFolder('primary');
                    if (match) return { tex: match, source: 'primary' };

                    match = matchInFolder('backup');
                    if (match) return { tex: match, source: 'backup' };

                    return null;
                  };

                  const bcMatch = findTexture(null, true);
                  const normalMatch = settings.enableNormal ? findTexture(settings.normalSuffix, false) : null;
                  const pbrMatch = settings.enablePBR ? findTexture(settings.pbrSuffix, false) : null;

                  // 检索自定义插槽贴图匹配
                  const customMatches = {};
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

                  // Fallback logic for simulation 
                  const isFallbackActive = settings.useFallbackMaterial && (
                    !bcMatch || 
                    (settings.enableNormal && !normalMatch) || 
                    (settings.enablePBR && !pbrMatch) ||
                    (settings.customSlots || []).some(slot => 
                      slot.enabled && (!customMatches[slot.id] || !customMatches[slot.id].textureName)
                    )
                  );
                  const finalPrefix = isFallbackActive ? settings.fallbackPrefix : settings.addInstancePrefix;
                  const instanceName = \`\${finalPrefix}\${coreName}\`;
                  const instanceSavePath = \`\${settings.saveFolder}/\${instanceName}\`;

                  opLogs.push(\`清洗: \${settings.matchSource === 'slot' ? \`[插槽名] \${m.slotName || m.originalMaterialName}\` : \`[材质名] \${m.originalMaterialName}\`} -> \${coreName}\`);
                  if (isFallbackActive) {
                    opLogs.push(\`[触发备用材质替换] 贴图不完整，启用备用母材质模板: \${settings.backupMasterMaterialPath}\`);
                    opLogs.push(\`由于启用备用材质机制，该材质实例仅绑定使用 BaseColor，其余插槽为空。\`);
                  }
                  opLogs.push(\`新建材质实例: \${instanceName} 在路径 \${settings.saveFolder}\`);
                  
                  if (bcMatch) {
                    opLogs.push(\`[BaseColor] 匹配到: \${bcMatch.tex.fileName} (\${bcMatch.source === 'primary' ? '主库' : '备库'})\`);
                  } else {
                    opLogs.push(\`[BaseColor] [未匹配到贴图]\`);
                  }

                  if (!isFallbackActive) {
                    if (settings.enableNormal) {
                      if (normalMatch) {
                        opLogs.push(\`[Normal] 匹配到: \${normalMatch.tex.fileName} (\${normalMatch.source === 'primary' ? '主库' : '备库'})\`);
                      } else {
                        opLogs.push(\`[Normal] [未匹配到贴图]\`);
                      }
                    } else {
                      opLogs.push(\`[Normal] [插槽未开启，已跳过]\`);
                    }

                    if (settings.enablePBR) {
                      if (pbrMatch) {
                        opLogs.push(\`[PBR] 匹配到: \${pbrMatch.tex.fileName} (\${pbrMatch.source === 'primary' ? '主库' : '备库'})\`);
                      } else {
                        opLogs.push(\`[PBR] [未匹配到贴图]\`);
                      }
                    } else {
                      opLogs.push(\`[PBR] [插槽未开启，已跳过]\`);
                    }

                    // 打印并处理自定义插槽匹配日志
                    (settings.customSlots || []).forEach(slot => {
                      if (slot.enabled) {
                        const matchInfo = customMatches[slot.id];
                        if (matchInfo && matchInfo.textureName) {
                          opLogs.push(\`[\${slot.name}] 匹配到: \${matchInfo.textureName} (\${matchInfo.foundIn === 'primary' ? '主库' : '备库'})\`);
                        } else {
                          opLogs.push(\`[\${slot.name}] [未匹配到贴图]\`);
                        }
                      } else {
                        opLogs.push(\`[\${slot.name}] [插槽未开启，已跳过]\`);
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
                }).filter(Boolean);

                results.forEach((res) => {
                  pushLog(\`       ======== 材质球: \${res.originalMaterial} -> 创建材质实例 =======\`);
                  res.logs.forEach(msg => pushLog(\`       * \${msg}\`));
                });

                setSimulationResults(results);
                setCurrentStep(5);

                setTimeout(() => {
                  pushLog(\`[5/5]  [保存] 写入烘焙配置并序列化保存材质实例属性...\`);
                  pushLog(\`[5/5]  [弹窗报告] 自动化匹配流程完美结束！\`);
                  setIsSimulating(false);
                }, 800);

              }, 800);
            }, 800);
          }, 800);
        }, 500);
      };

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
          }
        ]);
        setNewModel('');
        setNewMatName('');
        setNewSlotName('');
      };

      const addMockTexture = () => {
        if (!newTexFile) return;
        setMockTextures([
          ...mockTextures,
          { id: Date.now().toString(), fileName: newTexFile, folder: newTexFolder }
        ]);
        setNewTexFile('');
      };

      const lines = pythonScript.split('\\n');

      return (
        <div class="flex-1 flex flex-col justify-between">
          <header class="bg-[#1e1e1e] border-b border-[#2a2a2a] sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-[#E18E2D] flex items-center justify-center rounded">
                <span class="text-black font-black text-xl leading-none">U</span>
              </div>
              <div>
                <h1 class="text-sm sm:text-base font-bold tracking-tight text-white uppercase flex items-center">
                  Unreal 5.7+ Material Automator (Standalone Desktop)
                </h1>
                <p class="text-[10px] text-[#888888]">独立高兼容本地端：双离线计算模块，即开即用</p>
              </div>
            </div>
            <div class="text-[10px] text-[#E18E2D] border border-[#E18E2D]/20 bg-[#E18E2D]/10 px-2.5 py-1 rounded font-mono uppercase font-black">
              100% 离线运行模式 (Offline Pack)
            </div>
          </header>

          <main class="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Settings */}
              <div class="lg:col-span-5 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-5 flex flex-col space-y-4">
                <div class="flex items-center gap-2 border-b border-[#222] pb-3">
                  <SettingsIcon />
                  <span class="text-xs font-bold uppercase tracking-widest text-[#E18E2D]">1. 核心配置区域</span>
                </div>

                {/* Local Config management bar */}
                <div class="px-3 py-1.5 border border-[#222] rounded bg-[#151515] flex items-center justify-between text-[11px] gap-2">
                  <span class="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">本地配置管理 (JSON)</span>
                  <div class="flex items-center gap-1.5 font-sans">
                    {importStatus && (
                      <span class={\`text-[8px] font-bold px-1.5 py-0.5 rounded \${importStatus.includes('成功') ? 'bg-green-950/45 text-green-400 border border-green-500/20' : 'bg-red-950/45 text-red-400 border border-red-500/20'}\`}>
                        {importStatus}
                      </span>
                    )}
                    <button
                      onClick={handleExportConfig}
                      type="button"
                      class="flex items-center gap-1 px-2.5 py-1 bg-[#252525] hover:bg-[#2d2d2d] active:bg-[#151515] border border-[#353535] text-zinc-300 text-[9px] uppercase font-bold rounded transition-colors cursor-pointer"
                      title="保存当前配置的所有参数到本地 JSON 配置文件"
                    >
                      <span>导出配置</span>
                    </button>
                    <label
                      class="flex items-center gap-1 px-2.5 py-1 bg-[#E18E2D]/10 hover:bg-[#E18E2D]/20 active:bg-[#E18E2D]/30 border border-[#E18E2D]/20 hover:border-[#E18E2D]/45 text-[#E18E2D] text-[9px] uppercase font-bold rounded transition-colors cursor-pointer"
                      title="一键导入之前配置过的 JSON 配置文件"
                    >
                      <span>导入配置</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportConfig}
                        class="hidden"
                      />
                    </label>
                  </div>
                </div>
                
                <div class="space-y-3.5 text-xs text-[#cccccc]">
                  <div>
                    <label class="block text-[10px] text-[#888] font-bold uppercase mb-1">父级材质 / 实例路径</label>
                    <input type="text" name="masterMaterialPath" value={settings.masterMaterialPath} onChange={handleChange} class="w-full bg-[#0a0a0a] border border-[#333] hover:border-[#444] rounded p-2 text-white font-mono" />
                  </div>
                  
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-[10px] text-[#888] font-bold uppercase mb-1">主贴图库</label>
                      <input type="text" name="primaryTextureDir" value={settings.primaryTextureDir} onChange={handleChange} class="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-white font-mono" />
                    </div>
                    <div>
                      <label class="block text-[10px] text-[#888] font-bold uppercase mb-1">备用贴图库</label>
                      <input type="text" name="backupTextureDir" value={settings.backupTextureDir} onChange={handleChange} class="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-white font-mono" />
                    </div>
                  </div>

                  <div>
                    <label class="block text-[10px] text-[#888] font-bold uppercase mb-1">保存文件夹</label>
                    <input type="text" name="saveFolder" value={settings.saveFolder} onChange={handleChange} class="w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-white font-mono" />
                  </div>

                  <hr class="border-[#2a2a2a]" />

                  {/* 贴图插槽与启用控制 */}
                  <div class="space-y-2">
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">贴图参数插槽与匹配后缀</div>
                    <div class="grid grid-cols-1 gap-2.5">
                      {/* BaseColor */}
                      <div class="p-2.5 bg-[#0c0c0c] border border-[#2b2b2b] rounded">
                        <div class="flex items-center justify-between mb-1.5">
                          <span class="text-[10px] font-bold text-white uppercase">BaseColor 基础颜色</span>
                          <span class="text-[8px] px-1 bg-green-950/45 text-green-400 rounded border border-green-500/20 font-semibold font-mono">必填</span>
                        </div>
                        <div>
                          <label class="block text-[9px] text-[#666] uppercase mb-0.5">参数名称 (Parameter Name)</label>
                          <input type="text" name="baseColorParam" value={settings.baseColorParam} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                        </div>
                      </div>

                      {/* Normal */}
                      <div class={\`p-2.5 border rounded \${settings.enableNormal ? 'bg-[#0c0c0c] border-[#2b2b2b]' : 'bg-transparent border-[#222]/30 opacity-60'}\`}>
                        <div class="flex items-center justify-between mb-1.5">
                          <label class="text-[10px] font-bold text-white uppercase flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" name="enableNormal" checked={settings.enableNormal} onChange={handleChange} class="w-3.5 h-3.5 text-[#E18E2D] border-[#333] bg-black rounded cursor-pointer accent-[#E18E2D]" />
                            <span>Normal 法线插槽</span>
                          </label>
                          <span class={\`text-[8px] px-1 rounded border font-semibold font-mono \${settings.enableNormal ? 'bg-[#E18E2D]/10 text-[#E18E2D] border-[#E18E2D]/20' : 'bg-zinc-900/60 text-zinc-500 border-zinc-800'}\`}>
                            {settings.enableNormal ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        {settings.enableNormal && (
                          <div class="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <label class="block text-[9px] text-[#666] uppercase mb-0.5">参数名称</label>
                              <input type="text" name="normalParam" value={settings.normalParam} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                            </div>
                            <div>
                              <label class="block text-[9px] text-[#666] uppercase mb-0.5">检索后缀</label>
                              <input type="text" name="normalSuffix" value={settings.normalSuffix} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* PBR */}
                      <div class={\`p-2.5 border rounded \${settings.enablePBR ? 'bg-[#0c0c0c] border-[#2b2b2b]' : 'bg-transparent border-[#222]/30 opacity-60'}\`}>
                        <div class="flex items-center justify-between mb-1.5">
                          <label class="text-[10px] font-bold text-white uppercase flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" name="enablePBR" checked={settings.enablePBR} onChange={handleChange} class="w-3.5 h-3.5 text-[#E18E2D] border-[#333] bg-black rounded cursor-pointer accent-[#E18E2D]" />
                            <span>PBR (粗糙/金属/高光)</span>
                          </label>
                          <span class={\`text-[8px] px-1 rounded border font-semibold font-mono \${settings.enablePBR ? 'bg-[#E18E2D]/10 text-[#E18E2D] border-[#E18E2D]/20' : 'bg-zinc-900/60 text-zinc-500 border-zinc-800'}\`}>
                            {settings.enablePBR ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        {settings.enablePBR && (
                          <div class="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <label class="block text-[9px] text-[#666] uppercase mb-0.5">参数名称</label>
                              <input type="text" name="pbrParam" value={settings.pbrParam} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                            </div>
                            <div>
                              <label class="block text-[9px] text-[#666] uppercase mb-0.5">检索后缀</label>
                              <input type="text" name="pbrSuffix" value={settings.pbrSuffix} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Custom Slots */}
                      {(settings.customSlots || []).map((slot) => (
                        <div key={slot.id} class={\`p-2.5 border rounded \${slot.enabled ? 'bg-[#0c0c0c] border-[#2b2b2b]' : 'bg-transparent border-[#222]/30 opacity-60'}\`}>
                          <div class="flex items-center justify-between mb-1.2">
                            <label class="text-[10px] font-bold text-white uppercase flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={slot.enabled} onChange={(e) => handleUpdateCustomSlot(slot.id, { enabled: e.target.checked })} class="w-3.5 h-3.5 text-[#E18E2D] border-[#333] bg-black rounded cursor-pointer accent-[#E18E2D]" />
                              <span>{slot.name} (自定义)</span>
                            </label>
                            <div class="flex items-center gap-1.5">
                              <span class={\`text-[8px] px-1 rounded border font-semibold font-mono \${slot.enabled ? 'bg-[#E18E2D]/10 text-[#E18E2D] border-[#E18E2D]/20' : 'bg-zinc-900/60 text-zinc-500 border-zinc-800'}\`}>
                                {slot.enabled ? 'ENABLED' : 'DISABLED'}
                              </span>
                              <button onClick={() => handleRemoveCustomSlot(slot.id)} type="button" class="text-zinc-500 hover:text-rose-500 text-[10px]">删除</button>
                            </div>
                          </div>
                          <div class="space-y-1.5 mt-1.5">
                            <div class="grid grid-cols-2 gap-2">
                              <div>
                                <label class="block text-[8px] text-[#666] uppercase mb-0.5">插槽别名</label>
                                <input type="text" value={slot.name} onChange={(e) => handleUpdateCustomSlot(slot.id, { name: e.target.value })} class="w-full text-xs font-mono py-0.5 px-1 bg-black border border-[#333] rounded text-white" />
                              </div>
                              <div>
                                <label class="block text-[8px] text-[#666] uppercase mb-0.5">参数名</label>
                                <input type="text" value={slot.paramName} onChange={(e) => handleUpdateCustomSlot(slot.id, { paramName: e.target.value })} class="w-full text-xs font-mono py-0.5 px-1 bg-black border border-[#333] rounded text-white" />
                              </div>
                            </div>
                            <div>
                              <label class="block text-[8px] text-[#666] uppercase mb-0.5">检索后缀</label>
                              <input type="text" value={slot.suffix} onChange={(e) => handleUpdateCustomSlot(slot.id, { suffix: e.target.value })} class="w-full text-xs font-mono py-0.5 px-1 bg-black border border-[#333] rounded text-white" />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add Custom Slot Button */}
                      <button onClick={handleAddCustomSlot} type="button" class="w-full py-1.5 bg-zinc-900/60 hover:bg-zinc-900 border border-[#2b2b2b] text-zinc-300 rounded text-[9px] uppercase font-bold flex items-center justify-center gap-1">
                        <PlusIcon />
                        <span>+ 增加额外自定义槽位</span>
                      </button>
                    </div>
                  </div>                  {/* 备用替换母材质机制与命名清洗 */}
                  <div class="p-2.5 rounded border border-[#222] bg-[#141414] space-y-2.5">
                    <div class="flex items-center justify-between">
                      <label class="text-[10px] font-bold text-white uppercase flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" name="useFallbackMaterial" checked={settings.useFallbackMaterial} onChange={handleChange} class="w-3.5 h-3.5 text-[#E18E2D] border-[#333] bg-black rounded cursor-pointer accent-[#E18E2D]" />
                        <span>启用缺省备用替换机制</span>
                      </label>
                      <span class={\`text-[8.5px] font-bold font-mono px-1 rounded border \${settings.useFallbackMaterial ? 'bg-[#E18E2D]/10 text-[#E18E2D] border-[#E18E2D]/20' : 'text-zinc-600 border-zinc-900'}\`}>
                        {settings.useFallbackMaterial ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>

                    {settings.useFallbackMaterial && (
                      <div class="space-y-2 mt-2 pt-1 border-t border-[#222]">
                        <div>
                          <label class="block text-[9px] text-[#8a8a8a] uppercase mb-0.5">备用母材质路径 (Backup Master)</label>
                          <input type="text" name="backupMasterMaterialPath" value={settings.backupMasterMaterialPath} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                        </div>
                        <div>
                          <label class="block text-[9px] text-[#8a8a8a] uppercase mb-0.5">备用实例命名加缀 (Fallback Prefix)</label>
                          <input type="text" name="fallbackPrefix" value={settings.fallbackPrefix} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 材质库已有材质直接匹配规则 */}
                  <div class="p-2.5 rounded border border-[#222] bg-[#141414] space-y-2.5">
                    <div class="flex items-center justify-between">
                      <label class="text-[10px] font-bold text-white uppercase flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" name="enableMaterialLibraryMatch" checked={settings.enableMaterialLibraryMatch} onChange={handleChange} class="w-3.5 h-3.5 text-[#E18E2D] border-[#333] bg-black rounded cursor-pointer accent-[#E18E2D]" />
                        <span>优先直接匹配材质库已有材质</span>
                      </label>
                      <span class={\`text-[8.5px] font-bold font-mono px-1 rounded border \${settings.enableMaterialLibraryMatch ? 'bg-[#E18E2D]/10 text-[#E18E2D] border-[#E18E2D]/20' : 'text-zinc-600 border-zinc-900'}\`}>
                        {settings.enableMaterialLibraryMatch ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>

                    {settings.enableMaterialLibraryMatch && (
                      <div class="space-y-2 mt-2 pt-1 border-t border-[#222]">
                        <div>
                          <label class="block text-[9px] text-[#8a8a8a] uppercase mb-0.5 font-sans">材质库资产保存路径 (Library Folder)</label>
                          <input type="text" name="materialLibraryPath" value={settings.materialLibraryPath} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 材质球命名与前缀剥离规则 */}
                  <div class="p-2.5 rounded border border-[#222] bg-[#141414] space-y-2.5">
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">材质命名清洗与实例前缀</div>
                    
                    {/* 核心词检测源 (Match Source Setting) */}
                    <div class="space-y-1">
                      <label class="block text-[9px] text-[#8a8a8a] uppercase">核心词检测源 (检测源类型)</label>
                      <div class="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, matchSource: 'material' })}
                          class={\`px-2 py-1.5 border text-center transition-all rounded cursor-pointer text-[10px] uppercase font-bold \${(settings.matchSource || 'material') === 'material' ? 'bg-[#E18E2D]/10 border-[#E18E2D] text-white shadow-[0_0_8px_rgba(225,142,45,0.15)]' : 'bg-[#0a0a0a] border-[#333] text-zinc-550 hover:bg-[#151515] hover:border-zinc-700 hover:text-zinc-300'}\`}
                        >
                          材质球名称
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, matchSource: 'slot' })}
                          class={\`px-2 py-1.5 border text-center transition-all rounded cursor-pointer text-[10px] uppercase font-bold \${settings.matchSource === 'slot' ? 'bg-[#E18E2D]/10 border-[#E18E2D] text-white shadow-[0_0_8px_rgba(225,142,45,0.15)]' : 'bg-[#0a0a0a] border-[#333] text-zinc-550 hover:bg-[#151515] hover:border-zinc-700 hover:text-zinc-300'}\`}
                        >
                          材质插槽名
                        </button>
                      </div>
                      <span class="text-[8px] text-zinc-550 block leading-tight mt-1">
                        {settings.matchSource === 'slot'
                          ? '当前模式：读取模型自身的物理材质插槽名字进行检索'
                          : '当前模式：读取现配材质球资产的名称进行检索清洗'}
                      </span>
                    </div>
                    
                    <div class="space-y-2">
                      <div>
                        <label class="block text-[9px] text-[#8a8a8a] uppercase mb-0.5">要剥离的原始前缀 (Strip Prefixes)</label>
                        <input type="text" name="stripPrefixes" value={settings.stripPrefixes} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                        <span class="text-[8px] text-zinc-500 block leading-tight mt-0.5">逗号分隔。例如: MI_N_, M_ 等。</span>
                      </div>
                      <div>
                        <label class="block text-[9px] text-[#8a8a8a] uppercase mb-0.5">生成的材质实例前缀 (Instance Prefix)</label>
                        <input type="text" name="addInstancePrefix" value={settings.addInstancePrefix} onChange={handleChange} class="w-full text-xs font-mono py-1 px-1.5 bg-black border border-[#333] rounded text-white" />
                        <span class="text-[8px] text-zinc-500 block leading-tight mt-0.5">通常使用 MI_ 标识材质实例。</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-start gap-2.5 p-2 bg-[#0c0c0c] rounded border border-[#2b2b2b]">
                    <input type="checkbox" id="ignoreTrailingOne" name="ignoreTrailingOne" checked={settings.ignoreTrailingOne} onChange={handleChange} class="mt-1 accent-[#E18E2D] h-4 w-4" />
                    <label for="ignoreTrailingOne" class="text-[10px] text-zinc-400 block leading-tight">
                      <b>无视材质命名最末尾数字 1</b><br/>
                      清洗去重规则：例如 M_Weave_1 清洗后也为 Weave
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Code and Python view */}
              <div class="lg:col-span-7 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] flex flex-col overflow-hidden h-[540px]">
                <div class="p-4 bg-[#1e1e1e] border-b border-[#2a2a2a] flex items-center justify-between">
                  <span class="text-xs font-bold uppercase tracking-wider text-white">UE_MaterialAutomation.py (自适应)</span>
                  <div class="flex gap-2">
                    <button onClick={runSampleSimulation} class="px-3 py-1.5 bg-[#E18E2D] hover:bg-[#ffaa44] text-black font-semibold rounded text-[10px] uppercase flex items-center gap-1">运行干跑测试</button>
                    <button onClick={handleCopy} class="p-1.5 bg-[#111] hover:bg-[#333] rounded border border-[#333]">
                      {copied ? <CheckIcon /> : <CopyIcon />}
                    </button>
                    <button onClick={handleDownloadScript} class="p-1.5 bg-[#111] hover:bg-[#333] rounded border border-[#333]">
                      <DownloadIcon />
                    </button>
                  </div>
                </div>
                <div class="flex-1 overflow-auto p-4 bg-[#0c0c0c] font-mono text-xs text-[#999] flex custom-scrollbar">
                  <div class="text-right text-[#444] border-r border-[#1a1a1a] pr-3 select-none w-8">
                    {lines.map((_, i) => <div key={i}>{i+1}</div>)}
                  </div>
                  <pre class="pl-4 select-text text-zinc-300 overflow-x-auto w-full leading-5">
                    {lines.map((line, i) => {
                      let color = "text-[#CCC]";
                      if (line.trim().startsWith("#")) color = "text-zinc-600 italic";
                      else if (line.trim().startsWith("def ")) color = "text-[#E18E2D] font-bold";
                      else if (line.trim().startsWith("import ") || line.trim().startsWith("from ")) color = "text-purple-400";
                      return <div key={i} class={color}>{line || " "}</div>;
                    })}
                  </pre>
                </div>
              </div>
            </div>

            {/* Dry-Run Simulator */}
            <div class="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden p-5 space-y-4">
              <div class="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
                <span class="text-xs font-bold uppercase tracking-widest text-[#E18E2D]">2. 单机离线干跑调试</span>
                <button onClick={runSampleSimulation} disabled={isSimulating} class="px-4 py-2 bg-[#E18E2D] text-black hover:bg-[#ffaa44] font-bold rounded text-xs">启动演算</button>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div class="lg:col-span-5 space-y-3.5 bg-[#141414] p-3.5 rounded border border-[#222]">
                  <div class="flex p-1 bg-[#1c1c1c] rounded">
                    <button onClick={() => setActiveTab('selection')} class={\`flex-1 py-1 text-[10px] font-bold uppercase rounded \${activeTab === 'selection' ? 'bg-[#2a2a2a] text-white' : 'text-zinc-500'}\`}>材质球选中 (\${mockMaterials.length})</button>
                    <button onClick={() => setActiveTab('textures')} class={\`flex-1 py-1 text-[10px] font-bold uppercase rounded \${activeTab === 'textures' ? 'bg-[#2a2a2a] text-white' : 'text-zinc-500'}\`}>贴图资源 (\${mockTextures.length})</button>
                    <button onClick={() => setActiveTab('library')} class={\`flex-1 py-1 text-[10px] font-bold uppercase rounded \${activeTab === 'library' ? 'bg-[#2a2a2a] text-white' : 'text-zinc-500'}\`}>材质库 (\${mockLibMaterials.length})</button>
                  </div>

                  {activeTab === 'selection' && (
                    <div class="space-y-2">
                      <div class="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
                        {mockMaterials.map((item, idx) => (
                          <div key={idx} class="flex justify-between items-center bg-black/40 border border-[#222] p-1.5 px-2.5 rounded text-[11px]">
                            <div>
                              <b class="text-[#888] font-mono select-none block text-[9px] uppercase leading-none mb-0.5">{item.modelName}</b>
                              <span class="font-mono text-white text-xs">{item.originalMaterialName}</span>
                              <span class="text-zinc-500 font-mono text-[10px] ml-1.5">({item.slotName || '无插槽名'})</span>
                            </div>
                            <button onClick={() => setMockMaterials(mockMaterials.filter(m => m.id !== item.id))} class="text-zinc-600 hover:text-rose-500"><TrashIcon /></button>
                          </div>
                        ))}
                      </div>
                      <div class="p-2 border border-[#333] rounded space-y-2 bg-[#0c0c0c]">
                        <div class="grid grid-cols-3 gap-1.5">
                          <input type="text" placeholder="Mesh网格" value={newModel} onChange={e => setNewModel(e.target.value)} class="p-1 px-2 text-xs bg-black text-white rounded border border-[#333]" />
                          <input type="text" placeholder="源材质" value={newMatName} onChange={e => setNewMatName(e.target.value)} class="p-1 px-2 text-xs bg-black text-white rounded border border-[#333]" />
                          <input type="text" placeholder="插槽名(选填)" value={newSlotName} onChange={e => setNewSlotName(e.target.value)} class="p-1 px-2 text-xs bg-black text-white rounded border border-[#333]" />
                        </div>
                        <button onClick={addMockMaterial} class="w-full py-1 text-[10px] bg-[#222] text-white font-bold rounded uppercase">+ 追加选中材质球</button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'textures' && (
                    <div class="space-y-2">
                      <div class="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
                        {mockTextures.map((item, idx) => (
                          <div key={idx} class="flex justify-between items-center bg-black/40 border border-[#222] p-1.5 px-2.5 rounded text-[11px] font-mono">
                            <span class="text-white">{item.fileName} ({item.folder})</span>
                            <button onClick={() => setMockTextures(mockTextures.filter(t => t.id !== item.id))} class="text-zinc-650 hover:text-rose-500"><TrashIcon /></button>
                          </div>
                        ))}
                      </div>
                      <div class="p-2 border border-[#333] rounded space-y-2 bg-[#0c0c0c]">
                        <div class="flex gap-1.5">
                          <input type="text" placeholder="贴图 (Texture 如 T_Wood_n)" value={newTexFile} onChange={e => setNewTexFile(e.target.value)} class="flex-1 p-1 px-2 text-xs bg-black text-white rounded border border-[#333]" />
                          <select value={newTexFolder} onChange={e => setNewTexFolder(e.target.value)} class="bg-black text-xs text-white border border-[#333] p-1 rounded">
                            <option value="primary">主</option>
                            <option value="backup">备</option>
                          </select>
                        </div>
                        <button onClick={addMockTexture} class="w-full py-1 text-[10px] bg-[#222] text-white font-bold rounded uppercase">+ 录入新贴图文件</button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'library' && (
                    <div class="space-y-2">
                      <div class="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar">
                        {mockLibMaterials.map((item, idx) => (
                          <div key={idx} class="flex justify-between items-center bg-black/40 border border-[#222] p-1.5 px-2.5 rounded text-[11px]">
                            <div class="flex items-center gap-2">
                              <span class="text-yellow-500">📁</span>
                              <span class="font-mono text-white text-xs">{item}</span>
                            </div>
                            <button onClick={() => deleteMockLibMaterial(item)} class="text-zinc-650 hover:text-rose-500"><TrashIcon /></button>
                          </div>
                        ))}
                        {mockLibMaterials.length === 0 && (
                          <div class="text-center py-4 text-[10px] text-zinc-500 italic">材质库为空</div>
                        )}
                      </div>
                      <div class="p-2 border border-[#333] rounded space-y-2 bg-[#0c0c0c]">
                        <input
                          type="text"
                          placeholder="材质球名称 (例: MI_spruce_planks)"
                          value={newLibMat}
                          onChange={e => setNewLibMat(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addMockLibMaterial(); }}
                          class="w-full p-1 px-2 text-xs bg-[#050505] text-white rounded border border-[#333] font-mono"
                        />
                        <button onClick={addMockLibMaterial} class="w-full py-1 text-[10px] bg-[#222] text-[#CCC] font-bold rounded uppercase transition-colors hover:bg-[#333]">+ 录入已有材质</button>
                      </div>
                    </div>
                  )}
                </div>

                <div class="lg:col-span-7 bg-[#0e0e0e] p-4 rounded border border-[#222] flex flex-col space-y-3 min-h-[250px]">
                  {hasRun ? (
                    <div class="flex-1 flex flex-col space-y-3">
                      <div class="h-[90px] bg-black p-2 border border-[#1e1e1e] rounded overflow-y-auto font-mono text-[9px] text-[#888] custom-scrollbar">
                        {consoleLogs.map((log, i) => <div key={i}>{log}</div>)}
                      </div>
                      <div class="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {simulationResults.map((res, i) => (
                          <div key={i} class="p-2 bg-[#141414] border border-[#222] rounded flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-[10px]">
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-1.5 mb-1">
                                <span class="text-[#E18E2D] font-bold leading-none font-sans text-[9px] uppercase">Slot: {res.meshName} &gt; {res.cleanedMaterialName}</span>
                                {res.instanceName.startsWith(settings.fallbackPrefix) && (
                                  <span class="text-[8px] bg-amber-950 text-amber-400 font-bold px-1 rounded border border-amber-600/20 uppercase font-sans">Fallback</span>
                                )}
                              </div>
                              <span class="text-white text-xs block font-bold">{res.instanceName}</span>
                              <span class="text-zinc-650 block text-[9px] truncate mb-2">{res.instanceSavePath}</span>

                              {/* Custom Slots matches list */}
                              {Object.values(res.slots.customSlots || {}).length > 0 && (
                                <div class="flex flex-wrap gap-1.5 mt-1.5">
                                  {Object.values(res.slots.customSlots || {}).map((item, idx) => (
                                    <div key={idx} class="p-1 px-1.5 bg-black/40 rounded border border-[#222] text-[8.5px] leading-none flex items-center gap-1.5">
                                      <span class="text-[#E18E2D]/80 font-bold font-sans uppercase text-[7.5px]">{item.slotName}:</span>
                                      <span class={\`font-mono \${item.textureName ? 'text-zinc-300' : 'text-rose-500 font-semibold italic'}\`}>
                                        {item.textureName || 'Missing'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div class="grid grid-cols-3 gap-1 md:w-[320px] shrink-0 text-left">
                              {/* BaseColor */}
                              <div class="p-1 px-1.5 bg-black rounded border border-[#222] flex flex-col justify-center">
                                <span class="text-[7.5px] font-bold text-[#555555] uppercase font-mono">{res.slots.baseColor.paramName}</span>
                                <span class={\`text-[9px] truncate font-mono \${res.slots.baseColor.textureName ? 'text-[#CCCCCC]' : 'text-rose-500 font-bold italic'}\`}>
                                  {res.slots.baseColor.textureName || 'Missing'}
                                </span>
                              </div>
                              
                              {/* Normal */}
                              <div class={\`p-1 px-1.5 bg-black rounded border flex flex-col justify-center \${settings.enableNormal ? 'border-[#222]' : 'border-zinc-800 opacity-30'}\`}>
                                <span class="text-[7.5px] font-bold text-[#555555] uppercase font-mono">{res.slots.normal.paramName}</span>
                                {!settings.enableNormal ? (
                                  <span class="text-[8px] text-zinc-600 italic font-mono">OFF</span>
                                ) : (
                                  <span class={\`text-[9px] truncate font-mono \${res.slots.normal.textureName ? 'text-[#CCCCCC]' : 'text-rose-500 font-bold italic'}\`}>
                                    {res.slots.normal.textureName || 'Missing'}
                                  </span>
                                )}
                              </div>

                              {/* PBR */}
                              <div class={\`p-1 px-1.5 bg-black rounded border flex flex-col justify-center \${settings.enablePBR ? 'border-[#222]' : 'border-zinc-800 opacity-30'}\`}>
                                <span class="text-[7.5px] font-bold text-[#555555] uppercase font-mono">{res.slots.pbr.paramName}</span>
                                {!settings.enablePBR ? (
                                  <span class="text-[8px] text-zinc-600 italic font-mono">OFF</span>
                                ) : (
                                  <span class={\`text-[9px] truncate font-mono \${res.slots.pbr.textureName ? 'text-[#CCCCCC]' : 'text-rose-500 font-bold italic'}\`}>
                                    {res.slots.pbr.textureName || 'Missing'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div class="flex-1 flex flex-col items-center justify-center text-center text-zinc-650 p-6 select-none font-sans">
                      <p class="text-xs font-bold uppercase tracking-widest mb-1">等待运行算试匹配</p>
                      <p class="text-[10px] text-zinc-700">点击右上角“运行干跑测试”可立即在本地游览器预览该算法对贴图的检索分配机制</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>

          <footer class="bg-[#1e1e1e] border-t border-[#2a2a2a] p-4 text-center text-[10px] text-[#555] uppercase mt-12">
            <div>100% Client-Side Pure HTML Offline Toolset. Epic Games Unreal Engine compatible pipeline.</div>
          </footer>
        </div>
      );
    }

    const container = document.getElementById('root');
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
  </script>
</body>
</html>
`;
}
