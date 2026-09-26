import { createHandler } from "../_lib/http";
import { listPackages } from "../_lib/packages";

export default createHandler("GET", async () => listPackages());
