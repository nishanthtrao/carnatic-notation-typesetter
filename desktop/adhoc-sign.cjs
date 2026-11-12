/*
 * electron-builder "afterPack" hook.
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Apple Silicon Macs refuse to run apps whose code signature is broken
 * ("app is damaged"). Without a paid Apple Developer certificate we give the
 * app an ad-hoc signature so it runs (macOS still asks the user to confirm
 * the first launch). With a real certificate (CSC_LINK / CSC_NAME set),
 * electron-builder signs it properly and this hook does nothing.
 */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;
  const app = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app');
  console.log('  • ad-hoc signing', app);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
