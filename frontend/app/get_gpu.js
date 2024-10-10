import platform from 'platform';

export default async function getGPUInfo() {
    // get platform info
    let osVendor = "";
    let osVersion = "";
    let isMobile = false; 
    if (navigator.userAgentData) {
      const highEntropyHints = ["platformVersion"]
      const userAgentData = await navigator.userAgentData.getHighEntropyValues(highEntropyHints);
      osVendor = userAgentData.platform;
      osVersion = userAgentData.platformVersion;
      isMobile = userAgentData.mobile;
    }
    const gpuAdapter = await navigator.gpu.requestAdapter();
    const adapterInfo = gpuAdapter.info;
    const gl = document.createElement('canvas').getContext('webgl');
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let glVendor = "";
    let glRenderer = "";
    if (gl && debugInfo) {
      glVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      glRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
	  };
    return {
      gpu: {
        webGPUVendor: adapterInfo.vendor,
        webGPUArchitecture: adapterInfo.architecture,
        webGPUDevice: adapterInfo.device,
        webGPUDescription: adapterInfo.description,
        glVendor: glVendor,
        glRenderer: glRenderer
      },
      browser: {
        vendor: platform.name,
        version: platform.version
      },
      os: {
        vendor: osVendor,
        version: osVersion,
        mobile: isMobile
      }
    };
}
  
