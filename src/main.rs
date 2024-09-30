#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate rocket;

use ast::{Module, FnAttr};
use data_race_generator::*;
use rand::prelude::StdRng;
use rand::SeedableRng;
use rocket::serde::{json::Json, Serialize, Deserialize};
use std::error::Error;
use std::fs::create_dir;
use rusqlite::{params, Connection, Result};
use rocket::serde::json::to_string;

#[derive(Deserialize, Serialize, Clone)]
#[serde(crate = "rocket::serde")]
struct Options {
    seed: u64,
    workgroups: u32,
    workgroup_size: u32,
    racy_loc_pct: u32,
    racy_constant_loc_pct: u32,
    racy_var_pct: u32,
    num_lits: u32,
    stmts: u32,
    vars: u32,
    uninit_vars: u32,
    locs_per_thread: u32,
    constant_locs: u32,
    block_max_stmts: u32,
    block_max_nest_level: u32,
    max_loop_iter: u32,
    oob_pct: u32,
    else_chance: u32,
    race_val_strat: String,
    pattern_weights: String,
    pattern_mem_weights: String,
    data_buf_size: u32,
    pattern_slots: u32,
    reg_pressure: bool
}

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct ShaderResponse {
    safe: String,
    race: String,
    info: DataRaceInfo,
}

#[derive(Deserialize, Serialize)]
struct Mismatch {
    rep: u32,
    thread: Option<u32>,
    index: u32,
    actual: u32,
    expected: String,
}

#[derive(Deserialize, Serialize)]
#[serde(crate = "rocket::serde")]
struct ShaderSubmission  {
    vendor: String,
    renderer: String, 
    parameters: Options,
    data_race_info: DataRaceInfo,
    reps: u32,
    mismatches: u64,
    nonzero: u64,
    uninit: u64,
    name: String,
    email: String,
}

#[derive(Deserialize, Serialize)]
#[serde(crate = "rocket::serde")]
struct FuzzingID {
  id: i64
}

#[derive(Deserialize, Serialize)]
#[serde(crate = "rocket::serde")]
#[serde(rename_all = "camelCase")]
struct FuzzingInfo {
  id: i64,
  gl_vendor: String,
  gl_renderer: String,
  webgpu_vendor: String,
  webgpu_architecture: String,
  webgpu_device: String,
  webgpu_description: String,
  browser_vendor: String,
  browser_version: String,
  os_vendor: String,
  os_version: String,
  os_mobile: bool 
}


#[put("/race_api/start_fuzzing", data="<data>")]
fn start_fuzzing(data: Json<FuzzingInfo>) -> Json<FuzzingID> {
    let conn = Connection::open("./outcomes/outcomes.db").unwrap();
    conn.execute(
        "INSERT INTO tracking (ITERATIONS, OSMOBILE, GLVENDOR, GLRENDERER, WEBGPUVENDOR, WEBGPUARCH, WEBGPUDEVICE, WEBGPUDESC, BROWSERVENDOR, BROWSERVERSION, OSVENDOR, OSVERSION) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        (1,
         &data.os_mobile,
         &data.gl_vendor,
         &data.gl_renderer,
         &data.webgpu_vendor,
         &data.webgpu_architecture,
         &data.webgpu_device,
         &data.webgpu_description,
         &data.browser_vendor,
         &data.browser_version,
         &data.os_vendor,
         &data.os_version
      )
    ).unwrap();
    return Json(FuzzingID { id: conn.last_insert_rowid() });

}

#[post("/race_api/update_fuzzing", data="<data>")]
fn update_fuzzing(data: rocket::serde::json::Json<FuzzingID>) {
    let conn = Connection::open("./outcomes/outcomes.db").unwrap();
    conn.execute(
        "UPDATE tracking SET ITERATIONS = ITERATIONS + 1 WHERE ID = ?1", params![data.id]
    ).unwrap();
}

#[put("/race_api/submission", data="<data>")]
fn submit_shader(data: rocket::serde::json::Json<ShaderSubmission>) {
    let conn = Connection::open("./outcomes/outcomes.db").unwrap();
    conn.execute(
        "INSERT INTO results (NAME, EMAIL, REPS, MISMATCHES, NONZERO, UNINIT, TOTAL_VIOLATIONS, PARAMETERS, DATA_RACE_INFO, VENDOR, RENDERER) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        (&data.name,
         &data.email,
         data.reps,
         data.mismatches,
         data.nonzero,
         data.uninit,
         data.mismatches + data.nonzero + data.uninit,
         to_string(&data.parameters).unwrap(),
         to_string(&data.data_race_info).unwrap(),
         &data.vendor,
         &data.renderer)
    ).unwrap();
}

#[derive(Deserialize, Serialize)]
#[serde(crate = "rocket::serde")]
struct ListEntry {
    vendor: String,
    renderer: String,
    parameters: String,
    mismatches: u64,
    nonzero: u64,
    uninit: u64,
}

