import { registerPlugin } from '@capacitor/core';

import type { ImageMarkerPlugin } from './definitions';

const ImageMarker = registerPlugin<ImageMarkerPlugin>('ImageMarker', {
  web: () => import('./web').then(m => new m.ImageMarkerWeb()),
});

export * from './definitions';
export { ImageMarker };
export default ImageMarker;
