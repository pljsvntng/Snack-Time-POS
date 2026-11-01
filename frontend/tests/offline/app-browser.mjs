// Native event mock for browser acceptance only. Not part of Android builds.
export const App={
 async addListener(name,callback){const handler=e=>callback(e.detail||{}),event='pos:test-native-'+name;window.addEventListener(event,handler);return {remove:async()=>window.removeEventListener(event,handler)};},
 async minimizeApp(){window.__testNativeMinimized=(window.__testNativeMinimized||0)+1;}
};
