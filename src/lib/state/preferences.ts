import {z} from '../schema';
export const PREFERENCES_KEY='spatial.display-preferences.v2';
export const LEGACY_PREFERENCES_KEY='spatial.display-preferences.v1';
export const preferencesSchema=z.object({
  version:z.literal(2),quality:z.enum(['auto','low','high']),labelScale:z.number().min(1).max(1.5),
  earthOpacity:z.number().min(.15).max(1),motion:z.enum(['system','reduced','full']),textSize:z.enum(['standard','large']),
  houseMode:z.enum(['arcs','volumes','shells']),
  cardSparkles:z.boolean(),
}).strict();
const legacyPreferencesSchema=preferencesSchema.omit({version:true,cardSparkles:true}).extend({version:z.literal(1)}).strict();
export type DisplayPreferences=z.infer<typeof preferencesSchema>;
export const DEFAULT_PREFERENCES:Readonly<DisplayPreferences>=Object.freeze({version:2,quality:'auto',labelScale:1.25,earthOpacity:1,motion:'system',textSize:'standard',houseMode:'shells',cardSparkles:true});
type ReadStorage=Pick<Storage,'getItem'>;
type WriteStorage=Pick<Storage,'setItem'>;
function browserStorage():Storage|null{try{return typeof window==='undefined'?null:window.localStorage;}catch{return null;}}
/** Only this strict display-only whitelist is ever persisted. Personal context is session memory. */
export function readPreferences(storage:ReadStorage|null=browserStorage()):DisplayPreferences{
  try{
    const raw=storage?.getItem(PREFERENCES_KEY);
    if(raw){const parsed=preferencesSchema.safeParse(JSON.parse(raw));if(parsed.success)return parsed.data;}
    else {
      const legacy=storage?.getItem(LEGACY_PREFERENCES_KEY);
      if(legacy){const parsed=legacyPreferencesSchema.safeParse(JSON.parse(legacy));if(parsed.success)return {...parsed.data,version:2,cardSparkles:true};}
    }
  }catch{/* Storage may be unavailable; exploration remains in memory. */}
  return {...DEFAULT_PREFERENCES};
}
export function writePreferences(value:DisplayPreferences,storage:WriteStorage|null=browserStorage()):boolean{
  const parsed=preferencesSchema.safeParse(value);if(!parsed.success)return false;
  try{if(!storage)return false;storage.setItem(PREFERENCES_KEY,JSON.stringify(parsed.data));return true;}catch{return false;}
}
