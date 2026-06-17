/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeneratorSettings } from '../types';

export function generateUEPythonScript(settings: GeneratorSettings): string {
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

  // Convert comma-separated prefixes into a python list format
  const prefixListStr = stripPrefixes
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `"${p}"`)
    .join(', ');

  // Convert React custom slots array into Python dictionary format
  const customSlotsPython = customSlots
    .map((s) => {
      const isEnabled = s.enabled ? 'True' : 'False';
      return `    "${s.id}": {"ENABLED": ${isEnabled}, "PARAM_NAME": "${s.paramName}", "SUFFIX": "${s.suffix}", "UI_NAME": "${s.name}"}`;
    })
    .join(',\n');

  const pythonCode = `import unreal
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
MASTER_MATERIAL_PATH = "${masterMaterialPath}"

# 1-2. 缺省备用母材质设置 (Fallback / Incomplete Material Settings)
# 缺省备份机制完美融接自定义新增槽位，若任何启用的自定义插槽无可用材质，亦自动进行备份替换。
USE_FALLBACK_MATERIAL = ${useFallbackMaterial ? 'True' : 'False'}
BACKUP_MASTER_MATERIAL_PATH = "${backupMasterMaterialPath}"
FALLBACK_PREFIX = "${fallbackPrefix}"

# 1-3. 贴图插槽启用开关 (Texture Slot Enabled Switches)
ENABLE_NORMAL = ${enableNormal ? 'True' : 'False'}
ENABLE_PBR = ${enablePBR ? 'True' : 'False'}

# 2. 贴图库与备用库路径 (Texture Library Folders)
PRIMARY_TEXTURE_DIR = "${primaryTextureDir}"
BACKUP_TEXTURE_DIR = "${backupTextureDir}"

# 3. 材质实例保存目录 (Where to save generated Material Instances)
SAVE_FOLDER = "${saveFolder}"

# 4. 参数插槽名称 (Parameter Names in the Master Material)
PARAM_BASE_COLOR = "${baseColorParam}"
PARAM_SIZE_NORMAL = "${normalParam}"
PARAM_SIZE_PBR = "${pbrParam}"

# 5. 贴图后缀匹配规则 (Texture Suffix Matching Rules)
SUFFIX_NORMAL = "${normalSuffix}"
SUFFIX_PBR = "${pbrSuffix}"

# 5-2. 额外增加的自定义贴图插槽 (Custom Dynamic Texture Slots)
CUSTOM_SLOTS = {
${customSlotsPython}
}

# 寻找BaseColor时排除这些已被占用的后缀，避免错误配对为一般色彩
EXCLUDE_SUFFIXES = [SUFFIX_NORMAL, SUFFIX_PBR] + [slot_info["SUFFIX"] for slot_info in CUSTOM_SLOTS.values() if slot_info["ENABLED"]]

# 6. 命名清洗与前置后缀规则 (Naming Rules)
STRIP_PREFIXES = [${prefixListStr}] # 需要清洗的材质前缀
ADD_INSTANCE_PREFIX = "${addInstancePrefix}" # 生成材质实例的前缀
IGNORE_TRAILING_ONE = ${ignoreTrailingOne ? 'True' : 'False'} # 是否无视最末尾的 "1"
# 材质映射核心检测源 ('material' = 读取模型材质球名字, 'slot' = 读取模型插槽名字)
MATCH_SOURCE = "${matchSource}"

# 7. 材质库已有材质同名直接匹配 (Material Library Matching)
ENABLE_MATERIAL_LIBRARY_MATCH = ${enableMaterialLibraryMatch ? 'True' : 'False'}
MATERIAL_LIBRARY_PATH = "${materialLibraryPath}"

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
        try:
            selected_assets = unreal.EditorUtilityLibrary.get_selected_assets() or []
        except Exception as err:
            utility_subsystem = unreal.get_editor_subsystem(unreal.EditorUtilitySubsystem)
            if utility_subsystem and hasattr(utility_subsystem, 'get_selected_assets'):
                selected_assets = utility_subsystem.get_selected_assets() or []
                
        if selected_assets and MATCH_SOURCE == "material":
            unreal.log(f"[采集] 检测到内容浏览器中选中了 {len(selected_assets)} 个资源，开始提取材质...")
            for asset in selected_assets:
                if isinstance(asset, unreal.MaterialInterface):
                    materials.add(asset)
                elif isinstance(asset, unreal.StaticMesh):
                    for mat_slot in asset.static_materials:
                        if mat_slot.material_interface:
                            materials.add(mat_slot.material_interface)
                elif isinstance(asset, unreal.SkeletalMesh):
                    for mat_slot in asset.materials:
                        if mat_slot.material_interface:
                            materials.add(mat_slot.material_interface)
    except Exception as e:
        unreal.log_warning(f"[采集] 内容浏览器资源提取发生异常: {e}")

    # 2. 采集关卡视口选中的 Actor
    try:
        try:
            actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
            selected_actors = actor_subsystem.get_selected_level_actors() or []
        except Exception:
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
        unreal.log_warning(f"[采集] 关卡视口 Actor 提取发生异常: {e}")
        
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
            message=f"配置的父级材质或材质实例路径不存在，请在脚本中定义正确的路径:\\n{MASTER_MATERIAL_PATH}",
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
                
        unreal.log(f"\\n======== 开始为核心词 '{core_name}' 匹配贴图与生成材质实例 ========")
        
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
            unreal.log("\\n======== 开始扫描【内容浏览器】选中模型的物理材质插槽 =======")
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
            unreal.log("\\n======== 开始扫描【关卡主视口】选中角色的网格插槽并实时渲染 =======")
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
            unreal.log("\\n======== 开始自动回填替换内容浏览器选中模型的插槽材质球 ========")
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
            unreal.log("\\n======== 开始自动回填并实时渲染关卡视口选中的 Actor 材质球 ========")
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
    finish_message = f"脚本处理完成!\\n成功生成并匹配了 {processed_count} 个材质实例到该文件夹下:\\n{SAVE_FOLDER}\\n\\n"
    if replaced_asset_count > 0:
        finish_message += f"【内容浏览器】已完成 {replaced_asset_count} 个模型资产材质槽的原地升级替换！\\n"
    if replaced_actor_count > 0:
        finish_message += f"【关卡主视口】已完成 {replaced_actor_count} 个关卡网格角色的材质秒速渲染！\\n"
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
`;

  return pythonCode;
}
