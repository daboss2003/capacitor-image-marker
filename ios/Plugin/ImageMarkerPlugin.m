#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(ImageMarkerPlugin, "ImageMarker",
           CAP_PLUGIN_METHOD(markText, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(markImage, CAPPluginReturnPromise);
)
