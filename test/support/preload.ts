import { afterEach } from "bun:test";
import { closeLeftoverServers } from "./harness";

// a test that timed out may leave its server running: close it here, so the next test starts clean
afterEach(closeLeftoverServers);
