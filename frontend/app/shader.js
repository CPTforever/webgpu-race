
export async function check_gpu() {
  if (!("gpu" in navigator)) {
    alert(
        "WebGPU is not supported. Enable chrome://flags/#enable-unsafe-webgpu flag."
    );
    return false;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    alert("Failed to get GPU adapter.");
    return false; 
  }

  return true;
}

export async function run_shader(shader, shader_info) {
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

    let gpuBuffers = [];
    for (let i = 0; i < shader_info.buf_count; i++) {
        gpuBuffers.push(device.createBuffer({
            mappedAtCreation: true,
            size: arr.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC	
        }));
    
        const arrayBufferArray = gpuBuffers[i].getMappedRange();
        for (let i = 0; i < arr.byteLength; i++) {
            if (i % 4 == 0) {
                arr[i] = shader_info.race_val_strat === "Even" ? 2 : 1;
            }
            else {
                arr[i] = 0;
            }
        }
    
        new Uint8Array(arrayBufferArray).set(arr);

        gpuBuffers[i].unmap();
    }
    let layoutEntries = [];
    for (let i = 0; i < shader_info.buf_count; i++) {
        layoutEntries.push({
            binding: i,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
                type: "storage"
            }
        });
    }

    const bindGroupLayout = device.createBindGroupLayout({
        entries: layoutEntries
    });

    let bindGroupEntries = [];
    for (let i = 0; i < shader_info.buf_count; i++) {
        bindGroupEntries.push({
            binding: i,
            resource: {
                buffer: gpuBuffers[i],
            }
        })
    }

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: bindGroupEntries
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
    let readBuffers = [];
    for (let i = 0; i < shader_info.buf_count; i++) {
        readBuffers.push(device.createBuffer({
            size: arr.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        }));

        commandEncoder.copyBufferToBuffer(
            gpuBuffers[i] /* source buffer */,
            0 /* source offset */,
            readBuffers[i] /* destination buffer */,
            0 /* destination offset */,
            arr.byteLength /* size */
        );
    }

    const gpuCommands = commandEncoder.finish();
    device.queue.submit([gpuCommands]);

    let outputBuffers = [];
    for (let i = 0; i < shader_info.buf_count; i++) {
        await readBuffers[i].mapAsync(GPUMapMode.READ);

        const arrayBuffer = readBuffers[i].getMappedRange();

        outputBuffers.push(new Uint32Array(arrayBuffer).slice(0));
        readBuffers[i].unmap();
    }

    console.log(outputBuffers);

    return outputBuffers;
}
