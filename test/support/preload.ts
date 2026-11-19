import { afterEach, setDefaultTimeout } from "bun:test";
import { closeLeftoverServers } from "./harness";

// e2e tests spawn a server and wait for it to own the lease; under load that takes more than bun's 5 s default.
setDefaultTimeout(30_000);
// a test that timed out may leave its server running: close it here, so the next test starts clean
afterEach(closeLeftoverServers);
