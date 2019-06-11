#include "sha1.h"

int sizeof_SHA1Context() {
    return sizeof(SHA1Context);
}

int sizeof_SHA1Hash() {
    return SHA1HashSize;
}
