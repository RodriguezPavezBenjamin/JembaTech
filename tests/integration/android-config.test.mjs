// Controles estáticos sin SDK/red. No sustituyen assembleDebug, lint ni un emulador.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('Android: wrapper compatible con Capacitor 8 y descarga con checksum oficial', () => {
  const wrapper = read('frontend/android/gradle/wrapper/gradle-wrapper.properties');
  assert.ok(wrapper.includes('distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-all.zip'));
  assert.match(wrapper, /^distributionSha256Sum=ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c$/m);
  assert.match(read('frontend/android/build.gradle'), /com\.android\.tools\.build:gradle:8\.13\.0/);
  assert.match(read('frontend/android/variables.gradle'), /compileSdkVersion = 36/);
  assert.match(read('frontend/android/app/capacitor.build.gradle'), /sourceCompatibility JavaVersion\.VERSION_21/);
});

test('Android: identificador propio consistente en Capacitor, actividad y test de dispositivo', () => {
  const id = 'cl.jembatech.cotizador';
  assert.ok(read('frontend/capacitor.config.ts').includes("appId: '" + id + "'"));
  const app = read('frontend/android/app/build.gradle');
  assert.ok(app.includes('applicationId "' + id + '"'));
  assert.ok(app.includes('namespace = "' + id + '"'));
  assert.ok(read('frontend/android/app/src/main/java/cl/jembatech/cotizador/MainActivity.java').includes('package ' + id + ';'));
  const deviceTest = read('frontend/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java');
  assert.ok(deviceTest.includes('assertEquals("' + id + '", appContext.getPackageName())'));
  assert.ok(!deviceTest.includes('"com.getcapacitor.app"'));
});

test('Android: ruta de recursos web y configuración local fuera de Git', () => {
  assert.ok(read('frontend/capacitor.config.ts').includes("webDir: 'dist/jemba-cotiza/browser'"));
  const ignored = read('frontend/android/.gitignore');
  for (const rule of ['*.apk', '*.aab', '.gradle/', 'build/', '.idea/', 'local.properties', 'app/src/main/assets/public']) {
    assert.ok(ignored.split(/\r?\n/).includes(rule), rule + ' debe permanecer fuera de Git.');
  }
});
