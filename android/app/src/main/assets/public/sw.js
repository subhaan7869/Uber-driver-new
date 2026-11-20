/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-39895644'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "80347165cd5648b2cb60c0a8b3d5c2b9"
  }, {
    "url": "pwa-512x512.png",
    "revision": "fd337e547ab3ae9e559a305f162fd9e5"
  }, {
    "url": "pwa-192x192.png",
    "revision": "818a67e4a2def7f39880f88075cebbff"
  }, {
    "url": "index.html",
    "revision": "9ddcf253ecb5a6021b864c0c27cf5791"
  }, {
    "url": "icon.svg",
    "revision": "17a6631622048236903fa36b25201f3d"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "e154795e4083185d5902416aa28797eb"
  }, {
    "url": "sounds/start-trip.mp3",
    "revision": "a6eefef116a33cc882265b5014514f29"
  }, {
    "url": "sounds/online.mp3",
    "revision": "1037ec7171437c3db3b7ea5b40580ea2"
  }, {
    "url": "sounds/offline.mp3",
    "revision": "8440e4505625e2fbf0aebb3e86ba702b"
  }, {
    "url": "sounds/dispatch.mp3",
    "revision": "b9c3231baad34e6458ce0874b8581fa5"
  }, {
    "url": "sounds/accept.mp3",
    "revision": "f58a0959988e7d4418067186b5b23af6"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/maplibre-gl-worker-BZdkatZW.mjs",
    "revision": null
  }, {
    "url": "assets/index-HmdUEXKA.css",
    "revision": null
  }, {
    "url": "assets/index-DqLxs4Fe.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "e154795e4083185d5902416aa28797eb"
  }, {
    "url": "icon.svg",
    "revision": "17a6631622048236903fa36b25201f3d"
  }, {
    "url": "pwa-192x192.png",
    "revision": "818a67e4a2def7f39880f88075cebbff"
  }, {
    "url": "pwa-512x512.png",
    "revision": "fd337e547ab3ae9e559a305f162fd9e5"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "80347165cd5648b2cb60c0a8b3d5c2b9"
  }, {
    "url": "manifest.webmanifest",
    "revision": "54ca19b9e730d01989361cb6ceb2c84b"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/version\.json/]
  }));
  workbox.registerRoute(/\/version\.json(\?.*)?$/i, new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(/^https:\/\/tiles\.openfreemap\.org\/.*/i, new workbox.StaleWhileRevalidate({
    "cacheName": "openfreemap-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 500,
      maxAgeSeconds: 604800
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