#[get("/race_api/shader?<query>")]
fn get_shader(query: &str) -> Json<Vec<ListEntry>> { 
    println!("{}", query);
    let query_list = query.split(",");

    let conn = Connection::open("./outcomes/outcomes.db").unwrap();
    
    let mut query_string = "".to_owned();

    let mut all_results = false;

    let mut first = false;
    for query in query_list {
        if first {
            query_string.push_str(" OR ");
        }
        if query == "mismatches" {
            query_string.push_str("MISMATCHES > 0");
        }
        else if query == "uninit" {
            query_string.push_str("UNINIT > 0");
        }
        else if query == "nonzero" {
            query_string.push_str("NONZERO > 0");
        } else if query == "all" {
          all_results = true;
        }
        first = true;        
    }

    let prepared_string = if all_results {
        "SELECT 
            MAX(MISMATCHES) AS MISMATCHES,
            MAX(NONZERO) AS NONZERO,
            MAX(UNINIT) AS UNINIT,
            VENDOR, 
            RENDERER, 
            MIN(PARAMETERS) AS PARAMETERS
        FROM results
        GROUP BY VENDOR, RENDERER".to_string()
    }     
    else  {
        format!("SELECT MISMATCHES, NONZERO, UNINIT, VENDOR, RENDERER, PARAMETERS FROM results WHERE {};", query_string)
    };

    println!("{}", &prepared_string);
    let mut stmt =  conn.prepare(&prepared_string).expect("Good things.");
    
    let v = stmt.query_map((), |row| {
        Ok(ListEntry {
            mismatches: row.get(0).expect("mismatches failed"),   
            nonzero: row.get(1).expect("nonzero failed"),   
            uninit: row.get(2).expect("uninit failed"),   
            vendor: row.get(3).expect("vendor failed"),   
            renderer: row.get(4).expect("renderer failed"),
            parameters: row.get(5).expect("parameters failed"),   
        })
    }).expect("bad things");
    
    let mut x = Vec::<ListEntry>::new();
    for entry in v {
        x.push(entry.expect("Entry"));
    }
    return rocket::serde::json::Json(x);
}

#[post("/race_api/shader", format = "application/json", data="<settings>")]
fn post_shader(settings: Json<Options>) -> Json<ShaderResponse> {
    let gen_options = GenOptions {
        seed: settings.seed,
        workgroup_size: settings.workgroup_size,
        racy_loc_pct: settings.racy_loc_pct,
        racy_constant_loc_pct: settings.racy_constant_loc_pct,
        block_max_stmts: settings.block_max_stmts,
        block_max_nest_level: settings.block_max_nest_level,
        else_chance: settings.else_chance,
        max_loop_iter: settings.max_loop_iter,
        racy_var_pct: settings.racy_var_pct,
        num_lits: settings.num_lits,
        stmts: settings.stmts,
        vars: settings.vars,
        uninit_vars: settings.uninit_vars,
        locs_per_thread: settings.locs_per_thread,
        constant_locs: settings.constant_locs,
        race_val_strat: match settings.race_val_strat.as_str() {
            "Even" => Option::Some(RaceValueStrategy::Even),
            _ => None,
        },
        pattern_weights: match settings.pattern_weights.as_str() {
            "Default" => (50, 5, 5, 5, 5, 5, 5, 20),
            "Basic" => (100, 0, 0, 0, 0, 0, 0, 0),
            "UndefArith" => (0, 16, 16, 17, 17, 17, 17, 0),
            "ControlFlow" => (0, 0, 0, 0, 0, 0, 0, 100),
            _ => (50, 5, 5, 5, 5, 5, 5, 20)
        },
        pattern_mem_weights: match settings.pattern_mem_weights.as_str() {
          "Default" => (50, 30, 20),
          "Private" => (100, 0, 0),
          "Workgroup" => (0, 100, 0),
          "Device" => (0, 0, 100),
          _ => (50, 30, 20)
        },
        oob_pct: settings.oob_pct,
        pattern_slots: settings.pattern_slots,
        data_buf_size: settings.data_buf_size,
        reg_pressure: settings.reg_pressure
    };

    let (safe_str, race_str, data_race_info) = match generate(gen_options) {
        Ok((x, y, z)) => (x, y, z),
        Err(_) => panic!("Failed to generate."),
    };

    let response = ShaderResponse {
        safe: safe_str,
        race: race_str,
        info: data_race_info
    };
    
    rocket::serde::json::Json(response)
}


