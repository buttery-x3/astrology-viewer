export const FIGURE_REVISION:string;
export function deriveFigures(topology:{id:string;constellations:{id:string;lines:number[][]}[]},hygText:string,brightStars:readonly(readonly unknown[])[]):{schema:number;epochJulianDate:number;figures:{id:string;constellationId:string;abbreviation:string;paths:number[][]}[];endpoints:{hip:number;hygId:number}[];supportStars:unknown[][]};
