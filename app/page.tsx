'use client';

import { Card, Text, Button, Grid, Input, Spacer, Container, Row, Col, Radio, Textarea, Progress, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, getKeyValue } from '@nextui-org/react';
import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import axios from 'axios';
import run_shader from './shader';
import analyze from './analyze_results';
import getVideoCardInfo from './get_gpu';

function getRandomArbitrary(min: any, max: any) {
  return Math.floor(Math.random() * (max - min) + min);
}

const ParameterBox = forwardRef((props, _ref: any) => {
  let parameter_presets = {
    "basic" : {
      "seed" : 0,
      "workgroups" : 1,
      "workgroup_size" : 1,
      "racy_loc_pct" : 50,
      "racy_constant_loc_pct" : 50,
      "racy_var_pct" : 50,
      "num_lits" : 4,
      "stmts" : 8,
      "vars" : 8,
      "locs_per_thread" : 8,
      "constant_locs" : 16,
      "reps": 1,
      "race_val_strat" : "Odd"
    },
    "stress" : {
      "seed" : 0,
      "workgroups" : 128,
      "workgroup_size" : 128,
      "racy_loc_pct" : 500,
      "racy_constant_loc_pct" : 500,
      "racy_var_pct" : 500,
      "num_lits" : 40,
      "stmts" : 80,
      "vars" : 80,
      "locs_per_thread" : 80,
      "constant_locs" : 160,
      "reps": 10,
      "race_val_strat" : "Odd"
    }
  };

  const random = () => {
    return {
      "seed" : 0,
      "workgroups" : getRandomArbitrary(1,128),
      "workgroup_size" : getRandomArbitrary(1,128),
      "racy_loc_pct" : getRandomArbitrary(1,500),
      "racy_constant_loc_pct" : getRandomArbitrary(1, 500),
      "racy_var_pct" : getRandomArbitrary(1, 500),
      "num_lits" : getRandomArbitrary(1, 100),
      "stmts" : getRandomArbitrary(1, 100),
      "vars" : getRandomArbitrary(1, 100),
      "locs_per_thread" : getRandomArbitrary(1, 100),
      "constant_locs" : getRandomArbitrary(1, 100),
      "reps": getRandomArbitrary(1, 100),
      "race_val_strat" : Math.random() > 0.5 ? "Odd" : "Even",
    }
  }


  let [parameters, setParameter] = useState(parameter_presets.basic);
  
  useImperativeHandle(_ref, () => ({
    getParameters: () => {
      return parameters;
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
          <Input type="number" label="Workgroup_Size" value={parameters.workgroup_size} onChange={e => {setParameter({...parameters, "workgroup_size" : Math.max(Math.min(Number(e.target.value), 128), 0)})}} />
          <Spacer />
          <Input type="number" label="racy_loc_pct" value={parameters.racy_loc_pct} onChange={e => {setParameter({...parameters, "racy_loc_pct" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="racy_constant_loc_pct" value={parameters.racy_constant_loc_pct} onChange={e => {setParameter({...parameters, "racy_constant_loc_pct" : Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="racy_var" value={parameters.racy_var_pct} onChange={e => {setParameter({...parameters, "racy_var_pct" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="lits" value={parameters.num_lits} onChange={e => {setParameter({...parameters, "num_lits" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="stmts" value={parameters.stmts} onChange={e => {setParameter({...parameters, "stmts" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="vars" value={parameters.vars} onChange={e => {setParameter({...parameters, "vars" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="locs per thread" value={parameters.locs_per_thread} onChange={e => {setParameter({...parameters, "locs_per_thread" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="constant locs" value={parameters.constant_locs} onChange={e => {setParameter({...parameters, "constant_locs" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Input type="number" label="reps" value={parameters.reps} onChange={e => {setParameter({...parameters, "reps" :  Math.max(Math.min(Number(e.target.value), 1000), 0)})}} />
          <Spacer />
          <Radio.Group label="Options" value={parameters.race_val_strat} onChange={e => {setParameter({...parameters, "race_val_strat" : e})}}>
            <Radio value="Odd">Odd</Radio>
            <Radio value="Even">Even</Radio>
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
  let [iterations, setIterations] = useState(100);
  let [elapsed, setElapsed] = useState(0);
  let [shaders, setShaders] = useState({"shaders": {"safe" : "", "race" : "", "info" : {}}, "set_parameters": {}});
  const parameterRef = useRef<any>();

  const getParameterState: any = () => {
    const parameters = parameterRef.current.getParameters();
    return parameters;
  }
  
  const getShader = async() => {
    const parameters = getParameterState();
    parameters.strategy = (parameters.strategy === "Even" ? false : true);
    let axiosConfig = {
      headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
      }
    };
    const res = await axios.put('https://seagull.be.ucsc.edu/race_api/shader', parameters, axiosConfig);

    setShaders({"shaders": res.data, set_parameters: parameters});
  }
  const runShader = async () => {
    const parameters = getParameterState();

    let video_card_info = getVideoCardInfo();
    let mismatches: any[] = [];
    for (let i = 0; i < iterations; i++) {
      let arr_safe = await run_shader(shaders.shaders.safe, shaders.set_parameters);
      let arr_race = await run_shader(shaders.shaders.race, shaders.set_parameters);
      
      setElapsed(100 * (i + 1) / iterations);
      mismatches.concat(analyze(arr_safe, arr_race, shaders.set_parameters, shaders.shaders.info, i));
    }

    let axiosConfig = {
      headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
      }
    };

    const submit = await axios.put('https://seagull.be.ucsc.edu/race_api/submission', JSON.stringify({
      vendor: video_card_info.vendor,
      renderer: video_card_info.renderer,
      parameters: parameters,
      data_race_info: shaders.shaders.info,
      mismatches: mismatches
    }), axiosConfig);
  }

  return (
    <Container>
      <Row >
        <Text size={50} css={{
          textGradient: "75deg, $yellow600 -20%, $red600 100%",
          "text-size-adjust": "80%"
        }}>
            Webgpu Race Conditions Test Suite
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
          <Text> Iterations: </Text>
          <Input type="number" value={iterations} onChange={(e) => {setIterations(Number(e.target.value))}}/>
          <Spacer y={0.5}/>
          <Row>
            <Button css={{"background" : "#03c03c"}} onPress={() => {runShader()}} disabled={shaders.shaders.safe.length == 0}> Run </Button>
            <Spacer x={0.5}/>
            <Button onPress={() => {getShader()}}> Fetch </Button>
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
