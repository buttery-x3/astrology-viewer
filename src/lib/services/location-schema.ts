import {z} from 'zod';
export const placeResultSchema=z.object({
  id:z.string(),name:z.string(),label:z.string(),latitudeDeg:z.number().finite().min(-90).max(90),
  longitudeDeg:z.number().finite().min(-180).max(180),timezone:z.string().nullable(),
}).strict();
export type PlaceResult=z.infer<typeof placeResultSchema>;
export const placeResponseSchema=z.object({results:z.array(placeResultSchema).max(8),provider:z.string(),attribution:z.string()}).strict();
export const timezoneResponseSchema=z.object({zones:z.array(z.string().min(1)).min(1).max(10),dataset:z.literal('geo-tz/all@8.1.10'),attribution:z.string()}).strict();
