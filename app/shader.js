

export default async function run_shader(shader, shader_info) {
    console.log(shader, shader_info);
    if (!("gpu" in navigator)) {
        console.log(
            "WebGPU is not supported. Enable chrome://flags/#enable-unsafe-webgpu flag."
        );
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.log("Failed to get GPU adapter.");
      return;
    }
    const device = await adapter.requestDevice();

    let size = ((shader_info.workgroup_size * shader_info.workgroups * shader_info.locs_per_thread) + shader_info.constant_locs) * 4;
    const arr = new Uint8Array(size);

    const gpuBufferArray = device.createBuffer({
        mappedAtCreation: true,
        size: arr.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC	
    });

    const arrayBufferArray = gpuBufferArray.getMappedRange();
    for (let i = 0; i < arr.byteLength; i++) {
        if (i % 4 == 0) {
            arr[i] = shader_info.race_val_strat === "Odd" ? 1 : 2;
        }
        else {
            arr[i] = 0;
        }
    }

    new Uint8Array(arrayBufferArray).set(arr);
    gpuBufferArray.unmap();

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            }
        ]
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
            binding: 0,
            resource: {
                buffer: gpuBufferArray
            }
            }
        ]
    });
    
    const shaderModule = device.createShaderModule({
        code: shader
    });

    const computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        }),
        compute: {
            module: shaderModule,
            entryPoint: "main"
        }
    });

    const commandEncoder = device.createCommandEncoder();

    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(shader_info.workgroups >> 0);
    passEncoder.end();

    //await gpuBufferArray.mapAsync(GPUMapMode.READ);
    //const arrayBuffer = gpuReadBuffer.getMappedRange();
    //console.log(new Float32Array(arrayBuffer));
    const gpuReadBuffer = device.createBuffer({
        size: arr.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });

    commandEncoder.copyBufferToBuffer(
    gpuBufferArray /* source buffer */,
    0 /* source offset */,
    gpuReadBuffer /* destination buffer */,
    0 /* destination offset */,
    arr.byteLength /* size */
    );

    const gpuCommands = commandEncoder.finish();
    device.queue.submit([gpuCommands]);

    await gpuReadBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = gpuReadBuffer.getMappedRange();

    let array32 = new Uint32Array(arrayBuffer);

    return array32;
}
