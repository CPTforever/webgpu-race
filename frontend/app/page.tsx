 'use client';

import { Card, Text, Button, Grid, Input, Spacer, Container, Row, Col, Radio, Textarea, Progress, Checkbox, Dropdown} from '@nextui-org/react';
import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import axios from 'axios';
import { run_shader, check_gpu } from './shader';
import { analyze, pattern_anaylze } from './analyze_results';
import getVideoCardInfo from './get_gpu';
import { Table } from '@nextui-org/react';
import { any } from 'prop-types';

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

  const random = (checked: any) => {
    let val = getRandomArbitrary(0, 5);
    let pattern_weight = "Even";
    if (val == 0) {
      pattern_weight = "Even";
    }
    else if (val == 1) {
      pattern_weight = "Basic";
    }
    else if (val == 2) {
      pattern_weight = "IntMult";
    }
    else if (val == 3) {
      pattern_weight = "IntDiv";
    }
    else if (val == 4) {
      pattern_weight = "Divide";
    }
    return {
      "seed" : getRandomArbitrary(1,18446744073709551615),
      "workgroups" : getRandomArbitrary(1,128),
      "workgroup_size" : getRandomArbitrary(1,128),
      "racy_loc_pct" : getRandomArbitrary(0,100),
      "racy_constant_loc_pct" : getRandomArbitrary(0, 100),
      "racy_var_pct" : getRandomArbitrary(0, 100),
      "num_lits" : getRandomArbitrary(1, 16),
      "stmts" : getRandomArbitrary(1, 1000),
      "vars" : getRandomArbitrary(1, 16),
      "uninit_vars": getRandomArbitrary(1, 200),
      "locs_per_thread" : getRandomArbitrary(1, 16),
      "constant_locs" : getRandomArbitrary(1, 16),
      "race_val_strat" : Math.random() > 0.5 ? "None" : "Even",
      "pattern_weights" : pattern_weight,
      "else_chance" : getRandomArbitrary(0, 100),
      "block_max_stmts" : getRandomArbitrary(2, 100),
      "block_max_nest_level" : 3,
      "oob_pct" : checked == false ? 0 : getRandomArbitrary(0, 100),
      "max_loop_iter" : 10,
      "buf_count" : getRandomArbitrary(1, 4)
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
      "pattern_weights" : "Even",
      "block_max_stmts" : 4,
      "block_max_nest_level" : 1,
      "oob_pct" : 0,
      "max_loop_iter" : 10,
      "buf_count" : 1
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
      "pattern_weights" : "Even",
      "else_chance" : 50,
      "block_max_stmts" : 50,
      "block_max_nest_level" : 3,
      "oob_pct" : 0,
      "max_loop_iter" : 10,
      "buf_count" : 4,
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
          <Input type="number" label="Workgroups" value={parameters.workgroups} onChange={e => {setParameter({...parameters, "workgroups" :  Math.max(Math.min(Number(e.target.value), 128), 0)})}} />
          <Spacer />
          <Input type="number" label="Workgroup Size" value={parameters.workgroup_size} onChange={e => {setParameter({...parameters, "workgroup_size" : Math.max(Math.min(Number(e.target.value), 128), 0)})}} />
          <Spacer />
          <Input type="number" label="Racy Location Pct" value={parameters.racy_loc_pct} onChange={e => {setParameter({...parameters, "racy_loc_pct" :  Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Racy Constant Location Pct" value={parameters.racy_constant_loc_pct} onChange={e => {setParameter({...parameters, "racy_constant_loc_pct" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Else Chance" value={parameters.else_chance} onChange={e => {setParameter({...parameters, "else_chance" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Racy Variable Pct" value={parameters.racy_var_pct} onChange={e => {setParameter({...parameters, "racy_var_pct" :  Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Literals" value={parameters.num_lits} onChange={e => {setParameter({...parameters, "num_lits" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Statements" value={parameters.stmts} onChange={e => {setParameter({...parameters, "stmts" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Variables" value={parameters.vars} onChange={e => {setParameter({...parameters, "vars" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
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
          <Input type="number" label="Buffer Count" value={parameters.buf_count} onChange={e => {setParameter({...parameters, "buf_count" : Math.max(Math.min(Number(e.target.value), 4), 1)})}} />
          <Spacer />
          <Radio.Group label="Race Value Strategy" value={parameters.race_val_strat} onChange={e => {setParameter({...parameters, "race_val_strat" : e})}}>
            <Radio value="None">None</Radio>
            <Radio value="Even">Even</Radio>
          </Radio.Group>
          <Spacer />
          <Radio.Group label="Pattern Weights" value={parameters.pattern_weights} onChange={e => {setParameter({...parameters, "pattern_weights" : e})}}>
            <Radio value="Even">Even</Radio>
            <Radio value="Basic">Basic</Radio>
            <Radio value="IntMult">Integer Overflow Multiplication</Radio>
            <Radio value="IntDiv">Integer Overflow Divison</Radio>
            <Radio value="Divide">Divide By Zero</Radio>
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
    const res = await axios.get(process.env.NEXT_PUBLIC_RACE_API + '/shader', {
      headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
      },
      params: {
        query: Array.from(selected).join()
      }
    }); 
    let x = res.data;

    for (let i = 0; i < x.length; i++) {
    	x[i] = {...x[i], "key" : i};
    }
    
    return x;
  }

  let [elapsed, setElapsed] = useState(0);
  let [shaders, setShaders] = useState({"shaders": {"safe" : "", "race" : "", "info" : {}}, "set_parameters": {}});
  let [rows, setRows] = useState<any>([]);
  let [load_rows, setLoadRows] = useState<any>([]);
  let [reps, setReps] = useState(10);
  let [username, setName] = useState("");
  let [mismatches, setMismatches] = useState("");
  let [checked, setChecked] = React.useState(false);
  let [selected, setSelected] = React.useState(new Set(["nonzero", "uninit"]));

  const selectedValue = React.useMemo(
    () => Array.from(selected).join(", ").replaceAll("_", " "),
    [selected]
  );
  
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

  const addRow = (id: any, name: any, total: any, mismatches: any, pattern_total: any, non_zero: any, uninit: any) => {
    setRows((a: any) => [...a, {
      key: id,
      run: id,
      name: name,
      total: total,
      mismatches: mismatches,
      pattern: pattern_total,
      non_zero: non_zero,
      uninit: uninit
    }]);
  }

  const getShader = async(parameters: any) => {
    let axiosConfig = {
      headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
      }
    };

    let key: string = "";
    let new_parameters = parameters;
    for (key in parameter_presets.basic) {
      console.log(key);
      if (!(key in new_parameters)) {
        new_parameters[key] = parameter_presets.basic[key];
      }
    }

    console.log(new_parameters);

    await setParameters(new_parameters);

    const res = await axios.put(process.env.NEXT_PUBLIC_RACE_API + '/shader', parameters, axiosConfig);

    setShaders({"shaders": res.data, set_parameters: parameters});

    return res.data;
  }
  
  const runShader = async (i: number, parameters: any, shader: { safe: any; race: any; info: any; }) => {
    stop.current = false;

    let video_card_info = getVideoCardInfo();
    if (!check_gpu()) {
      return {parameters: "None"};
    }

    let total = 0;
    let pattern_total = 0;
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
        let pattern_result = pattern_anaylze(arr_race[4]);
        let uninit_result = uninit_anaylze(arr_race[1]);
        arr.push(...result);
        total += result.length;
        pattern_total += pattern_result[0].length;
        non_zero_total += pattern_result[1].length;
        uninit_total += uninit_result.length;
        show_arr.non_zero.push(...pattern_result[1]);
        show_arr.uninit.push(...uninit_result);
        console.log(pattern_result[1], uninit_result);
        setMismatches(JSON.stringify(show_arr));
      } catch (e) {
        i-=1;
        console.log(e);
        await delay(100);
        continue;
      };
    }
    

    let axiosConfig = {
      headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
      }
    };
    const submit = await axios.put(process.env.NEXT_PUBLIC_RACE_API + '/submission', JSON.stringify({
      vendor: video_card_info.vendor,
      renderer: video_card_info.renderer,
      parameters: parameters,
      reps: reps,
      data_race_info: shader.info,
      mismatches: total,
      oob: pattern_total,
      nonzero: non_zero_total,
      uninit: uninit_total,
      name: username
    }), axiosConfig);

    
    addRow(i, submit.data, total, arr, pattern_total, non_zero_total, uninit_total);
    
    return {
      "parameters" : parameters, 
      "mismatches" : total,
      "pattern" : pattern_total
    }
  }

  const runRandom = async () => {
    let i = rows.length + 1;
    while(true) {
      let parameters_x = setRandom(checked);

      let shaders_x = await getShader(parameters_x);

      //let [shaders, setShaders] = useState({"shaders": {"safe" : "", "race" : "", "info" : {}}, "set_parameters": {}});
      let obj = await runShader(i, parameters_x, shaders_x);

      i+=1;
      if (obj.parameters === "None") {
        return;
      }

      if (stop.current === true) {
	      return;
      }
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
      key: "oob",
      label: "OOB VIOLATIONS",
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
      key: "name",
      label: "NAME",
    },
    {
      key: "total",
      label: "MISMATCH COUNT",
    },
    {
      key: "pattern",
      label: "OOB VIOLATIONS",
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
            <Textarea rows={18} cols={100} label="Safe Shader" placeholder="Safe Shader" readOnly value={shaders.shaders.safe} />
          </Row>
          <Spacer y={1}/>

          <Row>
            <Textarea rows={18} cols={100} label="Race Shader" placeholder="Race Shader" readOnly value={shaders.shaders.race} />
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
            <Input label="name" type="text" value={username} onChange={e => {setName(e.target.value)}}  />
            <Spacer x={0.5}/>
            <Input label="Iterations" type="number" value={reps} onChange={e => {setReps(Number(e.target.value))}}  />
            <Spacer x={0.5}/>
            <Spacer y = {0.5}/>
            <Checkbox label="Enable Out of Bounds Accesses" onChange={handleChange}> 

            </Checkbox>
          </Row>
          <Spacer y={0.5}/>
          <Row>
            <Button css={{"background" : "#03c03c"}} onPress={async () => {await runShader(rows.length + 1, getParameterState(), {...shaders.shaders}); stop.current = true;}} disabled={shaders.shaders.safe.length == 0}> Run </Button>
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
            onSelectionChange={setSelected}
          >
            <Dropdown.Item key="mismatches">Mismatches</Dropdown.Item>
            <Dropdown.Item key="oob">OOB Violations</Dropdown.Item>
            <Dropdown.Item key="nonzero">Nonzero OOB</Dropdown.Item>
            <Dropdown.Item key="uninit">Uninit Violations</Dropdown.Item>
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

