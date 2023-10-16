#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate rocket;

use ast::{Module, FnAttr};
use chrono::Utc;
use data_race_generator::*;
use rand::prelude::StdRng;
use rand::rngs::OsRng;
use rand::{Rng, SeedableRng};
use rocket::form::Form;
use rocket::serde::{json::Json, Serialize, Deserialize};
use std::error::Error;
use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::{Header, Method, Status};
use rocket::{Request, Response};
use std::fs::File;
use std::io::Write;
pub struct CORS;
use std::fs::create_dir;
use std::time::{SystemTime, UNIX_EPOCH};
use rusqlite::{Connection, Result};
use rocket::serde::json::to_string;

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to responses",
            kind: Kind::Response
        }
    }

    async fn on_response<'r>(&self, _request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new("Access-Control-Allow-Methods", "PUT, OPTIONS"));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
    }
}



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
    locs_per_thread: u32,
    constant_locs: u32,
    block_max_stmts: u32,
    block_max_nest_level: u32,
    max_loop_iter: u32,
    oob_pct: u32,
    else_chance: u32,
    race_val_strat: String
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
    name: String,
}

#[put("/submission", data="<data>")]
fn submit_shader(data: rocket::serde::json::Json<ShaderSubmission>) -> String {
    let mut rng = rand::thread_rng();
    let start = SystemTime::now();
    let since_the_epoch = start
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards");
    let n2 : u32 = rng.gen(); // Prevent collisons of file names 

    let conn = Connection::open("./outcomes/outcomes.db").unwrap();

    conn.execute(
        "INSERT INTO results (NAME, REPS, MISMATCHES, PARAMETERS, DATA_RACE_INFO, VENDOR, RENDERER) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (&data.name,
         data.reps,
         data.mismatches,
         to_string(&data.parameters).unwrap(),
         to_string(&data.data_race_info).unwrap(),
         &data.vendor,
         &data.renderer)
    ).unwrap();

    
    format!("./outcomes/{}-{}.json", since_the_epoch.as_millis(), n2)
}

#[derive(Deserialize, Serialize)]
#[serde(crate = "rocket::serde")]
struct ListEntry {
    vendor: String,
    renderer: String,
    parameters: String,
    mismatches: u64
}

#[get("/shader")]
fn get_shader() -> Json<Vec<ListEntry>> { 
    let conn = Connection::open("./outcomes/outcomes.db").unwrap();
    
    let mut stmt =  conn.prepare("SELECT MISMATCHES, VENDOR, RENDERER, PARAMETERS FROM results WHERE MISMATCHES > 0;").expect("Good things.");
    
    let v = stmt.query_map((), |row| {
        Ok(ListEntry {
            mismatches: row.get(0).expect("mismatches failed"),   
            vendor: row.get(1).expect("mismatches failed"),   
            renderer: row.get(2).expect("mismatches failed"),
            parameters: row.get(3).expect("mismatches failed"),   
        })
    }).expect("bad things");
    
    let mut x = Vec::<ListEntry>::new();
    for entry in v {
        x.push(entry.expect("Entry"));
    }
    return rocket::serde::json::Json(x);
}

#[options("/shader")]
fn cors_check_options() -> Status {
    Status::Ok
}

#[options("/submission")]
fn cors_check_options2() -> Status {
    Status::Ok
}

#[put("/shader", format = "application/json", data="<settings>")]
fn put_shader(settings: Json<Options>) -> Json<ShaderResponse> {
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
        locs_per_thread: settings.locs_per_thread,
        constant_locs: settings.constant_locs,
        race_val_strat: match settings.race_val_strat.as_str() {
            "Even" => Option::Some(RaceValueStrategy::Even),
            _ => None,
        },
        oob_pct: settings.oob_pct,
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
    create_dir("./outcomes");
    let conn = Connection::open("./outcomes/outcomes.db").unwrap();

    conn.execute("CREATE TABLE IF NOT EXISTS results (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            NAME            TEXT,
            REPS            INTEGER     NOT NULL,
            MISMATCHES      INTEGER     NOT NULL,
            PARAMETERS      TEXT        NOT NULL,
            DATA_RACE_INFO  TEXT        NOT NULL,
            VENDOR          TEXT,
            RENDERER        TEXT
        );", ()).unwrap();

    rocket::build()
        .mount("/", routes![get_shader, put_shader, cors_check_options, cors_check_options2, submit_shader])
        .attach(CORS)

}


fn generate(gen_options: GenOptions) -> Result<(String, String, DataRaceInfo), Box<dyn Error>> {
    let mut rng = StdRng::seed_from_u64(gen_options.seed);

    let out = data_race_generator::Generator::new(&mut rng, gen_options).gen_module();

    let dt = Utc::now();

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
