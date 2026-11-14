import fs from "node:fs/promises";

// Free disk space changes between processes. Freeze only this observation for parity.
const statfs = fs.statfs.bind(fs);
fs.statfs = async (...args) => ({ ...await statfs(...args), bavail: 1024 });
