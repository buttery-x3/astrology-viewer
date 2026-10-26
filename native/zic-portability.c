/* Build-only Node/WASM portability for the unmodified IANA zic compiler.
 * Emscripten's linkat stub returns EMLINK, which zic treats as fatal. Report the
 * correct unsupported-operation result so zic uses its own byte-copy fallback.
 * Copy aliases on every host rather than requiring OS symlink privileges.
 */
#include <errno.h>

int sa_tz_linkat(int olddir, const char *oldpath, int newdir, const char *newpath, int flags) {
  (void)olddir; (void)oldpath; (void)newdir; (void)newpath; (void)flags;
  errno = ENOTSUP;
  return -1;
}

int sa_tz_symlink(const char *target, const char *linkname) {
  (void)target; (void)linkname;
  errno = ENOTSUP;
  return -1;
}
