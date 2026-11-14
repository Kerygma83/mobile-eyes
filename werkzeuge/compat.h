/* Ersatz für strlcpy/strlcat auf glibc < 2.38 (nur nativer Build im Container). */
#pragma once
#include <string.h>
#if defined(__GLIBC__) && !(__GLIBC__ > 2 || (__GLIBC__ == 2 && __GLIBC_MINOR__ >= 38))
static inline size_t strlcpy(char *dst, const char *src, size_t size)
{
	size_t len = strlen(src);
	if (size) {
		size_t n = len >= size ? size - 1 : len;
		memcpy(dst, src, n);
		dst[n] = '\0';
	}
	return len;
}
static inline size_t strlcat(char *dst, const char *src, size_t size)
{
	size_t dlen = strnlen(dst, size);
	if (dlen == size) return size + strlen(src);
	return dlen + strlcpy(dst + dlen, src, size - dlen);
}
#endif
