const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const vm = require("vm");
const Module = require("module");
const util = require("util");

function argumentValue(name, fallback = null) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const root = path.resolve(argumentValue("--root", process.cwd()));
const requestedPort = Number(argumentValue("--port", "0"));
const authToken = argumentValue("--token", "");
const readyPath = path.resolve(argumentValue("--ready", path.join(root, ".novi-node-ready.json")));
const npmArchive = path.join(root, "npm-10.9.9.tgz");

function tarOctal(buffer, start, length) {
    const value = buffer.toString("utf8", start, start + length).replace(/\0.*$/, "").trim();
    return value ? parseInt(value, 8) : 0;
}

function ensureNpm() {
    const marker = path.join(root, ".npm-version");
    const npmRoot = path.join(root, "node_modules", "npm");
    if (fs.existsSync(marker) && fs.existsSync(path.join(npmRoot, "bin", "npm-cli.js"))) return;
    if (!fs.existsSync(npmArchive)) throw new Error("Bundled npm-10.9.9.tgz is missing");

    const data = zlib.gunzipSync(fs.readFileSync(npmArchive));
    const targetRoot = path.join(root, "node_modules", "npm");
    fs.mkdirSync(targetRoot, { recursive: true });
    for (let offset = 0; offset + 512 <= data.length;) {
        const header = data.subarray(offset, offset + 512);
        if (header.every(byte => byte === 0)) break;
        const name = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
        const size = tarOctal(header, 124, 12);
        const type = header[156];
        if (!name.startsWith("package/") || name.includes("..") || path.isAbsolute(name)) {
            throw new Error(`Unsafe npm archive path: ${name}`);
        }
        if (type !== 0 && type !== 48) throw new Error(`Unsupported npm archive entry: ${name}`);
        const relative = name.slice("package/".length);
        if (relative) {
            const destination = path.join(targetRoot, relative);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, data.subarray(offset + 512, offset + 512 + size));
        }
        offset += 512 + Math.ceil(size / 512) * 512;
    }
    fs.writeFileSync(marker, "10.9.9\n", "utf8");
}

function sendJson(res, status, value) {
    const payload = JSON.stringify(value);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload)
    });
    res.end(payload);
}

function authorized(req) {
    return req.headers["x-novi-token"] === authToken;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.setEncoding("utf8");
        req.on("data", chunk => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                reject(new Error("Request body too large"));
                req.destroy();
            }
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}

function ensureInsideRoot(candidate) {
    const resolved = path.resolve(root, candidate);
    const relative = path.relative(root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Requested path is outside the Node workspace");
    }
    return resolved;
}

async function runNode(args, cwd) {
    const started = Date.now();
    let stdout = "";
    let stderr = "";

    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    const originalExit = process.exit;
    const originalExitCode = process.exitCode;
    const originalArgv = process.argv.slice();

    const push = (target, values) => {
        target === "stdout"
            ? (stdout += util.format(...values) + "\n")
            : (stderr += util.format(...values) + "\n");
    };

    try {
        process.chdir(cwd);
        process.exitCode = 0;
        process.stdout.write = (chunk, encoding, callback) => {
            stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk, encoding).toString();
            if (typeof callback === "function") callback();
            return true;
        };
        process.stderr.write = (chunk, encoding, callback) => {
            stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk, encoding).toString();
            if (typeof callback === "function") callback();
            return true;
        };
        process.exit = code => {
            process.exitCode = code ?? 0;
            if (process.exitCode !== 0) throw new Error(`process.exit(${process.exitCode}) was requested by the script`);
        };

        if (args[0] === "--version" || args[0] === "-v" || args.length === 0) {
            stdout += `${process.version}\n`;
            return { exitCode: process.exitCode ?? 0, stdout, stderr, durationMs: Date.now() - started };
        }

        if (args[0] === "-e" || args[0] === "--eval") {
            const source = args.slice(1).join(" ");
            const filename = path.join(root, "<node-eval>.js");
            const sandboxModule = new Module(filename, module);
            sandboxModule.filename = filename;
            sandboxModule.paths = Module._nodeModulePaths(root);
            const localRequire = Module.createRequire(filename);
            const wrapped = vm.runInThisContext(Module.wrap(source), { filename });
            wrapped(sandboxModule.exports, localRequire, sandboxModule, filename, root);
            return { exitCode: process.exitCode ?? 0, stdout, stderr, durationMs: Date.now() - started };
        }

        const script = ensureInsideRoot(args[0]);
        if (!fs.existsSync(script)) {
            throw new Error(`Node script not found: ${args[0]}`);
        }

        process.argv = [process.argv[0], script, ...args.slice(1)];
        delete require.cache[require.resolve(script)];
        const localRequire = Module.createRequire(script);
        await localRequire(script);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (script.includes("/node_modules/npm/") && !stderr &&
            (stdout.trim() === "10.9.9" || stdout.includes("Usage:"))) {
            process.exitCode = 0;
        }

        return { exitCode: process.exitCode ?? 0, stdout, stderr, durationMs: Date.now() - started };
    } catch (error) {
        const message = error && error.stack ? error.stack : String(error);
        stderr += message.endsWith("\n") ? message : `${message}\n`;
        return { exitCode: 1, stdout, stderr, durationMs: Date.now() - started };
    } finally {
        process.argv = originalArgv;
        console.log = originalLog;
        console.info = originalInfo;
        console.warn = originalWarn;
        console.error = originalError;
        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
        process.exit = originalExit;
        process.exitCode = originalExitCode;
        process.chdir(root);
    }
}

const server = http.createServer(async (req, res) => {
    if (!authorized(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
    }

    try {
        if (req.url === "/health" && req.method === "GET") {
            sendJson(res, 200, { ready: true, version: process.version, pid: process.pid });
            return;
        }

        if (req.url === "/command" && req.method === "POST") {
            const body = JSON.parse(await readBody(req));
            if (body.command !== "node") {
                sendJson(res, 400, { error: "Only the controlled Node command is available in this bridge" });
                return;
            }
            const args = Array.isArray(body.args) ? body.args.map(String) : [];
            const cwd = ensureInsideRoot(typeof body.cwd === "string" ? body.cwd : ".");
            const result = await runNode(args, cwd);
            sendJson(res, 200, result);
            return;
        }

        if (req.url === "/shutdown" && req.method === "POST") {
            sendJson(res, 200, { ok: true });
            setImmediate(() => server.close(() => process.exitCode = 0));
            return;
        }

        sendJson(res, 404, { error: "Not found" });
    } catch (error) {
        sendJson(res, 500, { error: error && error.message ? error.message : String(error) });
    }
});

try {
    ensureNpm();
} catch (error) {
    fs.writeFileSync(readyPath, JSON.stringify({ ready: false, error: error.message }), "utf8");
    throw error;
}

server.on("error", error => {
    try {
        fs.writeFileSync(readyPath, JSON.stringify({ ready: false, error: error.message }), "utf8");
    } catch (_) {}
    process.exitCode = 1;
});

server.listen(requestedPort, "127.0.0.1", () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : requestedPort;
    fs.writeFileSync(
        readyPath,
        JSON.stringify({ ready: true, version: process.version, port: actualPort }),
        "utf8"
    );
    console.log(`Novi Studio embedded Node.js ${process.version} ready on 127.0.0.1:${actualPort}`);
});
