/** Preserve the selected representation while linking the primary chart on sky and Earth. */
export function primaryHouseLink(id: string | null | undefined) {
  const match = /^(?:(?:house|boundary):|earth:(?:house|boundary):primary:)([1-9]|1[0-2])$/.exec(id ?? '');
  if (!match) return null;
  const house = Number(match[1]);
  return { house, skyHouseId: `house:${house}`, skyBoundaryId: `boundary:${house}`,
    earthHouseId: `earth:house:primary:${house}`, earthBoundaryId: `earth:boundary:primary:${house}` };
}
