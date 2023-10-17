#!/bin/bash

cd external/wgslsmith-flow
./build.py
cd ../..
cargo run &
cd frontend
npm run dev
