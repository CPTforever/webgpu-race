export default function analyze(safe_array, race_array, parameters, data_race_info, rep) {
    let mismatches = [];
    for (let const_index = 0; const_index < parameters.constant_locs; const_index+=1) {
        if (data_race_info.safe_constants.includes(const_index) && safe_array[const_index] != race_array[const_index]) {
            mismatches.push({
                rep: rep,
                thread: null,
                index: const_index,
                expected: safe_array[const_index],
                actual: race_array[const_index],
            })
        }
        if (parameters.race_val_strat == "Even" && race_array[const_index] % 2 != 0) {
            mismatches.push({
                rep: rep,
                thread: null,
                index: const_index,
                expected: "Even",
                actual: race_array[const_index]
            })
        }
    }

    let num_threads = parameters.workgroups * parameters.workgroup_size;
    for (let thread_id = 0; thread_id < num_threads; thread_id+=1) {
        for (let offset = 0; offset < parameters.locs_per_thread; offset++) {
            let index  = (thread_id * parameters.locs_per_thread) + offset + data_race_info.constant_locs;

            if (data_race_info.safe.includes(offset) && safe_array[index] != race_array[index])  {
                mismatches.push({
                    rep: rep,
                    thread: thread_id,
                    index: index,
                    expected: safe_array[index],
                    actual: race_array[index]
                })
            }
            if (parameters.race_val_strat == "Even" && race_array[index] % 2 != 0) {
                mismatches.push({
                    rep: rep,
                    thread: thread_id,
                    index: index,
                    expected: "Even",
                    actual: race_array[index]
                })
            } 
        }
    }

    console.log(mismatches);
    
    return mismatches;
}
