#include <Arduino.h>
#include <HttpsOTAUpdate.h>

void setup() {
    HttpsOTA.begin("https://example.com/firmware.bin", NULL, true); // skip cert check for test
}
void loop() {}
