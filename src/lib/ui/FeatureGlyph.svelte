<script lang="ts">
  let {
    name,
    size = 28,
    color = 'currentColor',
  }: { name: string; size?: number; color?: string } = $props();
  const paths: Record<string, string> = {
    sun: 'M21 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM16 15v2',
    moon: 'M20 5a12 12 0 1 0 0 22A13 13 0 0 1 20 5Z',
    mercury: 'M10 4a6 6 0 0 0 12 0M22 13a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM16 19v10M11 25h10',
    venus: 'M23 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM16 18v11M11 25h10',
    mars: 'M19 20a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM17 15 27 5M20 5h7v7',
    jupiter: 'M8 8c11-6 8 7-2 11h19M21 5v23',
    saturn: 'M12 4v17M7 9h10M12 17c12-9 12 7 6 10',
    uranus: 'M5 6v15M27 6v15M5 13h22M16 4v19M20 26a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    neptune: 'M7 6v5a9 9 0 0 0 18 0V6M16 4v25M11 25h10M4 9l3-4 3 4M22 9l3-4 3 4',
    pluto: 'M21 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM7 12a9 9 0 0 0 18 0M16 21v9M11 26h10',
    aries: 'M16 27V12C16-1 1 4 8 14M16 12c0-13 15-8 8 2',
    taurus: 'M7 4c0 9 18 9 18 0M24 19a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    gemini: 'M7 6q9 4 18 0M7 26q9-4 18 0M11 8v16M21 8v16',
    cancer:
      'M6 10c8-8 20-3 20 1M12 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM26 22c-8 8-20 3-20-1M28 20a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    leo: 'M11 22a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM10 20C-1-2 26-1 21 13c-6 13 5 17 8 9',
    virgo: 'M4 26V8q5-8 8 0v18M12 8q6-8 8 0v18M20 9c12-9 13 14 0 20M20 18l9 9',
    libra: 'M4 26h24M4 20h7a8 8 0 1 1 10 0h7',
    scorpio: 'M4 25V8q5-8 8 0v17M12 8q6-8 8 0v14q0 7 8 3M25 22l4 3-3 4',
    sagittarius: 'M6 27 27 6M16 6h11v11M7 15l10 10',
    capricorn: 'M3 8q5-8 8 0v14M11 8c3-9 9-5 6 5s6 18 12 9c4-8-6-11-10-4',
    aquarius: 'M3 12l4-4 5 7 5-7 5 7 7-7M3 22l4-4 5 7 5-7 5 7 7-7',
    pisces: 'M7 4q13 12 0 24M25 4q-13 12 0 24M3 16h26',
    conjunction: 'M19 22a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM17 17 28 6',
    sextile: 'M16 3v26M5 9l22 14M5 23 27 9',
    square: 'M6 6h20v20H6Z',
    trine: 'M16 4 29 27H3Z',
    opposition:
      'M13 23a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM29 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12 20 20 12',
    earth:
      'M28 16a12 12 0 1 1-24 0 12 12 0 0 1 24 0ZM4 16h24M16 4c-10 8-10 16 0 24 10-8 10-16 0-24Z',
    observer: 'M16 29V17M21 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM6 21q10-8 20 0',
    house: 'M4 16 16 5l12 11M7 14v14h18V14M13 28V18h6v10',
    star: 'm16 3 3 9 10 4-10 4-3 9-3-9-10-4 10-4Z',
    reference: 'M4 16h24M16 4v24M25 16a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    trail: 'M4 25c18 4 3-25 23-19M22 3l6 3-4 5',
    constellation: 'M5 22 11 9l11 5 6-9M5 21v2M10 8l2 2M21 13l2 2M27 4l2 2',
    layer: 'm3 11 13-7 13 7-13 7ZM3 17l13 7 13-7M3 23l13 7 13-7',
  };
  const key = $derived(name.replace(/^(body|sign|aspect):/, ''));
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 32 32"
  fill="none"
  stroke={color}
  stroke-width="1.65"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"><path d={paths[key] ?? paths.reference} /></svg
>
