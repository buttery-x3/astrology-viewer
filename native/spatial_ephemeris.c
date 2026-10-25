/* Owned narrow binding. Upstream Swiss Ephemeris remains unmodified. */
#include "swephexp.h"
#include "sweph.h"
#include "swephlib.h"
#include <string.h>
#include "leap-second-dates.h"

const char *sa_version(void) {
  static char version[256];
  return swe_version(version);
}

void sa_init(const char *path) {
  swe_set_ephe_path((char *)path);
  /* Explicitly lock the UTC conversion's documented DE431 default.
     Calculation calls must not silently change subsequent time conversions. */
  swe_set_tid_acc(SE_TIDAL_DE431);
}
void sa_close(void) { swe_close(); }

int sa_time(int year, int month, int day, int hour, int minute, double second,
            double *result, char *error) {
  int status = swe_utc_to_jd(year, month, day, hour, minute, second, SE_GREG_CAL, result, error);
  if (status < 0) return status;
  double midnight = swe_julday(year, month, day, 0, SE_GREG_CAL);
  int leap_count = 10, date = year * 10000 + month * 100 + day;
  for (int i = 0; i < SA_LEAP_COUNT; i++) if (date > sa_leap_dates[i]) leap_count++;
  /* Mirror the pinned upstream branch exactly, rather than infer it from rounded JDs.
     Extra runtime files are rejected by the JS adapter, so this generated table is authoritative. */
  result[2] = midnight < 2441317.5 ? 0
    : swe_deltat_ex(midnight, -1, NULL) * 86400.0 - leap_count - 32.184 >= 1.0 ? 2 : 1;
  return status;
}

int sa_body(double jd_tt, int body, int flags, double *result, char *error) {
  return swe_calc(jd_tt, body, flags, result, error);
}

int sa_houses(double jd_ut1, double latitude, double longitude, int system,
              double *cusps, double *angles, char *error) {
  double cusp_speed[13], angle_speed[10];
  return swe_houses_ex2(jd_ut1, 0, latitude, longitude, system,
                        cusps, angles, cusp_speed, angle_speed, error);
}

double sa_sidereal(double jd_ut1) { return swe_sidtime(jd_ut1) * 15.0; }

double sa_delta_t(double jd_ut1) {
  char error[256] = {0};
  return swe_deltat_ex(jd_ut1, -1, error) * 86400.0;
}

void sa_horizon(double jd_ut1, double latitude, double longitude,
                double ra, double declination, double distance, double *result) {
  double place[3] = {longitude, latitude, 0};
  double direction[3] = {ra, declination, distance};
  /* result[1] is geometric altitude; result[2] includes refraction and is unused. */
  swe_azalt(jd_ut1, SE_EQU2HOR, place, 0, 10, direction, result);
}

int sa_frame(double jd_tt, double *matrix, char *error) {
  double position[6];
  /* A real equatorial calculation initialises the engine's true-date nutation matrix. */
  int status = swe_calc(jd_tt, SE_SUN, SEFLG_SWIEPH | SEFLG_EQUATORIAL, position, error);
  if (status < 0 || (status & 7) != SEFLG_SWIEPH) return -1;
  for (int column = 0; column < 3; column++) {
    double basis[6] = {0, 0, 0, 0, 0, 0};
    basis[column] = 1;
    swi_nutate(basis, 0, TRUE);
    swi_precess(basis, jd_tt, 0, J_TO_J2000);
    for (int row = 0; row < 3; row++) matrix[row * 3 + column] = basis[row];
  }
  return status;
}

const char *sa_file(int index, double *range) {
  int denum = 0;
  const char *path = swe_get_current_file_data(index, &range[0], &range[1], &denum);
  range[2] = denum;
  return path ? path : "";
}
