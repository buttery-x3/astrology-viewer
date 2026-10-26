import { describe, expect, it } from 'vitest';
import { primaryHouseLink } from '../../src/lib/domain/house-links';

describe('linked primary house representations', () => {
  it('links all indexed houses and cusps in both directions without changing identity', () => {
    for (let house=1;house<=12;house++) {
      const ids=[`house:${house}`,`boundary:${house}`,`earth:house:primary:${house}`,`earth:boundary:primary:${house}`];
      for (const id of ids) expect(primaryHouseLink(id)).toEqual({house,skyHouseId:ids[0],skyBoundaryId:ids[1],earthHouseId:ids[2],earthBoundaryId:ids[3]});
    }
  });
  it('never links comparison cusps, historical samples, bodies or malformed IDs into the primary partition', () => {
    for (const id of [null,undefined,'boundary:comparison:7','history:w:7:1000','body:venus','house:0','house:13','earth:house:comparison:7','earth:house:primary:7:label']) expect(primaryHouseLink(id)).toBeNull();
  });
});
