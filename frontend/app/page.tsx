 'use client';

import { Card, Text, Button, Grid, Input, Spacer, Container, Row, Col, Radio, Textarea, Progress, Checkbox, Dropdown} from '@nextui-org/react';
import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { run_shader, check_gpu } from './shader';
import { analyze, pattern_analyze } from './analyze_results';
import getVideoCardInfo from './get_gpu';
import { Table } from '@nextui-org/react';
import { any } from 'prop-types';
import getGPUInfo from './get_gpu';

function uninit_anaylze(array: any) {
  let mismatches = [];
  for (let i = 0; i < array.length; i++) {
      if (array[i] != 0) {
          mismatches.push([i, array[i]]);
      }
  }

  return mismatches; 
}

function getRandomArbitrary(min: any, max: any) {
  return Math.floor(Math.random() * (max - min) + min);
}

var str2bool = (value: string) => {
  if (value.toLowerCase() === "true") return true;
  return false;
}

var bool2str = (value: boolean) => {
  if (value) return "true";
  return "false";
}

  const random = (checked: any) => {
    return {
      "seed" : getRandomArbitrary(1,18446744073709551615),
      "workgroups" : getRandomArbitrary(1,128),
      "workgroup_size" : getRandomArbitrary(1,128),
      "racy_loc_pct" : getRandomArbitrary(0,100),
      "racy_constant_loc_pct" : getRandomArbitrary(0, 100),
      "racy_var_pct" : getRandomArbitrary(0, 100),
      "num_lits" : getRandomArbitrary(1, 16),
      "stmts" : getRandomArbitrary(1000, 3000),
      "vars" : getRandomArbitrary(64, 1024),
      "uninit_vars": getRandomArbitrary(1, 10),
      "locs_per_thread" : getRandomArbitrary(1, 16),
      "constant_locs" : getRandomArbitrary(1, 16),
      "race_val_strat" : Math.random() > 0.5 ? "None" : "Even",
      "pattern_weights" : "Default", // leave weights to default for random testing
      "else_chance" : getRandomArbitrary(0, 100),
      "block_max_stmts" : getRandomArbitrary(2, 100),
      "block_max_nest_level" : 3,
      "oob_pct" : checked == false ? 0 : getRandomArbitrary(0, 100),
      "max_loop_iter" : 10,
      "data_buf_size" : getRandomArbitrary(256, 1048756), // up to 1 MB
      "pattern_slots": getRandomArbitrary(0, 10),
      "reg_pressure": Math.random() < 0.9 // 90% chance of register pressure
    }
  }

  let parameter_presets = {
    "basic" : {
      "seed" : 0,
      "workgroups" : 1,
      "workgroup_size" : 1,
      "racy_loc_pct" : 50,
      "racy_constant_loc_pct" : 50,
      "else_chance": 50,
      "racy_var_pct" : 50,
      "num_lits" : 4,
      "stmts" : 8,
      "vars" : 8,
      "uninit_vars": 8,
      "locs_per_thread" : 8,
      "constant_locs" : 16,
      "race_val_strat" : "None",
      "pattern_weights" : "Default",
      "block_max_stmts" : 4,
      "block_max_nest_level" : 1,
      "oob_pct" : 0,
      "max_loop_iter" : 10,
      "data_buf_size": 1024,
      "pattern_slots": 3,
      "reg_pressure": false,
    },
    "stress" : {
      "seed" : 0,
      "workgroups" : 128,
      "workgroup_size" : 128,
      "racy_loc_pct" : 50,
      "racy_constant_loc_pct" : 50,
      "racy_var_pct" : 50,
      "num_lits" : 40,
      "stmts" : 80,
      "vars" : 80,
      "uninit_vars": 80,
      "locs_per_thread" : 80,
      "constant_locs" : 160,
      "race_val_strat" : "Even",
      "pattern_weights" : "Default",
      "else_chance" : 50,
      "block_max_stmts" : 50,
      "block_max_nest_level" : 3,
      "oob_pct" : 0,
      "max_loop_iter" : 10,
      "data_buf_size": 1048576,
      "pattern_slots": 5,
      "reg_pressure": true
    }
  };

