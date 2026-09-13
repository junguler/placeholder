```javascript
// m3u-metadata-embedder.js
//
// Vanilla Node.js M3U metadata embedder.
// No npm packages or external dependencies.
//
// Usage:
//
//   node ./m3u-metadata-embedder.js
//
//   node ./m3u-metadata-embedder.js input_folder/ output_folder/
//
//   node ./m3u-metadata-embedder.js input_folder/ output_folder/ --quiet
//
// Optional flags:
//
//   --concurrency=10
//   --timeout=24000
//   --no-retry
//   --no-dedupe
//
// Example:
//
//   node ./m3u-metadata-embedder.js m3u-files m3u-embedded
//
// Requires Node.js 18+ for native fetch.


const fs = require('fs/promises');
const path = require('path');


/* ============================================================
   DEFAULT SETTINGS
   ============================================================ */

const DEFAULT_CONCURRENCY = 10;
const DEFAULT_TIMEOUT = 24000;
const DEFAULT_RETRY = true;
const DEFAULT_DEDUPE = true;


/*
 * Maximum amount of stream data examined when sniffing.
 *
 * 128 KiB is the same limit used by the browser version.
 */
const MAX_SNIFF_BYTES = 131072;


/* ============================================================
   ARGUMENTS
   ============================================================ */

let quiet = false;
let concurrency = DEFAULT_CONCURRENCY;
let timeout = DEFAULT_TIMEOUT;
let retry = DEFAULT_RETRY;
let dedupe = DEFAULT_DEDUPE;

const positionalArgs = [];

for (const arg of process.argv.slice(2)) {

    if (arg === '--quiet') {
        quiet = true;
        continue;
    }

    if (arg === '--no-retry') {
        retry = false;
        continue;
    }

    if (arg === '--no-dedupe') {
        dedupe = false;
        continue;
    }

    if (arg.startsWith('--concurrency=')) {

        const value =
            parseInt(
                arg.substring('--concurrency='.length),
                10
            );

        if (!Number.isNaN(value)) {
            concurrency =
                Math.max(
                    1,
                    Math.min(50, value)
                );
        }

        continue;
    }

    if (arg.startsWith('--timeout=')) {

        const value =
            parseInt(
                arg.substring('--timeout='.length),
                10
            );

        if (!Number.isNaN(value)) {
            timeout =
                Math.max(
                    1000,
                    Math.min(120000, value)
                );
        }

        continue;
    }

    positionalArgs.push(arg);
}


const inputDirectory =
    positionalArgs[0] || 'm3u-files';

const outputDirectory =
    positionalArgs[1] || 'm3u-embedded';


/* ============================================================
   CONTENT TYPE / FORMAT HELPERS
   ============================================================ */

const CONTENT_TYPE_TO_EXT = {

    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',

    'audio/aac': 'aac',
    'audio/aacp': 'aac',
    'audio/x-aac': 'aac',

    'audio/ogg': 'ogg',
    'application/ogg': 'ogg',

    'audio/opus': 'opus',

    'audio/flac': 'flac',
    'audio/x-flac': 'flac',

    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',

    'audio/webm': 'webm',

    'video/mp2t': 'ts',

    'application/vnd.apple.mpegurl': 'm3u8',
    'audio/x-mpegurl': 'm3u8',
    'audio/mpegurl': 'm3u8',

    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a'
};


function extFromContentType(contentType) {

    if (!contentType) {
        return null;
    }

    const clean =
        contentType
            .toLowerCase()
            .split(';')[0]
            .trim();

    return CONTENT_TYPE_TO_EXT[clean] || null;
}


function bitrateFromHeaders(headers) {

    const icyBr =
        headers.get('icy-br');

    if (icyBr) {

        const n =
            parseInt(icyBr, 10);

        if (
            !Number.isNaN(n) &&
            n > 0
        ) {
            return n;
        }
    }


    const audioInfo =
        headers.get('ice-audio-info');

    if (audioInfo) {

        const match =
            audioInfo.match(
                /bitrate=(\d+)/i
            );

        if (match) {

            const n =
                parseInt(
                    match[1],
                    10
                );

            if (
                !Number.isNaN(n) &&
                n > 0
            ) {
                return n;
            }
        }
    }


    return null;
}


/* ============================================================
   MP3
   ============================================================ */

const MPEG_BITRATE_TABLES = {

    '3_3':
        [
            0, 32, 64, 96,
            128, 160, 192, 224,
            256, 288, 320, 352,
            384, 416, 448
        ],

    '3_2':
        [
            0, 32, 48, 56,
            64, 80, 96, 112,
            128, 160, 192, 224,
            256, 320, 384
        ],

    '3_1':
        [
            0, 32, 40, 48,
            56, 64, 80, 96,
            112, 128, 160, 192,
            224, 256, 320
        ],

    '2_3':
        [
            0, 32, 48, 56,
            64, 80, 96, 112,
            128, 144, 160, 176,
            192, 224, 256
        ],

    '2_2':
        [
            0, 8, 16, 24,
            32, 40, 48, 56,
            64, 80, 96, 112,
            128, 144, 160
        ],

    '2_1':
        [
            0, 8, 16, 24,
            32, 40, 48, 56,
            64, 80, 96, 112,
            128, 144, 160
        ]
};


function findMp3Bitrate(bytes) {

    for (
        let i = 0;
        i < bytes.length - 4;
        i++
    ) {

        if (
            bytes[i] === 0xFF &&
            (bytes[i + 1] & 0xE0) === 0xE0
        ) {

            const versionBits =
                (bytes[i + 1] >> 3) & 0x3;

            const layerBits =
                (bytes[i + 1] >> 1) & 0x3;

            if (
                versionBits === 1 ||
                layerBits === 0
            ) {
                continue;
            }


            const bitrateIndex =
                (bytes[i + 2] >> 4) & 0xF;

            const sampleRateIndex =
                (bytes[i + 2] >> 2) & 0x3;


            if (
                bitrateIndex === 0 ||
                bitrateIndex === 15 ||
                sampleRateIndex === 3
            ) {
                continue;
            }


            const versionGroup =
                versionBits === 3
                    ? '3'
                    : '2';


            const table =
                MPEG_BITRATE_TABLES[
                    `${versionGroup}_${layerBits}`
                ];


            if (!table) {
                continue;
            }


            const bitrate =
                table[bitrateIndex];


            if (bitrate) {
                return bitrate;
            }
        }
    }


    return null;
}


/* ============================================================
   AAC
   ============================================================ */

const AAC_SAMPLE_RATES = [

    96000,
    88200,
    64000,
    48000,
    44100,
    32000,
    24000,
    22050,
    16000,
    12000,
    11025,
    8000,
    7350
];


function findAacBitrate(bytes) {

    for (
        let i = 0;
        i < bytes.length - 6;
        i++
    ) {

        if (
            bytes[i] === 0xFF &&
            (bytes[i + 1] & 0xF0) === 0xF0
        ) {

            const sampleRateIndex =
                (bytes[i + 2] >> 2) & 0xF;


            if (
                sampleRateIndex >=
                AAC_SAMPLE_RATES.length
            ) {
                continue;
            }


            const sampleRate =
                AAC_SAMPLE_RATES[
                    sampleRateIndex
                ];


            const frameLength =
                (
                    ((bytes[i + 3] & 0x3) << 11) |
                    (bytes[i + 4] << 3) |
                    ((bytes[i + 5] >> 5) & 0x7)
                );


            if (
                frameLength < 7 ||
                frameLength > 4096
            ) {
                continue;
            }


            const bitrate =
                Math.round(
                    (
                        frameLength *
                        8 *
                        sampleRate
                    ) /
                    1024 /
                    1000
                );


            if (
                bitrate > 0 &&
                bitrate < 1000
            ) {
                return bitrate;
            }
        }
    }


    return null;
}


/* ============================================================
   OGG / VORBIS / OPUS
   ============================================================ */

function findOggInfo(bytes) {

    for (
        let i = 0;
        i < bytes.length - 27;
        i++
    ) {

        if (
            bytes[i] === 0x4F &&
            bytes[i + 1] === 0x67 &&
            bytes[i + 2] === 0x67 &&
            bytes[i + 3] === 0x53
        ) {

            const pageSegments =
                bytes[i + 26];


            const segStart =
                i + 27;


            if (
                segStart + pageSegments >
                bytes.length
            ) {
                return null;
            }


            let firstPacketLen = 0;


            for (
                let s = 0;
                s < pageSegments;
                s++
            ) {

                firstPacketLen +=
                    bytes[segStart + s];


                if (
                    bytes[segStart + s] < 255
                ) {
                    break;
                }
            }


            const dataStart =
                segStart + pageSegments;


            if (
                dataStart + firstPacketLen >
                bytes.length
            ) {
                return null;
            }


            const packet =
                bytes.subarray(
                    dataStart,
                    dataStart + firstPacketLen
                );


            /*
             * Vorbis identification header.
             */
            if (
                packet.length >= 30 &&
                packet[0] === 0x01 &&
                packet[1] === 0x76 &&
                packet[2] === 0x6F &&
                packet[3] === 0x72 &&
                packet[4] === 0x62 &&
                packet[5] === 0x69 &&
                packet[6] === 0x73
            ) {

                const view =
                    new DataView(
                        packet.buffer,
                        packet.byteOffset,
                        packet.byteLength
                    );


                const bitrateMax =
                    view.getInt32(
                        16,
                        true
                    );


                const bitrateNominal =
                    view.getInt32(
                        20,
                        true
                    );


                const bitrateMin =
                    view.getInt32(
                        24,
                        true
                    );


                let kbps = null;


                if (bitrateNominal > 0) {

                    kbps =
                        Math.round(
                            bitrateNominal / 1000
                        );

                } else if (bitrateMax > 0) {

                    kbps =
                        Math.round(
                            bitrateMax / 1000
                        );

                } else if (bitrateMin > 0) {

                    kbps =
                        Math.round(
                            bitrateMin / 1000
                        );
                }


                return {
                    ext: 'ogg',
                    bitrate: kbps
                };
            }


            /*
             * Opus identification header.
             */
            if (
                packet.length >= 8 &&
                packet[0] === 0x4F &&
                packet[1] === 0x70 &&
                packet[2] === 0x75 &&
                packet[3] === 0x73 &&
                packet[4] === 0x48 &&
                packet[5] === 0x65 &&
                packet[6] === 0x61 &&
                packet[7] === 0x64
            ) {

                return {
                    ext: 'opus',
                    bitrate: null
                };
            }


            return {
                ext: 'ogg',
                bitrate: null
            };
        }
    }


    return null;
}


/* ============================================================
   WAV
   ============================================================ */

function findWavBitrate(bytes) {

    if (bytes.length < 12) {
        return null;
    }


    if (
        !(
            bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46
        )
    ) {
        return null;
    }


    if (
        !(
            bytes[8] === 0x57 &&
            bytes[9] === 0x41 &&
            bytes[10] === 0x56 &&
            bytes[11] === 0x45
        )
    ) {
        return null;
    }


    let pos = 12;


    while (
        pos + 8 <= bytes.length
    ) {

        const id =
            String.fromCharCode(
                bytes[pos],
                bytes[pos + 1],
                bytes[pos + 2],
                bytes[pos + 3]
            );


        const size =
            (
                bytes[pos + 4] |
                (bytes[pos + 5] << 8) |
                (bytes[pos + 6] << 16) |
                (bytes[pos + 7] << 24)
            );


        if (id === 'fmt ') {

            if (
                pos + 8 + 16 >
                bytes.length
            ) {
                return null;
            }


            const byteRate =
                (
                    bytes[pos + 16] |
                    (bytes[pos + 17] << 8) |
                    (bytes[pos + 18] << 16) |
                    (bytes[pos + 19] << 24)
                );


            return byteRate > 0
                ? Math.round(
                    (byteRate * 8) / 1000
                )
                : null;
        }


        pos +=
            8 +
            size +
            (size % 2);
    }


    return null;
}


/* ============================================================
   FLAC
   ============================================================ */

function findFlacBitrate(bytes) {

    if (bytes.length < 42) {
        return null;
    }


    if (
        !(
            bytes[0] === 0x66 &&
            bytes[1] === 0x4C &&
            bytes[2] === 0x61 &&
            bytes[3] === 0x43
        )
    ) {
        return null;
    }


    const blockType =
        bytes[4] & 0x7F;


    if (blockType !== 0) {
        return null;
    }


    const d = 8;


    const minBlock =
        (bytes[d] << 8) |
        bytes[d + 1];


    const maxBlock =
        (bytes[d + 2] << 8) |
        bytes[d + 3];


    const minFrame =
        (bytes[d + 4] << 16) |
        (bytes[d + 5] << 8) |
        bytes[d + 6];


    const maxFrame =
        (bytes[d + 7] << 16) |
        (bytes[d + 8] << 8) |
        bytes[d + 9];


    const sampleRate =
        (bytes[d + 10] << 12) |
        (bytes[d + 11] << 4) |
        (bytes[d + 12] >> 4);


    const blockSize =
        maxBlock || minBlock;


    const frameSize =
        maxFrame || minFrame;


    if (
        blockSize &&
        frameSize &&
        sampleRate
    ) {

        const kbps =
            Math.round(
                (
                    frameSize *
                    8 *
                    sampleRate
                ) /
                blockSize /
                1000
            );


        if (
            kbps > 0 &&
            kbps < 8000
        ) {
            return kbps;
        }
    }


    return null;
}


/* ============================================================
   MP4 / M4A
   ============================================================ */

function readMp4DescriptorLength(
    bytes,
    pos
) {

    let length = 0;
    let bytesRead = 0;
    let b;


    do {

        b =
            bytes[pos + bytesRead];


        length =
            (length << 7) |
            (b & 0x7F);


        bytesRead++;

    } while (
        (b & 0x80) !== 0 &&
        bytesRead < 4
    );


    return {
        length,
        bytesRead
    };
}


function findEsdsBitrate(bytes) {

    try {

        for (
            let i = 0;
            i < bytes.length - 4;
            i++
        ) {

            if (
                bytes[i] === 0x65 &&
                bytes[i + 1] === 0x73 &&
                bytes[i + 2] === 0x64 &&
                bytes[i + 3] === 0x73
            ) {

                let pos =
                    i + 4 + 4;


                if (
                    bytes[pos] !== 0x03
                ) {
                    continue;
                }


                pos++;


                let len =
                    readMp4DescriptorLength(
                        bytes,
                        pos
                    );


                pos +=
                    len.bytesRead + 2;


                const flags =
                    bytes[pos];


                pos++;


                if (flags & 0x80) {
                    pos += 2;
                }


                if (flags & 0x40) {

                    const urlLen =
                        bytes[pos];

                    pos +=
                        1 + urlLen;
                }


                if (flags & 0x20) {
                    pos += 2;
                }


                if (
                    bytes[pos] !== 0x04
                ) {
                    continue;
                }


                pos++;


                len =
                    readMp4DescriptorLength(
                        bytes,
                        pos
                    );


                pos +=
                    len.bytesRead;


                pos +=
                    1 + 1 + 3;


                if (
                    pos + 8 >
                    bytes.length
                ) {
                    return null;
                }


                const maxBitrate =
                    (
                        (
                            bytes[pos] << 24
                        ) |
                        (
                            bytes[pos + 1] << 16
                        ) |
                        (
                            bytes[pos + 2] << 8
                        ) |
                        bytes[pos + 3]
                    ) >>> 0;


                const avgBitrate =
                    (
                        (
                            bytes[pos + 4] << 24
                        ) |
                        (
                            bytes[pos + 5] << 16
                        ) |
                        (
                            bytes[pos + 6] << 8
                        ) |
                        bytes[pos + 7]
                    ) >>> 0;


                const kbps =
                    avgBitrate
                        ? Math.round(
                            avgBitrate / 1000
                        )
                        : (
                            maxBitrate
                                ? Math.round(
                                    maxBitrate / 1000
                                )
                                : null
                        );


                if (
                    kbps > 0 &&
                    kbps < 2000
                ) {
                    return kbps;
                }
            }
        }

    } catch (error) {

        /*
         * Partial or malformed MP4 data.
         */
    }


    return null;
}


/* ============================================================
   FORMAT SNIFFING
   ============================================================ */

function sniffFormatFromBytes(bytes) {

    if (bytes.length < 4) {
        return null;
    }


    /*
     * OGG
     */
    if (
        bytes[0] === 0x4F &&
        bytes[1] === 0x67 &&
        bytes[2] === 0x67 &&
        bytes[3] === 0x53
    ) {
        return 'ogg';
    }


    /*
     * WAV
     */
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x41 &&
        bytes[10] === 0x56 &&
        bytes[11] === 0x45
    ) {
        return 'wav';
    }


    /*
     * FLAC
     */
    if (
        bytes[0] === 0x66 &&
        bytes[1] === 0x4C &&
        bytes[2] === 0x61 &&
        bytes[3] === 0x43
    ) {
        return 'flac';
    }


    /*
     * MP3
     */
    if (
        bytes[0] === 0xFF &&
        (bytes[1] & 0xE0) === 0xE0
    ) {
        return 'mp3';
    }


    /*
     * AAC / ADTS
     */
    if (
        bytes[0] === 0xFF &&
        (bytes[1] & 0xF0) === 0xF0
    ) {
        return 'aac';
    }


    /*
     * WebM / Matroska.
     */
    if (
        bytes[0] === 0x1A &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xDF &&
        bytes[3] === 0xA3
    ) {
        return 'webm';
    }


    /*
     * MP4 / M4A.
     */
    if (bytes.length >= 8) {

        const boxType =
            String.fromCharCode(
                bytes[4],
                bytes[5],
                bytes[6],
                bytes[7]
            );


        if (
            [
                'ftyp',
                'moov',
                'free',
                'moof',
                'mdat',
                'styp',
                'skip',
                'wide'
            ].includes(boxType)
        ) {
            return 'm4a';
        }
    }


    return null;
}


/* ============================================================
   STREAM SNIFFING
   ============================================================ */

async function sniffAudioStream(
    body,
    knownExt
) {

    const reader =
        body.getReader();


    let buf =
        new Uint8Array(0);


    let ext =
        knownExt || null;


    let bitrate =
        null;


    try {

        while (
            buf.length <
            MAX_SNIFF_BYTES
        ) {

            const {
                done,
                value
            } =
                await reader.read();


            if (
                done ||
                !value
            ) {
                break;
            }


            const combined =
                new Uint8Array(
                    buf.length +
                    value.length
                );


            combined.set(
                buf,
                0
            );


            combined.set(
                value,
                buf.length
            );


            buf =
                combined;


            /*
             * If Content-Type did not tell us
             * what the stream is, sniff it.
             */
            if (!ext) {

                ext =
                    sniffFormatFromBytes(
                        buf
                    );
            }


            switch (ext) {

                case 'mp3':

                    bitrate =
                        findMp3Bitrate(
                            buf
                        );

                    break;


                case 'aac':

                    bitrate =
                        findAacBitrate(
                            buf
                        );

                    break;


                case 'wav':

                    bitrate =
                        findWavBitrate(
                            buf
                        );

                    break;


                case 'flac':

                    bitrate =
                        findFlacBitrate(
                            buf
                        );

                    break;


                case 'm4a':

                    bitrate =
                        findEsdsBitrate(
                            buf
                        );

                    break;


                case 'ogg': {

                    const info =
                        findOggInfo(
                            buf
                        );


                    if (info) {

                        ext =
                            info.ext;

                        bitrate =
                            info.bitrate;
                    }

                    break;
                }


                default:
                    break;
            }


            /*
             * Once we have enough information,
             * immediately stop reading the stream.
             *
             * This is particularly important for
             * live radio streams.
             */
            if (
                bitrate ||
                ext === 'webm' ||
                ext === 'opus' ||
                ext === 'ts' ||
                ext === 'm3u8'
            ) {
                break;
            }
        }

    } catch (error) {

        /*
         * Keep whatever metadata we managed to detect.
         */

    } finally {

        /*
         * Cancel the stream so Node does not keep
         * a live radio connection open.
         */
        try {
            await reader.cancel();
        } catch (error) {
            /* Ignore cancellation errors. */
        }
    }


    return {
        ext,
        bitrate
    };
}


/* ============================================================
   METADATA ATTEMPT
   ============================================================ */

async function attemptMetadata(
    url,
    timeoutMs
) {

    const controller =
        new AbortController();


    const timeoutId =
        setTimeout(
            () => controller.abort(),
            timeoutMs
        );


    try {

        const response =
            await fetch(
                url,
                {
                    method: 'GET',
                    signal: controller.signal,
                    cache: 'no-store',
                    redirect: 'follow'
                }
            );


        if (!response.ok) {

            return {
                ok: false,
                status: response.status,
                ext: null,
                bitrate: null
            };
        }


        let ext =
            extFromContentType(
                response.headers.get(
                    'content-type'
                )
            );


        let bitrate =
            bitrateFromHeaders(
                response.headers
            );


        /*
         * Headers are preferable because they don't
         * require downloading stream data.
         *
         * If we don't have enough information,
         * inspect the beginning of the body.
         */
        if (
            !bitrate &&
            response.body
        ) {

            const sniffed =
                await sniffAudioStream(
                    response.body,
                    ext
                );


            if (!ext) {
                ext =
                    sniffed.ext;
            }


            if (!bitrate) {
                bitrate =
                    sniffed.bitrate;
            }
        }


        /*
         * A successful response is reachable even
         * when no recognizable metadata was found.
         */
        return {
            ok: true,
            status: response.status,
            ext,
            bitrate
        };

    } catch (error) {

        if (
            error &&
            error.name === 'AbortError'
        ) {

            return {
                ok: false,
                status: 'timeout',
                ext: null,
                bitrate: null
            };
        }


        return {
            ok: false,
            status: 'network-error',
            ext: null,
            bitrate: null
        };

    } finally {

        clearTimeout(timeoutId);
    }
}


/* ============================================================
   URL CHECK
   ============================================================ */

async function checkUrl(
    url
) {

    let result =
        await attemptMetadata(
            url,
            timeout
        );


    /*
     * If metadata was successfully detected,
     * no retry is necessary.
     */
    if (
        result.ok &&
        (
            result.ext ||
            result.bitrate
        )
    ) {
        return result;
    }


    /*
     * A successful response with no metadata is
     * still a reachable stream.
     *
     * Retry once if enabled because some servers
     * occasionally return incomplete headers/data
     * on the first connection.
     */
    if (
        result.ok &&
        !result.ext &&
        !result.bitrate
    ) {

        if (retry) {

            await sleep(400);


            const retryResult =
                await attemptMetadata(
                    url,
                    timeout
                );


            if (
                retryResult.ok &&
                (
                    retryResult.ext ||
                    retryResult.bitrate
                )
            ) {
                return retryResult;
            }


            if (retryResult.ok) {
                return retryResult;
            }
        }


        return result;
    }


    /*
     * Retry failed network/HTTP attempts.
     */
    if (retry) {

        await sleep(400);


        result =
            await attemptMetadata(
                url,
                timeout
            );
    }


    return result;
}


/* ============================================================
   SLEEP
   ============================================================ */

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


/* ============================================================
   M3U PARSER
   ============================================================ */

function parseM3UContent(
    m3uContent
) {

    const originalLines =
        m3uContent.split('\n');


    const linksToProcess = [];


    let currentTitle = '';
    let currentTitleLineIndex = -1;


    for (
        let i = 0;
        i < originalLines.length;
        i++
    ) {

        const line =
            originalLines[i].trim();


        if (
            line.startsWith('#EXTINF')
        ) {

            currentTitle =
                line;


            currentTitleLineIndex =
                i;

        } else if (
            line.startsWith('http://') ||
            line.startsWith('https://')
        ) {

            linksToProcess.push({

                title:
                    currentTitle,

                url:
                    line,

                originalIndex:
                    i,

                originalTitleLineIndex:
                    currentTitleLineIndex
            });


            currentTitle = '';
            currentTitleLineIndex = -1;
        }
    }


    return linksToProcess;
}


/* ============================================================
   EMBED METADATA
   ============================================================ */

function embedMetadata(
    titleLine,
    ext,
    bitrate
) {

    /*
     * Remove metadata previously generated by this
     * tool so running the tool multiple times does
     * not create:
     *
     * Station - mp3 - 128kb - mp3 - 128kb
     */
    let cleanTitle =
        titleLine.replace(
            /\s+-\s+(?:mp3|aac|ogg|opus|wav|flac|webm|ts|m3u8|m4a)(?:\s+-\s+\d+kb)?$/i,
            ''
        );


    cleanTitle =
        cleanTitle.replace(
            /\s+-\s+\d+kb$/i,
            ''
        );


    let suffix = '';


    if (
        ext &&
        bitrate
    ) {

        suffix =
            ` - ${ext} - ${bitrate}kb`;

    } else if (ext) {

        suffix =
            ` - ${ext}`;

    } else if (bitrate) {

        suffix =
            ` - ${bitrate}kb`;
    }


    return (
        cleanTitle +
        suffix
    );
}


/* ============================================================
   RESULT DESCRIPTION
   ============================================================ */

function describeResult(
    result
) {

    if (!result) {
        return 'unknown';
    }


    if (
        result.status === 'timeout'
    ) {
        return 'timed out';
    }


    if (
        result.status === 'network-error'
    ) {
        return 'network error';
    }


    if (
        typeof result.status === 'number'
    ) {
        return `HTTP ${result.status}`;
    }


    if (
        result.ok &&
        !result.ext &&
        !result.bitrate
    ) {
        return 'reachable, but no recognizable metadata';
    }


    return String(
        result.status || 'unknown'
    );
}


/* ============================================================
   SINGLE LINK
   ============================================================ */

async function checkSingleLink(
    item,
    fileName,
    resultCache
) {

    let result;


    /*
     * Duplicate URL optimization.
     */
    if (
        dedupe &&
        resultCache.has(item.url)
    ) {

        result =
            resultCache.get(
                item.url
            );

    } else {

        result =
            await checkUrl(
                item.url
            );


        if (dedupe) {

            resultCache.set(
                item.url,
                result
            );
        }
    }


    return {
        url: item.url,
        ...result
    };
}


/* ============================================================
   PROCESS LINKS
   ============================================================ */

async function processLinks(
    linksToProcess,
    fileName,
    quiet = false
) {

    const tempMetadata =
        new Map();


    const resultCache =
        new Map();


    const activePromises =
        new Set();


    let linksProcessedCount = 0;


    let metadataFoundCount = 0;


    for (
        let i = 0;
        i < linksToProcess.length;
        i++
    ) {

        const item =
            linksToProcess[i];


        const promise =
            checkSingleLink(
                item,
                fileName,
                resultCache
            )
            .then(result => {

                if (
                    result &&
                    result.ok &&
                    (
                        result.ext ||
                        result.bitrate
                    )
                ) {

                    tempMetadata.set(
                        item.originalTitleLineIndex,
                        {
                            ext:
                                result.ext,

                            bitrate:
                                result.bitrate
                        }
                    );


                    metadataFoundCount++;
                }


                linksProcessedCount++;


                if (!quiet) {

                    const title =
                        item.title
                            ? item.title
                                .replace(
                                    /^#EXTINF.*?,/,
                                    ''
                                )
                                .trim()
                            : '(no title)';


                    let metadata =
                        'no metadata';


                    if (
                        result.ext ||
                        result.bitrate
                    ) {

                        const parts = [];


                        if (result.ext) {
                            parts.push(
                                result.ext
                            );
                        }


                        if (result.bitrate) {
                            parts.push(
                                `${result.bitrate}kb`
                            );
                        }


                        metadata =
                            parts.join(
                                ' - '
                            );
                    }


                    console.log(
                        `  [${fileName}] ` +
                        `[${linksProcessedCount}/${linksToProcess.length}] ` +
                        `${title} -> ${metadata}`
                    );


                    if (
                        !result.ok
                    ) {

                        console.log(
                            `    ${describeResult(result)}: ${item.url}`
                        );
                    }
                }


                activePromises.delete(
                    promise
                );


                return result;
            });


        activePromises.add(
            promise
        );


        if (
            activePromises.size >=
            concurrency
        ) {

            await Promise.race(
                Array.from(
                    activePromises
                )
            );
        }
    }


    await Promise.allSettled(
        Array.from(
            activePromises
        )
    );


    return {
        tempMetadata,
        metadataFoundCount
    };
}


/* ============================================================
   GENERATE OUTPUT M3U
   ============================================================ */

function generateOutputM3U(
    originalM3uContent,
    tempMetadata
) {

    const originalLines =
        originalM3uContent.split('\n');


    const outputLines = [];


    /*
     * Preserve the same basic behavior as the HTML
     * embedder: remove blank lines and guarantee
     * an #EXTM3U header.
     */
    for (
        let i = 0;
        i < originalLines.length;
        i++
    ) {

        const rawLine =
            originalLines[i];


        const line =
            rawLine.trim();


        if (
            line === ''
        ) {
            continue;
        }


        if (
            line.startsWith('#EXTINF') &&
            tempMetadata.has(i)
        ) {

            const {
                ext,
                bitrate
            } =
                tempMetadata.get(i);


            outputLines.push(
                embedMetadata(
                    line,
                    ext,
                    bitrate
                )
            );

        } else {

            outputLines.push(
                line
            );
        }
    }


    /*
     * Guarantee #EXTM3U as the first line.
     */
    if (
        !outputLines.length ||
        !outputLines[0]
            .startsWith('#EXTM3U')
    ) {

        outputLines.unshift(
            '#EXTM3U'
        );
    }


    return outputLines.join('\n');
}


/* ============================================================
   OUTPUT FILENAME
   ============================================================ */

function getOutputFileName(
    fileName
) {

    const ext =
        path.extname(fileName);


    const base =
        path.basename(
            fileName,
            ext
        );


    return (
        base +
        '_embedded' +
        ext
    );
}


/* ============================================================
   MAIN
   ============================================================ */

async function main(
    inputDir,
    outputDir,
    quiet = false
) {

    try {

        await fs.mkdir(
            outputDir,
            {
                recursive: true
            }
        );


        const files =
            await fs.readdir(
                inputDir
            );


        const m3uFiles =
            files.filter(
                file =>
                    file.endsWith('.m3u') ||
                    file.endsWith('.m3u8')
            );


        if (
            m3uFiles.length === 0
        ) {

            if (!quiet) {

                console.log(
                    `No .m3u or .m3u8 files found in "${inputDir}"`
                );
            }


            return;
        }


        if (!quiet) {

            console.log(
                `Found ${m3uFiles.length} M3U files to process.`
            );


            console.log(
                `Concurrency: ${concurrency}`
            );


            console.log(
                `Timeout: ${timeout} ms`
            );


            console.log(
                `Retry: ${retry ? 'yes' : 'no'}`
            );


            console.log(
                `Dedupe: ${dedupe ? 'yes' : 'no'}`
            );
        }


        for (
            const fileName of m3uFiles
        ) {

            if (!quiet) {

                console.log(
                    `\n--- Embedding "${fileName}" ---`
                );
            }


            const fullPath =
                path.join(
                    inputDir,
                    fileName
                );


            const originalM3uContent =
                await fs.readFile(
                    fullPath,
                    'utf8'
                );


            const linksToProcess =
                parseM3UContent(
                    originalM3uContent
                );


            if (!quiet) {

                console.log(
                    `  Found ${linksToProcess.length} stream links.`
                );
            }


            /*
             * No links.
             *
             * Still write the playlist because this
             * tool is an embedder rather than a checker.
             */
            if (
                linksToProcess.length === 0
            ) {

                const outputM3uContent =
                    generateOutputM3U(
                        originalM3uContent,
                        new Map()
                    );


                const outputPath =
                    path.join(
                        outputDir,
                        fileName
                    );


                await fs.writeFile(
                    outputPath,
                    outputM3uContent,
                    'utf8'
                );


                if (!quiet) {

                    console.log(
                        `  No stream links found. ` +
                        `Copied playlist to "${outputPath}".`
                    );
                }


                continue;
            }


            const {
                tempMetadata,
                metadataFoundCount
            } =
                await processLinks(
                    linksToProcess,
                    fileName,
                    quiet
                );


            /*
             * Generate playlist while preserving every
             * original stream.
             */
            const outputM3uContent =
                generateOutputM3U(
                    originalM3uContent,
                    tempMetadata
                );


            const outputPath =
                path.join(
                    outputDir,
                    getOutputFileName(
                        fileName
                    )
                );


            await fs.writeFile(
                outputPath,
                outputM3uContent,
                'utf8'
            );


            if (quiet) {

                console.log(
                    `${fileName} embedded - ` +
                    `${metadataFoundCount}/${linksToProcess.length} ` +
                    `streams had metadata`
                );

            } else {

                console.log(
                    `  Complete for "${fileName}". ` +
                    `Found metadata for ` +
                    `${metadataFoundCount}/${linksToProcess.length} streams.`
                );


                console.log(
                    `  Saved embedded playlist to "${outputPath}"`
                );
            }
        }


        if (!quiet) {

            console.log(
                '\n--- All M3U files processed ---'
            );
        }

    } catch (error) {

        console.error(
            'An error occurred:',
            error
        );


        process.exit(1);
    }
}


/* ============================================================
   START
   ============================================================ */

if (!quiet) {

    console.log(
        'Starting M3U Metadata Embedder...'
    );


    console.log(
        `Input Directory: ${inputDirectory}`
    );


    console.log(
        `Output Directory: ${outputDirectory}`
    );
}


main(
    inputDirectory,
    outputDirectory,
    quiet
);
```
