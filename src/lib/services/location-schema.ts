import {z} from '../schema';
const visibleText=(maximum:number)=>z.string().min(1).max(maximum).refine(value=>[...value].every(character=>character.charCodeAt(0)>=32&&character.charCodeAt(0)!==127),'Control characters are not accepted.');
export const zoneIdentifierSchema=visibleText(100).regex(/^(?:[A-Za-z0-9_+.-]+\/)*[A-Za-z0-9_+.-]+$/);
/** These are the only values allowed across the geographic lookup boundary. */
export const placeQuerySchema=z.object({q:z.string().trim().min(2).max(100).refine(value=>[...value].every(character=>character.charCodeAt(0)>=32&&character.charCodeAt(0)!==127))}).strict();
export const coordinateLookupSchema=z.object({latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)}).strict();
const decimalCoordinate=z.string().trim().min(1).max(32).regex(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/).transform(Number);
export const coordinateQuerySchema=z.object({latitude:decimalCoordinate.pipe(z.number().finite().min(-90).max(90)),longitude:decimalCoordinate.pipe(z.number().finite().min(-180).max(180))}).strict();
export const placeResultSchema=z.object({
  id:visibleText(100),name:visibleText(200),label:visibleText(700),latitudeDeg:z.number().finite().min(-90).max(90),
  longitudeDeg:z.number().finite().min(-180).max(180),timezone:zoneIdentifierSchema.nullable(),
}).strict();
export type PlaceResult=z.infer<typeof placeResultSchema>;
export const placeResponseSchema=z.object({results:z.array(placeResultSchema).max(8),provider:visibleText(200),attribution:visibleText(1000)}).strict();
export const timezoneResponseSchema=z.object({zones:z.array(zoneIdentifierSchema).min(1).max(10).refine(zones=>new Set(zones).size===zones.length),dataset:z.literal('geo-tz/all@8.1.10'),attribution:visibleText(1000)}).strict();
