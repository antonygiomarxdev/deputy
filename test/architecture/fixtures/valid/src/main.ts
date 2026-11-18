import { Repo } from "./inbox/adapters/repo";
import { server } from "./composition/server";
export const m = [new Repo(), server];
