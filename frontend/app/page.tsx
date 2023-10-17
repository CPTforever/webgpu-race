 'use client';

import { Card, Text, Button, Grid, Input, Spacer, Container, Row, Col, Radio, Textarea, Progress} from '@nextui-org/react';
import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import axios from 'axios';
import { run_shader, check_gpu } from './shader';
import analyze from './analyze_results';
import getVideoCardInfo from './get_gpu';
import { Table } from '@nextui-org/react';
import { any } from 'prop-types';

function getRandomArbitrary(min: any, max: any) {
  return Math.floor(Math.random() * (max - min) + min);
}

  const random = () => {
    return {
      "seed" : getRandomArbitrary(1,18446744073709551615),
      "workgroups" : getRandomArbitrary(1,128),
      "workgroup_size" : getRandomArbitrary(1,128),
      "racy_loc_pct" : getRandomArbitrary(1,100),
      "racy_constant_loc_pct" : getRandomArbitrary(1, 100),
      "racy_var_pct" : getRandomArbitrary(1, 100),
      "num_lits" : getRandomArbitrary(1, 400),
      "stmts" : getRandomArbitrary(1, 400),
      "vars" : getRandomArbitrary(1, 400),
      "locs_per_thread" : getRandomArbitrary(1, 400),
      "constant_locs" : getRandomArbitrary(1, 400),
      "race_val_strat" : Math.random() > 0.5 ? "None" : "Even",
      "else_chance" : getRandomArbitrary(1, 100),

      "block_max_stmts" : getRandomArbitrary(4, 25),
      "block_max_nest_level" : 3,
      "oob_pct" : getRandomArbitrary(1, 100),
      "max_loop_iter" : 10
    }
  }
