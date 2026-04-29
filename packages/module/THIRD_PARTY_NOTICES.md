# Third-Party Notices

## MozJPEG / libjpeg-turbo

The native JPEG WebAssembly codec included in this package is built from
MozJPEG 4.1.5, which is based on libjpeg-turbo and the Independent JPEG Group's
JPEG software.

This software is based in part on the work of the Independent JPEG Group.

libjpeg-turbo is covered by compatible BSD-style open source licenses: the IJG
License for code inherited from libjpeg, the Modified 3-clause BSD License for
libjpeg-turbo code and build system portions, and the zlib License for SIMD
extensions.

### Modified 3-Clause BSD License

Copyright (C)2009-2023 D. R. Commander. All Rights Reserved.
Copyright (C)2015 Viktor Szathmary. All Rights Reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
- Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
- Neither the name of the libjpeg-turbo Project nor the names of its
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS", AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### IJG License Notice

The authors make NO WARRANTY or representation, either express or implied, with
respect to this software, its quality, accuracy, merchantability, or fitness for
a particular purpose. This software is provided "AS IS", and you, its user,
assume the entire risk as to its quality and accuracy.

This software is copyright (C) 1991-2020, Thomas G. Lane, Guido Vollbeding. All
Rights Reserved except as specified below.

Permission is hereby granted to use, copy, modify, and distribute this software
or portions thereof for any purpose, without fee, subject to these conditions:

1. If any part of the source code for this software is distributed, then the IJG
   README file must be included, with its copyright and no-warranty notice
   unaltered; and any additions, deletions, or changes to the original files
   must be clearly indicated in accompanying documentation.
2. If only executable code is distributed, then the accompanying documentation
   must state that "this software is based in part on the work of the
   Independent JPEG Group".
3. Permission for use of this software is granted only if the user accepts full
   responsibility for any undesirable consequences; the authors accept NO
   LIABILITY for damages of any kind.

## ravif / rav1e / rav1d / avif-serialize / avif-parse

The native AVIF WebAssembly codec included in this package is built from ravif
0.13.0 for encoding, rav1d 1.1.0 for AV1 decoding, avif-serialize for AVIF
container serialization, and avif-parse 2.1.0 for AVIF container parsing.

ravif and avif-serialize are covered by the BSD 3-Clause License. rav1e and
rav1d are covered by the BSD 2-Clause License. avif-parse is covered by the
MPL 2.0 License.

### ravif BSD 3-Clause Notice

Copyright (c) 2020, Kornel
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the BSD 3-Clause License conditions
are met.

### avif-serialize BSD 3-Clause Notice

Copyright (c) 2020, Cloudflare, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the BSD 3-Clause License conditions
are met.

### rav1e BSD 2-Clause Notice

Copyright (c) 2017-2023, the rav1e contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the BSD 2-Clause License conditions
are met.

### rav1d BSD 2-Clause Notice

Copyright (c) 2023, the rav1d contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the BSD 2-Clause License conditions
are met.

### avif-parse MPL 2.0 Notice

avif-parse is made available under the Mozilla Public License 2.0. The MPL 2.0
license text is available at https://www.mozilla.org/MPL/2.0/.

THESE SOFTWARE COMPONENTS ARE PROVIDED BY THEIR COPYRIGHT HOLDERS AND
CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT
OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
IN ANY WAY OUT OF THE USE OF THESE SOFTWARE COMPONENTS, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

## png crate

The native PNG WebAssembly codec included in this package is built with the
Rust `png` crate 0.18.1.

The PNG WASM also statically links the Rust crates used by `png`:

| Component | Version | License |
|-----------|---------|---------|
| png | 0.18.1 | MIT OR Apache-2.0 |
| bitflags | 2.11.1 | MIT OR Apache-2.0 |
| crc32fast | 1.5.0 | MIT OR Apache-2.0 |
| fdeflate | 0.3.7 | MIT OR Apache-2.0 |
| flate2 | 1.1.9 | MIT OR Apache-2.0 |
| miniz_oxide | 0.8.9 | MIT OR Zlib OR Apache-2.0 |
| adler2 | 2.0.1 | 0BSD OR MIT OR Apache-2.0 |
| cfg-if | 1.0.4 | MIT OR Apache-2.0 |
| simd-adler32 | 0.3.9 | MIT |

The native AVIF WASM statically links Rust crates listed in
`native/avif/Cargo.lock`. Their license metadata was reviewed with
`cargo metadata --locked`; the linked set is composed of permissive MIT,
Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC0-1.0, Unlicense, NCSA, Unicode-3.0,
LLVM-exception, LGPL-2.1-or-later, and MPL-2.0 licensed crates. The MPL-2.0
component is `avif-parse` 2.1.0; its corresponding source is available from
the crates.io package for that exact version.

### Common Rust License Texts

Many Rust dependencies above are available under MIT OR Apache-2.0. The MIT
license text is included in this package's `LICENSE` file. The Apache License
2.0 text is available at https://www.apache.org/licenses/LICENSE-2.0.

The Mozilla Public License 2.0 text is available at
https://www.mozilla.org/MPL/2.0/.

The Unicode License v3 text is available at
https://www.unicode.org/license.txt.

## libwebp

The native WebP WebAssembly codec included in this package is built from
libwebp 1.6.0.

Copyright (c) 2010, Google Inc. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
- Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
- Neither the name of Google nor the names of its contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
