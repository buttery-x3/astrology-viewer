/* Reference-only native probe; Swiss Ephemeris source is compiled unchanged.
 * Unlike swetest's h/i fields, this deliberately supplies geocentric coordinates
 * to swe_azalt; swetest first requests SEFLG_TOPOCTR for its altitude columns. */
#include "swephexp.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
  if (argc != 11) return 2;
  double times[2], direction[6], horizontal[3];
  double place[3] = {atof(argv[9]), atof(argv[8]), 0};
  char error[256] = {0}, version[256] = {0};
  swe_set_ephe_path(argv[1]);
  swe_set_tid_acc(SE_TIDAL_DE431);
  if (swe_utc_to_jd(atoi(argv[2]), atoi(argv[3]), atoi(argv[4]), atoi(argv[5]), atoi(argv[6]), atof(argv[7]), SE_GREG_CAL, times, error) < 0) return 3;
  int flags = swe_calc(times[0], atoi(argv[10]), SEFLG_SWIEPH | SEFLG_EQUATORIAL | SEFLG_SPEED, direction, error);
  if ((flags & 7) != SEFLG_SWIEPH) return 4;
  swe_azalt(times[1], SE_EQU2HOR, place, 0, 10, direction, horizontal);
  printf("{\"version\":\"%s\",\"flags\":%d,\"tt\":%.17g,\"ut1\":%.17g,\"gast\":%.17g,\"ra\":%.17g,\"dec\":%.17g,\"altitude\":%.17g,\"azimuthSouthWest\":%.17g}\n",
    swe_version(version), flags, times[0], times[1], swe_sidtime(times[1]) * 15,
    direction[0], direction[1], horizontal[1], horizontal[0]);
  swe_close();
  return 0;
}