const ParameterBox = forwardRef((props, _ref: any) => {
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
      "locs_per_thread" : 8,
      "constant_locs" : 16,
      "race_val_strat" : "None",

      "block_max_stmts" : 4,
      "block_max_nest_level" : 1,
      "oob_pct" : 0,
      "max_loop_iter" : 10,
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
      "locs_per_thread" : 80,
      "constant_locs" : 160,
      "race_val_strat" : "Even",
      "else_chance" : 50,

      "block_max_stmts" : 50,
      "block_max_nest_level" : 3,
      "oob_pct" : 0,
      "max_loop_iter" : 10,
    }
  };



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
          <Input type="number" label="Block Max Statements" value={parameters.block_max_stmts} onChange={e => {setParameter({...parameters, "block_max_stmts" : Math.max(Math.min(Number(e.target.value), 200), 0)})}} />
          <Spacer />
          <Input type="number" label="Block Max Nest Level" value={parameters.block_max_nest_level} onChange={e => {setParameter({...parameters, "block_max_nest_level" : Math.max(Math.min(Number(e.target.value), 3), 0)})}} />
          <Spacer />
          <Input type="number" label="Else Chance" value={parameters.else_chance} onChange={e => {setParameter({...parameters, "else_chance" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Max Loop Iterations" value={parameters.max_loop_iter} onChange={e => {setParameter({...parameters, "max_loop_iter" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Racy Variable Pct" value={parameters.racy_var_pct} onChange={e => {setParameter({...parameters, "racy_var_pct" :  Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Literals" value={parameters.num_lits} onChange={e => {setParameter({...parameters, "num_lits" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Statements" value={parameters.stmts} onChange={e => {setParameter({...parameters, "stmts" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Variables" value={parameters.vars} onChange={e => {setParameter({...parameters, "vars" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Locations Per Thread" value={parameters.locs_per_thread} onChange={e => {setParameter({...parameters, "locs_per_thread" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="Number of Constant Locations" value={parameters.constant_locs} onChange={e => {setParameter({...parameters, "constant_locs" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Radio.Group label="Race Value Strategy" value={parameters.race_val_strat} onChange={e => {setParameter({...parameters, "race_val_strat" : e})}}>
            <Radio value="None">None</Radio>
            <Radio value="Even">Even</Radio>
          </Radio.Group>
          <Input type="number" label="Out of Bounds Access Pct" value={parameters.oob_pct} onChange={e => {setParameter({...parameters, "oob_pct" : Math.max(Math.min(Number(e.target.value), 100), 0)})}} />
          <Spacer />
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
              <Button onPress={() => {setParameter(random())}}> Random </Button>

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
  const getLoader = async() => {
    const res = await axios.get(process.env.NEXT_PUBLIC_RACE_API + '/shader', {
      headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
      }
    }); 
    let x = res.data;

    for (let i = 0; i < x.length; i++) {
    	x[i] = {...x[i], "key" : i};
    }
    
    return x;
  }

  let [iterations, setIterations] = useState(10);
  let [elapsed, setElapsed] = useState(0);
  let [shaders, setShaders] = useState({"shaders": {"safe" : "", "race" : "", "info" : {}}, "set_parameters": {}});
  let [rows, setRows] = useState<any>([]);
  let [load_rows, setLoadRows] = useState<any>([]);
  let [reps, setReps] = useState<any>(10);
  let [username, setName] = useState("");
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

  const setRandom = () => {
    let parameters = random();
    setParameterState(parameters);

    return parameters;
  }

  const setParameters = (parameters: any) => {
    setParameterState(parameters);
  }

  const addRow = (id: any, name: any, mismatches: any) => {
    setRows((a: any) => [...a, {
      key: id,
      run: id,
      name: name,
      mismatches: mismatches,
    }]);
  }

  const getShader = async(parameters: any) => {
    let axiosConfig = {
      headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
      }
    };
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
    for (let i = 0; i < reps; i++) {
      if (stop.current) {
        break;
      }
      try {
        let arr_safe = await run_shader(shader.safe, parameters);
        let arr_race = await run_shader(shader.race, parameters);  

        setElapsed(100 * (i + 1) / reps);
        let result = analyze(arr_safe, arr_race, parameters, shader.info, i);
        total += result.length;
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
      name: username
    }), axiosConfig);

    
    addRow(i, submit.data, total);
 
    return {
      "parameters" : parameters, 
      "mismatches" : total
    }
  }

  const runRandom = async () => {
    let i = rows.length + 1;
    while(true) {
      let parameters_x = setRandom();

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
      key: "mismatches",
      label: "MISMATCH COUNT",
    },
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

  const MINUTE_MS = 1000;

  useEffect(() => {
    const interval = setInterval(async () => {
      let x = await getLoader();
      setLoadRows(x);
    }, MINUTE_MS);

    return () => clearInterval(interval); // This represents the unmount function, in which you need to clear your interval to prevent memory leaks.
  }, [])


  return (
    <Container >
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
          </Row>
          <Spacer y={0.5}/>
          <Row>
            <Button css={{"background" : "#03c03c"}} onPress={async () => {await runShader(rows.length + 1, getParameterState(), {...shaders.shaders}); stop.current = true;}} disabled={shaders.shaders.safe.length == 0}> Run </Button>
            <Spacer x={0.5}/>
            <Button onPress={() => {getShader(getParameterState())}}> Fetch </Button>
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
        align="center"
        rowsPerPage={5}
        onPageChange={(page: any) => console.log({ page })}
      />
      </Table>

      <Table> 
        <Table.Header columns={run_columns}>
          {(column) => (
            <Table.Column key={column.key}>{column.label}</Table.Column>
          )}
        </Table.Header>
        <Table.Body items={rows} >
          {(item: any) => (
            <Table.Row key={item.key}>
              {(columnKey) => <Table.Cell>{item[columnKey]}</Table.Cell>}
            </Table.Row>
          )}
        </Table.Body>
      <Table.Pagination
        shadow
        noMargin
        align="center"
        rowsPerPage={20}
        onPageChange={(page: any) => console.log({ page })}
      />
      </Table>
      <Spacer y={2}/>
      <Text>
      Disclaimer: This research project involves the collection of anonymous hardware data. Including your GPU model, etc.
      No personally identifiable information will be gathered. Your participation is voluntary.
      If you have any questions or concerns, please reach out to us at [Your contact information]. Thank you for contributing to our research efforts.
      </Text>
      <Spacer y={2}/>
  </Container>
  )
}

