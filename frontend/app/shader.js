
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
    const mem_arr = new Uint8Array(size);

    let init;
    if (shader_info.race_val_strat == "Even") {
      init = 2;
    } else {
      init = 1;
    }
    for (let i = 0; i < mem_arr.byteLength; i++) {
      if (i % 4 == 0) {
            mem_arr[i] =  init;
        }
        else {
            mem_arr[i] = 0;
        }
    }

    const unit_arr = new Uint8Array(shader_info.workgroup_size * shader_info.workgroups * shader_info.uninit_vars * 4);
    let index_size = shader_info.workgroup_size * shader_info.workgroups * 4 * shader_info.pattern_slots;
    let output_size = shader_info.workgroup_size * shader_info.workgroups * 4 * shader_info.pattern_slots * 2;

    const index_arr = new Uint8Array(index_size);
    const data_arr = new Uint8Array(256 * 4);
    const output_arr = new Uint8Array(output_size);

    for (let i = 0; i < index_arr.byteLength; i++) {
        if (i % 4 == 0) {
            index_arr[i] =  1;
        }
        else {
            index_arr[i] = 0;
        }
    }

    for (let i = 0; i < output_arr.byteLength; i++) {
        if (i % 4 == 0) {
            output_arr[i] =  0;
        }
        else {
            output_arr[i] = 0;
        }
    }

    let gpuBuffers = [];
    gpuBuffers.push(device.createBuffer({
        label: "memory",
        mappedAtCreation: true,
        size: mem_arr.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC	
    }));
    gpuBuffers.push(device.createBuffer({
        label: "uninitialized",
        mappedAtCreation: true,
        size: unit_arr.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC	
    }));
    gpuBuffers.push(device.createBuffer({
        label: "index",
        mappedAtCreation: true,
        size: index_arr.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC	
    }));
    gpuBuffers.push(device.createBuffer({
        label: "data",
        mappedAtCreation: true,
        size: data_arr.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC	
    }));
    gpuBuffers.push(device.createBuffer({
        label: "output",
        mappedAtCreation: true,
        size: output_arr.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC	
    }));

    let arr_list = [mem_arr, unit_arr, index_arr, data_arr, output_arr]
    for (let i = 0; i < gpuBuffers.length; i++) {
        const arrayBufferArray = gpuBuffers[i].getMappedRange();
        new Uint8Array(arrayBufferArray).set(arr_list[i]);
        gpuBuffers[i].unmap();
    }

    let layoutEntries = [];
    for (let i = 0; i < 5; i++) {
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
    for (let i = 0; i < arr_list.length; i++) {
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
    for (let i = 0; i < arr_list.length; i++) {
        readBuffers.push(device.createBuffer({
            size: arr_list[i].byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        }));

        commandEncoder.copyBufferToBuffer(
            gpuBuffers[i] /* source buffer */,
            0 /* source offset */,
            readBuffers[i] /* destination buffer */,
            0 /* destination offset */,
            arr_list[i].byteLength /* size */
        );
    }

    const gpuCommands = commandEncoder.finish();
    device.queue.submit([gpuCommands]);

    let outputBuffers = [];
    for (let i = 0; i < arr_list.length; i++) {
        await readBuffers[i].mapAsync(GPUMapMode.READ);

        const arrayBuffer = readBuffers[i].getMappedRange();

        outputBuffers.push(new Uint32Array(arrayBuffer).slice(0));
        readBuffers[i].unmap();
    }

    return outputBuffers;
}
