/**
 * @file my_qrcode.h
 * @brief Header for the QR code generation library.
 * @author EdgeSecOps Team
 * @date 2026
 */

/**
 * The MIT License (MIT)
 *
 * This library is written and maintained by Richard Moore.
 * Major parts were derived from Project Nayuki's library.
 *
 * Copyright (c) 2017 Richard Moore     (https://github.com/ricmoo/QRCode)
 * Copyright (c) 2017 Project Nayuki    (https://www.nayuki.io/page/qr-code-generator-library)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 *  Special thanks to Nayuki (https://www.nayuki.io/) from which this library was
 *  heavily inspired and compared against.
 *
 *  See: https://github.com/nayuki/QR-Code-generator/tree/master/cpp
 */


#ifndef __QRCODE_H_
#define __QRCODE_H_

#ifndef __cplusplus
typedef unsigned char bool;
static const bool false = 0;
static const bool true = 1;
#endif

#include <stdint.h>


/** @brief QR Code Format Encoding: Numeric mode */
#define MODE_NUMERIC        0
/** @brief QR Code Format Encoding: Alphanumeric mode */
#define MODE_ALPHANUMERIC   1
/** @brief QR Code Format Encoding: Byte mode */
#define MODE_BYTE           2


/** @brief Error Correction Code Level: Low */
#define ECC_LOW            0
/** @brief Error Correction Code Level: Medium */
#define ECC_MEDIUM         1
/** @brief Error Correction Code Level: Quartile */
#define ECC_QUARTILE       2
/** @brief Error Correction Code Level: High */
#define ECC_HIGH           3


// If set to non-zero, this library can ONLY produce QR codes at that version
// This saves a lot of dynamic memory, as the codeword tables are skipped
#ifndef LOCK_VERSION
/** @brief Lock version to save memory (0 disables locking). */
#define LOCK_VERSION       0
#endif

/**
 * @brief Structure representing a QR Code configuration and data.
 */
typedef struct QRCode {
    uint8_t version; /**< @brief The QR code version (1 to 40) */
    uint8_t size;    /**< @brief The dimension of the QR code in modules */
    uint8_t ecc;     /**< @brief The error correction level used */
    uint8_t mode;    /**< @brief The encoding mode used */
    uint8_t mask;    /**< @brief The mask pattern used */
    uint8_t *modules; /**< @brief Pointer to the module (pixel) data buffer */
} QRCode;


#ifdef __cplusplus
extern "C"{
#endif  /* __cplusplus */


/**
 * @brief Gets the buffer size required for a given QR code version.
 * @param version The QR code version.
 * @return The required buffer size in bytes.
 */
uint16_t qrcode_getBufferSize(uint8_t version);

/**
 * @brief Initializes a QR code structure with text data.
 * @param qrcode Pointer to the QRCode structure to initialize.
 * @param modules Pointer to the memory buffer for the QR code modules.
 * @param version The QR code version.
 * @param ecc The error correction level.
 * @param data The null-terminated text string to encode.
 * @return 0 on success, or a negative error code.
 */
int8_t qrcode_initText(QRCode *qrcode, uint8_t *modules, uint8_t version, uint8_t ecc, const char *data);

/**
 * @brief Initializes a QR code structure with byte data.
 * @param qrcode Pointer to the QRCode structure to initialize.
 * @param modules Pointer to the memory buffer for the QR code modules.
 * @param version The QR code version.
 * @param ecc The error correction level.
 * @param data Pointer to the byte data to encode.
 * @param length The length of the byte data.
 * @return 0 on success, or a negative error code.
 */
int8_t qrcode_initBytes(QRCode *qrcode, uint8_t *modules, uint8_t version, uint8_t ecc, uint8_t *data, uint16_t length);

/**
 * @brief Gets the value of a specific module (pixel) in the QR code.
 * @param qrcode Pointer to the QRCode structure.
 * @param x The X coordinate of the module.
 * @param y The Y coordinate of the module.
 * @return True if the module is black, false if white.
 */
bool qrcode_getModule(QRCode *qrcode, uint8_t x, uint8_t y);



#ifdef __cplusplus
}
#endif  /* __cplusplus */


#endif  /* __QRCODE_H_ */