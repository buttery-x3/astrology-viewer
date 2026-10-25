export type QualityMode='auto'|'low'|'high';
export interface SceneDisplaySettings {quality:QualityMode;labelScale:number;earthOpacity:number;reducedMotion:boolean}
export const DEFAULT_SCENE_DISPLAY:Readonly<SceneDisplaySettings>=Object.freeze({quality:'auto',labelScale:1,earthOpacity:1,reducedMotion:false});
