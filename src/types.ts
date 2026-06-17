/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GeneratorSettings {
  masterMaterialPath: string;
  saveFolder: string;
  primaryTextureDir: string;
  backupTextureDir: string;
  ignoreTrailingOne: boolean;
  baseColorParam: string;
  normalParam: string;
  pbrParam: string;
  normalSuffix: string;
  pbrSuffix: string;
  stripPrefixes: string; // comma-separated, e.g., "M_, MI_"
  addInstancePrefix: string; // e.g., "MI_"
  backupMasterMaterialPath: string; // Fallback master material for incomplete collections
  fallbackPrefix: string; // Prefix used when using fallback material, e.g., "MI_N_"
  useFallbackMaterial: boolean; // Enable fallback material logic when textures are missing
  enableNormal: boolean; // Enable/disable normal map slot binding
  enablePBR: boolean; // Enable/disable PBR map slot binding
  customSlots: CustomSlot[]; // User customizable texture slots
  matchSource: 'material' | 'slot'; // 'material' (读取模型材质球名字) or 'slot' (读取模型插槽名字)
  materialLibraryPath: string; // Path of existing material assets library, e.g., '/Game/MaterialLibrary'
  enableMaterialLibraryMatch: boolean; // Enable direct matching of materials in the library
}

export interface CustomSlot {
  id: string; // unique ID, e.g., 'slot_1'
  name: string; // UI visible name, e.g., 'Ao'
  paramName: string; // Master material parameter name, e.g., 'AO'
  suffix: string; // texture matching suffix, e.g., '_ao'
  enabled: boolean; // active switch
}

export interface MockMeshMaterial {
  id: string;
  modelName: string;
  originalMaterialName: string;
  slotName: string;
}

export interface MockTextureAsset {
  id: string;
  fileName: string;
  folder: 'primary' | 'backup';
}

export interface SimulationResult {
  meshName: string;
  originalMaterial: string;
  cleanedMaterialName: string;
  instanceName: string;
  instanceSavePath: string;
  slots: {
    baseColor: {
      textureName: string | null;
      foundIn: 'primary' | 'backup' | 'library' | null;
      paramName: string;
    };
    normal: {
      textureName: string | null;
      foundIn: 'primary' | 'backup' | 'library' | null;
      paramName: string;
    };
    pbr: {
      textureName: string | null;
      foundIn: 'primary' | 'backup' | 'library' | null;
      paramName: string;
    };
    customSlots?: {
      [slotId: string]: {
        slotName: string;
        textureName: string | null;
        foundIn: 'primary' | 'backup' | 'library' | null;
        paramName: string;
      };
    };
  };
  logs: string[];
}