const ParameterBox = forwardRef((props, _ref: any) => {



  let [parameters, setParameter] = useState(parameter_presets.basic);
  
  useImperativeHandle(_ref, () => ({
    getParameters: () => {
      return parameters;
    },
    setParameters: () => {
      return setParameter;
    }
  }));

  return (
    <Card css={{ mw: "400px"}}>
      <Card.Header css={{background: "#E5E5E5"}}>
        <Text>
          Test Parameters
        </Text>
      </Card.Header>
      <Card.Divider />
      <Card.Body css={{"overflow-y": "scroll", mh: "437px"}}>
        <Grid> 
          <Input type="number" label="seed (0 is random)" value={parameters.seed} onChange={e => {setParameter({...parameters, "seed" : Number(e.target.value)})}} />
          <Spacer />
          <Input type="number" label="Workgroups" value={parameters.workgroups} onChange={e => {setParameter({...parameters, "workgroups" :  Math.max(Math.min(Number(e.target.value), 1024), 0)})}} />
          <Spacer />
          <Input type="number" label="Workgroup Size" value={parameters.workgroup_size} onChange={e => {setParameter({...parameters, "workgroup_size" : Math.max(Math.min(Number(e.target.value), 512), 0)})}} />
          <Spacer />
          <Input type="number" label="Racy Location Pct" value={parameters.racy_loc_pct} onChange={e => {setParameter({...parameters, "racy_loc_pct" :  Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Racy Constant Location Pct" value={parameters.racy_constant_loc_pct} onChange={e => {setParameter({...parameters, "racy_constant_loc_pct" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Else Chance" value={parameters.else_chance} onChange={e => {setParameter({...parameters, "else_chance" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Racy Variable Pct" value={parameters.racy_var_pct} onChange={e => {setParameter({...parameters, "racy_var_pct" :  Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Literals" value={parameters.num_lits} onChange={e => {setParameter({...parameters, "num_lits" :  Math.max(Math.min(Number(e.target.value), 5000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Statements" value={parameters.stmts} onChange={e => {setParameter({...parameters, "stmts" :  Math.max(Math.min(Number(e.target.value), 10000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Variables" value={parameters.vars} onChange={e => {setParameter({...parameters, "vars" :  Math.max(Math.min(Number(e.target.value), 5000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Uninitialized Variables" value={parameters.uninit_vars} onChange={e => {setParameter({...parameters, "uninit_vars" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Locations Per Thread" value={parameters.locs_per_thread} onChange={e => {setParameter({...parameters, "locs_per_thread" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Constant Locations" value={parameters.constant_locs} onChange={e => {setParameter({...parameters, "constant_locs" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Block Max Statements" value={parameters.block_max_stmts} onChange={e => {setParameter({...parameters, "block_max_stmts" : Math.max(Math.min(Number(e.target.value), 200), 0)})}} />
          <Spacer />
          <Input type="number" label="Block Max Nest Level" value={parameters.block_max_nest_level} onChange={e => {setParameter({...parameters, "block_max_nest_level" : Math.max(Math.min(Number(e.target.value), 3), 0)})}} />
          <Spacer />
          <Input type="number" label="Out of Bounds Access Pct" value={parameters.oob_pct} onChange={e => {setParameter({...parameters, "oob_pct" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Max Loop Iterations" value={parameters.max_loop_iter} onChange={e => {setParameter({...parameters, "max_loop_iter" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Data Buffer Size" value={parameters.data_buf_size} onChange={e => {setParameter({...parameters, "data_buf_size" : Math.max(Math.min(Number(e.target.value), 8388608), 0)})}} />
          <Spacer />
          <Input type="number" label="Pattern Slots" value={parameters.pattern_slots} onChange={e => {setParameter({...parameters, "pattern_slots" : Math.max(Math.min(Number(e.target.value), 10), 0)})}} />
          <Spacer />
          <Radio.Group label="Register Pressure" value={bool2str(parameters.reg_pressure)} onChange={e => {setParameter({...parameters, "reg_pressure" : str2bool(e)})}}>
            <Radio value="true">True</Radio>
            <Radio value="false">False</Radio>
          </Radio.Group>
          <Spacer />
          <Radio.Group label="Race Value Strategy" value={parameters.race_val_strat} onChange={e => {setParameter({...parameters, "race_val_strat" : e})}}>
            <Radio value="None">None</Radio>
            <Radio value="Even">Even</Radio>
          </Radio.Group>
          <Spacer />
          <Radio.Group label="Pattern Weights" value={parameters.pattern_weights} onChange={e => {setParameter({...parameters, "pattern_weights" : e})}}>
            <Radio value="Default">Default</Radio>
            <Radio value="Basic">Basic</Radio>
            <Radio value="IntMult">Integer Overflow Multiplication</Radio>
            <Radio value="IntAdd">Integer Overflow Addition</Radio>
            <Radio value="Divide">Divide By Zero</Radio>
            <Radio value="Modulo">Modulo By Zero</Radio>
            <Radio value="DivideMin">Divide By Int Min</Radio>
            <Radio value="ModuloMin">Modulo By Int Min</Radio>
          </Radio.Group>
        </Grid>
      </Card.Body>
      <Card.Divider />
      <Card.Footer>
        <Grid.Container gap={2} justify="center">
          <Grid> 
              <Button onPress={() => {setParameter(parameter_presets.basic)}}> Basic </Button>
              <Spacer y={0.5}/>
              <Button onPress={() => {setParameter(parameter_presets.stress)}}> Stress </Button>
              <Spacer y={0.5}/>
              <Button onPress={() => {setParameter(random(true))}}> Random </Button>

          </Grid>
          <Card.Divider />
          <Grid>
            <Button css={{background:"#03c03c"}} disabled> Upload </Button>
          </Grid>
        </Grid.Container>

        <Grid>
        </Grid>
      </Card.Footer>
    </Card>
  );

});

export default function Home() {
  const getLoader = async(selected: any) => {
    const requestOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const response = await fetch(process.env.NEXT_PUBLIC_RACE_API + "/shader?" + 
      new URLSearchParams({query: Array.from(selected).join()}), requestOptions);
    if (!response.ok) {
      throw new Error(`Error! status: ${response.status}`);
    }


    let data = await response.json();

    for (let i = 0; i < data.length; i++) {
    	data[i] = {...data[i], "key" : i};
    }
    
    return data;
  }

  let [elapsed, setElapsed] = useState(0);
  let [shaders, setShaders] = useState({"shaders": {"safe" : "", "race" : "", "info" : {}}, "set_parameters": {}});
  let [rows, setRows] = useState<any>([]);
  let [load_rows, setLoadRows] = useState<any>([]);
  let [reps, setReps] = useState(3);
  let [username, setName] = useState("");
  let [email, setEmail] = useState("");
  let [mismatches, setMismatches] = useState("");
  let [checked, setChecked] = React.useState(false);
  let [selected, setSelected] = React.useState<Set<string>>(new Set(["nonzero"]));

  const selectedValue = React.useMemo(
    () => Array.from(selected).join(", ").replaceAll("_", " "),
    [selected]
  );

  const handleSelectionChange = (keys: 'all' | Set<React.Key>) => {
    // Doesn't appear this occurs
    if (keys === 'all') {
      console.log("Query selection is all");
      // Handle the case where all items are selected if necessary
      return;
    }
    console.log(keys);
    const selectedKeys = new Set<string>(Array.from(keys as Set<string>));
    setSelected(selectedKeys);
  };

  const stop = React.useRef(true);
  const parameterRef = useRef<any>();
 
  const delay: any = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));

  const getParameterState: any = () => {
    const parameters = parameterRef.current.getParameters();
    return parameters;
  }
 
  const setParameterState: any = (parameters: any) => {
    parameterRef.current.setParameters()(parameters);
  }

  const setRandom = (checked: any) => {
    let parameters = random(checked);
    setParameterState(parameters);

    return parameters;
  }

  const setParameters = (parameters: any) => {
    setParameterState(parameters);
  }

  const addRow = (id: any, total: any, mismatches: any, non_zero: any, uninit: any) => {
    setRows((a: any) => [...a, {
      key: id,
      run: id,
      total: total,
      mismatches: mismatches,
      non_zero: non_zero,
      uninit: uninit
    }]);
  }

  const getShader = async(parameters: any) => {
    let key: string = "";
    setParameters(parameters);
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parameters)
    };
    const response = await fetch(process.env.NEXT_PUBLIC_RACE_API + "/shader", requestOptions);
    if (!response.ok) {
      throw new Error(`Error! status: ${response.status}`);
    }

    let data = await response.json();
    setShaders({ shaders: data, set_parameters: parameters });
    return data;
  }
  
  const runShader = async (i: number, parameters: any, shader: { safe: any; race: any; info: any; }, submit: boolean) => {
    stop.current = false;

    let gpuInfo = await getGPUInfo();
    if (!check_gpu()) {
      return {parameters: "None"};
    }

    let total = 0;
    let non_zero_total = 0; 
    let uninit_total = 0;
    let arr = [];
    let show_arr: any = {
      non_zero: [],
      uninit: [],
    };
    for (let i = 0; i < reps; i++) {
      if (stop.current) {
        break;
      }
      try {
        let arr_safe : any = await run_shader(shader.safe, parameters);
        await delay(50);
        let arr_race : any = await run_shader(shader.race, parameters);  
        await delay(50);

        setElapsed(100 * (i + 1) / reps);

        let result = analyze(arr_safe[0], arr_race[0], parameters, shader.info, i);
        let pattern_result = pattern_analyze(arr_race[4]);
        let uninit_result = uninit_anaylze(arr_race[1]);
        arr.push(...result);
        total += result.length;
        non_zero_total += pattern_result.length;
        uninit_total += uninit_result.length;
        show_arr.non_zero.push(...pattern_result);
        show_arr.uninit.push(...uninit_result);
        setMismatches(JSON.stringify(show_arr));
      } catch (e) {
        i-=1;
        console.log(e);
        await delay(100);
        continue;
      };
    }

    // only submit interesting results to database
    if (total + non_zero_total + uninit_total > 0 || submit) {
      const requestOptions = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: gpuInfo.gpu.glVendor,
          renderer: gpuInfo.gpu.glRenderer,
          parameters: parameters,
          reps: reps,
          data_race_info: shader.info,
          mismatches: total,
          nonzero: non_zero_total,
          uninit: uninit_total,
          name: username,
          email: email
        })
      };
      const response = await fetch(process.env.NEXT_PUBLIC_RACE_API + "/submission", requestOptions);
      if (!response.ok) {
        throw new Error(`Error! status: ${response.status}`);
      }
    }

    addRow(i, total, arr, non_zero_total, uninit_total);
    
    return {
      "parameters" : parameters
    }
  }

  const runRandom = async () => {
    let i = rows.length + 1;
    var submit = true; // submit results on the first run to get GPU info
    // track this fuzzing session
    let gpuInfo = await getGPUInfo();
    console.log(gpuInfo)

    var _id; // used to keep track of this fuzzing session
    const requestOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1, // unused
        glVendor: gpuInfo.gpu.glVendor,
        glRenderer: gpuInfo.gpu.glRenderer,
        webgpuVendor: gpuInfo.gpu.webGPUVendor,
        webgpuArchitecture: gpuInfo.gpu.webGPUArchitecture,
        webgpuDevice: gpuInfo.gpu.webGPUDevice,
        webgpuDescription: gpuInfo.gpu.webGPUDescription,
        browserVendor: gpuInfo.browser.vendor,
        browserVersion: gpuInfo.browser.version,
        osVendor: gpuInfo.os.vendor,
        osVersion: gpuInfo.os.version,
        osMobile: gpuInfo.os.mobile
      })
    };
    const response = await fetch(process.env.NEXT_PUBLIC_RACE_API + "/start_fuzzing", requestOptions);
    if (!response.ok) {
      throw new Error(`Error! status: ${response.status}`);
    }

    let data = await response.json();
    _id = data["id"];
    console.log("Fuzzing session id: " + _id)

    while(true) {
      let parameters_x = setRandom(checked);

      let shaders_x = await getShader(parameters_x);

      let obj = await runShader(i, parameters_x, shaders_x, submit);

      // update tracking of this fuzzing session
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: _id,
        })
      };
      const response = await fetch(process.env.NEXT_PUBLIC_RACE_API + "/update_fuzzing", requestOptions);
      if (!response.ok) {
        throw new Error(`Error! status: ${response.status}`);
      }

      i+=1;
      if (obj.parameters === "None") {
        return;
      }

      if (stop.current === true) {
	      return;
      }
      submit = false;
    }
  }

  const load_columns = [
    {
      key: "vendor",
      label: "VENDOR",
    },
    {
      key: "renderer",
      label: "RENDERER",
    },
    {
      key: "mismatches",
      label: "MISMATCH COUNT",
    },
    {
      key: "nonzero",
      label: "NON ZERO OOB",
    },
    {
      key: "uninit",
      label: "UNINIT VIOLATIONS",
    },
    {
      key: "actions",
      label: "ACTIONS",
    },
  ];
  
  const run_columns = [
    {
      key: "run",
      label: "RUN",
    },
    {
      key: "total",
      label: "MISMATCH COUNT",
    },
    {
      key: "non_zero",
      label: "NON ZERO OOB",
    },
    {
      key: "uninit",
      label: "UNINIT VIOLATIONS",
    },
    {
      key: "actions",
      label: "ACTIONS"
    }
  ];

  const fix = (parameters: string) => {
    let x = JSON.parse(parameters);
    return x;
  }

  const renderCell = (item: any, key: React.Key) => {
    const cellValue = item[key];
    switch (key) {
      case "actions":
        return (
	        <Row>
            <Button onPress={async () => {
              let x = item.parameters;
              let y = fix(x);
              setParameters(y);
              await getShader(y);
            }}> Fetch </Button>
  	      </Row>
        );
      default: 
        return cellValue;
    }
  }

  const loadMismatches = (item: any, key: React.Key) => {
    const cellValue = item[key];
    switch (key) {
      case "actions":
        return (
        <Button onPress = {async() => {
          console.log("item", cellValue)
          setMismatches(JSON.stringify(item["mismatches"]));
        }}> Load 
        </Button>
        )
      default: 
        return cellValue;
    }
  }


  const handleChange = () => {
    stop.current = true;
    setChecked(!checked);
  };

  return (
    <Container>
      <Row >
        <Text size={50} css={{
          textGradient: "75deg, $yellow600 -20%, $red600 100%",
          "text-size-adjust": "80%"
        }}>
            WebGPU Data Race Safety Testing
        </Text>
      </Row>
      <Spacer y={2}/>

      <Row css={{right: "0"}}>
          <ParameterBox ref={parameterRef}/>
          <Spacer x={2}/>

          <Col> 

          <Row>
            <Textarea rows={18} cols={100} label="Shader" placeholder="Shader" readOnly value={shaders.shaders.race} />
          </Row>
          <Spacer y={1}/>

          <Row>
            <Textarea rows={10} cols={100} label="Mismatches" placeholder="Mismatches" readOnly value={mismatches} />
          </Row>
          </Col>
          <Spacer x={2}/>
      </Row>

      <Spacer y={2}/>
      <Row>
        <Col>
          <Row>
            <Input label="Name (Optional)" type="text" value={username} onChange={e => {setName(e.target.value)}}  />
            <Spacer x={0.5}/>
            <Input label="Email (Optional)" type="text" value={email} onChange={e => {setEmail(e.target.value)}}  />
            <Spacer x={0.5}/>

            <Input label="Iterations" type="number" value={reps} onChange={e => {setReps(Number(e.target.value))}}  />
            <Spacer x={0.5}/>
            <Spacer y = {0.5}/>
            <Checkbox label="Enable Out of Bounds Accesses" onChange={handleChange}> 

            </Checkbox>
          </Row>
          <Spacer y={0.5}/>
          <Row>
            <Button css={{"background" : "#03c03c"}} onPress={async () => {await runShader(rows.length + 1, getParameterState(), {...shaders.shaders}, false); stop.current = true;}} disabled={shaders.shaders.safe.length == 0}> Run </Button>
            <Spacer x={0.5}/>
            <Button onPress={() => {getShader(getParameterState())}}> Get Shader </Button>
            <Spacer x={0.5}/>
            <Button onPress={() => {runRandom()}}> Run Random </Button>
          </Row>
          <Spacer y={0.5}/>
          <Row>
            <Button css={{"background" : "#ff0000"}} onPress={() => {stop.current = true}} disabled={stop.current}> Stop </Button>
            <Spacer x={0.5}/>
          </Row>
	  
        </Col>
        <Spacer x={1}/>
        <Col>
          <Text>
            Runtime : 0.0s
          </Text>
          <Progress
            value={elapsed}
            color="gradient"
            status="primary"
          />
          <Spacer y={0.5}/>

          <Text>
            Time Remaining : 0.0s
          </Text>
          <Spacer y={0.5}/>
          <Text>
            Rate: 0 iterations per second
          </Text>
        </Col>

      </Row>

      <Spacer y={2}/>
      <Table> 
        <Table.Header columns={load_columns}>
          {(column) => (
            <Table.Column key={column.key}>{column.label}</Table.Column>
          )}
        </Table.Header>
        <Table.Body items={load_rows} >
          {(item: any) => (
            <Table.Row key={item.key}>
              {(columnKey) => <Table.Cell>{renderCell(item, columnKey)}</Table.Cell>}
            </Table.Row>
          )}
        </Table.Body>
      <Table.Pagination
        shadow
        noMargin
        rowsPerPage={5}
        autoResetPage
      />
      </Table>
      <Spacer x={0.5}/>
      <Row>
          <Button onPress={async () => {let x = await getLoader(selected); setLoadRows(x);}}> Fetch DB </Button>
          
          <Spacer y={0.5}/>

          <Dropdown>
          <Dropdown.Button flat color="secondary" css={{ tt: "capitalize" }}>
            {selectedValue}
          </Dropdown.Button>
          <Dropdown.Menu 
            aria-label="Static Actions"
            disallowEmptySelection
            selectionMode="multiple"
            selectedKeys={selected}
            onSelectionChange={(keys) => handleSelectionChange(keys)}
          >
            <Dropdown.Item key="mismatches">Mismatches</Dropdown.Item>
            <Dropdown.Item key="nonzero">Nonzero OOB</Dropdown.Item>
            <Dropdown.Item key="uninit">Uninit Violations</Dropdown.Item>
            <Dropdown.Item key="all">All Results</Dropdown.Item>

          </Dropdown.Menu>
        </Dropdown>
      </Row>
      <Spacer x={0.5}/>
      <Table> 
        <Table.Header columns={run_columns}>
          {(column) => (
            <Table.Column key={column.key}>{column.label}</Table.Column>
          )}
        </Table.Header>
        <Table.Body items={rows} >
          {(item: any) => (
            <Table.Row key={item.key}>
              {(columnKey) => <Table.Cell>{loadMismatches(item, columnKey)}</Table.Cell>}
            </Table.Row>
          )}
        </Table.Body>
      <Table.Pagination
        shadow
        noMargin
        rowsPerPage={20}
      />
      </Table>
      <Spacer y={2}/>
      <Text>
      Disclaimer: This research project involves the collection of anonymous hardware data. Including your GPU model, etc.
      No personally identifiable information will be gathered. Your participation is voluntary.
      If you have any questions or concerns, please reach out to us at <a href="https://users.soe.ucsc.edu/~tsorensen/"> https://users.soe.ucsc.edu/~tsorensen/ </a>. Thank you for contributing to our research efforts.
      </Text>
      <Spacer y={2}/>
  </Container>
  )
}

