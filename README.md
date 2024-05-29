# Run Locally

First build the wgslsmith crate in the `external/wgslsmith-flow` directory. Note that you need to use a stable version of the rust compiler for this, e.g. by running `rustup override set stable`.

To build the rust backend server, you need to use a `nightly` version of the rust compiler because `rocket` uses experimental features (e.g. `rustup override set nightly`).

You can also use the `run.sh` script to set up the rust server for generating shaders and NextJS frontend for serving/running shaders.

The rust server is not set up with CORS enabled, because on our server we use Caddy as a reverse proxy with https/cors setup. Therefore, you have to disable CORS for local development. For example, if developing on Chrome on OSX, you can start it with CORS disabled by running the following:

```
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --user-data-dir="/tmp/chrome_dev_session" --disable-web-security
```

# Build a static frontend site

Navigate to the `frontend` directory. Ensure your `.env` files are set up with the url base path you'd like to run from.

Run `npm run build` to build the static site (in the `out` directory), then zip it up and send it over to the server. It's currently hosted under the `htdocs/webgpu-race-testing` directory on GPUHarbor.

# Build the backend server

On the server, build the server by first building the wgslsmith crate as above, then running `cargo build --release` from this repository's directory. Then you can use the provided `webgpurace.service` file to set up the binary through systemd, with Caddy providing reverse proxy/https support. The file is currently located at `/etc/systemd/system/webgpurace.service` on Seagull, while the Caddyfile is at `/etc/caddy/Caddyfile`.