#[launch]
fn rocket() -> _ {
    let _ = create_dir("./outcomes");
    let conn = Connection::open("./outcomes/outcomes.db").unwrap();

    conn.execute("CREATE TABLE IF NOT EXISTS results (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            NAME             TEXT,
            EMAIL            TEXT,
            REPS             INTEGER     NOT NULL,
            MISMATCHES       INTEGER     NOT NULL,
            NONZERO          INTEGER     NOT NULL,
            UNINIT           INTEGER     NOT NULL,
            TOTAL_VIOLATIONS INTEGER     NOT NULL,
            PARAMETERS       TEXT        NOT NULL,
            DATA_RACE_INFO   TEXT        NOT NULL,
            VENDOR           TEXT,
            RENDERER         TEXT
        );", ()).unwrap();

    conn.execute("CREATE TABLE IF NOT EXISTS tracking (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            ITERATIONS       INTEGER     NOT NULL,
            CREATED_AT       INTEGER,
            UPDATED_AT       INTEGER,
            OSMOBILE         INTEGER, 
            GLVENDOR         TEXT,
            GLRENDERER       TEXT,
            WEBGPUVENDOR     TEXT,
            WEBGPUARCH       TEXT,
            WEBGPUDEVICE     TEXT,
            WEBGPUDESC       TEXT,
            BROWSERVENDOR    TEXT,
            BROWSERVERSION   TEXT,
            OSVENDOR         TEXT,
            OSVERSION        TEXT
        );", ()).unwrap();

    conn.execute("CREATE TRIGGER IF NOT EXISTS set_timestamp_on_insert
            AFTER INSERT ON tracking
            FOR EACH ROW
            BEGIN
              UPDATE tracking
              SET CREATED_AT = strftime('%s', 'now'),
                  UPDATED_AT = strftime('%s', 'now')
              WHERE id = NEW.id;
            END;", ()).unwrap();

    conn.execute("CREATE TRIGGER IF NOT EXISTS set_timestamp_on_update
            AFTER UPDATE ON tracking
            FOR EACH ROW
            BEGIN
              UPDATE tracking
              SET UPDATED_AT = strftime('%s', 'now')
              WHERE id = NEW.id;
            END;", ()).unwrap();

    rocket::build()
        .mount("/", routes![get_shader, post_shader, submit_shader, start_fuzzing, update_fuzzing])
}


fn generate(gen_options: GenOptions) -> Result<(String, String, DataRaceInfo), Box<dyn Error>> {
    let mut rng = StdRng::seed_from_u64(gen_options.seed);

    let out = data_race_generator::Generator::new(&mut rng, &gen_options).gen_module();

    let safe_shader = out.safe;
    let race_shader = out.race;
    let data_race_info = out.info;

    let safe_output = str_module(&safe_shader);
    let race_output = str_module(&race_shader);

    Ok((safe_output, race_output, data_race_info))
}

fn str_module(module: &Module) -> String {
    let mut s : String = "".to_owned();

    for decl in &module.structs {
        s.push_str(&format!("struct {} {{\n", decl.name));

        for member in &decl.members {
            for attr in member.attrs.iter() {
                s.push_str(&format!("\t@{attr}\n"));
            }
            s.push_str(&format!("\t{}: {},\n", member.name, member.data_type));
        }

        s.push_str("}\n\n");
    }

    for decl in &module.consts {
        s.push_str("let");

        s.push_str(&format!( " {}: {} = {};\n", decl.name, decl.data_type, decl.initializer));

        s.push_str("\n");
    }

    for decl in &module.vars {
        for attr in decl.attrs.iter() {
            s.push_str(&format!("@{attr}\n"));
        }

        s.push_str("var");

        if let Some(qualifier) = &decl.qualifier {
            s.push_str(&format!("<{}", qualifier.storage_class));
            if let Some(access_mode) = &qualifier.access_mode {
                s.push_str(&format!(", {access_mode}"));
            }
            s.push_str(">");
        }

        s.push_str(&format!(" {}: {}", decl.name, decl.data_type));
        
        if let Some(initializer) = &decl.initializer {
            s.push_str(&format!(" = {initializer}"));
        }
        s.push_str(";\n\n");
    }

    for func in &module.functions {
        for attr in &func.attrs {
            match attr {
                FnAttr::Stage(stage) => {
                    // TODO: Tint doesn't currently support the new stage attribute syntax - update when implemented
                    // NOTE: I think Tint now supports this so I changed it (Kyle Little)
                    s.push_str(&format!("@{stage}\n"));
                    //if self.options.concise_stage_attrs {
                    //writeln!(f, "@{stage}")?;
                    //} else {
                    //writeln!(f, "@stage({stage})")?;
                    //}
                }
                _ => {
                    s.push_str(&format!("@{attr}\n"));
                }
            }
        }
        s.push_str(&format!("fn {}(", func.name));

        for (i, param) in func.inputs.iter().enumerate() {
            //for attr in &param.attrs {
            //write!(f, "@{attr} ")?
            //}
            s.push_str(&format!("{param}"));
            if i != func.inputs.len() - 1 {
                s.push_str(", ");
            }
        }
        s.push_str(") ");

        if let Some(output) = &func.output {
            s.push_str(&format!("-> {output} "));
        }
        s.push_str("{\n");

        for stmt in &func.body {
            s.push_str(&format!("\t{}\n", stmt));
        }
        s.push_str("}\n");

        s.push_str("\n");
    }
    
    s
}
